const { Vec3 } = require('vec3')

const AIR_BLOCK_NAMES = new Set(['air', 'cave_air', 'void_air'])

function verifyBrokenPositions(bot, positions) {
    validateInputs(bot, positions, 'positions')

    const verified = []
    const failed = []
    for (const position of positions) {
        const actual = readBlockName(bot, position)
        const item = {
            position: { ...position },
            expected: 'air',
            actual: actual.name
        }

        if (!actual.available) {
            item.reason = 'WORLD_BLOCK_UNAVAILABLE'
            failed.push(item)
        } else if (isAir(actual.name)) {
            verified.push(item)
        } else {
            item.reason = 'BLOCK_NOT_BROKEN'
            failed.push(item)
        }
    }
    return { success: failed.length === 0, verified, failed }
}

function verifyPlacedBlocks(bot, blocks) {
    validateInputs(bot, blocks, 'blocks')

    const verified = []
    const failed = []
    for (const block of blocks) {
        const position = block.position
        const actual = readBlockName(bot, position)
        const item = {
            position: { ...position },
            expected: block.block,
            actual: actual.name
        }

        if (!actual.available) {
            item.reason = 'WORLD_BLOCK_UNAVAILABLE'
            failed.push(item)
        } else if (normalizeBlockName(actual.name) === normalizeBlockName(block.block)) {
            verified.push(item)
        } else {
            item.reason = 'BLOCK_MISMATCH'
            failed.push(item)
        }
    }
    return { success: failed.length === 0, verified, failed }
}

function validateInputs(bot, items, kind) {
    if (!bot || typeof bot.blockAt !== 'function') {
        const error = new TypeError('bot.blockAt must be available for verification.')
        error.code = 'BOT_NOT_AVAILABLE_FOR_VERIFICATION'
        throw error
    }
    if (!Array.isArray(items)) {
        throw new TypeError(`${kind} must be an array.`)
    }
    for (let index = 0; index < items.length; index++) {
        const item = items[index]
        const position = kind === 'positions' ? item : item && item.position
        if (!position || typeof position !== 'object' || Array.isArray(position) ||
            !['x', 'y', 'z'].every(axis => Number.isInteger(position[axis]))) {
            throw new TypeError(`${kind}[${index}] must have integer position coordinates.`)
        }
        if (kind === 'blocks' && (!item || typeof item.block !== 'string' || item.block.trim().length === 0)) {
            throw new TypeError(`blocks[${index}].block must be a non-empty string.`)
        }
    }
}

function readBlockName(bot, position) {
    try {
        const block = bot.blockAt(new Vec3(position.x, position.y, position.z))
        if (!block || typeof block.name !== 'string') return { available: false, name: null }
        return { available: true, name: block.name }
    } catch (_) {
        return { available: false, name: null }
    }
}

function isAir(name) {
    return AIR_BLOCK_NAMES.has(normalizeBlockName(name))
}

function normalizeBlockName(name) {
    return name.startsWith('minecraft:') ? name.slice('minecraft:'.length) : name
}

module.exports = {
    verifyBrokenPositions,
    verifyPlacedBlocks
}
