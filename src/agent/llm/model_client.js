const OpenAI = require('openai')
const { toLLMName, toInternalName } = require('./tool_name_adapter')

class ModelClient {
    constructor(options = {}) {
        this.model = options.model || 'deepseek-v4-flash'
        this.client = new OpenAI({
            apiKey: options.apiKey || process.env.DEEPSEEK_API_KEY,
            baseURL: options.baseURL || 'https://api.deepseek.com'
        })
    }

    async chat(messages, tools) {
        const deepSeekTools = tools.map(tool => ({
            type: 'function',
            function: {
                name: toLLMName(tool.name),
                description: tool.description,
                parameters: tool.parameters
            }
        }))

        const response = await this.client.chat.completions.create({
            model: this.model,
            messages,
            tools: deepSeekTools,
            tool_choice: 'auto',
            stream: false
        })

        const message = response.choices[0].message
        const toolCalls = message.tool_calls || []
        const assistantMessage = {
            role: 'assistant',
            content: message.content || ''
        }
        if (message.reasoning_content !== undefined) {
            assistantMessage.reasoning_content = message.reasoning_content
        }

        if (toolCalls.length === 0) {
            return {
                type: 'text',
                text: assistantMessage.content,
                assistantMessage
            }
        }

        if (toolCalls.length > 1) {
            return {
                type: 'error',
                reason: 'MULTIPLE_TOOL_CALLS_NOT_SUPPORTED'
            }
        }

        const call = toolCalls[0]
        if (!call.id || !call.function || !call.function.name ||
            (call.type && call.type !== 'function')) {
            return { type: 'error', reason: 'INVALID_MODEL_RESPONSE' }
        }
        let parameters
        const internalName = toInternalName(call.function.name)
        if (!internalName) {
            return { type: 'error', reason: 'TOOL_NOT_ALLOWED' }
        }

        try {
            parameters = JSON.parse(call.function.arguments)
        } catch (error) {
            return {
                type: 'error',
                reason: 'INVALID_TOOL_ARGUMENTS'
            }
        }

        assistantMessage.tool_calls = [{
            id: call.id,
            type: call.type || 'function',
            function: {
                name: call.function.name,
                arguments: call.function.arguments
            }
        }]

        return {
            type: 'tool_call',
            id: call.id,
            name: internalName,
            parameters,
            assistantMessage
        }
    }
}

module.exports = ModelClient
