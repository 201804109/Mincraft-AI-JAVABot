const CHUNK_SIZE = 16
const DEFAULT_EXPIRE_TIME = 30 * 60 * 1000
const AIR_TYPES = new Set(['air', 'cave_air', 'void_air'])
const blockChangedListeners = new Set()
const chunkChangedListeners = new Set()
const chunkRemovedListeners = new Set()

class ChunkMap {
    constructor(options = {}) {
        this.expireTime = options.expireTime ?? DEFAULT_EXPIRE_TIME
        this.chunks = new Map()
    }

    updateBlock(x, y, z, type) {
        const now = Date.now()
        const chunkX = toChunkCoordinate(x)
        const chunkZ = toChunkCoordinate(z)
        const chunk = this._ensureChunk(chunkX, chunkZ, now)
        const key = blockKey(x, y, z, chunkX, chunkZ)

        chunk.blocks[key] = {
            type,
            state: AIR_TYPES.has(type) ? 'AIR' : 'SOLID',
            lastSeen: now,
            confidence: 1
        }
        chunk.lastSeen = now
        chunk.lastAccess = now
        chunk.confidence = 1
        chunk.dirty = true
    }

    getBlock(x, y, z) {
        const chunkX = toChunkCoordinate(x)
        const chunkZ = toChunkCoordinate(z)
        const chunk = this.chunks.get(chunkKey(chunkX, chunkZ))

        if (!chunk) {
            return { state: 'UNKNOWN' }
        }

        chunk.lastAccess = Date.now()
        const key = blockKey(x, y, z, chunkX, chunkZ)
        const block = chunk.blocks[key]

        if (!block) {
            return { state: 'UNKNOWN' }
        }

        const confidence = calculateConfidence(block.lastSeen, this.expireTime)
        if (confidence <= 0) {
            delete chunk.blocks[key]
            return { state: 'UNKNOWN' }
        }

        return {
            ...block,
            confidence
        }
    }

    updateChunk(chunkX, chunkZ, data) {
        if (!data || typeof data !== 'object') {
            return
        }

        const now = Date.now()
        const blocks = {}

        for (const [key, block] of Object.entries(data.blocks || {})) {
            if (!block || typeof block !== 'object') {
                continue
            }

            const lastSeen = block.lastSeen ?? data.lastSeen ?? now
            const confidence = calculateConfidence(lastSeen, this.expireTime)
            if (confidence <= 0) {
                continue
            }

            blocks[key] = {
                type: block.type,
                state: block.state || (AIR_TYPES.has(block.type) ? 'AIR' : 'SOLID'),
                lastSeen,
                confidence
            }
        }

        this.chunks.set(chunkKey(chunkX, chunkZ), {
            blocks,
            lastSeen: data.lastSeen ?? now,
            lastAccess: now,
            confidence: calculateConfidence(data.lastSeen ?? now, this.expireTime),
            dirty: false
        })
    }

    removeChunk(chunkX, chunkZ) {
        return this.chunks.delete(chunkKey(chunkX, chunkZ))
    }

    getNearbyChunks(x, z, radius) {
        const nearby = []
        const minChunkX = toChunkCoordinate(x - radius)
        const maxChunkX = toChunkCoordinate(x + radius)
        const minChunkZ = toChunkCoordinate(z - radius)
        const maxChunkZ = toChunkCoordinate(z + radius)

        for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ++) {
                const chunk = this.chunks.get(chunkKey(chunkX, chunkZ))
                if (chunk) {
                    chunk.lastAccess = Date.now()
                    nearby.push({ chunkX, chunkZ, ...chunk })
                }
            }
        }

        return nearby
    }

    cleanup(position) {
        const now = Date.now()
        const removed = []

        // 只遍历 chunk 索引，不扫描所有 voxel。
        for (const [key, chunk] of this.chunks) {
            const [chunkX, chunkZ] = key.split(',').map(Number)
            const distance = distanceToChunk(position.x, position.z, chunkX, chunkZ)
            const lastUsed = Math.max(chunk.lastSeen || 0, chunk.lastAccess || 0)

            if (distance > 512 && now - lastUsed > this.expireTime) {
                this.chunks.delete(key)
                removed.push({ chunkX, chunkZ })
            }
        }

        return removed
    }

    getChunk(chunkX, chunkZ) {
        return this.chunks.get(chunkKey(chunkX, chunkZ))
    }

    clear() {
        this.chunks.clear()
    }

    _ensureChunk(chunkX, chunkZ, now) {
        const key = chunkKey(chunkX, chunkZ)
        let chunk = this.chunks.get(key)

        if (!chunk) {
            chunk = {
                blocks: {},
                lastSeen: now,
                lastAccess: now,
                confidence: 1,
                dirty: false
            }
            this.chunks.set(key, chunk)
        }

        return chunk
    }
}

let chunkMap = new ChunkMap()

function init(options = {}) {
    chunkMap = new ChunkMap(options)
}

function updateBlock(x, y, z, type) {
    chunkMap.updateBlock(x, y, z, type)
    notifyListeners(blockChangedListeners, {
        x: Math.floor(x),
        y: Math.floor(y),
        z: Math.floor(z),
        type
    })
}

function getBlock(x, y, z) {
    return chunkMap.getBlock(x, y, z)
}

function updateChunk(chunkX, chunkZ, data) {
    if (!data || typeof data !== 'object') {
        return
    }

    chunkMap.updateChunk(chunkX, chunkZ, data)
    notifyListeners(chunkChangedListeners, { chunkX, chunkZ })
}

function removeChunk(chunkX, chunkZ) {
    const removed = chunkMap.removeChunk(chunkX, chunkZ)

    if (removed) {
        notifyListeners(chunkRemovedListeners, { chunkX, chunkZ })
    }

    return removed
}

function getNearbyChunks(x, z, radius) {
    return chunkMap.getNearbyChunks(x, z, radius)
}

function cleanup(position) {
    const removed = chunkMap.cleanup(position)

    for (const chunk of removed) {
        notifyListeners(chunkRemovedListeners, chunk)
    }

    return removed
}

function getChunk(chunkX, chunkZ) {
    return chunkMap.getChunk(chunkX, chunkZ)
}

// 兼容旧调用：扫描数据仍可批量写入，但内部逐 block 分 chunk 更新。
function update(scanData) {
    for (const block of scanData?.blocks || []) {
        updateBlock(block.x, block.y, block.z, block.type)
    }
}

function getArea(center, radius) {
    const result = []

    for (const chunk of getNearbyChunks(center.x, center.z, radius)) {
        for (const [key, block] of Object.entries(chunk.blocks)) {
            const [localX, y, localZ] = key.split(',').map(Number)
            const x = chunk.chunkX * CHUNK_SIZE + localX
            const z = chunk.chunkZ * CHUNK_SIZE + localZ

            if (
                Math.abs(x - center.x) <= radius &&
                Math.abs(y - center.y) <= radius &&
                Math.abs(z - center.z) <= radius
            ) {
                const current = getBlock(x, y, z)
                if (current.state !== 'UNKNOWN') {
                    result.push({ x, y, z, ...current })
                }
            }
        }
    }

    return result
}

function getMap() {
    return Object.fromEntries(chunkMap.chunks)
}

function onBlockChanged(listener) {
    return addListener(blockChangedListeners, listener)
}

function onChunkChanged(listener) {
    return addListener(chunkChangedListeners, listener)
}

function onChunkRemoved(listener) {
    return addListener(chunkRemovedListeners, listener)
}

function loadMap(data) {
    chunkMap.clear()

    for (const [key, value] of Object.entries(data || {})) {
        if (value?.blocks) {
            const [chunkX, chunkZ] = key.split(',').map(Number)
            updateChunk(chunkX, chunkZ, value)
            continue
        }

        // 一次性兼容旧的 "x,y,z" 数据。
        const [x, y, z] = key.split(',').map(Number)
        if ([x, y, z].every(Number.isFinite) && value?.type) {
            updateBlock(x, y, z, value.type)
        }
    }
}

function toChunkCoordinate(value) {
    return Math.floor(Math.floor(value) / CHUNK_SIZE)
}

function chunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`
}

function blockKey(x, y, z, chunkX, chunkZ) {
    const blockX = Math.floor(x)
    const blockY = Math.floor(y)
    const blockZ = Math.floor(z)
    return `${blockX - chunkX * CHUNK_SIZE},${blockY},${blockZ - chunkZ * CHUNK_SIZE}`
}

function calculateConfidence(lastSeen, expireTime) {
    return Math.max(0, 1 - (Date.now() - lastSeen) / expireTime)
}

function distanceToChunk(x, z, chunkX, chunkZ) {
    const minX = chunkX * CHUNK_SIZE
    const maxX = minX + CHUNK_SIZE - 1
    const minZ = chunkZ * CHUNK_SIZE
    const maxZ = minZ + CHUNK_SIZE - 1
    const dx = Math.max(minX - x, 0, x - maxX)
    const dz = Math.max(minZ - z, 0, z - maxZ)
    return Math.sqrt(dx * dx + dz * dz)
}

function addListener(listeners, listener) {
    if (typeof listener !== 'function') {
        throw new Error('World Map listener必须是函数')
    }

    listeners.add(listener)
    return () => listeners.delete(listener)
}

function notifyListeners(listeners, change) {
    for (const listener of listeners) {
        try {
            listener(change)
        } catch (error) {
            console.error('[world-map] change listener failed:', error)
        }
    }
}

module.exports = {
    ChunkMap,
    init,
    updateBlock,
    getBlock,
    updateChunk,
    removeChunk,
    getNearbyChunks,
    cleanup,
    getChunk,
    update,
    getArea,
    getMap,
    loadMap,
    onBlockChanged,
    onChunkChanged,
    onChunkRemoved
}
