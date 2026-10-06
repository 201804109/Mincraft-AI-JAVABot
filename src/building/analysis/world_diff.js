const { Vec3 } = require('vec3')

const AIR_BLOCK_NAMES = new Set(['air', 'cave_air', 'void_air'])
const AXES = ['x', 'y', 'z']

function analyzeWorldDiff(bot, transformedPlan) {
    if (!bot || typeof bot.blockAt !== 'function') {
        throw createDiffError('INVALID_BOT', 'bot.blockAt must be available.')
    }
    validatePlanBounds(transformedPlan)

    const targets = new Map()
    for (const item of transformedPlan.blocks) {
        if (!item || !item.position || !AXES.every(axis => Number.isInteger(item.position[axis]))) {
            throw createDiffError('INVALID_PLAN', 'Each block must have an integer world position.')
        }
        targets.set(positionKey(item.position), item)
    }

    const diff = { keep: [], break: [], place: [] }
    const { origin, size } = transformedPlan

    // Stable Y → Z → X scan order: lowest level first, then rows, then columns.
    for (let y = origin.y; y < origin.y + size.y; y++) {
        for (let z = origin.z; z < origin.z + size.z; z++) {
            for (let x = origin.x; x < origin.x + size.x; x++) {
                const position = { x, y, z }
                const target = targets.get(positionKey(position))
                const current = readWorldBlock(bot, position)
                const currentIsAir = isAirBlock(current.name)

                if (!target) {
                    if (!currentIsAir) diff.break.push(position)
                    continue
                }

                if (currentIsAir) {
                    diff.place.push({ block: target.block, position })
                } else if (normalizeBlockName(current.name) === normalizeBlockName(target.block)) {
                    diff.keep.push({ block: target.block, position })
                } else {
                    diff.break.push(position)
                    diff.place.push({ block: target.block, position })
                }
            }
        }
    }

    return diff
}

function validatePlanBounds(plan) {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan) ||
        !plan.origin || !plan.size || !Array.isArray(plan.blocks)) {
        throw createDiffError('INVALID_PLAN', 'transformedPlan must include origin, size, and blocks.')
    }

    for (const axis of AXES) {
        if (!Number.isInteger(plan.origin[axis]) || !Number.isInteger(plan.size[axis]) || plan.size[axis] <= 0) {
            throw createDiffError('INVALID_PLAN', `transformedPlan origin.${axis} and size.${axis} must define integer bounds.`)
        }
        if (!Number.isSafeInteger(plan.origin[axis] + plan.size[axis])) {
            throw createDiffError('INVALID_PLAN', `transformedPlan bounds on ${axis} exceed the safe integer range.`)
        }
    }
}

function readWorldBlock(bot, position) {
    let block
    try {
        block = bot.blockAt(new Vec3(position.x, position.y, position.z))
    } catch (cause) {
        throw createUnavailableError(position, cause)
    }
    if (!block || typeof block.name !== 'string') {
        throw createUnavailableError(position)
    }
    return block
}

function createUnavailableError(position, cause) {
    const error = createDiffError(
        'WORLD_BLOCK_UNAVAILABLE',
        `World block is unavailable at (${position.x}, ${position.y}, ${position.z}).`,
        cause
    )
    error.position = { ...position }
    return error
}

function normalizeBlockName(name) {
    return name.startsWith('minecraft:') ? name.slice('minecraft:'.length) : name
}

function isAirBlock(name) {
    return AIR_BLOCK_NAMES.has(normalizeBlockName(name))
}

function positionKey(position) {
    return `${position.x},${position.y},${position.z}`
}

function createDiffError(code, message, cause) {
    const error = new Error(message, cause ? { cause } : undefined)
    error.code = code
    return error
}

module.exports = {
    analyzeWorldDiff
}
