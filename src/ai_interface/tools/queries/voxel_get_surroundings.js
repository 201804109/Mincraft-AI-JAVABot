const perceptionApi = require('../../../perception/api')

module.exports = {
    definition: {
        name: 'voxel.getSurroundings',
        type: 'query',
        description: 'Read existing Raw World Map around the floored current bot position; no active scan. Use horizontalRadius <= 8 and verticalRadius <= 4 for Agent requests. coverage < 1 is incomplete knowledge, not failure; blocks omit air and unknown voxels.',
        parameters: {
            type: 'object',
            properties: {
                horizontalRadius: {
                    type: 'integer',
                    minimum: 0
                },
                verticalRadius: {
                    type: 'integer',
                    minimum: 0
                }
            },
            required: ['horizontalRadius', 'verticalRadius']
        }
    },

    execute({ bot, parameters }) {
        return perceptionApi.getSurroundings(bot, parameters)
    }
}
