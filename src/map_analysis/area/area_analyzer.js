const { loadArea } = require('./area_loader')
const {
    buildAreaGrid,
    findDominantBlock,
    summarizeHeightCounts,
    incrementCount,
    toSortedCountObject,
    lexicalCompare
} = require('./area_grid')

const MIN_REGION_COVERAGE = 0.5

function analyzeSurfaceArea(options) {
    if (!options || typeof options !== 'object') {
        throw new Error('Surface area analysis需要有效参数')
    }

    const area = loadArea({
        minX: options.minX,
        maxX: options.maxX,
        minZ: options.minZ,
        maxZ: options.maxZ
    })
    const grid = buildAreaGrid(area, { resolution: options.resolution ?? 1 })
    return analyzeArea(grid)
}

function analyzeArea(grid) {
    validateGrid(grid)

    let totalColumns = 0
    let observedColumns = 0
    let emptyTopColumns = 0
    let topBlockColumns = 0
    let heightSum = 0
    let heightCount = 0
    const blockCounts = new Map()
    const heightCounts = new Map()

    for (const cell of grid.cells) {
        totalColumns += cell.totalColumns
        observedColumns += cell.observedColumns
        emptyTopColumns += cell.emptyTopColumns
        topBlockColumns += cell.topBlockColumns
        heightSum += cell.heightSum
        heightCount += cell.heightCount
        mergeCountObject(blockCounts, cell.blockCounts)
        mergeCountObject(heightCounts, cell.heightCounts, Number)
    }

    const dominant = findDominantBlock(blockCounts)

    return {
        bounds: { ...grid.bounds },
        resolution: grid.resolution,
        grid: {
            width: grid.gridWidth,
            depth: grid.gridDepth
        },
        coverage: totalColumns === 0 ? 0 : observedColumns / totalColumns,
        observedColumns,
        unknownColumns: totalColumns - observedColumns,
        emptyTopColumns,
        topBlockColumns,
        totalColumns,
        dominantBlock: {
            block: dominant.block,
            count: dominant.count,
            ratio: topBlockColumns === 0 ? 0 : dominant.count / topBlockColumns
        },
        blockCounts: toSortedCountObject(blockCounts),
        height: summarizeHeightCounts(heightCounts, heightSum, heightCount),
        regions: buildRegions(grid)
    }
}

function buildRegions(grid) {
    const eligibleCells = new Map()

    for (const cell of grid.cells) {
        if (cell.coverage >= MIN_REGION_COVERAGE && cell.dominantBlock !== null) {
            eligibleCells.set(gridKey(cell.gridX, cell.gridZ), cell)
        }
    }

    const visited = new Set()
    const regions = []

    for (const start of grid.cells) {
        const startKey = gridKey(start.gridX, start.gridZ)
        if (!eligibleCells.has(startKey) || visited.has(startKey)) {
            continue
        }

        const cells = collectConnectedCells(start, eligibleCells, visited)
        regions.push(summarizeRegion(start.dominantBlock, cells))
    }

    regions.sort(compareRegions)

    return regions.map((region, index) => ({
        id: `region_${index + 1}`,
        ...region
    }))
}

function collectConnectedCells(start, eligibleCells, visited) {
    const queue = [start]
    const cells = []
    visited.add(gridKey(start.gridX, start.gridZ))

    for (let index = 0; index < queue.length; index++) {
        const cell = queue[index]
        cells.push(cell)

        const neighbors = [
            [cell.gridX, cell.gridZ - 1],
            [cell.gridX - 1, cell.gridZ],
            [cell.gridX + 1, cell.gridZ],
            [cell.gridX, cell.gridZ + 1]
        ]

        for (const [gridX, gridZ] of neighbors) {
            const key = gridKey(gridX, gridZ)
            const neighbor = eligibleCells.get(key)

            if (
                !neighbor ||
                visited.has(key) ||
                neighbor.dominantBlock !== start.dominantBlock
            ) {
                continue
            }

            visited.add(key)
            queue.push(neighbor)
        }
    }

    return cells
}

function summarizeRegion(block, cells) {
    let totalColumns = 0
    let observedColumns = 0
    let topBlockColumns = 0
    let blockColumns = 0
    let heightSum = 0
    let heightCount = 0
    const heightCounts = new Map()
    const bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity
    }

    for (const cell of cells) {
        totalColumns += cell.totalColumns
        observedColumns += cell.observedColumns
        topBlockColumns += cell.topBlockColumns
        blockColumns += cell.blockCounts[block] || 0
        heightSum += cell.heightSum
        heightCount += cell.heightCount
        mergeCountObject(heightCounts, cell.heightCounts, Number)
        bounds.minX = Math.min(bounds.minX, cell.bounds.minX)
        bounds.maxX = Math.max(bounds.maxX, cell.bounds.maxX)
        bounds.minZ = Math.min(bounds.minZ, cell.bounds.minZ)
        bounds.maxZ = Math.max(bounds.maxZ, cell.bounds.maxZ)
    }

    return {
        block,
        cellCount: cells.length,
        bounds,
        coverage: observedColumns / totalColumns,
        dominantBlockRatio: topBlockColumns === 0 ? 0 : blockColumns / topBlockColumns,
        topBlockColumns,
        height: summarizeHeightCounts(heightCounts, heightSum, heightCount)
    }
}

function mergeCountObject(target, source, parseKey = value => value) {
    for (const [key, count] of Object.entries(source || {})) {
        if (Number.isFinite(count) && count > 0) {
            incrementCount(target, parseKey(key), count)
        }
    }
}

function compareRegions(left, right) {
    return (
        right.topBlockColumns - left.topBlockColumns ||
        left.bounds.minZ - right.bounds.minZ ||
        left.bounds.minX - right.bounds.minX ||
        lexicalCompare(left.block, right.block)
    )
}

function validateGrid(grid) {
    if (
        !grid ||
        typeof grid !== 'object' ||
        !grid.bounds ||
        !Number.isInteger(grid.resolution) ||
        grid.resolution < 1 ||
        !Number.isInteger(grid.gridWidth) ||
        !Number.isInteger(grid.gridDepth) ||
        !Array.isArray(grid.cells)
    ) {
        throw new Error('Area analyzer需要有效的Area Grid')
    }
}

function gridKey(gridX, gridZ) {
    return `${gridX},${gridZ}`
}

module.exports = {
    MIN_REGION_COVERAGE,
    analyzeSurfaceArea,
    analyzeArea
}
