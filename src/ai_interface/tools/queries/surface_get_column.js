const surfaceApi = require('../../../map_analysis/surface/api')

module.exports = {
    definition: {
        name: 'surface.getColumn',
        type: 'query',
        description: 'Read a cached Surface column without scanning. top is only the highest observed non-air block, not guaranteed ground, roof, safe footing or full world height. observed:false means unknown. Surface data may be stale and has no freshness timestamp.',
        parameters: {
            type: 'object',
            properties: {
                x: { type: 'integer' },
                z: { type: 'integer' }
            },
            required: ['x', 'z']
        }
    },

    execute({ parameters }) {
        return surfaceApi.getColumn(parameters.x, parameters.z)
    }
}
