class Task {
    constructor(goal) {
        this.goal = goal
        this.messages = []
        this.iteration = 0
        this.status = 'running'
    }

    addMessage(message) {
        this.messages.push(message)
    }

    incrementIteration() {
        this.iteration++
    }

    finish() {
        this.status = 'finished'
    }

    fail() {
        this.status = 'failed'
    }
}

module.exports = Task
