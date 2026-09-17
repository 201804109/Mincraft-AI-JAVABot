const { placeBlock } = require('../../../skills/block_manipulation/block_place')
const {
    createSuccessResult,
    createFailureResult
} = require('../../result')

function printPlaceResult(result) {
    if (!result.success) {
        console.log('放置失败:')
        console.log(result.reason)
        return
    }

    console.log('放置成功:')
    console.log(result.block)
    console.log('坐标:')
    console.log(`${result.position.x} ${result.position.y} ${result.position.z}`)
}

module.exports = {
    definition: {
        name: 'place',
        type: 'action',
        description: 'Place a block at a position',
        parameters: {
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
    },

    async execute({ bot, parameters }) {
        try {
            const result = await placeBlock(
                bot,
                parameters.block,
                parameters.position
            )

            printPlaceResult(result)

            if (!result.success) {
                return createFailureResult(
                    'action',
                    'place',
                    result.reason || 'PLACE_FAILED'
                )
            }

            return createSuccessResult('action', 'place', {
                block: result.block,
                position: result.position
            })
        } catch (error) {
            console.error('放置执行异常:', error)
            return createFailureResult('action', 'place', 'PLACE_ERROR')
        }
    }
}
