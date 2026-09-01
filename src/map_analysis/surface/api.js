const surfaceMap = require('./map')
const surfaceStorage = require('./storage')
const { loadArea } = require('../area/area_loader')

const CHUNK_SIZE = 16

function getColumn(x, z) {
    validateCoordinate(x, 'x')
    validateCoordinate(z, 'z')

    const area = loadArea({
        minX: x,
        maxX: x,
        minZ: z,
        maxZ: z
    })

    return toPublicColumn(x, z, area.columns[`${x},${z}`])
}

function getChunk(chunkX, chunkZ) {
    validateCoordinate(chunkX, 'chunkX')
    validateCoordinate(chunkZ, 'chunkZ')

    const chunk = surfaceMap.getChunk(chunkX, chunkZ) ||
        surfaceStorage.loadChunk(chunkX, chunkZ)
    const columns = {}

    for (const [localKey, column] of Object.entries(chunk?.columns || {})) {
        const localPosition = parseLocalPosition(localKey)
        if (!localPosition) {
            continue
        }

        const x = chunkX * CHUNK_SIZE + localPosition.x
        const z = chunkZ * CHUNK_SIZE + localPosition.z
        columns[`${x},${z}`] = toPublicColumn(x, z, column)
    }

    return {
        chunkX,
        chunkZ,
        columns
    }
}

function getArea(bounds) {
    const area = loadArea(bounds)
    const columns = []

    for (let z = area.bounds.minZ; z <= area.bounds.maxZ; z++) {
        for (let x = area.bounds.minX; x <= area.bounds.maxX; x++) {
            columns.push(toPublicColumn(x, z, area.columns[`${x},${z}`]))
        }
    }

    return {
        bounds: { ...area.bounds },
        columns
    }
}

function toPublicColumn(x, z, column) {
    const observed = column?.observed === true

    return {
        observed,
        x,
        z,
        top: observed && column.top
            ? {
                y: column.top.y,
                block: column.top.block
            }
            : null
    }
}

function parseLocalPosition(key) {
    const match = /^(\d+),(\d+)$/.exec(key)
    if (!match) {
        return null
    }

    const x = Number(match[1])
    const z = Number(match[2])

    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
        return null
    }

    return { x, z }
}

function validateCoordinate(value, name) {
    if (!Number.isInteger(value)) {
        throw new Error(`${name}必须是整数坐标`)
    }
}

module.exports = {
    getColumn,
    getChunk,
    getArea
}
