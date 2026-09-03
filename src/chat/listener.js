module.exports = function(bot, agentRuntime) {

    bot.on('chat', async (username, message) => {

        if (username === bot.username) {
            return
        }

        console.log(`${username}: ${message}`)

        try {
            const result = await agentRuntime.run(message)

            if (result.success && result.text) {
                bot.chat(result.text)
            } else {
                console.error(
                    'Agent处理失败:',
                    result.reason,
                    result.error
                )
            }
        } catch (error) {
            console.error('Agent聊天失败:', error)
        }
    })
}
