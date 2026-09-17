const areaApi = require('../../../map_analysis/area/api')

module.exports = {
    definition: {
        name: 'area.getAreaGrid',
        type: 'query',
        description: 'Get a grid analysis of a surface area',
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
        return areaApi.getAreaGrid(parameters.bounds, parameters.options)
    }
}
