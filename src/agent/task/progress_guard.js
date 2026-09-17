class ProgressGuard {
    constructor(options = {}) {
        this.maxRepeatedSteps = options.maxRepeatedSteps ?? 3
        this.lastStep = null
        this.repeatedSteps = 0
    }

    record(name, parametersJson, resultJson) {
        const currentStep = { name, parametersJson, resultJson }
        const sameAsLast = Boolean(
            this.lastStep &&
            this.lastStep.name === currentStep.name &&
            this.lastStep.parametersJson === currentStep.parametersJson &&
            this.lastStep.resultJson === currentStep.resultJson
        )

        this.repeatedSteps = sameAsLast ? this.repeatedSteps + 1 : 1
        this.lastStep = currentStep
    }

    hasNoProgress() {
        return this.repeatedSteps >= this.maxRepeatedSteps
    }
}

module.exports = ProgressGuard
