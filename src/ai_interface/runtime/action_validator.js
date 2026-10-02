const ALLOWED_ACTIONS = new Set([
    'navigate',
    'place',
    'break',
    'batch_place',
    'batch_break'
])

function validateAction(name, parameters) {
    if (typeof name !== 'string' || !ALLOWED_ACTIONS.has(name)) {
        return invalid('UNKNOWN_ACTION')
    }

    if (!isObject(parameters)) {
        return invalid('INVALID_ARGUMENT')
    }

    if (name === 'navigate') {
        return hasFinitePosition(parameters.position)
            ? { valid: true }
            : invalid('INVALID_ARGUMENT')
    }

    if (name === 'place') {
        return hasIntegerPosition(parameters.position) &&
            typeof parameters.block === 'string' &&
            parameters.block.trim().length > 0
            ? { valid: true }
            : invalid('INVALID_ARGUMENT')
    }

    if (name === 'break') {
        return hasIntegerPosition(parameters.position)
            ? { valid: true }
            : invalid('INVALID_ARGUMENT')
    }

    if (name === 'batch_place') {
        if (!Array.isArray(parameters.blocks) || !parameters.blocks.every(block =>
            isObject(block) &&
            typeof block.block === 'string' &&
            block.block.trim().length > 0 &&
            hasIntegerPosition(block.position)
        )) {
            return invalid('INVALID_ARGUMENT')
        }
        return { valid: true }
    }

    if (name === 'batch_break') {
        if (!Array.isArray(parameters.positions) || !parameters.positions.every(hasIntegerPosition)) {
            return invalid('INVALID_ARGUMENT')
        }
        return { valid: true }
    }

    return invalid('UNKNOWN_ACTION')
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
