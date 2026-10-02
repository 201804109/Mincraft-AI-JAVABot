const { Vec3 } = require('vec3')
const { breakBlock, breakBlockFromCurrentPosition } = require('./block_break')
const { checkBlockReachability } = require('./reachability')

const DEFAULT_MAX_ATTEMPTS = 3
const AIR_TYPES = new Set(['air', 'cave_air', 'void_air'])

async function breakBlocks(bot, positions, options = {}) {
    const validationError = validateInput(bot, positions, options)
    if (validationError) {
        return failedBatch(positions, validationError)
    }

    const maxAttempts = options.maxAttemptsPerTarget ?? DEFAULT_MAX_ATTEMPTS
    const results = new Array(positions.length)
    const pending = positions.map((position, index) => ({ ...position, index, attempts: 0 }))

    while (pending.length > 0) {
        let completedThisRound = false

        for (let cursor = 0; cursor < pending.length;) {
            const job = pending[cursor]
            const current = inspectBreakTarget(bot, job)

            if (current === 'skipped') {
                results[job.index] = successfulResult(job, false, true)
                pending.splice(cursor, 1)
                completedThisRound = true
                continue
            }

            if (current === 'failed') {
                job.attempts++
                if (job.attempts >= maxAttempts) {
                    results[job.index] = failedResult(job, 'TARGET_UNAVAILABLE')
                    pending.splice(cursor, 1)
                    completedThisRound = true
                    continue
                }
                cursor++
                continue
            }

            if (current === 'unavailable') {
                cursor++
                continue
            }

            const operation = await safeCall(() => breakBlockFromCurrentPosition(bot, job))
            if (operation && operation.success) {
                results[job.index] = successfulResult(job, true, false)
                pending.splice(cursor, 1)
                completedThisRound = true
                continue
            }

            const refreshed = inspectBreakTarget(bot, job)
            if (refreshed === 'skipped') {
                results[job.index] = successfulResult(job, false, true)
                pending.splice(cursor, 1)
                completedThisRound = true
                continue
            }

            job.attempts++
            if (job.attempts >= maxAttempts) {
                results[job.index] = failedResult(job, operation && operation.reason)
                pending.splice(cursor, 1)
                completedThisRound = true
                continue
            }
            cursor++
        }

        if (pending.length === 0) {
            break
        }
        if (completedThisRound) {
            continue
        }

        const anchor = pending[0]
        const operation = await safeCall(() => breakBlock(bot, anchor))
        if (operation && operation.success) {
            results[anchor.index] = successfulResult(anchor, true, false)
            pending.splice(pending.indexOf(anchor), 1)
            continue
        }

        const refreshed = inspectBreakTarget(bot, anchor)
        if (refreshed === 'skipped') {
            results[anchor.index] = successfulResult(anchor, false, true)
            pending.splice(pending.indexOf(anchor), 1)
            continue
        }

        anchor.attempts++
        if (anchor.attempts >= maxAttempts) {
            results[anchor.index] = failedResult(anchor, operation && operation.reason)
            pending.splice(pending.indexOf(anchor), 1)
        }
    }

    return summarize(results, 'broken')
}

function inspectBreakTarget(bot, position) {
    try {
        const block = bot.blockAt(new Vec3(position.x, position.y, position.z))

        if (!block) {
            return 'failed'
        }
        if (AIR_TYPES.has(block.name)) {
            return 'skipped'
        }
        return checkBlockReachability(bot, block).reachable ? 'available' : 'unavailable'
    } catch (_) {
        return 'failed'
    }
}

function validateInput(bot, positions, options) {
    if (!bot || !bot.entity || !bot.entity.position ||
        typeof bot.blockAt !== 'function' ||
        typeof bot.lookAt !== 'function' ||
        typeof bot.dig !== 'function') {
        return 'INVALID_BOT'
    }
    if (!Array.isArray(positions)) {
        return 'INVALID_POSITIONS'
    }
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        return 'INVALID_OPTIONS'
    }
    const maxAttempts = options.maxAttemptsPerTarget ?? DEFAULT_MAX_ATTEMPTS
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
        return 'INVALID_MAX_ATTEMPTS_PER_TARGET'
    }
    if (!positions.every(isValidPosition)) {
        return 'INVALID_TARGET_POSITION'
    }
    return null
}

function isValidPosition(position) {
    return position && [position.x, position.y, position.z].every(Number.isInteger)
}

function successfulResult(job, broken, skipped) {
    return {
        position: { x: job.x, y: job.y, z: job.z },
        success: true,
        broken,
        skipped
    }
}

function failedResult(job, reason) {
    return {
        position: { x: job.x, y: job.y, z: job.z },
        success: false,
        broken: false,
        skipped: false,
        reason: reason || 'BREAK_FAILED'
    }
}

function failedBatch(positions, reason) {
    const results = Array.isArray(positions) ? positions.map(position => ({
        position: position && { x: position.x, y: position.y, z: position.z },
        success: false,
        broken: false,
        skipped: false,
        reason
    })) : []
    const summary = summarize(results, 'broken')
    return {
        ...summary,
        success: false,
        failed: Math.max(summary.failed, 1),
        reason
    }
}

function summarize(results, completedKey) {
    const completed = results.filter(result => result && result[completedKey]).length
    const skipped = results.filter(result => result && result.skipped).length
    const failed = results.filter(result => !result || !result.success).length
    return {
        success: failed === 0,
        total: results.length,
        [completedKey]: completed,
        skipped,
        failed,
        results
    }
}

async function safeCall(operation) {
    try {
        return await operation()
    } catch (error) {
        return { success: false, reason: error && error.message }
    }
}

module.exports = {
    breakBlocks
}
