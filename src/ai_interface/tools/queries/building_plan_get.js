const planStore = require('../../../building/storage/plan_store')

const DEFAULT_BLOCK_PAGE_SIZE = 100
const MAX_BLOCK_PAGE_SIZE = 256

module.exports = {
    DEFAULT_BLOCK_PAGE_SIZE,
    MAX_BLOCK_PAGE_SIZE,
    definition: {
        name: 'building.plan.get',
        type: 'query',
        description: 'Read BuildingPlan metadata and one page of blocks. kind and planId are required; offset defaults to 0 and limit defaults to 100 (maximum 256). Use building.plan.list to discover IDs.',
        parameters: {
            type: 'object',
            properties: {
                kind: { type: 'string', enum: ['plan', 'draft'] },
                planId: { type: 'string' },
                offset: { type: 'integer', minimum: 0 },
                limit: { type: 'integer', minimum: 1, maximum: MAX_BLOCK_PAGE_SIZE }
            },
            required: ['kind', 'planId'],
            additionalProperties: false
        }
    },

    async execute({ parameters }) {
        if (!isObject(parameters) || !['plan', 'draft'].includes(parameters.kind) ||
            typeof parameters.planId !== 'string') {
            throw createQueryError('INVALID_QUERY_PARAMETERS', 'kind and planId are required; kind must be "plan" or "draft".')
        }

        const offset = parameters.offset === undefined ? 0 : parameters.offset
        const limit = parameters.limit === undefined ? DEFAULT_BLOCK_PAGE_SIZE : parameters.limit
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1) {
            throw createQueryError('INVALID_QUERY_PARAMETERS', 'offset must be a non-negative integer and limit must be a positive integer.')
        }
        if (limit > MAX_BLOCK_PAGE_SIZE) {
            throw createQueryError('AGENT_QUERY_RANGE_EXCEEDED', `limit must not exceed ${MAX_BLOCK_PAGE_SIZE}.`)
        }

        const plan = parameters.kind === 'plan'
            ? await planStore.getPlan(parameters.planId)
            : await planStore.getDraft(parameters.planId)
        const source = isObject(plan) ? plan : {}
        const { blocks: sourceBlocks, ...document } = source
        const hasBlockArray = Array.isArray(sourceBlocks)
        const total = hasBlockArray ? sourceBlocks.length : null
        const items = hasBlockArray ? sourceBlocks.slice(offset, offset + limit) : []

        return {
            kind: parameters.kind,
            id: parameters.planId,
            document,
            blocks: {
                total,
                offset,
                limit,
                items,
                hasMore: hasBlockArray ? offset + items.length < total : false
            }
        }
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
