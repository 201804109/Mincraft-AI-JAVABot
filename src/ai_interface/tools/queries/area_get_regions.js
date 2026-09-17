const areaApi = require('../../../map_analysis/area/api')

module.exports = {
    definition: {
        name: 'area.getRegions',
        type: 'query',
        description: 'Get detected regions within a surface area',
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
                },
                options: {
                    type: 'object',
                    properties: {
                        resolution: {
                            type: 'integer',
                            minimum: 1
                        }
                    }
                }
            },
            required: ['bounds']
        }
    },

    execute({ parameters }) {
        return areaApi.getRegions(parameters.bounds, parameters.options)
    }
}
