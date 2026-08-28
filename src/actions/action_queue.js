const { executeAction } = require('./executor')
const { createFailureResult } = require('./result')

let queueTail = Promise.resolve()

function enqueueAction(bot, action) {
    const execution = queueTail.then(() => executeQueuedAction(bot, action))

    queueTail = execution.then(
        () => undefined,
        () => undefined
    )

    return execution
}

async function executeQueuedAction(bot, action) {
    try {
        return await executeAction(bot, action)
    } catch (error) {
        console.error('Action Queue执行异常:', error)
        return createFailureResult(
            action?.action ?? 'unknown',
            'EXECUTION_ERROR'
        )
    }
}

module.exports = {
    enqueueAction
}
