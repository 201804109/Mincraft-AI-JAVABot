const aiInterface = require('../../ai_interface')
const {
    checkPlacementBuildability,
    partitionBuildablePlacements
} = require('../analysis/buildability')
const { verifyBrokenPositions, verifyPlacedBlocks } = require('./verifier')
const { recoverBreakBatch, recoverPlaceBatch, DEFAULT_MAX_RECOVERY_ATTEMPTS } = require('./recovery')

async function executeBuildPlan(executionPlan, options = {}) {
    const handleAction = options && options.handleAction
        ? options.handleAction
        : aiInterface.handle
    const bot = options && options.bot
    const checkBuildability = options && options.checkBuildability
        ? options.checkBuildability
        : defaultBuildabilityCheck
    const verifyBreak = options && options.verifyBreak ? options.verifyBreak : verifyBrokenPositions
    const verifyPlace = options && options.verifyPlace ? options.verifyPlace : verifyPlacedBlocks
    const maxRecoveryAttempts = options && options.maxRecoveryAttempts !== undefined
        ? options.maxRecoveryAttempts
        : DEFAULT_MAX_RECOVERY_ATTEMPTS
    const shouldStop = options && typeof options.shouldStop === 'function'
        ? options.shouldStop
        : null
    const onLayerCompleted = options && typeof options.onLayerCompleted === 'function'
        ? options.onLayerCompleted
        : null

    const validationError = validateExecutionPlan(executionPlan)
    if (validationError) {
        return {
            success: false,
            completedLayers: 0,
            totalLayers: Array.isArray(executionPlan) ? executionPlan.length : 0,
            failedLayer: null,
            failedAction: null,
            result: { success: false, reason: 'INVALID_EXECUTION_PLAN', message: validationError },
            results: []
        }
    }
    if (typeof handleAction !== 'function') {
        return {
            success: false,
            completedLayers: 0,
            totalLayers: executionPlan.length,
            failedLayer: null,
            failedAction: null,
            result: { success: false, reason: 'INVALID_ACTION_HANDLER' },
            results: []
        }
    }
    if (!Number.isInteger(maxRecoveryAttempts) || maxRecoveryAttempts < 0) {
        return {
            success: false,
            completedLayers: 0,
            totalLayers: executionPlan.length,
            failedLayer: null,
            failedAction: null,
            result: { success: false, reason: 'INVALID_MAX_RECOVERY_ATTEMPTS' },
            results: []
        }
    }

    const results = []
    let completedLayers = 0

    for (const layer of executionPlan) {
        if (shouldStopRequested(shouldStop)) {
            return stoppedExecution(completedLayers, executionPlan.length, results)
        }

        const layerResult = {
            y: layer.y,
            breakResult: null,
            breakVerification: null,
            breakRecovery: null,
            placeResults: []
        }
        results.push(layerResult)

        if (layer.breakBatch.positions.length > 0) {
            const result = await invokeAction(handleAction, 'batch_break', {
                positions: layer.breakBatch.positions.map(position => ({ ...position }))
            })
            layerResult.breakResult = result
            const verification = await runVerification(verifyBreak, bot, layer.breakBatch.positions)
            layerResult.breakVerification = verification
            if (!isSuccessfulVerification(verification)) {
                const recovery = await recoverBreakBatch(layer.breakBatch.positions, {
                    bot,
                    handleAction,
                    verifyBreak,
                    maxRecoveryAttempts
                })
                layerResult.breakRecovery = recovery
                if (!recovery.success) {
                    return failedRecoveryExecution(
                        completedLayers, executionPlan.length, layer.y, 'batch_break', recovery, results
                    )
                }
            }
        }

        let pending = layer.placeBatch.blocks.slice()
        while (pending.length > 0) {
            let partition
            try {
                partition = checkBuildability === defaultBuildabilityCheck
                    ? partitionBuildablePlacements(bot, pending)
                    : partitionWithChecker(checkBuildability, bot, pending)
            } catch (error) {
                const result = {
                    success: false,
                    reason: 'BUILDABILITY_CHECK_FAILED',
                    message: error && error.message
                }
                return failedExecution(completedLayers, executionPlan.length, layer.y, 'buildability', result, results)
            }

            if (partition.ready.length === 0) {
                const deferred = partition.deferred.map(copyPlaceTask)
                const result = { success: false, reason: 'UNBUILDABLE_LAYER', deferred }
                return {
                    ...failedExecution(completedLayers, executionPlan.length, layer.y, 'buildability', result, results),
                    reason: 'UNBUILDABLE_LAYER',
                    deferred
                }
            }

            const result = await invokeAction(handleAction, 'batch_place', {
                blocks: partition.ready.map(copyPlaceTask)
            })
            const placeResult = { actionResult: result, verification: null, recovery: null }
            layerResult.placeResults.push(placeResult)
            const verification = await runVerification(verifyPlace, bot, partition.ready)
            placeResult.verification = verification
            if (!isSuccessfulVerification(verification)) {
                const recovery = await recoverPlaceBatch(partition.ready, {
                    bot,
                    handleAction,
                    verifyPlace,
                    checkBuildability,
                    maxRecoveryAttempts
                })
                placeResult.recovery = recovery
                if (!recovery.success) {
                    return failedRecoveryExecution(
                        completedLayers, executionPlan.length, layer.y, 'batch_place', recovery, results
                    )
                }
            }
            pending = partition.deferred
        }

        completedLayers++
        if (onLayerCompleted) {
            try {
                await onLayerCompleted({
                    y: layer.y,
                    completedLayers,
                    totalLayers: executionPlan.length
                })
            } catch (_) {
                // Progress observers must not change execution behavior.
            }
        }
    }

    if (shouldStopRequested(shouldStop)) {
        return stoppedExecution(completedLayers, executionPlan.length, results)
    }

    return {
        success: true,
        completedLayers,
        totalLayers: executionPlan.length,
        results
    }
}

function defaultBuildabilityCheck(bot, task) {
    return checkPlacementBuildability(bot, task)
}

function partitionWithChecker(checker, bot, tasks) {
    const ready = []
    const deferred = []
    for (const task of tasks) {
        const result = checker(bot, copyPlaceTask(task))
        if (!result || typeof result.buildable !== 'boolean') {
            throw new TypeError('checkBuildability must return an object with a boolean buildable field.')
        }
        if (result.buildable) {
            ready.push(task)
        } else {
            deferred.push(task)
        }
    }
    return { ready, deferred }
}

function copyPlaceTask(block) {
    return { ...block, position: { ...block.position } }
}

async function runVerification(verifier, bot, tasks) {
    try {
        return await verifier(bot, tasks.map(task => task.position
            ? copyPlaceTask(task)
            : { ...task }))
    } catch (error) {
        const reason = error && error.code === 'BOT_NOT_AVAILABLE_FOR_VERIFICATION'
            ? 'BOT_NOT_AVAILABLE_FOR_VERIFICATION'
            : 'VERIFICATION_ERROR'
        return {
            success: false,
            verified: [],
            failed: tasks.map(task => ({
                position: { ...(task.position || task) },
                expected: task.block || 'air',
                actual: null,
                reason
            })),
            reason
        }
    }
}

function isSuccessfulVerification(result) {
    return Boolean(result && result.success === true)
}

function failedRecoveryExecution(completedLayers, totalLayers, failedLayer, failedAction, recovery, results) {
    return {
        ...failedExecution(completedLayers, totalLayers, failedLayer, failedAction, recovery, results),
        failureType: 'recovery',
        reason: recovery.reason,
        recovery
    }
}

function shouldStopRequested(shouldStop) {
    if (!shouldStop) return false
    try {
        return shouldStop() === true
    } catch (_) {
        return false
    }
}

function stoppedExecution(completedLayers, totalLayers, results) {
    return {
        success: false,
        stopped: true,
        reason: 'STOP_REQUESTED',
        completedLayers,
        totalLayers,
        results
    }
}

function validateExecutionPlan(plan) {
    if (!Array.isArray(plan)) return 'executionPlan must be an array.'

    for (let index = 0; index < plan.length; index++) {
        const layer = plan[index]
        if (!isObject(layer) || !Number.isFinite(layer.y)) {
            return `executionPlan[${index}] must be an object with a finite y.`
        }
        if (!isObject(layer.breakBatch) || !Array.isArray(layer.breakBatch.positions)) {
            return `executionPlan[${index}].breakBatch.positions must be an array.`
        }
        if (!isObject(layer.placeBatch) || !Array.isArray(layer.placeBatch.blocks)) {
            return `executionPlan[${index}].placeBatch.blocks must be an array.`
        }
        if (!layer.breakBatch.positions.every(isValidPosition)) {
            return `executionPlan[${index}].breakBatch.positions must contain coordinate objects.`
        }
        if (!layer.placeBatch.blocks.every(isValidPlaceBlock)) {
            return `executionPlan[${index}].placeBatch.blocks must contain block and position objects.`
        }
    }
    return null
}

async function invokeAction(handleAction, name, parameters) {
    try {
        return await handleAction({ type: 'action', name, parameters })
    } catch (error) {
        return {
            success: false,
            reason: 'ACTION_ERROR',
            message: error && error.message
        }
    }
}

function failedExecution(completedLayers, totalLayers, failedLayer, failedAction, result, results) {
    return {
        success: false,
        completedLayers,
        totalLayers,
        failedLayer,
        failedAction,
        result,
        results
    }
}

function isSuccessfulActionResult(result) {
    return Boolean(result && result.success === true)
}

function isValidPosition(position) {
    return isObject(position) && ['x', 'y', 'z'].every(axis => Number.isInteger(position[axis]))
}

function isValidPlaceBlock(block) {
    return isObject(block) && typeof block.block === 'string' && block.block.trim().length > 0 &&
        isValidPosition(block.position)
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

module.exports = {
    executeBuildPlan
}
