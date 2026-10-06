const { executeBuildPlan } = require('../executor/executor')

class BuildSession {
    constructor(executionPlan, options = {}) {
        const settings = options && typeof options === 'object' && !Array.isArray(options) ? options : {}
        this._executionPlan = cloneValue(executionPlan)
        this._executor = typeof settings.executeBuildPlan === 'function'
            ? settings.executeBuildPlan
            : executeBuildPlan
        this._executorOptions = { ...settings }
        delete this._executorOptions.executeBuildPlan
        this._externalProgressCallback = this._executorOptions.onLayerCompleted
        this._externalStopCheck = this._executorOptions.shouldStop
        delete this._executorOptions.onLayerCompleted
        delete this._executorOptions.shouldStop

        this.status = 'pending'
        this.result = null
        this.error = null
        this.createdAt = new Date().toISOString()
        this.startedAt = null
        this.finishedAt = null
        this.totalLayers = Array.isArray(executionPlan) ? executionPlan.length : 0
        this.completedLayers = 0
        this._stopRequested = false
        this._runPromise = null
    }

    start() {
        if (this.status !== 'pending') {
            return Promise.reject(createSessionError('SESSION_ALREADY_STARTED', 'BuildSession can only be started once.'))
        }

        this.status = 'running'
        this.startedAt = new Date().toISOString()
        this._runPromise = this._run()
        return this._runPromise
    }

    async _run() {
        try {
            const result = await this._executor(this._executionPlan, {
                ...this._executorOptions,
                onLayerCompleted: async progress => {
                    this._updateProgress(progress)
                    if (typeof this._externalProgressCallback === 'function') {
                        await this._externalProgressCallback(progress)
                    }
                },
                shouldStop: () => this._stopRequested || (
                    typeof this._externalStopCheck === 'function' && this._externalStopCheck() === true
                )
            })

            this.result = cloneValue(result)
            if (result && Number.isInteger(result.completedLayers)) {
                this.completedLayers = result.completedLayers
            }
            if (result && result.stopped === true) {
                this.status = 'stopped'
            } else if (result && result.success === true) {
                this.status = 'completed'
                this.completedLayers = this.totalLayers
            } else {
                this.status = 'failed'
            }
            this.finishedAt = new Date().toISOString()
            return cloneValue(this.result)
        } catch (error) {
            this.error = serializeError(error)
            this.result = {
                success: false,
                reason: 'EXECUTOR_ERROR',
                error: cloneValue(this.error)
            }
            this.status = 'failed'
            this.finishedAt = new Date().toISOString()
            return cloneValue(this.result)
        }
    }

    stop() {
        if (this.status === 'pending') {
            this._stopRequested = true
            this.status = 'stopped'
            this.finishedAt = new Date().toISOString()
            this.result = {
                success: false,
                stopped: true,
                reason: 'STOP_REQUESTED',
                completedLayers: 0,
                totalLayers: this.totalLayers,
                results: []
            }
            return this.getStatus()
        }

        if (this.status === 'running') {
            this._stopRequested = true
        }
        return this.getStatus()
    }

    getStatus() {
        const totalLayers = this.totalLayers
        const completedLayers = this.completedLayers
        const percentage = totalLayers === 0
            ? (this.status === 'completed' ? 100 : 0)
            : Math.round((completedLayers / totalLayers) * 100)

        return {
            status: this.status,
            progress: { totalLayers, completedLayers, percentage },
            result: cloneValue(this.result),
            error: cloneValue(this.error),
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            finishedAt: this.finishedAt
        }
    }

    _updateProgress(progress) {
        if (progress && Number.isInteger(progress.completedLayers)) {
            this.completedLayers = progress.completedLayers
        }
        if (progress && Number.isInteger(progress.totalLayers)) {
            this.totalLayers = progress.totalLayers
        }
    }
}

function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue)
    if (value && typeof value === 'object') {
        const copy = {}
        for (const [key, item] of Object.entries(value)) copy[key] = cloneValue(item)
        return copy
    }
    return value
}

function serializeError(error) {
    if (!error) return { name: 'Error', message: 'Unknown executor error.' }
    return {
        name: typeof error.name === 'string' ? error.name : 'Error',
        message: typeof error.message === 'string' ? error.message : String(error),
        ...(typeof error.code === 'string' ? { code: error.code } : {})
    }
}

function createSessionError(code, message) {
    const error = new Error(message)
    error.code = code
    return error
}

module.exports = {
    BuildSession
}
