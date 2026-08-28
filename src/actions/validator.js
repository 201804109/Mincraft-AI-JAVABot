const ALLOWED_ACTIONS = new Set([
    'navigate',
    'place',
    'break'
])

function validateAction(command) {
    if (!isObject(command)) {
        return invalid('unknown', 'INVALID_ARGUMENT')
    }

    if (typeof command.action !== 'string' || command.action.trim().length === 0) {
        return invalid('unknown', 'INVALID_ARGUMENT')
    }

    const action = command.action

    if (!ALLOWED_ACTIONS.has(action)) {
        return invalid(action, 'UNKNOWN_ACTION')
    }

    if (!hasFinitePosition(command.position)) {
        return invalid(action, 'INVALID_ARGUMENT')
    }

    if (action === 'place') {
        if (
            !hasIntegerPosition(command.position) ||
            typeof command.block !== 'string' ||
            command.block.trim().length === 0
        ) {
            return invalid(action, 'INVALID_ARGUMENT')
        }
    }

    if (action === 'break' && !hasIntegerPosition(command.position)) {
        return invalid(action, 'INVALID_ARGUMENT')
    }

    return {
        valid: true,
        action
    }
}

function hasFinitePosition(position) {
    return isObject(position) &&
        [position.x, position.y, position.z].every(value =>
            typeof value === 'number' && Number.isFinite(value)
        )
}

function hasIntegerPosition(position) {
    return [position.x, position.y, position.z].every(Number.isInteger)
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function invalid(action, reason) {
    return {
        valid: false,
        action,
        reason
    }
}

module.exports = {
    validateAction
}
