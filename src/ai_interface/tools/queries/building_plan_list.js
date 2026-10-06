const planStore = require('../../../building/storage/plan_store')

module.exports = {
    definition: {
        name: 'building.plan.list',
        type: 'query',
        description: 'List summaries of cached BuildingPlans or editable drafts. Choose kind "plan" for validated formal plans or "draft" for work in progress. Does not return block coordinates.',
        parameters: {
            type: 'object',
            properties: {
                kind: { type: 'string', enum: ['plan', 'draft'] }
            },
            required: ['kind'],
            additionalProperties: false
        }
    },

    async execute({ parameters }) {
        if (!isObject(parameters) || !['plan', 'draft'].includes(parameters.kind)) {
            throw createQueryError('INVALID_QUERY_PARAMETERS', 'kind must be "plan" or "draft".')
        }

        const items = parameters.kind === 'plan'
            ? await planStore.listPlans()
            : await planStore.listDrafts()
        return { kind: parameters.kind, count: items.length, items }
    }
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function createQueryError(code, message) {
    const error = new Error(message)
    error.code = code
    return error
}
