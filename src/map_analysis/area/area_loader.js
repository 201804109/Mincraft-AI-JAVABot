const surfaceMap = require('../surface/map')
const surfaceStorage = require('../surface/storage')

const CHUNK_SIZE = 16

function loadArea(bounds) {
    const normalizedBounds = validateBounds(bounds)
    const chunks = loadIntersectingChunks(normalizedBounds)
    const columns = {}

    for (let z = normalizedBounds.minZ; z <= normalizedBounds.maxZ; z++) {
        for (let x = normalizedBounds.minX; x <= normalizedBounds.maxX; x++) {
            const chunkX = toChunkCoordinate(x)
            const chunkZ = toChunkCoordinate(z)
            const chunk = chunks.get(chunkKey(chunkX, chunkZ))
            columns[columnKey(x, z)] = readColumn(chunk, x, z, chunkX, chunkZ)
        }
    }

    return {
        bounds: normalizedBounds,
        width: normalizedBounds.maxX - normalizedBounds.minX + 1,
        depth: normalizedBounds.maxZ - normalizedBounds.minZ + 1,
        columns
    }
}

function loadIntersectingChunks(bounds) {
    const chunks = new Map()
    const minChunkX = toChunkCoordinate(bounds.minX)
    const maxChunkX = toChunkCoordinate(bounds.maxX)
    const minChunkZ = toChunkCoordinate(bounds.minZ)
    const maxChunkZ = toChunkCoordinate(bounds.maxZ)

    for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ++) {
        for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            let chunk = null

            try {
                chunk = surfaceMap.getChunk(chunkX, chunkZ)
                if (!chunk) {
                    chunk = surfaceStorage.loadChunk(chunkX, chunkZ)
                }
            } catch (error) {
                console.error(`[area-loader] failed to load surface chunk ${chunkX}_${chunkZ}:`, error)
            }

            chunks.set(chunkKey(chunkX, chunkZ), chunk)
        }
    }

    return chunks
}

function readColumn(chunk, x, z, chunkX, chunkZ) {
    if (!chunk || !chunk.columns || typeof chunk.columns !== 'object') {
        return unknownColumn()
    }

    const localX = x - chunkX * CHUNK_SIZE
    const localZ = z - chunkZ * CHUNK_SIZE
    const column = chunk.columns[`${localX},${localZ}`]

    if (!column || column.observed !== true) {
        return unknownColumn()
    }

    if (column.top === null) {
        return { observed: true, top: null }
    }

    return {
        observed: true,
        top: {
            x,
            y: column.top.y,
            z,
            block: column.top.block
        }
    }
}

function validateBounds(bounds) {
    if (!bounds || typeof bounds !== 'object') {
        throw new Error('Area bounds必须是对象')
    }

    const { minX, maxX, minZ, maxZ } = bounds
    if (![minX, maxX, minZ, maxZ].every(Number.isInteger)) {
        throw new Error('Area bounds必须是整数坐标')
    }

    if (minX > maxX || minZ > maxZ) {
        throw new Error('Area bounds最小坐标不能大于最大坐标')
    }

    return { minX, maxX, minZ, maxZ }
}

function unknownColumn() {
    return { observed: false, top: null }
}

function toChunkCoordinate(value) {
    return Math.floor(value / CHUNK_SIZE)
}

function chunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`
}

function columnKey(x, z) {
    return `${x},${z}`
}

module.exports = {
    loadArea
}
