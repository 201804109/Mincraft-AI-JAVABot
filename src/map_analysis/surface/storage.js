const fs = require('fs')
const path = require('path')

const surfaceDirectory = path.join(__dirname, '../../../maps/surface')
const FORMAT_VERSION = 2
const CHUNK_SIZE = 16
let tempFileSequence = 0

function saveChunk(chunkX, chunkZ, chunk) {
    const finalPath = getChunkPath(chunkX, chunkZ)
    let tempPath = null

    try {
        fs.mkdirSync(surfaceDirectory, { recursive: true })
        tempPath = getTempChunkPath(finalPath)
        fs.writeFileSync(tempPath, JSON.stringify(encodeChunk(chunk)), 'utf8')
        fs.renameSync(tempPath, finalPath)
        return true
    } catch (error) {
        cleanupTempFile(tempPath)
        logStorageError('save', chunkX, chunkZ, error)
        return false
    }
}

function loadChunks() {
    const chunks = []

    try {
        if (!fs.existsSync(surfaceDirectory)) {
            return chunks
        }

        for (const fileName of fs.readdirSync(surfaceDirectory)) {
            const match = /^(-?\d+)_(-?\d+)\.json$/.exec(fileName)
            if (!match) {
                continue
            }

            const chunkX = Number(match[1])
            const chunkZ = Number(match[2])
            const chunk = loadChunk(chunkX, chunkZ)
            if (chunk) {
                chunks.push(chunk)
            }
        }
    } catch (error) {
        console.error('[surface-storage] failed to list chunks:', error)
    }

    return chunks
}

function loadChunk(chunkX, chunkZ) {
    const file = getChunkPath(chunkX, chunkZ)

    try {
        if (!fs.existsSync(file)) {
            return null
        }

        const data = JSON.parse(fs.readFileSync(file, 'utf8'))
        return decodeChunk(data)
    } catch (error) {
        logStorageError('load', chunkX, chunkZ, error)
        return null
    }
}

function deleteChunk(chunkX, chunkZ) {
    const file = getChunkPath(chunkX, chunkZ)

    try {
        if (!fs.existsSync(file)) {
            return true
        }

        fs.unlinkSync(file)
        return true
    } catch (error) {
        logStorageError('delete', chunkX, chunkZ, error)
        return false
    }
}

function encodeChunk(chunk) {
    if (!chunk || !Number.isInteger(chunk.chunkX) || !Number.isInteger(chunk.chunkZ)) {
        throw new Error('Surface chunk坐标无效')
    }

    const columns = {}
    const keys = Object.keys(chunk.columns || {})
        .filter(key => parseLocalKey(key) !== null)
        .sort(compareColumnKeys)

    for (const key of keys) {
        const local = parseLocalKey(key)
        const column = chunk.columns[key]

        if (!column || column.observed !== true) {
            continue
        }

        const encodedKey = `${local.localX},${local.localZ}`

        if (column.top === null) {
            columns[encodedKey] = null
            continue
        }

        if (isValidTop(column.top)) {
            columns[encodedKey] = [column.top.y, column.top.block]
        }
    }

    return {
        formatVersion: FORMAT_VERSION,
        chunkX: chunk.chunkX,
        chunkZ: chunk.chunkZ,
        columns
    }
}

function decodeChunk(data) {
    if (
        !data ||
        !Number.isInteger(data.chunkX) ||
        !Number.isInteger(data.chunkZ) ||
        !data.columns ||
        typeof data.columns !== 'object' ||
        Array.isArray(data.columns)
    ) {
        throw new Error('Surface chunk格式无效')
    }

    if (data.formatVersion !== undefined && data.formatVersion !== FORMAT_VERSION) {
        throw new Error(`不支持的Surface chunk格式版本: ${data.formatVersion}`)
    }

    const columns = {}

    for (const [key, value] of Object.entries(data.columns)) {
        const local = parseLocalKey(key)
        if (!local) {
            continue
        }

        const decoded = decodeColumn(
            value,
            data.chunkX * CHUNK_SIZE + local.localX,
            data.chunkZ * CHUNK_SIZE + local.localZ
        )

        if (decoded) {
            columns[`${local.localX},${local.localZ}`] = decoded
        }
    }

    return {
        chunkX: data.chunkX,
        chunkZ: data.chunkZ,
        columns
    }
}

function decodeColumn(value, x, z) {
    if (value === null) {
        return { observed: true, top: null }
    }

    if (
        Array.isArray(value) &&
        value.length === 2 &&
        Number.isInteger(value[0]) &&
        isNonEmptyString(value[1])
    ) {
        return {
            observed: true,
            top: { x, y: value[0], z, block: value[1] }
        }
    }

    if (!value || Array.isArray(value) || typeof value !== 'object' || value.observed !== true) {
        return null
    }

    if (value.top === null) {
        return { observed: true, top: null }
    }

    if (!isValidTop(value.top)) {
        return null
    }

    return {
        observed: true,
        top: { x, y: value.top.y, z, block: value.top.block }
    }
}

function parseLocalKey(key) {
    const match = /^(\d+),(\d+)$/.exec(key)
    if (!match) {
        return null
    }

    const localX = Number(match[1])
    const localZ = Number(match[2])

    if (localX < 0 || localX >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE) {
        return null
    }

    return { localX, localZ }
}

function compareColumnKeys(left, right) {
    const leftLocal = parseLocalKey(left)
    const rightLocal = parseLocalKey(right)
    return leftLocal.localX - rightLocal.localX || leftLocal.localZ - rightLocal.localZ
}

function isValidTop(top) {
    return top && Number.isInteger(top.y) && isNonEmptyString(top.block)
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0
}

function getChunkPath(chunkX, chunkZ) {
    return path.join(surfaceDirectory, `${chunkX}_${chunkZ}.json`)
}

function getTempChunkPath(finalPath) {
    tempFileSequence++
    return `${finalPath}.${process.pid}.${Date.now()}.${tempFileSequence}.tmp`
}

function cleanupTempFile(tempPath) {
    if (!tempPath) {
        return
    }

    try {
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath)
        }
    } catch (_) {
        // Surface临时文件清理失败不能影响Bot运行。
    }
}

function logStorageError(operation, chunkX, chunkZ, error) {
    console.error(
        `[surface-storage] failed to ${operation} chunk ${chunkX}_${chunkZ}:`,
        error?.code ?? 'UNKNOWN',
        error?.message ?? String(error)
    )
}

module.exports = {
    saveChunk,
    loadChunks,
    loadChunk,
    deleteChunk,
    encodeChunk,
    decodeChunk
}
