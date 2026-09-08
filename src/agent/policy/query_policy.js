const MAX_SURROUNDINGS_HORIZONTAL_RADIUS = 8
const MAX_SURROUNDINGS_VERTICAL_RADIUS = 4
const MAX_VOLUME_BLOCKS = 4096
const MAX_AREA_WIDTH = 64
const MAX_AREA_DEPTH = 64
const MAX_GRID_CELLS = 1024

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function get2DSize(bounds) {
    if (
        !isPlainObject(bounds) ||
        ![bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ]
            .every(Number.isSafeInteger)
    ) return null

    const width = bounds.maxX - bounds.minX + 1
    const depth = bounds.maxZ - bounds.minZ + 1
    return width > 0 && depth > 0 ? { width, depth } : null
}

function get3DSize(bounds) {
    if (
        !isPlainObject(bounds) ||
        ![
            bounds.minX,
            bounds.maxX,
            bounds.minY,
            bounds.maxY,
            bounds.minZ,
            bounds.maxZ
        ].every(Number.isSafeInteger)
    ) return null

    const width = bounds.maxX - bounds.minX + 1
    const height = bounds.maxY - bounds.minY + 1
    const depth = bounds.maxZ - bounds.minZ + 1
    if (width <= 0 || height <= 0 || depth <= 0) return null

    return { width, height, depth, volume: width * height * depth }
}

function getResolution(parameters) {
    if (parameters.options === undefined) return 1
    if (!isPlainObject(parameters.options)) return null

    const resolution = parameters.options.resolution ?? 1
    return Number.isSafeInteger(resolution) && resolution >= 1
        ? resolution
        : null
}

// Agent-only limits; internal APIs retain their existing contracts.
function validateQuery(name, parameters) {
    if (!isPlainObject(parameters)) return 'INVALID_QUERY_PARAMETERS'

    if (name === 'voxel.getSurroundings') {
        const { horizontalRadius: h, verticalRadius: v } = parameters
        if (![h, v].every(value => Number.isSafeInteger(value) && value >= 0)) {
            return 'INVALID_QUERY_PARAMETERS'
        }
        if (
            h > MAX_SURROUNDINGS_HORIZONTAL_RADIUS ||
            v > MAX_SURROUNDINGS_VERTICAL_RADIUS
        ) return 'AGENT_QUERY_RANGE_EXCEEDED'
    }

    if (name === 'voxel.getVolume') {
        const size = get3DSize(parameters.bounds)
        if (!size) return 'INVALID_QUERY_PARAMETERS'
        if (size.volume > MAX_VOLUME_BLOCKS) return 'AGENT_QUERY_RANGE_EXCEEDED'
    }

    if (name === 'surface.getChunk') {
        if (![parameters.chunkX, parameters.chunkZ].every(Number.isSafeInteger)) {
            return 'INVALID_QUERY_PARAMETERS'
        }
    }

    if (
        name === 'surface.getArea' ||
        name === 'area.getAreaSummary' ||
        name === 'area.getAreaGrid' ||
        name === 'area.getRegions'
    ) {
        const size = get2DSize(parameters.bounds)
        if (!size) return 'INVALID_QUERY_PARAMETERS'
        if (size.width > MAX_AREA_WIDTH || size.depth > MAX_AREA_DEPTH) {
            return 'AGENT_QUERY_RANGE_EXCEEDED'
        }

        if (name === 'area.getAreaGrid' || name === 'area.getRegions') {
            const resolution = getResolution(parameters)
            if (resolution === null) return 'INVALID_QUERY_PARAMETERS'

            if (name === 'area.getAreaGrid') {
                const gridWidth = Math.ceil(size.width / resolution)
                const gridDepth = Math.ceil(size.depth / resolution)
                if (gridWidth * gridDepth > MAX_GRID_CELLS) {
                    return 'AGENT_QUERY_RANGE_EXCEEDED'
                }
            }
        }
    }

    return null
}

module.exports = { validateQuery, get2DSize, get3DSize }
