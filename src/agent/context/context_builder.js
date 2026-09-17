class ContextBuilder {
    constructor(options = {}) {
        this.sessionMemory = options.sessionMemory
        this.systemPrompt = options.systemPrompt
    }

    build(task, goal) {
        task.addMessage({
            role: 'system',
            content: this.systemPrompt
        })

        for (const message of this.sessionMemory.getMessages()) {
            task.addMessage(message)
        }

        const userMessage = {
            role: 'user',
            content: goal
        }
        task.addMessage(userMessage)

        return userMessage
    }
}

module.exports = ContextBuilder
