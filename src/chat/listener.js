module.exports = function(bot, agentRuntime) {

    bot.on('chat', async (username, message) => {

        if (username === bot.username) {
            return
        }

        console.log(`${username}: ${message}`)

        try {
            const result = await agentRuntime.run(message)

            if (
                result.success &&
                typeof result.agentOutput === 'string' &&
                result.agentOutput.trim()
            ) {
                bot.chat(result.agentOutput)
            } else if (!result.success) {
                console.warn(`[Agent] Failed: ${result.reason}`)
            }
        } catch (error) {
            console.error('Agent聊天失败:', error)
        }
    })
}
