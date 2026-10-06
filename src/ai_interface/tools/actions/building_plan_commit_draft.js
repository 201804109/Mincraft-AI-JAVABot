const planStore = require('../../../building/storage/plan_store')
const { createSuccessResult, createFailureResult } = require('../../result')

const TOOL_NAME = 'building.plan.commitDraft'

module.exports = {
    definition: {
        name: TOOL_NAME,
        type: 'action',
        description: 'Validate an existing BuildingPlan draft and publish it as a formal plan. This does not execute or build the plan.',
        parameters: {
            type: 'object',
            properties: {
                planId: { type: 'string', minLength: 1 }
            },
            required: ['planId']
        }
    },

    async execute({ parameters }) {
        try {
            await planStore.commitDraft(parameters.planId)
            return createSuccessResult('action', TOOL_NAME, {
                planId: parameters.planId,
                status: 'committed'
            })
        } catch (error) {
            const data = error && error.code === 'INVALID_BUILDING_PLAN' && Array.isArray(error.errors)
                ? { errors: error.errors }
                : null
            return createFailureResult(
                'action',
                TOOL_NAME,
                error && error.code || 'PLAN_STORE_ERROR',
                data
            )
        }
    }
}
