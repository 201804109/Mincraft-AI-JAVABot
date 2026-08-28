const fs = require('fs')
const path = require('path')

const chunksDirectory = path.join(__dirname, '../../maps/chunks')
const CHUNK_SAVE_COOLDOWN_MS = 10000
const lastSavedAt = new Map()
let tempFileSequence = 0

function saveChunk(chunkX, chunkZ) {
    const worldMap = require('./map')
    const chunk = worldMap.getChunk(chunkX, chunkZ)

    if (!chunk) {
        return false
    }

    const key = chunkKey(chunkX, chunkZ)
    const now = Date.now()
    const lastSaved = lastSavedAt.get(key)

    if (
        lastSaved !== undefined &&
        now - lastSaved < CHUNK_SAVE_COOLDOWN_MS
    ) {
        return true
    }

    const finalPath = getChunkPath(chunkX, chunkZ)
    let tempPath = null

    try {
        fs.mkdirSync(chunksDirectory, { recursive: true })
        tempPath = getTempChunkPath(finalPath)
        fs.writeFileSync(tempPath, JSON.stringify(chunk), 'utf8')
        fs.renameSync(tempPath, finalPath)
        lastSavedAt.set(key, Date.now())
        return true
    } catch (error) {
        cleanupTempFile(tempPath)
        logStorageError('save', chunkX, chunkZ, error)
        return false
    }
}

function loadChunk(chunkX, chunkZ) {
    const file = getChunkPath(chunkX, chunkZ)

    try {
        if (!fs.existsSync(file)) {
            return null
        }

        return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
        logStorageError('load', chunkX, chunkZ, error)
        return null
    }
}

function deleteChunk(chunkX, chunkZ) {
    const file = getChunkPath(chunkX, chunkZ)

    try {
        if (!fs.existsSync(file)) {
            return false
        }

        fs.unlinkSync(file)
        lastSavedAt.delete(chunkKey(chunkX, chunkZ))
        return true
    } catch (error) {
        logStorageError('delete', chunkX, chunkZ, error)
        return false
    }
}

function loadNearbyChunks(position, radius = 128) {
    const worldMap = require('./map')
    const minChunkX = Math.floor((position.x - radius) / 16)
    const maxChunkX = Math.floor((position.x + radius) / 16)
    const minChunkZ = Math.floor((position.z - radius) / 16)
    const maxChunkZ = Math.floor((position.z + radius) / 16)

    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
        for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ++) {
            const data = loadChunk(chunkX, chunkZ)
            if (data) {
                worldMap.updateChunk(chunkX, chunkZ, data)
            }
        }
    }
}

// 旧启动代码兼容：不再一次性读取整张世界地图。
function load() {
    return {}
}

function save() {
    // 大地图不再保存为单个 JSON；由 saveChunk() 分块保存。
}

function getChunkPath(chunkX, chunkZ) {
    return path.join(chunksDirectory, `${chunkX}_${chunkZ}.json`)
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
        // 临时文件清理失败不能影响Bot运行。
    }
}

function logStorageError(operation, chunkX, chunkZ, error) {
    console.error(
        `[storage] failed to ${operation} chunk ${chunkX}_${chunkZ}:`,
        error?.code ?? 'UNKNOWN',
        error?.message ?? String(error)
    )
}

function chunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`
}

module.exports = {
    saveChunk,
    loadChunk,
    deleteChunk,
    loadNearbyChunks,
    save,
    load
}
