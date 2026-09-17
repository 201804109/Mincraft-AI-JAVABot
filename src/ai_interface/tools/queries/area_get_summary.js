const areaApi = require('../../../map_analysis/area/api')

module.exports = {
    definition: {
        name: 'area.getAreaSummary',
        type: 'query',
        description: 'Summarize existing Surface Map, without scanning: coverage, dominantBlock, height and regions. Agent bounds must have inclusive width <= 64 and depth <= 64. Data may be stale; coverage is observed-column coverage, not freshness. Regions are connected dominant-material cells, not semantic houses or forests.',
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
        return areaApi.getAreaSummary(parameters.bounds, parameters.options)
    }
}
