const { enqueueAction } = require('./action_queue')

async function runTool(bot, action) {
    return enqueueAction(bot, action)
}

module.exports = {
    runTool
}
