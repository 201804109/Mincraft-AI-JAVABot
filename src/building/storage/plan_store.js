const cache = require('../../cache')
const { validateBuildingPlan } = require('../plan/validator')

const DRAFTS_DIRECTORY = 'building/drafts'
const PLANS_DIRECTORY = 'building/plans'
const PLAN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

async function ensurePlanStorage() {
    await Promise.all([
        cache.ensureDirectory(DRAFTS_DIRECTORY),
        cache.ensureDirectory(PLANS_DIRECTORY)
    ])
}

async function listDrafts() {
    await ensurePlanStorage()
    const entries = await cache.list(DRAFTS_DIRECTORY)
    const files = getPlanFiles(entries)
    const drafts = await Promise.all(files.map(async entry => {
        const id = entry.name.slice(0, -'.json'.length)
        const draft = await cache.readJson(`${DRAFTS_DIRECTORY}/${entry.name}`)
        return {
            id,
            name: typeof draft?.name === 'string' ? draft.name : null,
            formatVersion: typeof draft?.formatVersion === 'string' ? draft.formatVersion : null,
            blockCount: Array.isArray(draft?.blocks) ? draft.blocks.length : null
        }
    }))
    return drafts.sort((a, b) => a.id.localeCompare(b.id))
}

async function listPlans() {
    await ensurePlanStorage()
    const entries = await cache.list(PLANS_DIRECTORY)
    const files = getPlanFiles(entries)
    const plans = await Promise.all(files.map(async entry => {
        const id = entry.name.slice(0, -'.json'.length)
        const plan = await cache.readJson(`${PLANS_DIRECTORY}/${entry.name}`)
        return {
            id,
            name: typeof plan?.name === 'string' ? plan.name : null,
            formatVersion: typeof plan?.formatVersion === 'string' ? plan.formatVersion : null,
            origin: isObject(plan?.origin) ? plan.origin : null,
            size: isObject(plan?.size) ? plan.size : null,
            blockCount: Array.isArray(plan?.blocks) ? plan.blocks.length : null
        }
    }))
    return plans.sort((a, b) => a.id.localeCompare(b.id))
}

async function getDraft(planId) {
    assertPlanId(planId)
    try {
        return await cache.readJson(draftPath(planId))
    } catch (error) {
        if (error && error.code === 'CACHE_NOT_FOUND') {
            throw createPlanStoreError('DRAFT_NOT_FOUND', `Draft not found: ${planId}`, error)
        }
        throw error
    }
}

async function getPlan(planId) {
    assertPlanId(planId)
    try {
        return await cache.readJson(planPath(planId))
    } catch (error) {
        if (error && error.code === 'CACHE_NOT_FOUND') {
            throw createPlanStoreError('PLAN_NOT_FOUND', `Plan not found: ${planId}`, error)
        }
        throw error
    }
}

async function createDraft(planId, data) {
    assertPlanId(planId)
    assertDraftData(data)
    await ensurePlanStorage()
    if (await cache.exists(draftPath(planId))) {
        throw createPlanStoreError('DRAFT_ALREADY_EXISTS', `Draft already exists: ${planId}`)
    }
    await cache.writeJson(draftPath(planId), data)
    return cache.readJson(draftPath(planId))
}

async function updateDraft(planId, data) {
    assertPlanId(planId)
    assertDraftData(data)
    await ensurePlanStorage()
    if (!(await cache.exists(draftPath(planId)))) {
        throw createPlanStoreError('DRAFT_NOT_FOUND', `Draft not found: ${planId}`)
    }
    await cache.writeJson(draftPath(planId), data)
    return cache.readJson(draftPath(planId))
}

async function commitDraft(planId) {
    assertPlanId(planId)
    const draft = await getDraft(planId)
    const validation = validateBuildingPlan(draft)
    if (!validation.valid) {
        const error = createPlanStoreError('INVALID_BUILDING_PLAN', `Draft is not a valid BuildingPlan: ${planId}`)
        error.errors = validation.errors
        throw error
    }

    await ensurePlanStorage()
    if (await cache.exists(planPath(planId))) {
        throw createPlanStoreError('PLAN_ALREADY_EXISTS', `Plan already exists: ${planId}`)
    }
    await cache.writeJson(planPath(planId), draft)
    return cache.readJson(planPath(planId))
}

function getPlanFiles(entries) {
    return entries.filter(entry => entry.type === 'file' && entry.name.endsWith('.json'))
        .filter(entry => PLAN_ID_PATTERN.test(entry.name.slice(0, -'.json'.length)))
}

function assertPlanId(planId) {
    if (typeof planId !== 'string' || !PLAN_ID_PATTERN.test(planId)) {
        throw createPlanStoreError(
            'INVALID_PLAN_ID',
            'planId must be 1–64 characters, start with a letter or digit, and contain only letters, digits, underscores, or hyphens.'
        )
    }
}

function assertDraftData(data) {
    if (!isObject(data)) {
        throw createPlanStoreError('INVALID_DRAFT_DATA', 'Draft data must be a plain object.')
    }
}

function isObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

function draftPath(planId) {
    return `${DRAFTS_DIRECTORY}/${planId}.json`
}

function planPath(planId) {
    return `${PLANS_DIRECTORY}/${planId}.json`
}

function createPlanStoreError(code, message, cause) {
    const error = new Error(message, cause ? { cause } : undefined)
    error.code = code
    return error
}

module.exports = {
    ensurePlanStorage,
    listDrafts,
    listPlans,
    getDraft,
    getPlan,
    createDraft,
    updateDraft,
    commitDraft
}
