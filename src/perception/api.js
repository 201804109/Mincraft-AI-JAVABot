const worldMap = require('./map')

const MAX_VOLUME_BLOCKS = 32768

function getBlock(x, y, z) {
    validateCoordinate(x, 'x')
    validateCoordinate(y, 'y')
    validateCoordinate(z, 'z')

    const block = worldMap.getBlock(x, y, z)
    const position = { x, y, z }

    if (!block || block.state === 'UNKNOWN') {
        return {
            observed: false,
            position,
            block: null
        }
    }

    return {
        observed: true,
        position,
        block: {
            type: block.type,
            state: block.state
        },
        lastSeen: block.lastSeen,
        confidence: block.confidence
    }
}

function getVolume(bounds) {
    const normalizedBounds = validateBounds(bounds)
    const totalBlocks = calculateVolume(normalizedBounds)

    if (totalBlocks > MAX_VOLUME_BLOCKS) {
        throw createApiError(
            'VOLUME_LIMIT_EXCEEDED',
            `Volume最多允许查询${MAX_VOLUME_BLOCKS}个方块`
        )
    }

    const blocks = []
    let unknownCount = 0
    let airCount = 0

    for (let x = normalizedBounds.minX; x <= normalizedBounds.maxX; x++) {
        for (let y = normalizedBounds.minY; y <= normalizedBounds.maxY; y++) {
            for (let z = normalizedBounds.minZ; z <= normalizedBounds.maxZ; z++) {
                const result = getBlock(x, y, z)

                if (!result.observed) {
                    unknownCount++
                    continue
                }

                if (result.block.state === 'AIR') {
                    airCount++
                    continue
                }

                blocks.push({
                    x,
                    y,
                    z,
                    type: result.block.type,
                    state: result.block.state,
                    lastSeen: result.lastSeen,
                    confidence: result.confidence
                })
            }
        }
    }

    return {
        bounds: normalizedBounds,
        coverage: (totalBlocks - unknownCount) / totalBlocks,
        blocks,
        unknownCount,
        airCount
    }
}

function getSurroundings(bot, options) {
    if (
        !bot ||
        !bot.entity ||
        !bot.entity.position ||
        ![bot.entity.position.x, bot.entity.position.y, bot.entity.position.z]
            .every(Number.isFinite)
    ) {
        throw createApiError('BOT_NOT_AVAILABLE', 'Bot位置不可用')
    }

    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw createApiError('INVALID_ARGUMENT', 'Surroundings options必须是对象')
    }

    const horizontalRadius = options.horizontalRadius
    const verticalRadius = options.verticalRadius

    validateRadius(horizontalRadius, 'horizontalRadius')
    validateRadius(verticalRadius, 'verticalRadius')

    const center = {
        x: Math.floor(bot.entity.position.x),
        y: Math.floor(bot.entity.position.y),
        z: Math.floor(bot.entity.position.z)
    }
    const volume = getVolume({
        minX: center.x - horizontalRadius,
        maxX: center.x + horizontalRadius,
        minY: center.y - verticalRadius,
        maxY: center.y + verticalRadius,
        minZ: center.z - horizontalRadius,
        maxZ: center.z + horizontalRadius
    })

    return {
        center,
        bounds: volume.bounds,
        coverage: volume.coverage,
        blocks: volume.blocks,
        unknownCount: volume.unknownCount
    }
}

function validateBounds(bounds) {
    if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds)) {
        throw createApiError('INVALID_ARGUMENT', 'Volume bounds必须是对象')
    }

    const normalizedBounds = {
        minX: bounds.minX,
        maxX: bounds.maxX,
        minY: bounds.minY,
        maxY: bounds.maxY,
        minZ: bounds.minZ,
        maxZ: bounds.maxZ
    }

    for (const [name, value] of Object.entries(normalizedBounds)) {
        validateCoordinate(value, name)
    }

    if (
        normalizedBounds.minX > normalizedBounds.maxX ||
        normalizedBounds.minY > normalizedBounds.maxY ||
        normalizedBounds.minZ > normalizedBounds.maxZ
    ) {
        throw createApiError(
            'INVALID_ARGUMENT',
            'Volume bounds最小坐标不能大于最大坐标'
        )
    }

    return normalizedBounds
}

function calculateVolume(bounds) {
    const width = bounds.maxX - bounds.minX + 1
    const height = bounds.maxY - bounds.minY + 1
    const depth = bounds.maxZ - bounds.minZ + 1
    return width * height * depth
}

function validateCoordinate(value, name) {
    if (!Number.isInteger(value)) {
        throw createApiError('INVALID_ARGUMENT', `${name}必须是整数坐标`)
    }
}

function validateRadius(value, name) {
    if (!Number.isInteger(value) || value < 0) {
        throw createApiError(
            'INVALID_ARGUMENT',
            `${name}必须是非负整数`
        )
    }
}

function createApiError(code, message) {
    const error = new Error(message)
    error.code = code
    return error
}

module.exports = {
    MAX_VOLUME_BLOCKS,
    getBlock,
    getVolume,
    getSurroundings
}
