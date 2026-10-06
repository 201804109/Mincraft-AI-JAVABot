const planStore = require('../../../building/storage/plan_store')
const { createSuccessResult, createFailureResult } = require('../../result')

const TOOL_NAME = 'building.plan.createDraft'

module.exports = {
    definition: {
        name: TOOL_NAME,
        type: 'action',
        description: 'Create a new BuildingPlan draft. Drafts may be incomplete and are not validated until commitDraft. The document replaces no existing draft.',
        parameters: {
            type: 'object',
            properties: {
                planId: { type: 'string', minLength: 1 },
                document: { type: 'object' }
            },
            required: ['planId', 'document']
        }
    },

    async execute({ parameters }) {
        try {
            await planStore.createDraft(parameters.planId, parameters.document)
            return createSuccessResult('action', TOOL_NAME, {
                planId: parameters.planId,
                status: 'draft_created'
            })
        } catch (error) {
            return createFailureResult('action', TOOL_NAME, error && error.code || 'PLAN_STORE_ERROR')
        }
    }
}
