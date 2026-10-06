const building = require('../../../building')
const { createSuccessResult, createFailureResult } = require('../../result')

const TOOL_NAME = 'build_from_plan'

module.exports = {
    definition: {
        name: TOOL_NAME,
        type: 'action',
        description: 'Execute a committed formal BuildingPlan by planId. This waits until the build finishes. Drafts cannot be built; this action does not accept file paths or change the plan origin.',
        parameters: {
            type: 'object',
            properties: {
                planId: { type: 'string', minLength: 1 }
            },
            required: ['planId']
        }
    },

    async execute({ bot, parameters, executeNestedAction }) {
        if (typeof executeNestedAction !== 'function') {
            return createFailureResult('action', TOOL_NAME, 'BUILD_ACTION_CONTEXT_REQUIRED')
        }

        try {
            const session = await building.prepareBuildFromPlanId(bot, parameters.planId, {
                handleAction: request => executeNestedAction(request)
            })
            const executionResult = await session.start()
            const status = session.getStatus()
            const summary = {
                planId: parameters.planId,
                status: status.status,
                completedLayers: status.progress.completedLayers,
                totalLayers: status.progress.totalLayers
            }

            if (status.status === 'completed' && executionResult && executionResult.success === true) {
                return createSuccessResult('action', TOOL_NAME, summary)
            }

            const reason = getBuildFailureReason(executionResult, status)
            return createFailureResult('action', TOOL_NAME, reason, {
                ...summary,
                ...(executionResult && executionResult.failedLayer !== undefined
                    ? { failedLayer: executionResult.failedLayer }
                    : {}),
                ...(executionResult && executionResult.failedAction
                    ? { failedAction: executionResult.failedAction }
                    : {}),
                ...(executionResult && executionResult.failureType
                    ? { failureType: executionResult.failureType }
                    : {}),
                ...(getUnresolvedCount(executionResult) !== null
                    ? { unresolvedCount: getUnresolvedCount(executionResult) }
                    : {})
            })
        } catch (error) {
            const data = error && Array.isArray(error.errors)
                ? { validationErrorCount: error.errors.length }
                : null
            return createFailureResult(
                'action',
                TOOL_NAME,
                error && error.code || 'BUILD_PREPARATION_FAILED',
                data
            )
        }
    }
}

function getBuildFailureReason(result, status) {
    return result && (
        result.reason ||
        result.recovery && result.recovery.reason ||
        result.result && result.result.reason
    ) || status && status.result && status.result.reason || 'BUILD_FAILED'
}

function getUnresolvedCount(result) {
    if (!result || typeof result !== 'object') return null
    if (Array.isArray(result.deferred)) return result.deferred.length
    if (result.recovery && Array.isArray(result.recovery.unresolved)) {
        return result.recovery.unresolved.length
    }
    if (result.result && Array.isArray(result.result.deferred)) {
        return result.result.deferred.length
    }
    return null
}
