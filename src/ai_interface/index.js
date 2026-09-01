const { enqueueAction } = require('./actions/action_queue')
const { executeQuery } = require('./queries/executor')
const { createFailureResult } = require('./result')

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
