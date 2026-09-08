const Task = require('./task')
const { validateQuery } = require('./policy/query_policy')
const SYSTEM_PROMPT = require('./prompt/system_prompt')

const MAX_PROTOCOL_RETRIES = 2

const ALLOWED_ACTION_TOOLS = new Set([
    'navigate',
    'place',
    'break'
])
const ALLOWED_QUERY_TOOLS = new Set([
    'self.getPosition',
    'voxel.getBlock',
    'voxel.getVolume',
    'voxel.getSurroundings',
    'surface.getColumn',
    'surface.getChunk',
    'surface.getArea',
    'area.getAreaSummary',
    'area.getAreaGrid',
    'area.getRegions'
])
function isAllowed(name) {
    return ALLOWED_ACTION_TOOLS.has(name) || ALLOWED_QUERY_TOOLS.has(name)
}

function logToolResultSummary(name, toolResult) {
    const data = toolResult?.data
    const details = []
    const coverage = typeof data?.coverage === 'number'
        ? data.coverage
        : data?.coverage?.ratio

    if (typeof coverage === 'number') details.push(`coverage=${coverage}`)
    if (Array.isArray(data?.blocks)) details.push(`blocks=${data.blocks.length}`)
    if (Array.isArray(data?.regions)) details.push(`regions=${data.regions.length}`)

    const suffix = details.length > 0 ? ` ${details.join(' ')}` : ''
    console.log(
        `[Agent] Tool completed: ${name} success=${toolResult?.success === true}${suffix}`
    )
}

function canCommitTrace(messages) {
    const last = messages[messages.length - 1]
    return Boolean(
        last &&
        (
            last.role === 'tool' ||
            (
                last.role === 'assistant' &&
                !Array.isArray(last.tool_calls)
            )
        )
    )
}

class AgentRuntime {
    constructor(options = {}) {
        this.modelClient = options.modelClient
        this.toolRegistry = options.toolRegistry
        this.aiInterface = options.aiInterface
        this.sessionMemory = options.sessionMemory
        this.maxIterations = options.maxIterations ?? 32
        this.maxDurationMs = options.maxDurationMs ?? 180000
        this.maxRepeatedSteps = options.maxRepeatedSteps ?? 3
        this.queueTail = Promise.resolve()
    }

    run(goal) {
        const execution = this.queueTail.then(() => this.runInternal(goal))
        this.queueTail = execution.then(() => undefined, () => undefined)
        return execution
    }

    async runInternal(goal) {
        const task = new Task(goal)
        task.addMessage({
            role: 'system',
            content: SYSTEM_PROMPT
        })
        for (const message of this.sessionMemory.getMessages()) {
            task.addMessage(message)
        }
        const userMessage = {
            role: 'user',
            content: goal
        }
        task.addMessage(userMessage)
        const turnMessages = [userMessage]
        const startedAt = Date.now()
        let lastStep = null
        let repeatedSteps = 0
        let lastToolResult = null
        let protocolRetries = 0
        let traceCommitted = false

        const commitCompletedTrace = () => {
            if (traceCommitted) return

            let completedMessages = turnMessages
            const last = completedMessages[completedMessages.length - 1]
            if (
                last?.role === 'assistant' &&
                Array.isArray(last.tool_calls)
            ) {
                completedMessages = completedMessages.slice(0, -1)
            }

            if (canCommitTrace(completedMessages)) {
                this.sessionMemory.appendTurn(completedMessages)
                traceCommitted = true
            }
        }

        console.log(`[Agent] User: ${goal}`)
        console.log(`[Agent] Context messages: ${task.messages.length}`)

        try {
            const tools = this.toolRegistry
                .getAllTools()
                .filter(tool => isAllowed(tool.name))
                .map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters
                }))

            while (task.status === 'running') {
                if (task.iteration >= this.maxIterations) {
                    task.fail()
                    commitCompletedTrace()
                    return {
                        success: false,
                        reason: 'AGENT_BUDGET_EXCEEDED',
                        agentOutput: null,
                        toolResult: null,
                        task
                    }
                }

                if (Date.now() - startedAt >= this.maxDurationMs) {
                    task.fail()
                    commitCompletedTrace()
                    return {
                        success: false,
                        reason: 'AGENT_TIMEOUT',
                        agentOutput: null,
                        toolResult: null,
                        task
                    }
                }

                task.incrementIteration()
                const response = await this.modelClient.chat(task.messages, tools)

                if (response.type === 'text') {
                    protocolRetries = 0
                    task.addMessage(response.assistantMessage)
                    turnMessages.push(response.assistantMessage)
                    task.finish()
                    commitCompletedTrace()
                    return {
                        success: true,
                        agentOutput: response.text,
                        toolResult: lastToolResult,
                        task
                    }
                }

                if (response.type === 'error') {
                    if (response.reason === 'MULTIPLE_TOOL_CALLS_NOT_SUPPORTED') {
                        protocolRetries++

                        if (protocolRetries > MAX_PROTOCOL_RETRIES) {
                            task.fail()
                            commitCompletedTrace()
                            return {
                                success: false,
                                reason: 'MULTIPLE_TOOL_CALLS_NOT_SUPPORTED',
                                agentOutput: null,
                                toolResult: lastToolResult,
                                task
                            }
                        }

                        task.addMessage({
                            role: 'system',
                            content:
                                'You attempted to call multiple tools in one response. ' +
                                'Only ONE tool may be called per iteration. ' +
                                'Choose the single most useful next tool now, wait for its result, ' +
                                'and continue sequentially.'
                        })

                        console.log(
                            `[Agent] Multiple tool calls rejected; retrying ` +
                            `(${protocolRetries}/${MAX_PROTOCOL_RETRIES})`
                        )
                        continue
                    }

                    task.fail()
                    commitCompletedTrace()
                    return {
                        success: false,
                        reason: response.reason,
                        agentOutput: null,
                        toolResult: lastToolResult,
                        task
                    }
                }

                if (response.type !== 'tool_call') {
                    task.fail()
                    commitCompletedTrace()
                    return {
                        success: false,
                        reason: 'INVALID_MODEL_RESPONSE',
                        agentOutput: null,
                        toolResult: null,
                        task
                    }
                }

                protocolRetries = 0

                console.log(`[Agent] Model selected tool: ${response.name}`)
                console.log(`[Agent] Parameters: ${JSON.stringify(response.parameters)}`)

                if (!isAllowed(response.name)) {
                    task.fail()
                    commitCompletedTrace()
                    return {
                        success: false,
                        reason: 'TOOL_NOT_ALLOWED',
                        agentOutput: null,
                        toolResult: null,
                        task
                    }
                }

                const definition = this.toolRegistry.getToolDefinition(response.name)
                if (!definition) {
                    task.fail()
                    commitCompletedTrace()
                    return {
                        success: false,
                        reason: 'UNKNOWN_TOOL',
                        agentOutput: null,
                        toolResult: null,
                        task
                    }
                }

                task.addMessage(response.assistantMessage)
                turnMessages.push(response.assistantMessage)

                const request = {
                    type: definition.type,
                    name: definition.name,
                    parameters: response.parameters
                }
                const validationError = definition.type === 'query'
                    ? validateQuery(definition.name, response.parameters)
                    : null
                const toolResult = validationError
                    ? {
                        success: false,
                        type: definition.type,
                        name: definition.name,
                        reason: validationError,
                        data: null
                    }
                    : await this.aiInterface.handle(request)
                lastToolResult = toolResult

                const toolResultMessage = {
                    role: 'tool',
                    tool_call_id: response.id,
                    content: JSON.stringify(toolResult)
                }
                task.addMessage(toolResultMessage)
                turnMessages.push(toolResultMessage)
                logToolResultSummary(definition.name, toolResult)

                const currentStep = {
                    name: definition.name,
                    parametersJson: JSON.stringify(response.parameters),
                    resultJson: toolResultMessage.content
                }
                const sameAsLast = Boolean(
                    lastStep &&
                    lastStep.name === currentStep.name &&
                    lastStep.parametersJson === currentStep.parametersJson &&
                    lastStep.resultJson === currentStep.resultJson
                )
                repeatedSteps = sameAsLast ? repeatedSteps + 1 : 1
                lastStep = currentStep

                if (repeatedSteps >= this.maxRepeatedSteps) {
                    task.fail()
                    commitCompletedTrace()
                    return {
                        success: false,
                        reason: 'AGENT_NO_PROGRESS',
                        agentOutput: null,
                        toolResult,
                        task
                    }
                }
            }
        } catch (error) {
            task.fail()
            commitCompletedTrace()
            return {
                success: false,
                reason: 'MODEL_ERROR',
                error: error.message,
                agentOutput: null,
                toolResult: null,
                task
            }
        }
    }
}

module.exports = AgentRuntime
