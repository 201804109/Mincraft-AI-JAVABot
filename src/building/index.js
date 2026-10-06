const { loadBuildingPlan } = require('./plan/loader')
const { validateBuildingPlan } = require('./plan/validator')
const { transformBuildingPlan } = require('./plan/coordinate_transformer')
const { analyzeWorldDiff } = require('./analysis/world_diff')
const { generateLayers } = require('./planner/layer_generator')
const { scheduleLayers } = require('./planner/layer_scheduler')
const { applyScanPath } = require('./planner/scan_path')
const { generateBatches } = require('./planner/batch_generator')
const { BuildSession } = require('./runtime/build_session')
const planStore = require('./storage/plan_store')

async function prepareExecutionPlan(bot, filePath) {
    validateBot(bot)

    const rawPlan = await loadBuildingPlan(filePath)
    return prepareExecutionPlanFromDocument(bot, rawPlan)
}

async function prepareExecutionPlanFromPlanId(bot, planId) {
    validateBot(bot)
    const plan = await planStore.getPlan(planId)
    return prepareExecutionPlanFromDocument(bot, plan)
}

function prepareExecutionPlanFromDocument(bot, plan) {
    const validation = validateBuildingPlan(plan)
    if (!validation.valid) {
        const error = new Error('BuildingPlan validation failed.')
        error.code = 'INVALID_BUILDING_PLAN'
        error.errors = validation.errors
        throw error
    }

    const worldPlan = transformBuildingPlan(plan)
    const diff = analyzeWorldDiff(bot, worldPlan)
    const layers = generateLayers(diff)
    const scheduledLayers = scheduleLayers(layers)
    const scannedLayers = scheduledLayers.map(applyScanPath)
    return generateBatches(scannedLayers)
}

async function prepareBuild(bot, filePath, options = {}) {
    const executionPlan = await prepareExecutionPlan(bot, filePath)
    return new BuildSession(executionPlan, {
        ...(options && typeof options === 'object' && !Array.isArray(options) ? options : {}),
        bot
    })
}

async function prepareBuildFromPlanId(bot, planId, options = {}) {
    const executionPlan = await prepareExecutionPlanFromPlanId(bot, planId)
    return new BuildSession(executionPlan, {
        ...(options && typeof options === 'object' && !Array.isArray(options) ? options : {}),
        bot
    })
}

function validateBot(bot) {
    if (!bot || typeof bot.blockAt !== 'function') {
        const error = new TypeError('A valid bot with blockAt() is required to prepare a build.')
        error.code = 'BOT_REQUIRED'
        throw error
    }
}

module.exports = {
    prepareExecutionPlan,
    prepareBuild,
    prepareExecutionPlanFromPlanId,
    prepareBuildFromPlanId
}
