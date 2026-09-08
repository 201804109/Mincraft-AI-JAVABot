class SessionMemory {
    constructor(options = {}) {
        this.maxTurns = options.maxTurns ?? 10
        if (!Number.isInteger(this.maxTurns) || this.maxTurns < 1) {
            throw new RangeError('maxTurns must be a positive integer')
        }
        this.turns = []
    }

    getMessages() {
        return JSON.parse(JSON.stringify(this.turns.flat()))
    }

    appendTurn(messages) {
        this.turns.push(JSON.parse(JSON.stringify(messages)))
        while (this.turns.length > this.maxTurns) {
            this.turns.shift()
        }
    }

    clear() {
        this.turns = []
    }
}

module.exports = SessionMemory
