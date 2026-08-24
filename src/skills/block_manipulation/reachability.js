const DEFAULT_MAX_DISTANCE = 5
const PLAYER_EYE_HEIGHT = 1.62

function checkBlockReachability(bot, block, options = {}) {
    if (!block) {
        return {
            reachable: false,
            reason: 'block_not_found'
        }
    }

    if (!bot || !bot.entity || !bot.entity.position) {
        return {
            reachable: false,
            reason: 'bot_not_available'
        }
    }

    if (!block.position || !isValidPosition(block.position)) {
        return {
            reachable: false,
            reason: 'invalid_block_position'
        }
    }

    const maxDistance = options.maxDistance ?? DEFAULT_MAX_DISTANCE
    if (!Number.isFinite(maxDistance) || maxDistance < 0) {
        return {
            reachable: false,
            reason: 'invalid_max_distance'
        }
    }

    const eyePosition = bot.entity.position.offset(0, PLAYER_EYE_HEIGHT, 0)
    const distance = distanceToBlock(eyePosition, block.position)

    if (distance > maxDistance) {
        return {
            reachable: false,
            reason: 'out_of_reach'
        }
    }

    return {
        reachable: true,
        distance
    }
}

function distanceToBlock(point, blockPosition) {
    const closestX = clamp(point.x, blockPosition.x, blockPosition.x + 1)
    const closestY = clamp(point.y, blockPosition.y, blockPosition.y + 1)
    const closestZ = clamp(point.z, blockPosition.z, blockPosition.z + 1)
    const dx = point.x - closestX
    const dy = point.y - closestY
    const dz = point.z - closestZ

    return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
}

function isValidPosition(position) {
    return [position.x, position.y, position.z].every(Number.isFinite)
}

module.exports = {
    checkBlockReachability
}
