const perceptionApi = require('../../../perception/api')

module.exports = {
    definition: {
        name: 'voxel.getBlock',
        type: 'query',
        description: 'Read one integer voxel from the existing Raw World Map; does not scan Minecraft. observed:false / UNKNOWN means no reliable observation, NOT air. lastSeen and confidence describe observation freshness.',
        parameters: {
            type: 'object',
            properties: {
                x: { type: 'integer' },
                y: { type: 'integer' },
                z: { type: 'integer' }
            },
            required: ['x', 'y', 'z']
        }
    },

    execute({ parameters }) {
        return perceptionApi.getBlock(parameters.x, parameters.y, parameters.z)
    }
}
