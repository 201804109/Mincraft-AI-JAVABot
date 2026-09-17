const SYSTEM_PROMPT = require('./prompt/system_prompt')
const ContextBuilder = require('./context/context_builder')
const TaskRunner = require('./task/task_runner')

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

        this.contextBuilder = new ContextBuilder({
            sessionMemory: this.sessionMemory,
            systemPrompt: SYSTEM_PROMPT
        })
        this.taskRunner = new TaskRunner({
            modelClient: this.modelClient,
            toolRegistry: this.toolRegistry,
            aiInterface: this.aiInterface,
            sessionMemory: this.sessionMemory,
            contextBuilder: this.contextBuilder,
            maxIterations: this.maxIterations,
            maxDurationMs: this.maxDurationMs,
            maxRepeatedSteps: this.maxRepeatedSteps
        })
    }

    run(goal) {
        const execution = this.queueTail.then(() => {
            this.contextBuilder.sessionMemory = this.sessionMemory
            this.taskRunner.modelClient = this.modelClient
            this.taskRunner.toolRegistry = this.toolRegistry
            this.taskRunner.aiInterface = this.aiInterface
            this.taskRunner.sessionMemory = this.sessionMemory
            this.taskRunner.contextBuilder = this.contextBuilder
            this.taskRunner.maxIterations = this.maxIterations
            this.taskRunner.maxDurationMs = this.maxDurationMs
            this.taskRunner.maxRepeatedSteps = this.maxRepeatedSteps
            return this.taskRunner.run(goal)
        })
        this.queueTail = execution.then(() => undefined, () => undefined)
        return execution
    }
}

module.exports = AgentRuntime
