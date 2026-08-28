function createSuccessResult(action, data = null) {
    return {
        success: true,
        action,
        reason: null,
        data
    }
}

function createFailureResult(action, reason, data = null) {
    return {
        success: false,
        action,
        reason,
        data
    }
}

module.exports = {
    createSuccessResult,
    createFailureResult
}
