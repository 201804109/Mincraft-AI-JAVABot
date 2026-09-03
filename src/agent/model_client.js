const OpenAI = require('openai')

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
                name: tool.name,
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

        if (toolCalls.length === 0) {
            return {
                type: 'text',
                text: message.content || ''
            }
        }

        if (toolCalls.length > 1) {
            return {
                type: 'error',
                reason: 'MULTIPLE_TOOL_CALLS_NOT_SUPPORTED'
            }
        }

        const call = toolCalls[0]
        let parameters

        try {
            parameters = JSON.parse(call.function.arguments)
        } catch (error) {
            return {
                type: 'error',
                reason: 'INVALID_TOOL_ARGUMENTS'
            }
        }

        return {
            type: 'tool_call',
            id: call.id,
            name: call.function.name,
            parameters
        }
    }
}

module.exports = ModelClient
