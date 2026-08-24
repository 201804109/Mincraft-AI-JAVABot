const { placeBlock } = require('../skills/block_manipulation/block_place')

async function executeAction(bot, command) {
    if (!command || command.action !== 'place') {
        return null
    }

    const result = await placeBlock(
        bot,
        command.block,
        command.position
    )

    printPlaceResult(result)
    return result
}

function printPlaceResult(result) {
    if (!result.success) {
        console.log('放置失败:')
        console.log(result.reason)
        return
    }

    console.log('放置成功:')
    console.log(result.block)
    console.log('坐标:')
    console.log(`${result.position.x} ${result.position.y} ${result.position.z}`)
}

module.exports = {
    executeAction
}
