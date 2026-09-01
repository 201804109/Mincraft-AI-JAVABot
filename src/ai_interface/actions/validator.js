const ALLOWED_ACTIONS = new Set([
    'navigate',
    'place',
    'break'
])

function validateAction(name, parameters) {
    if (typeof name !== 'string' || !ALLOWED_ACTIONS.has(name)) {
        return invalid('UNKNOWN_ACTION')
    }

    if (!isObject(parameters) || !hasFinitePosition(parameters.position)) {
        return invalid('INVALID_ARGUMENT')
    }

    if (name === 'place') {
        if (
            !hasIntegerPosition(parameters.position) ||
            typeof parameters.block !== 'string' ||
            parameters.block.trim().length === 0
        ) {
            return invalid('INVALID_ARGUMENT')
        }
    }

    if (name === 'break' && !hasIntegerPosition(parameters.position)) {
        return invalid('INVALID_ARGUMENT')
    }

    return { valid: true }
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

function invalid(reason) {
    return {
        valid: false,
        reason
    }
}

module.exports = {
    validateAction
}
