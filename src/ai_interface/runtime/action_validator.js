const ALLOWED_ACTIONS = new Set([
    'navigate',
    'place',
    'break',
    'batch_place',
    'batch_break',
    'building.plan.createDraft',
    'building.plan.updateDraft',
    'building.plan.commitDraft',
    'build_from_plan'
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

    if (name === 'building.plan.createDraft' || name === 'building.plan.updateDraft') {
        return isPlainObject(parameters) &&
            typeof parameters.planId === 'string' && parameters.planId.trim().length > 0 &&
            isPlainObject(parameters.document)
            ? { valid: true }
            : invalid('INVALID_ARGUMENT')
    }

    if (name === 'building.plan.commitDraft') {
        return typeof parameters.planId === 'string' && parameters.planId.trim().length > 0
            ? { valid: true }
            : invalid('INVALID_ARGUMENT')
    }

    if (name === 'build_from_plan') {
        return typeof parameters.planId === 'string' && parameters.planId.trim().length > 0
            ? { valid: true }
            : invalid('INVALID_ARGUMENT')
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

function isPlainObject(value) {
    if (!isObject(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
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
