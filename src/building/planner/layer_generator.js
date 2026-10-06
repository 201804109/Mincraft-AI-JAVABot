function generateLayers(diff) {
    if (!diff || typeof diff !== 'object' || Array.isArray(diff)) {
        throw new TypeError('diff must be an object.')
    }
    if (!Array.isArray(diff.break)) {
        throw new TypeError('diff.break must be an array.')
    }
    if (!Array.isArray(diff.place)) {
        throw new TypeError('diff.place must be an array.')
    }

    const layersByY = new Map()

    for (const item of diff.break) {
        const y = getTaskY(item, 'break')
        getOrCreateLayer(layersByY, y).break.push(copyTask(item))
    }

    for (const item of diff.place) {
        const y = getTaskY(item, 'place')
        getOrCreateLayer(layersByY, y).place.push(copyTask(item))
    }

    return Array.from(layersByY.values())
}

function getTaskY(item, type) {
    const y = type === 'break'
        ? item && item.y
        : item && item.position && item.position.y
    if (!Number.isInteger(y)) {
        throw new TypeError(`Every ${type} task must have an integer world Y coordinate.`)
    }
    return y
}

function getOrCreateLayer(layersByY, y) {
    if (!layersByY.has(y)) {
        layersByY.set(y, { y, break: [], place: [] })
    }
    return layersByY.get(y)
}

function copyTask(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TypeError('Each diff task must be an object.')
    }
    const copy = { ...item }
    if (item.position && typeof item.position === 'object' && !Array.isArray(item.position)) {
        copy.position = { ...item.position }
    }
    return copy
}

module.exports = {
    generateLayers
}
