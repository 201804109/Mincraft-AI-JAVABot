const surfaceApi = require('../../../map_analysis/surface/api')

module.exports = {
    definition: {
        name: 'surface.getChunk',
        type: 'query',
        description: 'Get surface information for one Minecraft chunk',
        parameters: {
            type: 'object',
            properties: {
                chunkX: { type: 'integer' },
                chunkZ: { type: 'integer' }
            },
            required: ['chunkX', 'chunkZ']
        }
    },

    execute({ parameters }) {
        return surfaceApi.getChunk(parameters.chunkX, parameters.chunkZ)
    }
}
