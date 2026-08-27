const { Vec3 } = require('vec3')
const navigation = require('../move/navigation')
const { checkBlockReachability } = require('./reachability')

const VIEW_STABILIZATION_DELAY = 300
const BREAK_VERIFY_DELAY = 200
const PLAYER_WIDTH = 0.6
const PLAYER_HEIGHT = 1.8
const PLAYER_EYE_HEIGHT = 1.62
const MAX_INTERACTION_DISTANCE = 5
const MAX_SAFE_POSITION_RADIUS = 4
const LINE_SAMPLE_STEP = 0.1
const BOUNDARY_EPSILON = 1e-7
const AIR_TYPES = new Set(['air', 'cave_air', 'void_air'])

async function breakBlock(bot, targetPosition) {
    console.log('[BlockBreak]')

    if (!isValidBot(bot)) {
        return fail('INVALID_BOT')
    }

    if (!isValidBlockPosition(targetPosition)) {
        return fail('INVALID_TARGET_POSITION')
    }

    const target = new Vec3(targetPosition.x, targetPosition.y, targetPosition.z)
    const targetCenter = target.offset(0.5, 0.5, 0.5)

    console.log('Target:')
    console.log(formatPosition(target))
    console.log('Checking block...')

    let block = bot.blockAt(target)
    if (!block || isAirBlock(block)) {
        return fail('TARGET_EMPTY')
    }

    console.log('Found:')
    console.log(block.name)

    await lookAtTarget(bot, targetCenter)

    console.log('Checking reachability...')
    const initialReachability = checkBlockReachability(bot, block)
    const currentPositionSafe = !bodyOverlapsTarget(bot.entity.position, target)
    const currentTargetVisible = hasLineOfSight(
        bot,
        bot.entity.position.offset(0, PLAYER_EYE_HEIGHT, 0),
        targetCenter,
        target
    )

    if (!initialReachability.reachable || !currentPositionSafe || !currentTargetVisible) {
        console.log('Current position is not suitable, searching for a safe position...')
        const safePosition = findSafePosition(bot, target, targetCenter)

        if (!safePosition) {
            return fail('NO_SAFE_POSITION')
        }

        console.log('Safe position:')
        console.log(formatPosition(safePosition))

        let navigationResult
        try {
            navigationResult = await navigation.navigateTo(safePosition)
        } catch (error) {
            console.error('[BlockBreak] Navigation error:', error)
            return fail('NAVIGATION_FAILED')
        }

        if (navigationResult !== true) {
            return fail('NAVIGATION_FAILED')
        }

        await lookAtTarget(bot, targetCenter)

        block = bot.blockAt(target)
        if (!block || isAirBlock(block)) {
            return fail('TARGET_EMPTY')
        }

        const finalReachability = checkBlockReachability(bot, block)
        if (!finalReachability.reachable) {
            return fail('OUT_OF_REACH')
        }

        if (
            bodyOverlapsTarget(bot.entity.position, target) ||
            !hasLineOfSight(
                bot,
                bot.entity.position.offset(0, PLAYER_EYE_HEIGHT, 0),
                targetCenter,
                target
            )
        ) {
            return fail('NO_SAFE_POSITION')
        }
    }

    console.log('Breaking...')

    try {
        await bot.dig(block)
    } catch (error) {
        console.error('[BlockBreak] Dig error:', error)
        return fail('BREAK_FAILED')
    }

    await sleep(BREAK_VERIFY_DELAY)

    const resultBlock = bot.blockAt(target)
    if (!resultBlock || !isAirBlock(resultBlock)) {
        return fail('BREAK_FAILED')
    }

    console.log('Success')
    return {
        success: true,
        position: targetPosition
    }
}

async function lookAtTarget(bot, targetCenter) {
    await bot.lookAt(targetCenter)
    await sleep(VIEW_STABILIZATION_DELAY)
}

function findSafePosition(bot, target, targetCenter) {
    const candidates = []

    for (let radius = 1; radius <= MAX_SAFE_POSITION_RADIUS; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== radius) {
                        continue
                    }

                    const candidate = new Vec3(
                        target.x + dx,
                        target.y + dy,
                        target.z + dz
                    )

                    if (isSafePosition(bot, candidate, target, targetCenter)) {
                        candidates.push(candidate)
                    }
                }
            }
        }
    }

    candidates.sort((a, b) => {
        const aWorld = a.offset(0.5, 0, 0.5)
        const bWorld = b.offset(0.5, 0, 0.5)
        return bot.entity.position.distanceTo(aWorld) - bot.entity.position.distanceTo(bWorld)
    })

    return candidates[0] || null
}

function isSafePosition(bot, candidate, target, targetCenter) {
    const supportPosition = candidate.offset(0, -1, 0)

    if (samePosition(supportPosition, target)) {
        return false
    }

    if (!isSolidBlock(bot.blockAt(supportPosition))) {
        return false
    }

    const worldPosition = candidate.offset(0.5, 0, 0.5)
    if (!isBodySpaceClear(bot, worldPosition)) {
        return false
    }

    if (bodyOverlapsTarget(worldPosition, target)) {
        return false
    }

    const eyePosition = worldPosition.offset(0, PLAYER_EYE_HEIGHT, 0)
    if (distanceToBlock(eyePosition, target) > MAX_INTERACTION_DISTANCE) {
        return false
    }

    return hasLineOfSight(bot, eyePosition, targetCenter, target)
}

function isBodySpaceClear(bot, position) {
    const halfWidth = PLAYER_WIDTH / 2
    const minX = Math.floor(position.x - halfWidth + BOUNDARY_EPSILON)
    const maxX = Math.floor(position.x + halfWidth - BOUNDARY_EPSILON)
    const minY = Math.floor(position.y + BOUNDARY_EPSILON)
    const maxY = Math.floor(position.y + PLAYER_HEIGHT - BOUNDARY_EPSILON)
    const minZ = Math.floor(position.z - halfWidth + BOUNDARY_EPSILON)
    const maxZ = Math.floor(position.z + halfWidth - BOUNDARY_EPSILON)

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                if (!isAirBlock(bot.blockAt(new Vec3(x, y, z)))) {
                    return false
                }
            }
        }
    }

    return true
}

function bodyOverlapsTarget(position, target) {
    const halfWidth = PLAYER_WIDTH / 2

    return rangesOverlap(position.x - halfWidth, position.x + halfWidth, target.x, target.x + 1) &&
        rangesOverlap(position.y, position.y + PLAYER_HEIGHT, target.y, target.y + 1) &&
        rangesOverlap(position.z - halfWidth, position.z + halfWidth, target.z, target.z + 1)
}

function rangesOverlap(minA, maxA, minB, maxB) {
    return minA < maxB && maxA > minB
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

function hasLineOfSight(bot, from, to, target) {
    const delta = to.minus(from)
    const distance = delta.norm()

    if (distance === 0) {
        return true
    }

    const direction = delta.scaled(1 / distance)
    const steps = Math.floor(distance / LINE_SAMPLE_STEP)
    let lastKey = null

    for (let index = 1; index < steps; index++) {
        const point = from.plus(direction.scaled(index * LINE_SAMPLE_STEP))
        const position = point.floored()

        if (samePosition(position, target)) {
            continue
        }

        const key = `${position.x},${position.y},${position.z}`
        if (key === lastKey) {
            continue
        }

        lastKey = key
        const block = bot.blockAt(position)

        if (!block || !isAirBlock(block)) {
            return false
        }
    }

    return true
}

function isAirBlock(block) {
    return Boolean(block) && AIR_TYPES.has(block.name)
}

function isSolidBlock(block) {
    return Boolean(block) && !AIR_TYPES.has(block.name)
}

function isValidBot(bot) {
    return bot &&
        bot.entity &&
        bot.entity.position &&
        typeof bot.lookAt === 'function' &&
        typeof bot.blockAt === 'function' &&
        typeof bot.dig === 'function'
}

function isValidBlockPosition(position) {
    return position && [position.x, position.y, position.z].every(Number.isInteger)
}

function samePosition(a, b) {
    return a.x === b.x && a.y === b.y && a.z === b.z
}

function formatPosition(position) {
    return `${position.x} ${position.y} ${position.z}`
}

function fail(reason) {
    console.log('[BlockBreak]')
    console.log('Failed:')
    console.log(reason)
    return {
        success: false,
        reason
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
    breakBlock
}
