function buildAreaGrid(area, options = {}) {
    const bounds = validateArea(area)
    const resolution = options.resolution ?? 1

    if (!Number.isInteger(resolution) || resolution < 1) {
        throw new Error('Area grid resolution必须是大于等于1的整数')
    }

    const width = bounds.maxX - bounds.minX + 1
    const depth = bounds.maxZ - bounds.minZ + 1
    const gridWidth = Math.ceil(width / resolution)
    const gridDepth = Math.ceil(depth / resolution)
    const cells = []

    for (let gridZ = 0; gridZ < gridDepth; gridZ++) {
        for (let gridX = 0; gridX < gridWidth; gridX++) {
            const cellBounds = {
                minX: bounds.minX + gridX * resolution,
                maxX: Math.min(bounds.maxX, bounds.minX + (gridX + 1) * resolution - 1),
                minZ: bounds.minZ + gridZ * resolution,
                maxZ: Math.min(bounds.maxZ, bounds.minZ + (gridZ + 1) * resolution - 1)
            }

            cells.push(buildCell(area, gridX, gridZ, cellBounds))
        }
    }

    return {
        bounds: { ...bounds },
        resolution,
        gridWidth,
        gridDepth,
        cells
    }
}

function buildCell(area, gridX, gridZ, bounds) {
    const totalColumns =
        (bounds.maxX - bounds.minX + 1) *
        (bounds.maxZ - bounds.minZ + 1)
    let observedColumns = 0
    let emptyTopColumns = 0
    let heightSum = 0
    let heightCount = 0
    const blockCounts = new Map()
    const heightCounts = new Map()

    for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const column = area.columns[`${x},${z}`]

            if (!column || column.observed !== true) {
                continue
            }

            observedColumns++

            if (column.top === null) {
                emptyTopColumns++
                continue
            }

            const { y, block } = column.top
            if (!Number.isInteger(y) || typeof block !== 'string' || block.length === 0) {
                continue
            }

            incrementCount(blockCounts, block)
            incrementCount(heightCounts, y)
            heightSum += y
            heightCount++
        }
    }

    const dominant = findDominantBlock(blockCounts)

    return {
        gridX,
        gridZ,
        bounds,
        totalColumns,
        observedColumns,
        unknownColumns: totalColumns - observedColumns,
        emptyTopColumns,
        topBlockColumns: heightCount,
        coverage: observedColumns / totalColumns,
        dominantBlock: dominant.block,
        dominantBlockCount: dominant.count,
        dominantBlockRatio: heightCount === 0 ? 0 : dominant.count / heightCount,
        blockCounts: toSortedCountObject(blockCounts),
        height: summarizeHeightCounts(heightCounts, heightSum, heightCount),
        heightCounts: toSortedCountObject(heightCounts, numericCompare),
        heightSum,
        heightCount
    }
}

function findDominantBlock(counts) {
    let block = null
    let count = 0

    for (const [candidate, candidateCount] of counts) {
        if (
            candidateCount > count ||
            (candidateCount === count && (block === null || lexicalCompare(candidate, block) < 0))
        ) {
            block = candidate
            count = candidateCount
        }
    }

    return { block, count }
}

function summarizeHeightCounts(counts, sum, count) {
    if (count === 0) {
        return null
    }

    let min = Infinity
    let max = -Infinity
    let mode = null
    let modeCount = 0

    for (const [height, occurrences] of counts) {
        min = Math.min(min, height)
        max = Math.max(max, height)

        if (
            occurrences > modeCount ||
            (occurrences === modeCount && (mode === null || height < mode))
        ) {
            mode = height
            modeCount = occurrences
        }
    }

    return {
        min,
        max,
        average: sum / count,
        mode
    }
}

function toSortedCountObject(counts, compare = lexicalCompare) {
    const result = {}

    for (const key of Array.from(counts.keys()).sort(compare)) {
        result[key] = counts.get(key)
    }

    return result
}

function incrementCount(counts, key, amount = 1) {
    counts.set(key, (counts.get(key) || 0) + amount)
}

function validateArea(area) {
    if (!area || typeof area !== 'object' || !area.bounds || !area.columns) {
        throw new Error('Area grid需要有效的Surface area')
    }

    const { minX, maxX, minZ, maxZ } = area.bounds
    if (
        ![minX, maxX, minZ, maxZ].every(Number.isInteger) ||
        minX > maxX ||
        minZ > maxZ
    ) {
        throw new Error('Surface area bounds无效')
    }

    return { minX, maxX, minZ, maxZ }
}

function lexicalCompare(left, right) {
    if (left < right) {
        return -1
    }
    if (left > right) {
        return 1
    }
    return 0
}

function numericCompare(left, right) {
    return Number(left) - Number(right)
}

module.exports = {
    buildAreaGrid,
    findDominantBlock,
    summarizeHeightCounts,
    incrementCount,
    toSortedCountObject,
    lexicalCompare,
    numericCompare
}
