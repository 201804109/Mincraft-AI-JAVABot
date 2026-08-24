const { Vec3 } = require('vec3')
const navigation = require('../move/navigation')

const VIEW_STABILIZATION_DELAY = 300
const PLACEMENT_VERIFY_DELAY = 200
const PLAYER_WIDTH = 0.6
const PLAYER_HEIGHT = 1.8
const PLAYER_EYE_HEIGHT = 1.62
const MIN_PLACEMENT_DISTANCE = 1
const MAX_PLACEMENT_DISTANCE = 5
const MAX_SAFE_POSITION_RADIUS = 4
const LINE_SAMPLE_STEP = 0.1
const BOUNDARY_EPSILON = 1e-7
const AIR_TYPES = new Set(['air', 'cave_air', 'void_air'])

const REFERENCE_DIRECTIONS = [
    { offset: new Vec3(1, 0, 0), face: new Vec3(-1, 0, 0) },
    { offset: new Vec3(-1, 0, 0), face: new Vec3(1, 0, 0) },
    { offset: new Vec3(0, 1, 0), face: new Vec3(0, -1, 0) },
    { offset: new Vec3(0, -1, 0), face: new Vec3(0, 1, 0) },
    { offset: new Vec3(0, 0, 1), face: new Vec3(0, 0, -1) },
    { offset: new Vec3(0, 0, -1), face: new Vec3(0, 0, 1) }
]

async function placeBlock(bot, blockName, targetPosition) {
    console.log('[BlockPlace]')

    if (!isValidBot(bot)) {
        return fail('INVALID_BOT')
    }

    if (typeof blockName !== 'string' || blockName.length === 0) {
        return fail('INVALID_BLOCK_NAME')
    }

    if (!isValidBlockPosition(targetPosition)) {
        return fail('INVALID_TARGET_POSITION')
    }

    const target = new Vec3(targetPosition.x, targetPosition.y, targetPosition.z)
    const targetCenter = target.offset(0.5, 0.5, 0.5)

    console.log('Target:')
    console.log(formatPosition(target))

    await lookAtTarget(bot, targetCenter)

    const targetBlock = bot.blockAt(target)
    if (!targetBlock) {
        return fail('TARGET_UNAVAILABLE')
    }

    if (!isAirBlock(targetBlock)) {
        return fail('TARGET_OCCUPIED')
    }

    console.log('Checking reference block...')
    let reference = findReferenceBlock(bot, target)

    if (!reference) {
        return fail('NO_REFERENCE_BLOCK')
    }

    console.log('Found reference:')
    console.log(reference.referenceBlock.name)
    console.log(formatPosition(reference.referenceBlock.position))

    if (!canPlaceFromCurrentPosition(bot, target, targetCenter)) {
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
            console.error('[BlockPlace] Navigation error:', error)
            return fail('NAVIGATION_FAILED')
        }

        if (navigationResult !== true) {
            return fail('NAVIGATION_FAILED')
        }

        await lookAtTarget(bot, targetCenter)
    }

    const currentTargetBlock = bot.blockAt(target)
    if (!currentTargetBlock || !isAirBlock(currentTargetBlock)) {
        return fail('TARGET_OCCUPIED')
    }

    reference = refreshReferenceBlock(bot, reference)
    if (!reference) {
        return fail('NO_REFERENCE_BLOCK')
    }

    const item = bot.inventory.items().find(candidate => candidate.name === blockName)
    if (!item) {
        return fail('NO_BLOCK_IN_INVENTORY')
    }

    try {
        await bot.equip(item, 'hand')
    } catch (error) {
        console.error('[BlockPlace] Equip error:', error)
        return fail('EQUIP_FAILED')
    }

    console.log('Placing...')

    try {
        await bot.placeBlock(reference.referenceBlock, reference.faceVector)
    } catch (error) {
        console.error('[BlockPlace] Place error:', error)
        return fail('PLACE_FAILED')
    }

    await sleep(PLACEMENT_VERIFY_DELAY)

    const placedBlock = bot.blockAt(target)
    if (!placedBlock || placedBlock.name !== blockName) {
        return fail('PLACE_FAILED')
    }

    console.log('Success')
    return {
        success: true,
        block: blockName,
        position: targetPosition
    }
}

async function lookAtTarget(bot, targetCenter) {
    await bot.lookAt(targetCenter)
    await sleep(VIEW_STABILIZATION_DELAY)
}

function findReferenceBlock(bot, target) {
    for (const direction of REFERENCE_DIRECTIONS) {
        const position = target.plus(direction.offset)
        const block = bot.blockAt(position)

        if (isSolidBlock(block)) {
            return {
                referenceBlock: block,
                faceVector: direction.face
            }
        }
    }

    return null
}

function refreshReferenceBlock(bot, reference) {
    const block = bot.blockAt(reference.referenceBlock.position)

    if (!isSolidBlock(block)) {
        return null
    }

    return {
        referenceBlock: block,
        faceVector: reference.faceVector
    }
}

function canPlaceFromCurrentPosition(bot, target, targetCenter) {
    if (bodyOverlapsTarget(bot.entity.position, target)) {
        console.log('[BlockPlace] Robot body overlaps target block')
        return false
    }

    const eyePosition = bot.entity.position.offset(0, PLAYER_EYE_HEIGHT, 0)
    const distance = eyePosition.distanceTo(targetCenter)

    if (distance > MAX_PLACEMENT_DISTANCE) {
        console.log('[BlockPlace] Target is out of placement range')
        return false
    }

    if (!hasLineOfSight(bot, eyePosition, targetCenter, target)) {
        console.log('[BlockPlace] Target is not visible from current position')
        return false
    }

    return true
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
    const supportBlock = bot.blockAt(candidate.offset(0, -1, 0))
    if (!isSolidBlock(supportBlock)) {
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
    const distance = eyePosition.distanceTo(targetCenter)

    if (distance < MIN_PLACEMENT_DISTANCE || distance > MAX_PLACEMENT_DISTANCE) {
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
    const bodyMinX = position.x - halfWidth
    const bodyMaxX = position.x + halfWidth
    const bodyMinY = position.y
    const bodyMaxY = position.y + PLAYER_HEIGHT
    const bodyMinZ = position.z - halfWidth
    const bodyMaxZ = position.z + halfWidth

    return rangesOverlap(bodyMinX, bodyMaxX, target.x, target.x + 1) &&
        rangesOverlap(bodyMinY, bodyMaxY, target.y, target.y + 1) &&
        rangesOverlap(bodyMinZ, bodyMaxZ, target.z, target.z + 1)
}

function rangesOverlap(minA, maxA, minB, maxB) {
    return minA < maxB && maxA > minB
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
        typeof bot.placeBlock === 'function' &&
        typeof bot.equip === 'function' &&
        bot.inventory &&
        typeof bot.inventory.items === 'function'
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
    console.log(`[BlockPlace] Failed: ${reason}`)
    return {
        success: false,
        reason
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
    placeBlock
}
