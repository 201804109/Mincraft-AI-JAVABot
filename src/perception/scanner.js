const Vec3 = require('vec3')
const worldMap = require('./map')
const storage = require('./storage')

const MOVE_THRESHOLD = 8
const CLEANUP_INTERVAL = 5 * 60 * 1000
const CORRECTION_RADIUS = 8
const CORRECTION_INTERVAL = 5000

let bot = null
let scanTimer = null
let correctionTimer = null
let cleanupTimer = null
let lastScanPosition = null

function init(_bot) {
    bot = _bot
    lastScanPosition = null
}

// 保持原扫描数据结构不变。
function scan(radius) {
    if (!bot) {
        console.log('Bot未初始化')
        return null
    }

    if (!Number.isInteger(radius) || radius < 0) {
        throw new Error('扫描半径必须是非负整数')
    }

    const center = bot.entity.position.floored()
    const blocks = []

    for (let x = center.x - radius; x <= center.x + radius; x++) {
        for (let y = center.y - radius; y <= center.y + radius; y++) {
            for (let z = center.z - radius; z <= center.z + radius; z++) {
                const block = bot.blockAt(new Vec3(x, y, z))

                if (block) {
                    blocks.push({ x, y, z, type: block.name })
                }
            }
        }
    }

    const entities = Object.values(bot.entities).map(entity => ({
        id: entity.id,
        type: entity.type,
        name: entity.username || entity.name || null,
        position: {
            x: entity.position.x,
            y: entity.position.y,
            z: entity.position.z
        }
    }))

    return {
        position: {
            x: bot.entity.position.x,
            y: bot.entity.position.y,
            z: bot.entity.position.z
        },
        blocks,
        entities
    }
}

function start(radius = 16, interval = 2000) {
    stop()

    if (!bot) {
        console.log('Bot未初始化')
        return
    }

    storage.loadNearbyChunks(bot.entity.position, 128)
    updateLocalMap(radius)

    scanTimer = setInterval(() => {
        if (shouldScan(bot.entity.position)) {
            updateLocalMap(radius)
        }
    }, interval)

    correctionTimer = setInterval(() => {
        updateLocalMap(CORRECTION_RADIUS, false)
    }, CORRECTION_INTERVAL)

    cleanupTimer = setInterval(() => {
        const removed = worldMap.cleanup(bot.entity.position)
        for (const { chunkX, chunkZ } of removed) {
            storage.deleteChunk(chunkX, chunkZ)
        }
    }, CLEANUP_INTERVAL)

    console.log('[scanner] scan started')
}

function stop() {
    if (scanTimer !== null) {
        clearInterval(scanTimer)
        scanTimer = null
    }

    if (correctionTimer !== null) {
        clearInterval(correctionTimer)
        correctionTimer = null
    }

    if (cleanupTimer !== null) {
        clearInterval(cleanupTimer)
        cleanupTimer = null
    }
}

function shouldScan(position) {
    return lastScanPosition === null || position.distanceTo(lastScanPosition) > MOVE_THRESHOLD
}

function updateLocalMap(radius, updateScanPosition = true) {
    const data = scan(radius)
    if (!data) {
        return
    }

    const touchedChunks = new Set()

    for (const block of data.blocks) {
        worldMap.updateBlock(block.x, block.y, block.z, block.type)
        touchedChunks.add(`${Math.floor(block.x / 16)},${Math.floor(block.z / 16)}`)
    }

    for (const key of touchedChunks) {
        const [chunkX, chunkZ] = key.split(',').map(Number)
        storage.saveChunk(chunkX, chunkZ)
    }

    if (updateScanPosition) {
        lastScanPosition = bot.entity.position.clone()
    }
    console.log('[scanner] map updated')
}

function scanAt(position, radius) {
    if (!bot) {
        console.log('Bot未初始化')
        return null
    }

    if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) {
        throw new Error('扫描中心必须是有效坐标')
    }

    if (!Number.isInteger(radius) || radius < 0) {
        throw new Error('扫描半径必须是非负整数')
    }

    const center = new Vec3(
        Math.floor(position.x),
        Math.floor(position.y),
        Math.floor(position.z)
    )
    const blocks = []
    const touchedChunks = new Set()

    for (let x = center.x - radius; x <= center.x + radius; x++) {
        for (let y = center.y - radius; y <= center.y + radius; y++) {
            for (let z = center.z - radius; z <= center.z + radius; z++) {
                const block = bot.blockAt(new Vec3(x, y, z))

                if (block) {
                    const blockData = { x, y, z, type: block.name }
                    blocks.push(blockData)
                    worldMap.updateBlock(blockData.x, blockData.y, blockData.z, blockData.type)
                    touchedChunks.add(`${Math.floor(x / 16)},${Math.floor(z / 16)}`)
                }
            }
        }
    }

    for (const key of touchedChunks) {
        const [chunkX, chunkZ] = key.split(',').map(Number)
        storage.saveChunk(chunkX, chunkZ)
    }

    console.log('[scanner] area map updated')
    return {
        position: { x: center.x, y: center.y, z: center.z },
        blocks
    }
}

module.exports = {
    init,
    scan,
    scanAt,
    start,
    stop
}
