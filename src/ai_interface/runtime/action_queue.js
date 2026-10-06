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
        const context = { bot, parameters }
        if (name === 'build_from_plan') {
            context.executeNestedAction = request => executeNestedAction(bot, request)
        }
        return await tool.execute(context)
    } catch (error) {
        console.error('Action Queue执行异常:', error)
        return createFailureResult(
            'action',
            name || 'unknown',
            'EXECUTION_ERROR'
        )
    }
}

async function executeNestedAction(bot, request) {
    if (!request || request.type !== 'action' ||
        !['batch_break', 'batch_place'].includes(request.name)) {
        return createFailureResult('action', request && request.name || 'unknown', 'NESTED_ACTION_NOT_ALLOWED')
    }
    return executeQueuedAction(bot, request.name, request.parameters)
}

module.exports = {
    enqueueAction
}
