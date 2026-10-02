const { Vec3 } = require('vec3')
const { placeBlock, placeBlockFromCurrentPosition } = require('./block_place')

const DEFAULT_MAX_ATTEMPTS = 3
const MAX_PLACEMENT_DISTANCE = 5
const PLAYER_EYE_HEIGHT = 1.62
const AIR_TYPES = new Set(['air', 'cave_air', 'void_air'])
const REFERENCE_OFFSETS = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
]

async function placeBlocks(bot, blocks, options = {}) {
    const validationError = validateInput(bot, blocks, options)
    if (validationError) {
        return failedBatch(blocks, validationError)
    }

    const maxAttempts = options.maxAttemptsPerTarget ?? DEFAULT_MAX_ATTEMPTS
    const results = new Array(blocks.length)
    const pending = blocks.map((job, index) => ({ ...job, index, attempts: 0 }))

    while (pending.length > 0) {
        let completedThisRound = false

        for (let cursor = 0; cursor < pending.length;) {
            const job = pending[cursor]
            const current = inspectPlacementTarget(bot, job)

            if (current === 'placed') {
                results[job.index] = successfulResult(job, true, false)
                pending.splice(cursor, 1)
                completedThisRound = true
                continue
            }

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

            const operation = await safeCall(() => placeBlockFromCurrentPosition(
                bot,
                stripMinecraftNamespace(job.block),
                job.position
            ))

            if (operation && operation.success) {
                results[job.index] = successfulResult(job, true, false)
                pending.splice(cursor, 1)
                completedThisRound = true
                continue
            }

            const refreshed = inspectPlacementTarget(bot, job)
            if (refreshed === 'skipped') {
                results[job.index] = successfulResult(job, false, true)
                pending.splice(cursor, 1)
                completedThisRound = true
                continue
            }
            if (refreshed === 'placed') {
                results[job.index] = successfulResult(job, true, false)
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
        const operation = await safeCall(() => placeBlock(
            bot,
            stripMinecraftNamespace(anchor.block),
            anchor.position
        ))

        if (operation && operation.success) {
            results[anchor.index] = successfulResult(anchor, true, false)
            pending.splice(pending.indexOf(anchor), 1)
            continue
        }

        const refreshed = inspectPlacementTarget(bot, anchor)
        if (refreshed === 'skipped') {
            results[anchor.index] = successfulResult(anchor, false, true)
            pending.splice(pending.indexOf(anchor), 1)
            continue
        }
        if (refreshed === 'placed') {
            results[anchor.index] = successfulResult(anchor, true, false)
            pending.splice(pending.indexOf(anchor), 1)
            continue
        }

        anchor.attempts++
        if (anchor.attempts >= maxAttempts) {
            results[anchor.index] = failedResult(anchor, operation && operation.reason)
            pending.splice(pending.indexOf(anchor), 1)
        }
    }

    return summarize(results, 'placed')
}

function inspectPlacementTarget(bot, job) {
    try {
        const target = bot.blockAt(new Vec3(job.position.x, job.position.y, job.position.z))

        if (!target) {
            return 'failed'
        }
        if (target.name === job.block || target.name === stripMinecraftNamespace(job.block)) {
            return 'skipped'
        }
        if (!AIR_TYPES.has(target.name)) {
            return 'failed'
        }

        const position = bot.entity.position
        const eye = position.offset(0, PLAYER_EYE_HEIGHT, 0)
        const center = new Vec3(job.position.x + 0.5, job.position.y + 0.5, job.position.z + 0.5)

        if (eye.distanceTo(center) > MAX_PLACEMENT_DISTANCE) {
            return 'unavailable'
        }

        return REFERENCE_OFFSETS.some(offset => {
            const block = bot.blockAt(new Vec3(
                job.position.x + offset[0],
                job.position.y + offset[1],
                job.position.z + offset[2]
            ))
            return block && !AIR_TYPES.has(block.name)
        }) ? 'available' : 'unavailable'
    } catch (_) {
        return 'failed'
    }
}

function validateInput(bot, blocks, options) {
    if (!bot || !bot.entity || !bot.entity.position ||
        typeof bot.blockAt !== 'function' ||
        typeof bot.lookAt !== 'function' ||
        typeof bot.placeBlock !== 'function') {
        return 'INVALID_BOT'
    }
    if (!Array.isArray(blocks)) {
        return 'INVALID_BLOCKS'
    }
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        return 'INVALID_OPTIONS'
    }
    const maxAttempts = options.maxAttemptsPerTarget ?? DEFAULT_MAX_ATTEMPTS
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
        return 'INVALID_MAX_ATTEMPTS_PER_TARGET'
    }
    for (const job of blocks) {
        if (!job || typeof job.block !== 'string' || job.block.trim().length === 0) {
            return 'INVALID_BLOCK_NAME'
        }
        if (!isValidPosition(job.position)) {
            return 'INVALID_TARGET_POSITION'
        }
    }
    return null
}

function isValidPosition(position) {
    return position && [position.x, position.y, position.z].every(Number.isInteger)
}

function stripMinecraftNamespace(block) {
    return block.startsWith('minecraft:') ? block.slice('minecraft:'.length) : block
}

function successfulResult(job, placed, skipped) {
    return {
        position: { ...job.position },
        block: job.block,
        success: true,
        placed,
        skipped
    }
}

function failedResult(job, reason) {
    return {
        position: { ...job.position },
        block: job.block,
        success: false,
        placed: false,
        skipped: false,
        reason: reason || 'PLACE_FAILED'
    }
}

function failedBatch(blocks, reason) {
    const results = Array.isArray(blocks) ? blocks.map(job => ({
        position: job && job.position ? { ...job.position } : null,
        block: job && job.block,
        success: false,
        placed: false,
        skipped: false,
        reason
    })) : []
    const summary = summarize(results, 'placed')
    return {
        ...summary,
        success: false,
        failed: Math.max(summary.failed, 1),
        reason
    }
}

function summarize(results, completedKey) {
    const placed = results.filter(result => result && result[completedKey]).length
    const skipped = results.filter(result => result && result.skipped).length
    const failed = results.filter(result => !result || !result.success).length
    return {
        success: failed === 0,
        total: results.length,
        [completedKey]: placed,
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
    placeBlocks
}
