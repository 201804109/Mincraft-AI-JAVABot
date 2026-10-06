function generateLayerBatches(layer) {
    validateLayer(layer)

    return {
        y: layer.y,
        breakBatch: {
            positions: layer.break.map((task, index) => copyBreakTask(task, index))
        },
        placeBatch: {
            blocks: layer.place.map((task, index) => copyPlaceTask(task, index))
        }
    }
}

function generateBatches(layers) {
    if (!Array.isArray(layers)) {
        throw new TypeError('layers must be an array.')
    }
    return layers.map(generateLayerBatches)
}

function validateLayer(layer) {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
        throw new TypeError('layer must be an object.')
    }
    if (!Number.isInteger(layer.y)) {
        throw new TypeError('layer.y must be an integer.')
    }
    if (!Array.isArray(layer.break)) {
        throw new TypeError('layer.break must be an array.')
    }
    if (!Array.isArray(layer.place)) {
        throw new TypeError('layer.place must be an array.')
    }
}

function copyBreakTask(task, index) {
    if (!isObject(task) || !hasIntegerCoordinates(task)) {
        throw new TypeError(`layer.break[${index}] must have integer x, y, and z coordinates.`)
    }
    return { ...task }
}

function copyPlaceTask(task, index) {
    if (!isObject(task) || typeof task.block !== 'string' || task.block.trim().length === 0 ||
        !isObject(task.position) || !hasIntegerCoordinates(task.position)) {
        throw new TypeError(`layer.place[${index}] must have a block name and integer position coordinates.`)
    }
    return {
        ...task,
        position: { ...task.position }
    }
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasIntegerCoordinates(position) {
    return ['x', 'y', 'z'].every(axis => Number.isInteger(position[axis]))
}

module.exports = {
    generateLayerBatches,
    generateBatches
}
