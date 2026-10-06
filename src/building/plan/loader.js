const fs = require('node:fs/promises')

async function loadBuildingPlan(filePath) {
    let contents

    try {
        contents = await fs.readFile(filePath, 'utf8')
    } catch (cause) {
        const code = cause && cause.code === 'ENOENT'
            ? 'BUILDING_PLAN_NOT_FOUND'
            : 'BUILDING_PLAN_READ_FAILED'
        throw createLoaderError(code, `Unable to read BuildingPlan file: ${filePath}`, cause)
    }

    if (contents.trim().length === 0) {
        throw createLoaderError('BUILDING_PLAN_EMPTY_FILE', `BuildingPlan file is empty: ${filePath}`)
    }

    try {
        return JSON.parse(contents)
    } catch (cause) {
        throw createLoaderError('BUILDING_PLAN_INVALID_JSON', `BuildingPlan file contains invalid JSON: ${filePath}`, cause)
    }
}

function createLoaderError(code, message, cause) {
    const error = new Error(message, cause ? { cause } : undefined)
    error.code = code
    return error
}

module.exports = {
    loadBuildingPlan
}
