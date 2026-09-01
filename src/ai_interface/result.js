function createSuccessResult(type, name, data = null) {
    return {
        success: true,
        type,
        name,
        reason: null,
        data
    }
}

function createFailureResult(type, name, reason, data = null) {
    return {
        success: false,
        type,
        name,
        reason,
        data
    }
}

module.exports = {
    createSuccessResult,
    createFailureResult
}
