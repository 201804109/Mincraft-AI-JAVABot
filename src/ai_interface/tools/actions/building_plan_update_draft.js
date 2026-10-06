const planStore = require('../../../building/storage/plan_store')
const { createSuccessResult, createFailureResult } = require('../../result')

const TOOL_NAME = 'building.plan.updateDraft'

module.exports = {
    definition: {
        name: TOOL_NAME,
        type: 'action',
        description: 'Replace the entire document of an existing BuildingPlan draft. This is whole-document replacement, not a partial patch. Drafts may remain incomplete until commitDraft.',
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
            await planStore.updateDraft(parameters.planId, parameters.document)
            return createSuccessResult('action', TOOL_NAME, {
                planId: parameters.planId,
                status: 'draft_updated'
            })
        } catch (error) {
            return createFailureResult('action', TOOL_NAME, error && error.code || 'PLAN_STORE_ERROR')
        }
    }
}
