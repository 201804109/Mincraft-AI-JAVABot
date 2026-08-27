const { placeBlock } = require('../skills/block_manipulation/block_place')
const { breakBlock } = require('../skills/block_manipulation/block_break')

async function executeAction(bot, command) {
    if (!command) {
        return null
    }

    if (command.action === 'place') {
        const result = await placeBlock(
            bot,
            command.block,
            command.position
        )

        printPlaceResult(result)
        return result
    }

    if (command.action === 'break') {
        const result = await breakBlock(bot, command.position)

        printBreakResult(result)
        return result
    }

    return null
}

function printBreakResult(result) {
    if (!result.success) {
        console.log('破坏失败:')
        console.log(result.reason)
        return
    }

    console.log('破坏成功:')
    console.log('坐标:')
    console.log(`${result.position.x} ${result.position.y} ${result.position.z}`)
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
