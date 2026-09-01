const aiInterface = require('../ai_interface')

module.exports = function(bot, parser) {

    bot.on('chat', async (username, message) => {

        // 忽略机器人自己发送的消息
        if (username === bot.username) {
            return
        }

        console.log(`${username}: ${message}`)

        // 把聊天内容交给 parser
        try {
            const action = parser(message)

            if (!action) {
                return
            }

            const { action: name, ...parameters } = action
            await aiInterface.handle({
                type: 'action',
                name,
                parameters
            })
        } catch (error) {
            console.error('聊天命令执行失败:', error)
        }
    })
}
