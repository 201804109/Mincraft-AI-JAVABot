const surfaceApi = require('../../map_analysis/surface/api')
const areaApi = require('../../map_analysis/area/api')
const perceptionApi = require('../../perception/api')
const {
    createSuccessResult,
    createFailureResult
} = require('../result')

const QUERY_HANDLERS = {
    'surface.getColumn': parameters =>
        surfaceApi.getColumn(parameters.x, parameters.z),
    'surface.getChunk': parameters =>
        surfaceApi.getChunk(parameters.chunkX, parameters.chunkZ),
    'surface.getArea': parameters =>
        surfaceApi.getArea(parameters.bounds),
    'area.getAreaSummary': parameters =>
        areaApi.getAreaSummary(parameters.bounds, parameters.options),
    'area.getAreaGrid': parameters =>
        areaApi.getAreaGrid(parameters.bounds, parameters.options),
    'area.getRegions': parameters =>
        areaApi.getRegions(parameters.bounds, parameters.options),
    'voxel.getBlock': parameters =>
        perceptionApi.getBlock(parameters.x, parameters.y, parameters.z),
    'voxel.getVolume': parameters =>
        perceptionApi.getVolume(parameters.bounds),
    'voxel.getSurroundings': (parameters, bot) =>
        perceptionApi.getSurroundings(bot, parameters)
}

function executeQuery(name, parameters, bot = null) {
    const handler = QUERY_HANDLERS[name]

    if (!handler) {
        return createFailureResult('query', name, 'UNKNOWN_QUERY')
    }

    try {
        return createSuccessResult('query', name, handler(parameters, bot))
    } catch (error) {
        console.error(`Query执行失败 (${name}):`, error)
        return createFailureResult(
            'query',
            name,
            error?.code || 'INVALID_QUERY_PARAMETERS'
        )
    }
}

module.exports = {
    executeQuery
}
