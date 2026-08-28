const CHUNK_SIZE = 16
const AIR_TYPES = new Set(['air', 'cave_air', 'void_air'])

function analyzeColumn(rawMap, x, z) {
    if (!rawMap || typeof rawMap.getChunk !== 'function' || typeof rawMap.getBlock !== 'function') {
        throw new Error('Surface analyzer需要有效的Raw World Map')
    }

    const blockX = Math.floor(x)
    const blockZ = Math.floor(z)
    const chunkX = Math.floor(blockX / CHUNK_SIZE)
    const chunkZ = Math.floor(blockZ / CHUNK_SIZE)
    const chunk = rawMap.getChunk(chunkX, chunkZ)

    if (!chunk) {
        return { observed: false, top: null }
    }

    const localX = blockX - chunkX * CHUNK_SIZE
    const localZ = blockZ - chunkZ * CHUNK_SIZE
    let observed = false
    let top = null

    for (const key of Object.keys(chunk.blocks || {})) {
        const [entryX, y, entryZ] = key.split(',').map(Number)

        if (entryX !== localX || entryZ !== localZ || !Number.isFinite(y)) {
            continue
        }

        const block = rawMap.getBlock(blockX, y, blockZ)
        if (!block || block.state === 'UNKNOWN') {
            continue
        }

        observed = true

        if (block.state === 'AIR' || AIR_TYPES.has(block.type)) {
            continue
        }

        if (!top || y > top.y) {
            top = {
                x: blockX,
                y,
                z: blockZ,
                block: block.type
            }
        }
    }

    return { observed, top }
}

module.exports = {
    analyzeColumn
}
