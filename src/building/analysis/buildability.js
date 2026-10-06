const { Vec3 } = require('vec3')

const AIR_BLOCK_NAMES = new Set(['air', 'cave_air', 'void_air'])
const REFERENCE_OFFSETS = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
]

function checkPlacementBuildability(bot, task) {
    if (!bot || typeof bot.blockAt !== 'function') {
        throw new TypeError('bot.blockAt must be available.')
    }
    if (!task || typeof task !== 'object' || Array.isArray(task) ||
        !task.position || typeof task.position !== 'object' || Array.isArray(task.position) ||
        !['x', 'y', 'z'].every(axis => Number.isInteger(task.position[axis]))) {
        throw new TypeError('task.position must contain integer x, y, and z coordinates.')
    }

    const { x, y, z } = task.position
    for (const [dx, dy, dz] of REFERENCE_OFFSETS) {
        const block = bot.blockAt(new Vec3(x + dx, y + dy, z + dz))
        if (block && typeof block.name === 'string' && !isAirName(block.name)) {
            return { buildable: true }
        }
    }
    return { buildable: false, reason: 'NO_REFERENCE_BLOCK' }
}

function partitionBuildablePlacements(bot, tasks) {
    if (!Array.isArray(tasks)) {
        throw new TypeError('tasks must be an array.')
    }

    const ready = []
    const deferred = []
    for (const task of tasks) {
        if (checkPlacementBuildability(bot, task).buildable) {
            ready.push(task)
        } else {
            deferred.push(task)
        }
    }
    return { ready, deferred }
}

function isAirName(name) {
    return AIR_BLOCK_NAMES.has(name.startsWith('minecraft:') ? name.slice('minecraft:'.length) : name)
}

module.exports = {
    checkPlacementBuildability,
    partitionBuildablePlacements
}
