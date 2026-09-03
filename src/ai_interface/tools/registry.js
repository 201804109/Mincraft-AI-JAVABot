const definitions = require('./definitions')

const tools = {}

for (const definition of definitions) {
    tools[definition.name] = definition
}

function getToolDefinition(name) {
    return tools[name]
}

function getAllTools() {
    return Object.values(tools)
}

function getLLMSchema() {
    return getAllTools().map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
    }))
}

module.exports = {
    getToolDefinition,
    getAllTools,
    getLLMSchema
}
