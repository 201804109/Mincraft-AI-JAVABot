function scheduleLayers(layers) {
    if (!Array.isArray(layers)) {
        throw new TypeError('layers must be an array.')
    }

    layers.forEach((layer, index) => {
        if (!layer || typeof layer !== 'object' || Array.isArray(layer) || !Number.isInteger(layer.y)) {
            throw new TypeError(`layers[${index}] must be an object with an integer y.`)
        }
    })

    return layers
        .map((layer, index) => ({ layer, index }))
        .sort((a, b) => a.layer.y - b.layer.y || a.index - b.index)
        .map(entry => entry.layer)
}

module.exports = {
    scheduleLayers
}
