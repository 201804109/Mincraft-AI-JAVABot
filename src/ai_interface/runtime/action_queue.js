const registry = require('../tools/registry')
const { createFailureResult } = require('../result')
const { validateAction } = require('./action_validator')

let queueTail = Promise.resolve()

function enqueueAction(bot, name, parameters) {
    const execution = queueTail.then(() =>
        executeQueuedAction(bot, name, parameters)
    )

    queueTail = execution.then(
        () => undefined,
        () => undefined
    )

    return execution
}

async function executeQueuedAction(bot, name, parameters) {
    try {
        const validation = validateAction(name, parameters)

        if (!validation.valid) {
            return createFailureResult('action', name, validation.reason)
        }

        const tool = registry.getToolModule(name)
        return await tool.execute({ bot, parameters })
    } catch (error) {
        console.error('Action Queue执行异常:', error)
        return createFailureResult(
            'action',
            name || 'unknown',
            'EXECUTION_ERROR'
        )
    }
}

module.exports = {
    enqueueAction
}
