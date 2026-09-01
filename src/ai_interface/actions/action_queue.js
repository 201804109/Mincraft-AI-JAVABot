const { executeAction } = require('./executor')
const { createFailureResult } = require('../result')

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
        return await executeAction(bot, name, parameters)
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
