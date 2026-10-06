const TOP_LEVEL_FIELDS = new Set(['formatVersion', 'name', 'origin', 'size', 'blocks'])
const COORDINATE_FIELDS = new Set(['x', 'y', 'z'])
const BLOCK_FIELDS = new Set(['block', 'position'])
const BLOCK_ID_PATTERN = /^minecraft:[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/

function validateBuildingPlan(plan) {
    const errors = []

    if (!isPlainObject(plan)) {
        addError(errors, 'INVALID_PLAN', '$', 'BuildingPlan must be a plain object.')
        return { valid: false, errors }
    }

    checkUnknownFields(plan, TOP_LEVEL_FIELDS, '$', errors)
    for (const field of TOP_LEVEL_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(plan, field)) {
            addError(errors, 'MISSING_REQUIRED_FIELD', field, `Required field "${field}" is missing.`)
        }
    }

    if (Object.prototype.hasOwnProperty.call(plan, 'formatVersion') && plan.formatVersion !== '1.0') {
        addError(errors, 'INVALID_FORMAT_VERSION', 'formatVersion', 'formatVersion must be "1.0".')
    }

    if (Object.prototype.hasOwnProperty.call(plan, 'name') &&
        (typeof plan.name !== 'string' || plan.name.trim().length === 0)) {
        addError(errors, 'INVALID_NAME', 'name', 'name must be a non-empty string after trimming.')
    }

    validateCoordinates(plan.origin, 'origin', errors, { integer: true }, Object.prototype.hasOwnProperty.call(plan, 'origin'))
    validateCoordinates(plan.size, 'size', errors, { positive: true }, Object.prototype.hasOwnProperty.call(plan, 'size'))

    const validSize = isPlainObject(plan.size) && ['x', 'y', 'z'].every(axis =>
        Number.isInteger(plan.size[axis]) && plan.size[axis] > 0)

    if (!Array.isArray(plan.blocks)) {
        if (Object.prototype.hasOwnProperty.call(plan, 'blocks')) {
            addError(errors, 'INVALID_BLOCKS', 'blocks', 'blocks must be an array.')
        }
    } else {
        if (plan.blocks.length === 0) {
            addError(errors, 'EMPTY_BLOCKS', 'blocks', 'blocks must contain at least one target block.')
        }
        validateBlocks(plan.blocks, validSize ? plan.size : null, errors)
    }

    return { valid: errors.length === 0, errors }
}

function validateBlocks(blocks, size, errors) {
    const positions = new Set()

    blocks.forEach((item, index) => {
        const basePath = `blocks[${index}]`
        if (!isPlainObject(item)) {
            addError(errors, 'INVALID_BLOCK_ITEM', basePath, 'Block item must be a plain object.')
            return
        }

        checkUnknownFields(item, BLOCK_FIELDS, basePath, errors)
        for (const field of BLOCK_FIELDS) {
            if (!Object.prototype.hasOwnProperty.call(item, field)) {
                addError(errors, 'MISSING_REQUIRED_FIELD', `${basePath}.${field}`, `Required field "${field}" is missing.`)
            }
        }

        if (Object.prototype.hasOwnProperty.call(item, 'block')) {
            if (typeof item.block !== 'string' || item.block.trim().length === 0 || !BLOCK_ID_PATTERN.test(item.block)) {
                addError(errors, 'INVALID_BLOCK_ID', `${basePath}.block`, 'block must be a Minecraft namespaced ID using the minecraft: namespace.')
            } else if (item.block === 'minecraft:air') {
                addError(errors, 'EXPLICIT_AIR_BLOCK', `${basePath}.block`, 'minecraft:air must not be listed in blocks.')
            }
        }

        const position = item.position
        if (!isPlainObject(position)) {
            if (Object.prototype.hasOwnProperty.call(item, 'position')) {
                addError(errors, 'INVALID_POSITION', `${basePath}.position`, 'position must be a plain object.')
            }
            return
        }

        checkUnknownFields(position, COORDINATE_FIELDS, `${basePath}.position`, errors)
        for (const axis of COORDINATE_FIELDS) {
            if (!Object.prototype.hasOwnProperty.call(position, axis)) {
                addError(errors, 'MISSING_REQUIRED_FIELD', `${basePath}.position.${axis}`, `Required coordinate "${axis}" is missing.`)
            } else if (!Number.isInteger(position[axis])) {
                addError(errors, 'INVALID_BLOCK_POSITION', `${basePath}.position.${axis}`, `${axis} must be an integer.`)
            }
        }

        if (!['x', 'y', 'z'].every(axis => Number.isInteger(position[axis]))) return

        const key = `${position.x},${position.y},${position.z}`
        if (positions.has(key)) {
            addError(errors, 'DUPLICATE_BLOCK_POSITION', `${basePath}.position`, `Position (${key}) is already used by another block.`)
        } else {
            positions.add(key)
        }

        if (size && ['x', 'y', 'z'].some(axis => position[axis] < 0 || position[axis] >= size[axis])) {
            addError(errors, 'BLOCK_POSITION_OUT_OF_BOUNDS', `${basePath}.position`, 'position must be within the size-defined local coordinate bounds.')
        }
    })
}

function validateCoordinates(value, path, errors, options, present) {
    if (!isPlainObject(value)) {
        if (present) {
            addError(errors, 'INVALID_COORDINATES', path, `${path} must be an object with x, y, and z.`)
        }
        return
    }

    checkUnknownFields(value, COORDINATE_FIELDS, path, errors)
    for (const axis of COORDINATE_FIELDS) {
        const axisPath = `${path}.${axis}`
        if (!Object.prototype.hasOwnProperty.call(value, axis)) {
            addError(errors, 'MISSING_REQUIRED_FIELD', axisPath, `Required coordinate "${axis}" is missing.`)
        } else if (!Number.isInteger(value[axis])) {
            addError(errors, options.positive ? 'INVALID_SIZE' : 'INVALID_COORDINATE', axisPath, `${axis} must be an integer${options.positive ? ' greater than zero' : ''}.`)
        } else if (options.positive && value[axis] <= 0) {
            addError(errors, 'INVALID_SIZE', axisPath, `${axis} must be greater than zero.`)
        }
    }
}

function checkUnknownFields(object, allowed, path, errors) {
    for (const field of Object.keys(object)) {
        if (!allowed.has(field)) {
            addError(errors, 'UNKNOWN_FIELD', path === '$' ? field : `${path}.${field}`, `Field "${field}" is not defined in BuildingPlan V1.`)
        }
    }
}

function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

function addError(errors, code, path, message) {
    errors.push({ code, path, message })
}

module.exports = {
    validateBuildingPlan
}
