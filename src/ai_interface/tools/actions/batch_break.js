const { breakBlocks } = require('../../../skills/block_manipulation/block_batch')
const {
    createSuccessResult,
    createFailureResult
} = require('../../result')

module.exports = {
    definition: {
        name: 'batch_break',
        type: 'action',
        description: 'Break multiple blocks efficiently in one batch. Prefer this for ranges, areas, clearing operations, or any task involving multiple known block coordinates.',
        parameters: {
            type: 'object',
            properties: {
                positions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            x: { type: 'integer' },
                            y: { type: 'integer' },
                            z: { type: 'integer' }
                        },
                        required: ['x', 'y', 'z']
                    }
                }
            },
            required: ['positions']
        }
    },

    async execute({ bot, parameters }) {
        try {
            const result = await breakBlocks(bot, parameters.positions)
            const summary = {
                total: result.total,
                broken: result.broken,
                skipped: result.skipped,
                failed: result.failed,
                results: result.results
            }

            if (!result.success) {
                console.error('[batch_break] Batch completed with failures:', result)
                return createFailureResult(
                    'action',
                    'batch_break',
                    'BATCH_BREAK_PARTIAL_FAILURE',
                    summary
                )
            }

            return createSuccessResult('action', 'batch_break', summary)
        } catch (error) {
            console.error('[batch_break] Batch execution error:', error)
            return createFailureResult('action', 'batch_break', 'BATCH_BREAK_ERROR')
        }
    }
}
