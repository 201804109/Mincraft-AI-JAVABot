const fs = require('fs')
const path = require('path')

const chunksDirectory = path.join(__dirname, '../../maps/chunks')

function saveChunk(chunkX, chunkZ) {
    const worldMap = require('./map')
    const chunk = worldMap.getChunk(chunkX, chunkZ)

    if (!chunk) {
        return false
    }

    fs.mkdirSync(chunksDirectory, { recursive: true })
    fs.writeFileSync(
        getChunkPath(chunkX, chunkZ),
        JSON.stringify(chunk, null, 2),
        'utf8'
    )
    return true
}

function loadChunk(chunkX, chunkZ) {
    const file = getChunkPath(chunkX, chunkZ)

    if (!fs.existsSync(file)) {
        return null
    }

    return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function deleteChunk(chunkX, chunkZ) {
    const file = getChunkPath(chunkX, chunkZ)

    if (!fs.existsSync(file)) {
        return false
    }

    fs.unlinkSync(file)
    return true
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

module.exports = {
    saveChunk,
    loadChunk,
    deleteChunk,
    loadNearbyChunks,
    save,
    load
}
