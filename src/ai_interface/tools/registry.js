const toolModules = [
    require('./queries/self_get_position'),
    require('./queries/voxel_get_block'),
    require('./queries/voxel_get_volume'),
    require('./queries/voxel_get_surroundings'),
    require('./queries/surface_get_column'),
    require('./queries/surface_get_chunk'),
    require('./queries/surface_get_area'),
    require('./queries/area_get_summary'),
    require('./queries/area_get_grid'),
    require('./queries/area_get_regions'),
    require('./actions/navigate'),
    require('./actions/place'),
    require('./actions/break')
]

const tools = {}

for (const tool of toolModules) {
    tools[tool.definition.name] = tool
}

function getToolDefinition(name) {
    return tools[name]?.definition
}

function getAllTools() {
    return Object.values(tools).map(tool => tool.definition)
}

function getLLMSchema() {
    return getAllTools().map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
    }))
}

function getToolModule(name) {
    return tools[name]
}

module.exports = {
    getToolDefinition,
    getAllTools,
    getLLMSchema,
    getToolModule
}
