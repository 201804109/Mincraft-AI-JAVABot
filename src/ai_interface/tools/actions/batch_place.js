const { placeBlocks } = require('../../../skills/block_manipulation/block_batch')
const {
    createSuccessResult,
    createFailureResult
} = require('../../result')

module.exports = {
    definition: {
        name: 'batch_place',
        type: 'action',
        description: 'Place multiple blocks efficiently in one batch. Prefer this for ranges, areas, walls, floors, or any task involving multiple known block coordinates.',
        parameters: {
            type: 'object',
            properties: {
                blocks: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            block: {
                                type: 'string',
                                minLength: 1
                            },
                            position: {
                                type: 'object',
                                properties: {
                                    x: { type: 'integer' },
                                    y: { type: 'integer' },
                                    z: { type: 'integer' }
                                },
                                required: ['x', 'y', 'z']
                            }
                        },
                        required: ['block', 'position']
                    }
                }
            },
            required: ['blocks']
        }
    },

    async execute({ bot, parameters }) {
        try {
            const result = await placeBlocks(bot, parameters.blocks)
            const summary = {
                total: result.total,
                placed: result.placed,
                skipped: result.skipped,
                failed: result.failed,
                results: result.results
            }

            if (!result.success) {
                console.error('[batch_place] Batch completed with failures:', result)
                return createFailureResult(
                    'action',
                    'batch_place',
                    'BATCH_PLACE_PARTIAL_FAILURE',
                    summary
                )
            }

            return createSuccessResult('action', 'batch_place', summary)
        } catch (error) {
            console.error('[batch_place] Batch execution error:', error)
            return createFailureResult('action', 'batch_place', 'BATCH_PLACE_ERROR')
        }
    }
}
