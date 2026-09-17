const { breakBlock } = require('../../../skills/block_manipulation/block_break')
const {
    createSuccessResult,
    createFailureResult
} = require('../../result')

function printBreakResult(result) {
    if (!result.success) {
        console.log('破坏失败:')
        console.log(result.reason)
        return
    }

    console.log('破坏成功:')
    console.log('坐标:')
    console.log(`${result.position.x} ${result.position.y} ${result.position.z}`)
}

module.exports = {
    definition: {
        name: 'break',
        type: 'action',
        description: 'Break a block at a position',
        parameters: {
            type: 'object',
            properties: {
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
            required: ['position']
        }
    },

    async execute({ bot, parameters }) {
        try {
            const result = await breakBlock(bot, parameters.position)

            printBreakResult(result)

            if (!result.success) {
                return createFailureResult(
                    'action',
                    'break',
                    result.reason || 'BREAK_FAILED'
                )
            }

            return createSuccessResult('action', 'break', {
                position: result.position
            })
        } catch (error) {
            console.error('破坏执行异常:', error)
            return createFailureResult('action', 'break', 'BREAK_ERROR')
        }
    }
}
