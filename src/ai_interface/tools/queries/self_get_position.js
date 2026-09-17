const selfState = require('../../../self_state')

module.exports = {
    definition: {
        name: 'self.getPosition',
        type: 'query',
        description: 'Get the current live position of the Minecraft bot, not the player. Coordinates may be fractional.',
        parameters: {
            type: 'object',
            properties: {}
        }
    },

    execute({ bot }) {
        return selfState.getPosition(bot)
    }
}
