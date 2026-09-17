const navigation = require('../../../skills/move/navigation')
const {
    createSuccessResult,
    createFailureResult
} = require('../../result')

module.exports = {
    definition: {
        name: 'navigate',
        type: 'action',
        description: 'Navigate the Minecraft bot to a position',
        parameters: {
            type: 'object',
            properties: {
                position: {
                    type: 'object',
                    properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        z: { type: 'number' }
                    },
                    required: ['x', 'y', 'z']
                }
            },
            required: ['position']
        }
    },

    async execute({ parameters }) {
        try {
            const result = await navigation.navigateTo(parameters.position)

            if (result === true) {
                return createSuccessResult('action', 'navigate', {
                    position: parameters.position
                })
            }

            if (result === 'REPLAN_REQUIRED') {
                return createFailureResult(
                    'action',
                    'navigate',
                    'REPLAN_REQUIRED'
                )
            }

            return createFailureResult(
                'action',
                'navigate',
                'NAVIGATION_FAILED'
            )
        } catch (error) {
            console.error('导航执行异常:', error)
            return createFailureResult(
                'action',
                'navigate',
                'NAVIGATION_ERROR'
            )
        }
    }
}
