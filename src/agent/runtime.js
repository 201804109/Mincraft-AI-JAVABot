const Task = require('./task')

const ALLOWED_ACTION_TOOLS = new Set([
    'navigate',
    'place',
    'break'
])

class AgentRuntime {
    constructor(options = {}) {
        this.modelClient = options.modelClient
        this.toolRegistry = options.toolRegistry
        this.aiInterface = options.aiInterface
    }

    async run(goal) {
        const task = new Task(goal)
        task.addMessage({
            role: 'user',
            content: goal
        })

        console.log(`[Agent] User: ${goal}`)

        try {
            const tools = this.toolRegistry
                .getAllTools()
                .filter(tool => ALLOWED_ACTION_TOOLS.has(tool.name))
                .map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters
                }))

            task.incrementIteration()

            const response = await this.modelClient.chat(
                task.messages,
                tools
            )

            if (response.type === 'text') {
                task.addMessage({
                    role: 'assistant',
                    content: response.text
                })

                task.finish()
                return {
                    success: true,
                    text: response.text,
                    task
                }
            }

            if (response.type === 'error') {
                task.fail()
                return {
                    success: false,
                    reason: response.reason,
                    text: `Agent failed: ${response.reason}`,
                    task
                }
            }

            if (response.type !== 'tool_call') {
                task.fail()
                return {
                    success: false,
                    reason: 'INVALID_MODEL_RESPONSE',
                    text: 'Agent failed: INVALID_MODEL_RESPONSE',
                    task
                }
            }

            console.log(
                `[Agent] Model selected tool: ${response.name}`
            )
            console.log(
                `[Agent] Parameters: ${JSON.stringify(response.parameters)}`
            )

            if (!ALLOWED_ACTION_TOOLS.has(response.name)) {
                task.fail()
                return {
                    success: false,
                    reason: 'TOOL_NOT_ALLOWED',
                    text: `Tool ${response.name} failed: TOOL_NOT_ALLOWED`,
                    task
                }
            }

            const definition = this.toolRegistry
                .getToolDefinition(response.name)

            if (!definition) {
                task.fail()
                return {
                    success: false,
                    reason: 'UNKNOWN_TOOL',
                    text: `Tool ${response.name} failed: UNKNOWN_TOOL`,
                    task
                }
            }

            const request = {
                type: definition.type,
                name: definition.name,
                parameters: response.parameters
            }

            const toolResult = await this.aiInterface.handle(request)

            console.log(
                `[Agent] Tool result: ${JSON.stringify(toolResult)}`
            )

            if (toolResult.success) {
                task.finish()
                return {
                    success: true,
                    text: `Tool ${definition.name} executed successfully`,
                    toolResult,
                    task
                }
            }

            task.fail()
            return {
                success: false,
                reason: toolResult.reason,
                text: `Tool ${definition.name} failed: ${toolResult.reason}`,
                toolResult,
                task
            }
        } catch (error) {
            task.fail()
            return {
                success: false,
                reason: 'MODEL_ERROR',
                error: error.message
            }
        }
    }
}

module.exports = AgentRuntime
