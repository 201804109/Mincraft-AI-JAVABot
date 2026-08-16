const { Vec3 } = require('vec3')
const flight = require('./flight')
const { voxelToWorld } = require('./coordinate')
const spatial = require('../../perception/spatial')
const { WAYPOINT_THRESHOLD } = require('../../../config/navigation_config')

const LINE_SAMPLE_STEP = 0.5
const PROGRESS_TIMEOUT = 5000
const POLL_INTERVAL = 250
const MIN_PROGRESS = 0.05
const BLOCK_CHECK_INTERVAL = 1000
const BLOCK_TIMEOUT = 2000
const BLOCK_MIN_MOVEMENT = 0.1
const REPLAN_REQUIRED = 'REPLAN_REQUIRED'
const MAX_REPLAN_ATTEMPTS = 3

let bot = null
let activeGoalKey = null
let replanAttempts = 0

function init(_bot) {
    bot = _bot
}

async function followPath(path) {
    if (!bot || !Array.isArray(path) || path.length === 0) {
        return false
    }

    trackGoal(path[path.length - 1])
    const waypoints = compressPath(path)

    for (const point of waypoints) {
        const waypoint = new Vec3(point.x, point.y, point.z)
        const worldWaypoint = voxelToWorld(waypoint)

        if (bot.entity.position.distanceTo(worldWaypoint) < 0.01) {
            continue
        }

        const result = await moveToWaypoint(waypoint)

        if (result === REPLAN_REQUIRED) {
            return requestReplan()
        }

        if (!result) {
            return false
        }
    }

    resetReplanState()
    return true
}

async function moveToWaypoint(waypoint) {
    const worldWaypoint = voxelToWorld(waypoint)

    if (!canMoveToWaypoint(bot.entity.position, waypoint)) {
        console.log('[Follow DEBUG]')
        console.log('current world:', formatPosition(bot.entity.position))
        console.log('target voxel:', formatPosition(waypoint))
        console.log('target world:', formatPosition(worldWaypoint))
        console.log('[Follow] waypoint invalid, replan required')
        return REPLAN_REQUIRED
    }

    let movementFinished = false
    let movementError = null
    let bestDistance = bot.entity.position.distanceTo(worldWaypoint)
    let lastProgressAt = Date.now()
    let movementAnchor = bot.entity.position.clone()
    let movementAnchorAt = Date.now()
    let lastBlockCheckAt = Date.now()

    const movement = flight.flyTo(waypoint)
        .then(() => {
            movementFinished = true
        })
        .catch(error => {
            movementError = error
            movementFinished = true
        })

    while (!movementFinished) {
        const distance = bot.entity.position.distanceTo(worldWaypoint)

        if (movementError) {
            console.error('[Follow] movement failed:', movementError)
            return false
        }

        if (!canMoveToWaypoint(bot.entity.position, waypoint)) {
            console.log('[Follow] path changed during movement, replan required')
            stopCurrentMovement()
            return REPLAN_REQUIRED
        }

        if (
            distance >= WAYPOINT_THRESHOLD &&
            distance < bestDistance - MIN_PROGRESS
        ) {
            bestDistance = distance
            lastProgressAt = Date.now()
        }

        const now = Date.now()
        if (now - lastBlockCheckAt >= BLOCK_CHECK_INTERVAL) {
            const moved = bot.entity.position.distanceTo(movementAnchor)

            if (moved >= BLOCK_MIN_MOVEMENT) {
                movementAnchor = bot.entity.position.clone()
                movementAnchorAt = now
            } else if (now - movementAnchorAt >= BLOCK_TIMEOUT) {
                console.log('[Follow] robot blocked')
                return false
            }

            lastBlockCheckAt = now
        }

        if (now - lastProgressAt >= PROGRESS_TIMEOUT) {
            return false
        }

        await sleep(POLL_INTERVAL)
    }

    await movement
    return movementError === null
}

function canMoveToWaypoint(from, waypoint) {
    const worldWaypoint = voxelToWorld(waypoint)
    const dx = Math.abs(worldWaypoint.x - from.x)
    const dy = Math.abs(worldWaypoint.y - from.y)
    const dz = Math.abs(worldWaypoint.z - from.z)

    if (dx <= 1 && dy <= 1 && dz <= 1) {
        return spatial.canMove(from, worldWaypoint)
    }

    return canMoveAlongLine(from, worldWaypoint)
}

function stopCurrentMovement() {
    if (bot?.creative && typeof bot.creative.stopFlying === 'function') {
        bot.creative.stopFlying()
    }
}

function trackGoal(goal) {
    const goalKey = `${goal.x},${goal.y},${goal.z}`

    if (goalKey !== activeGoalKey) {
        activeGoalKey = goalKey
        replanAttempts = 0
    }
}

function requestReplan() {
    if (replanAttempts >= MAX_REPLAN_ATTEMPTS) {
        console.log('[Follow] maximum replan attempts reached')
        resetReplanState()
        return false
    }

    replanAttempts++
    return REPLAN_REQUIRED
}

function resetReplanState() {
    activeGoalKey = null
    replanAttempts = 0
}

function compressPath(path) {
    const points = path.map(point => ({ x: point.x, y: point.y, z: point.z }))

    if (points.length <= 2) {
        return points
    }

    const compressed = [points[0]]
    let anchor = points[0]
    let previousDirection = getDirection(points[0], points[1])

    for (let index = 2; index < points.length; index++) {
        const direction = getDirection(points[index - 1], points[index])
        const canMerge = sameDirection(previousDirection, direction) &&
            canMoveAlongLine(
                voxelToWorld(anchor),
                voxelToWorld(points[index])
            )

        if (!canMerge) {
            const previous = points[index - 1]
            compressed.push(previous)
            anchor = previous
            previousDirection = direction
        }
    }

    const last = points[points.length - 1]
    if (!samePosition(compressed[compressed.length - 1], last)) {
        compressed.push(last)
    }

    return compressed
}

function canMoveAlongLine(from, to) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dz = to.z - from.z
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (distance === 0) {
        return spatial.canOccupy(from)
    }

    const steps = Math.ceil(distance / LINE_SAMPLE_STEP)
    let previous = from

    for (let index = 1; index <= steps; index++) {
        const t = index / steps
        const current = {
            x: from.x + dx * t,
            y: from.y + dy * t,
            z: from.z + dz * t
        }

        if (!spatial.canMove(previous, current)) {
            return false
        }

        previous = current
    }

    return true
}

function getDirection(from, to) {
    return {
        x: Math.sign(to.x - from.x),
        y: Math.sign(to.y - from.y),
        z: Math.sign(to.z - from.z)
    }
}

function sameDirection(a, b) {
    return a.x === b.x && a.y === b.y && a.z === b.z
}

function samePosition(a, b) {
    return a.x === b.x && a.y === b.y && a.z === b.z
}

function formatPosition(position) {
    return `(${position.x},${position.y},${position.z})`
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
    init,
    followPath,
    compressPath,
    REPLAN_REQUIRED,
    MAX_REPLAN_ATTEMPTS
}
