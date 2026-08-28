const { analyzeColumn } = require('./analyzer')
const storage = require('./storage')

const CHUNK_SIZE = 16
const COLUMN_FLUSH_DELAY_MS = 100
const CHUNK_SAVE_DELAY_MS = 250

let rawWorldMap = null
let chunks = new Map()
let dirtyColumns = new Set()
let dirtyChunks = new Set()
let columnFlushTimer = null
let chunkSaveTimer = null

function init(worldMap) {
    if (!worldMap || typeof worldMap.getChunk !== 'function' || typeof worldMap.getBlock !== 'function') {
        throw new Error('Surface Map需要有效的Raw World Map')
    }

    clearTimers()
    rawWorldMap = worldMap
    chunks = new Map()
    dirtyColumns = new Set()
    dirtyChunks = new Set()

    for (const chunk of storage.loadChunks()) {
        loadChunk(chunk)
    }
}

function updateColumn(x, z) {
    ensureInitialized()

    const blockX = Math.floor(x)
    const blockZ = Math.floor(z)
    const chunkX = toChunkCoordinate(blockX)
    const chunkZ = toChunkCoordinate(blockZ)
    const key = chunkKey(chunkX, chunkZ)
    const localKey = columnKey(blockX, blockZ, chunkX, chunkZ)
    const analysis = analyzeColumn(rawWorldMap, blockX, blockZ)
    let chunk = chunks.get(key)

    if (!analysis.observed) {
        if (!chunk || !Object.prototype.hasOwnProperty.call(chunk.columns, localKey)) {
            return analysis
        }

        delete chunk.columns[localKey]

        if (Object.keys(chunk.columns).length === 0) {
            chunks.delete(key)
            dirtyChunks.delete(key)
            storage.deleteChunk(chunkX, chunkZ)
        } else {
            markChunkForSave(chunkX, chunkZ)
        }

        return analysis
    }

    if (!chunk) {
        chunk = { chunkX, chunkZ, columns: {} }
        chunks.set(key, chunk)
    }

    const nextColumn = {
        observed: true,
        top: analysis.top
    }

    if (columnsEqual(chunk.columns[localKey], nextColumn)) {
        return analysis
    }

    chunk.columns[localKey] = nextColumn
    markChunkForSave(chunkX, chunkZ)
    return analysis
}

function getColumn(x, z) {
    const blockX = Math.floor(x)
    const blockZ = Math.floor(z)
    const chunkX = toChunkCoordinate(blockX)
    const chunkZ = toChunkCoordinate(blockZ)
    const chunk = chunks.get(chunkKey(chunkX, chunkZ))

    if (!chunk) {
        return { observed: false, top: null }
    }

    return chunk.columns[columnKey(blockX, blockZ, chunkX, chunkZ)] || {
        observed: false,
        top: null
    }
}

function getChunk(chunkX, chunkZ) {
    return chunks.get(chunkKey(chunkX, chunkZ)) || null
}

function markDirty(x, z) {
    const blockX = Math.floor(x)
    const blockZ = Math.floor(z)
    dirtyColumns.add(`${blockX},${blockZ}`)
    scheduleColumnFlush()
}

function markChunkDirty(chunkX, chunkZ) {
    ensureInitialized()

    const columns = new Set()
    const rawChunk = rawWorldMap.getChunk(chunkX, chunkZ)
    const surfaceChunk = getChunk(chunkX, chunkZ)

    for (const key of Object.keys(rawChunk?.blocks || {})) {
        const [localX, , localZ] = key.split(',').map(Number)
        if (Number.isInteger(localX) && Number.isInteger(localZ)) {
            columns.add(`${localX},${localZ}`)
        }
    }

    for (const key of Object.keys(surfaceChunk?.columns || {})) {
        columns.add(key)
    }

    for (const key of columns) {
        const [localX, localZ] = key.split(',').map(Number)
        markDirty(
            chunkX * CHUNK_SIZE + localX,
            chunkZ * CHUNK_SIZE + localZ
        )
    }
}

function flushDirty() {
    if (columnFlushTimer !== null) {
        clearTimeout(columnFlushTimer)
        columnFlushTimer = null
    }

    const pending = Array.from(dirtyColumns)
    dirtyColumns.clear()

    for (const key of pending) {
        const [x, z] = key.split(',').map(Number)

        try {
            updateColumn(x, z)
        } catch (error) {
            console.error(`[surface-map] failed to update column ${key}:`, error)
        }
    }
}

function removeChunk(chunkX, chunkZ) {
    const key = chunkKey(chunkX, chunkZ)
    chunks.delete(key)
    dirtyChunks.delete(key)

    for (const column of dirtyColumns) {
        const [x, z] = column.split(',').map(Number)
        if (toChunkCoordinate(x) === chunkX && toChunkCoordinate(z) === chunkZ) {
            dirtyColumns.delete(column)
        }
    }

    storage.deleteChunk(chunkX, chunkZ)
}

function loadChunk(data) {
    if (
        !data ||
        !Number.isInteger(data.chunkX) ||
        !Number.isInteger(data.chunkZ) ||
        !data.columns ||
        typeof data.columns !== 'object'
    ) {
        return
    }

    const columns = {}

    for (const [key, column] of Object.entries(data.columns)) {
        if (column?.observed === true) {
            columns[key] = {
                observed: true,
                top: column.top || null
            }
        }
    }

    if (Object.keys(columns).length > 0) {
        chunks.set(chunkKey(data.chunkX, data.chunkZ), {
            chunkX: data.chunkX,
            chunkZ: data.chunkZ,
            columns
        })
    }
}

function markChunkForSave(chunkX, chunkZ) {
    dirtyChunks.add(chunkKey(chunkX, chunkZ))

    if (chunkSaveTimer === null) {
        chunkSaveTimer = setTimeout(flushChunkSaves, CHUNK_SAVE_DELAY_MS)
    }
}

function flushChunkSaves() {
    chunkSaveTimer = null
    const pending = Array.from(dirtyChunks)
    dirtyChunks.clear()

    for (const key of pending) {
        const [chunkX, chunkZ] = key.split(',').map(Number)
        const chunk = getChunk(chunkX, chunkZ)

        if (chunk) {
            storage.saveChunk(chunkX, chunkZ, chunk)
        }
    }
}

function scheduleColumnFlush() {
    if (columnFlushTimer === null) {
        columnFlushTimer = setTimeout(flushDirty, COLUMN_FLUSH_DELAY_MS)
    }
}

function clearTimers() {
    if (columnFlushTimer !== null) {
        clearTimeout(columnFlushTimer)
        columnFlushTimer = null
    }

    if (chunkSaveTimer !== null) {
        clearTimeout(chunkSaveTimer)
        chunkSaveTimer = null
    }
}

function ensureInitialized() {
    if (!rawWorldMap) {
        throw new Error('Surface Map尚未初始化')
    }
}

function columnsEqual(left, right) {
    if (!left || left.observed !== right.observed) {
        return false
    }

    if (left.top === null || right.top === null) {
        return left.top === right.top
    }

    return (
        left.top.x === right.top.x &&
        left.top.y === right.top.y &&
        left.top.z === right.top.z &&
        left.top.block === right.top.block
    )
}

function toChunkCoordinate(value) {
    return Math.floor(Math.floor(value) / CHUNK_SIZE)
}

function chunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`
}

function columnKey(x, z, chunkX, chunkZ) {
    return `${x - chunkX * CHUNK_SIZE},${z - chunkZ * CHUNK_SIZE}`
}

module.exports = {
    init,
    updateColumn,
    getColumn,
    getChunk,
    markDirty,
    markChunkDirty,
    flushDirty,
    removeChunk
}
