const perceptionApi = require('../../../perception/api')

module.exports = {
    definition: {
        name: 'voxel.getVolume',
        type: 'query',
        description: 'Get observed blocks within a voxel volume',
        parameters: {
            type: 'object',
            properties: {
                bounds: {
                    type: 'object',
                    properties: {
                        minX: { type: 'integer' },
                        maxX: { type: 'integer' },
                        minZ: { type: 'integer' },
                        maxZ: { type: 'integer' },
                        minY: { type: 'integer' },
                        maxY: { type: 'integer' }
                    },
                    required: ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ']
                }
            },
            required: ['bounds']
        }
    },

    execute({ parameters }) {
        return perceptionApi.getVolume(parameters.bounds)
    }
}
