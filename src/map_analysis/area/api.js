const { loadArea } = require('./area_loader')
const { buildAreaGrid } = require('./area_grid')
const { analyzeSurfaceArea } = require('./area_analyzer')

function getAreaSummary(bounds, options = {}) {
    const input = validateInput(bounds, options)
    const analysis = analyzeSurfaceArea({
        ...input.bounds,
        resolution: input.resolution
    })

    return {
        bounds: { ...analysis.bounds },
        resolution: analysis.resolution,
        coverage: {
            ratio: analysis.coverage,
            observedColumns: analysis.observedColumns,
            unknownColumns: analysis.unknownColumns,
            totalColumns: analysis.totalColumns
        },
        dominantBlock: {
            block: analysis.dominantBlock.block,
            count: analysis.dominantBlock.count,
            ratio: analysis.dominantBlock.ratio
        },
        height: copyHeight(analysis.height),
        regions: analysis.regions.map(region => ({
            id: region.id,
            bounds: { ...region.bounds },
            dominantBlock: region.block,
            coverage: region.coverage,
            height: copyHeight(region.height)
        }))
    }
}

function getAreaGrid(bounds, options = {}) {
    const input = validateInput(bounds, options)
    const area = loadArea(input.bounds)
    const areaGrid = buildAreaGrid(area, {
        resolution: input.resolution
    })

    return {
        bounds: { ...areaGrid.bounds },
        resolution: areaGrid.resolution,
        grid: {
            width: areaGrid.gridWidth,
            depth: areaGrid.gridDepth,
            cells: areaGrid.cells.map(cell => ({
                gridX: cell.gridX,
                gridZ: cell.gridZ,
                bounds: { ...cell.bounds },
                coverage: cell.coverage,
                observedColumns: cell.observedColumns,
                unknownColumns: cell.unknownColumns,
                dominantBlock: {
                    block: cell.dominantBlock,
                    ratio: cell.dominantBlockRatio
                },
                height: copyGridHeight(cell.height)
            }))
        }
    }
}

function getRegions(bounds, options = {}) {
    const input = validateInput(bounds, options)
    const analysis = analyzeSurfaceArea({
        ...input.bounds,
        resolution: input.resolution
    })

    return {
        bounds: { ...analysis.bounds },
        regions: analysis.regions.map(region => ({
            id: region.id,
            bounds: { ...region.bounds },
            dominantBlock: region.block,
            coverage: region.coverage,
            dominantBlockRatio: region.dominantBlockRatio,
            height: copyHeight(region.height)
        }))
    }
}

function validateInput(bounds, options) {
    if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds)) {
        throw new Error('Area API bounds必须是对象')
    }

    const normalizedBounds = {
        minX: bounds.minX,
        maxX: bounds.maxX,
        minZ: bounds.minZ,
        maxZ: bounds.maxZ
    }

    if (!Object.values(normalizedBounds).every(Number.isInteger)) {
        throw new Error('Area API bounds必须使用整数坐标')
    }

    if (
        normalizedBounds.minX > normalizedBounds.maxX ||
        normalizedBounds.minZ > normalizedBounds.maxZ
    ) {
        throw new Error('Area API bounds最小坐标不能大于最大坐标')
    }

    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new Error('Area API options必须是对象')
    }

    const resolution = options.resolution ?? 1
    if (!Number.isInteger(resolution) || resolution < 1) {
        throw new Error('Area API resolution必须是大于等于1的整数')
    }

    return {
        bounds: normalizedBounds,
        resolution
    }
}

function copyHeight(height) {
    if (height === null) {
        return null
    }

    return {
        min: height.min,
        max: height.max,
        average: height.average,
        mode: height.mode
    }
}

function copyGridHeight(height) {
    if (height === null) {
        return null
    }

    return {
        min: height.min,
        max: height.max,
        average: height.average
    }
}

module.exports = {
    getAreaSummary,
    getAreaGrid,
    getRegions
}
