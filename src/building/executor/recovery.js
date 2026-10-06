const { checkPlacementBuildability } = require('../analysis/buildability')
const { verifyBrokenPositions, verifyPlacedBlocks } = require('./verifier')

const DEFAULT_MAX_RECOVERY_ATTEMPTS = 2

async function recoverBreakBatch(positions, options = {}) {
    const maxRecoveryAttempts = validateRecoveryOptions(options)
    validatePositions(positions)

    const verify = options.verifyBreak || verifyBrokenPositions
    const handleAction = options.handleAction
    let pending = positions.map(position => ({ ...position }))
    const recovered = []
    const recoveredKeys = new Set()
    const history = []
    let attempts = 0
    let observation = await observe(verify, options.bot, pending, 'break')
    if (observation.error) return failedRecovery('RECOVERY_VERIFICATION_FAILED', attempts, recovered, pending, history, observation)
    addVerifiedTasks(recovered, recoveredKeys, pending, observation)
    pending = getUnresolved(pending, observation, 'break')

    while (pending.length > 0) {
        if (attempts >= maxRecoveryAttempts) {
            return failedRecovery('RECOVERY_EXHAUSTED', attempts, recovered, pending, history)
        }

        const actionResult = await invokeAction(handleAction, 'batch_break', {
            positions: pending.map(position => ({ ...position }))
        })
        attempts++
        const verification = await observe(verify, options.bot, pending, 'break')
        history.push({
            attempt: attempts,
            tasks: pending.map(position => ({ ...position })),
            actionResult,
            verification
        })
        if (verification.error) {
            return failedRecovery('RECOVERY_VERIFICATION_FAILED', attempts, recovered, pending, history, verification)
        }

        addVerifiedTasks(recovered, recoveredKeys, pending, verification)
        pending = getUnresolved(pending, verification, 'break')
    }

    return { success: true, attempts, recovered, unresolved: [], history }
}

async function recoverPlaceBatch(tasks, options = {}) {
    const maxRecoveryAttempts = validateRecoveryOptions(options)
    validatePlaceTasks(tasks)

    const verify = options.verifyPlace || verifyPlacedBlocks
    const checkBuildability = options.checkBuildability || checkPlacementBuildability
    const handleAction = options.handleAction
    let pending = tasks.map(copyPlaceTask)
    const recovered = []
    const recoveredKeys = new Set()
    const history = []
    let attempts = 0
    let observation = await observe(verify, options.bot, pending, 'place')
    if (observation.error) return failedRecovery('RECOVERY_VERIFICATION_FAILED', attempts, recovered, pending, history, observation)
    addVerifiedTasks(recovered, recoveredKeys, pending, observation)
    pending = getUnresolved(pending, observation, 'place')

    while (pending.length > 0) {
        if (attempts >= maxRecoveryAttempts) {
            return failedRecovery('RECOVERY_EXHAUSTED', attempts, recovered, pending, history)
        }

        let ready = []
        try {
            for (const task of pending) {
                const result = checkBuildability(options.bot, task)
                if (!result || typeof result.buildable !== 'boolean') {
                    throw new TypeError('checkBuildability must return a boolean buildable field.')
                }
                if (result.buildable) ready.push(task)
            }
        } catch (error) {
            return failedRecovery('RECOVERY_BUILDABILITY_FAILED', attempts, recovered, pending, history, {
                message: error && error.message
            })
        }

        if (ready.length === 0) {
            return failedRecovery('RECOVERY_NOT_BUILDABLE', attempts, recovered, pending, history)
        }
        const actionResult = await invokeAction(handleAction, 'batch_place', {
            blocks: ready.map(copyPlaceTask)
        })
        attempts++
        const verification = await observe(verify, options.bot, ready, 'place')
        history.push({
            attempt: attempts,
            tasks: ready.map(copyPlaceTask),
            actionResult,
            verification
        })
        if (verification.error) {
            return failedRecovery('RECOVERY_VERIFICATION_FAILED', attempts, recovered, pending, history, verification)
        }

        addVerifiedTasks(recovered, recoveredKeys, ready, verification)
        const unresolvedReady = getUnresolved(ready, verification, 'place')
        const unresolvedKeys = new Set(unresolvedReady.map(task => positionKey(task.position)))
        const readyKeys = new Set(ready.map(task => positionKey(task.position)))
        pending = pending.filter(task => !readyKeys.has(positionKey(task.position)) || unresolvedKeys.has(positionKey(task.position)))
    }

    return { success: true, attempts, recovered, unresolved: [], history }
}

function validateRecoveryOptions(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('recovery options must be an object.')
    }
    if (typeof options.handleAction !== 'function') {
        throw new TypeError('recovery options.handleAction must be a function.')
    }
    const maxAttempts = options.maxRecoveryAttempts ?? DEFAULT_MAX_RECOVERY_ATTEMPTS
    if (!Number.isInteger(maxAttempts) || maxAttempts < 0) {
        throw new TypeError('maxRecoveryAttempts must be a non-negative integer.')
    }
    return maxAttempts
}

function validatePositions(positions) {
    if (!Array.isArray(positions) || !positions.every(isPosition)) {
        throw new TypeError('positions must be an array of integer coordinate objects.')
    }
}

function validatePlaceTasks(tasks) {
    if (!Array.isArray(tasks) || !tasks.every(task => isObject(task) &&
        typeof task.block === 'string' && task.block.trim().length > 0 && isPosition(task.position))) {
        throw new TypeError('tasks must be an array of block tasks with integer positions.')
    }
}

async function observe(verifier, bot, tasks, kind) {
    try {
        const input = kind === 'break' ? tasks.map(position => ({ ...position })) : tasks.map(copyPlaceTask)
        const result = await verifier(bot, input)
        if (!result || typeof result.success !== 'boolean' || !Array.isArray(result.verified) || !Array.isArray(result.failed)) {
            throw new TypeError('Verifier must return success, verified, and failed fields.')
        }
        return result
    } catch (error) {
        return {
            success: false,
            verified: [],
            failed: [],
            error: true,
            reason: error && error.code === 'BOT_NOT_AVAILABLE_FOR_VERIFICATION'
                ? 'BOT_NOT_AVAILABLE_FOR_VERIFICATION'
                : 'VERIFICATION_ERROR',
            message: error && error.message
        }
    }
}

function getUnresolved(tasks, verification, kind) {
    if (verification.success) return []
    const verifiedKeys = new Set(verification.verified
        .filter(item => item.position)
        .map(item => positionKey(item.position)))
    const failedKeys = new Set(verification.failed.map(item => item.position && positionKey(item.position)))
    return tasks.filter(task => {
        const position = kind === 'break' ? task : task.position
        const key = positionKey(position)
        return failedKeys.has(key) || !verifiedKeys.has(key)
    })
}

function addVerifiedTasks(recovered, recoveredKeys, tasks, verification) {
    const verifiedKeys = new Set(verification.verified
        .filter(item => item.position)
        .map(item => positionKey(item.position)))
    for (const task of tasks) {
        const position = task.position || task
        const key = positionKey(position)
        if (verifiedKeys.has(key) && !recoveredKeys.has(key)) {
            recoveredKeys.add(key)
            recovered.push(task.position ? copyPlaceTask(task) : { ...task })
        }
    }
}

async function invokeAction(handleAction, name, parameters) {
    try {
        return await handleAction({ type: 'action', name, parameters })
    } catch (error) {
        return { success: false, reason: 'ACTION_ERROR', message: error && error.message }
    }
}

function failedRecovery(reason, attempts, recovered, unresolved, history, verification = null) {
    return { success: false, attempts, recovered, unresolved, reason, history, ...(verification ? { verification } : {}) }
}

function copyPlaceTask(task) {
    return { ...task, position: { ...task.position } }
}

function positionKey(position) {
    return `${position.x},${position.y},${position.z}`
}

function isPosition(position) {
    return isObject(position) && ['x', 'y', 'z'].every(axis => Number.isInteger(position[axis]))
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

module.exports = {
    DEFAULT_MAX_RECOVERY_ATTEMPTS,
    recoverBreakBatch,
    recoverPlaceBatch
}
