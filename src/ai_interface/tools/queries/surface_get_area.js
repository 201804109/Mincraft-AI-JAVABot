const surfaceApi = require('../../../map_analysis/surface/api')

module.exports = {
    definition: {
        name: 'surface.getArea',
        type: 'query',
        description: 'Get surface columns within an area',
        parameters: {
            type: 'object',
            properties: {
                bounds: {
                    type: 'object',
                    properties: {
                        minX: { type: 'integer' },
                        maxX: { type: 'integer' },
                        minZ: { type: 'integer' },
                        maxZ: { type: 'integer' }
                    },
                    required: ['minX', 'maxX', 'minZ', 'maxZ']
                }
            },
            required: ['bounds']
        }
    },

    execute({ parameters }) {
        return surfaceApi.getArea(parameters.bounds)
    }
}
