const { enqueueAction } = require('./runtime/action_queue')
const registry = require('./tools/registry')
const {
    createSuccessResult,
    createFailureResult
} = require('./result')

const REQUEST_TYPES = new Set(['action', 'query'])

let bot = null

function init(_bot) {
    bot = _bot
}

async function handle(request) {
    const validation = validateRequest(request)
    if (!validation.valid) {
        return createFailureResult(
            validation.type,
            validation.name,
            validation.reason
        )
    }

    const tool = registry.getToolDefinition(request.name)
    if (!tool || tool.type !== request.type) {
        return createFailureResult(
            request.type,
            request.name,
            'UNKNOWN_TOOL'
        )
    }

    if (request.type === 'action') {
        if (!bot) {
            return createFailureResult(
                'action',
                request.name,
                'BOT_NOT_INITIALIZED'
            )
        }

        return enqueueAction(bot, request.name, request.parameters)
    }

    return executeQuery(request.name, request.parameters, bot)
}

function executeQuery(name, parameters, queryBot = null) {
    const tool = registry.getToolModule(name)

    if (!tool) {
        return createFailureResult('query', name, 'UNKNOWN_QUERY')
    }

    try {
        return createSuccessResult(
            'query',
            name,
            tool.execute({ bot: queryBot, parameters })
        )
    } catch (error) {
        console.error(`Query执行失败 (${name}):`, error)
        return createFailureResult(
            'query',
            name,
            error?.code || 'INVALID_QUERY_PARAMETERS'
        )
    }
}

function validateRequest(request) {
    if (!isObject(request)) {
        return invalid('unknown', 'unknown', 'INVALID_REQUEST')
    }

    const type = typeof request.type === 'string'
        ? request.type
        : 'unknown'
    const name = typeof request.name === 'string' &&
        request.name.trim().length > 0
        ? request.name
        : 'unknown'

    if (!REQUEST_TYPES.has(type) || name === 'unknown') {
        return invalid(type, name, 'INVALID_REQUEST')
    }

    if (!isObject(request.parameters)) {
        return invalid(type, name, 'INVALID_PARAMETERS')
    }

    return { valid: true }
}

function invalid(type, name, reason) {
    return {
        valid: false,
        type,
        name,
        reason
    }
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

module.exports = {
    init,
    handle
}
