const { placeBlock } = require('../skills/block_manipulation/block_place')
const { breakBlock } = require('../skills/block_manipulation/block_break')
const navigation = require('../skills/move/navigation')
const {
    createSuccessResult,
    createFailureResult
} = require('./result')
const { validateAction } = require('./validator')

async function executeAction(bot, command) {
    if (!command) {
        return null
    }

    const validation = validateAction(command)

    if (!validation.valid) {
        return createFailureResult(
            validation.action,
            validation.reason
        )
    }

    if (command.action === 'place') {
        try {
            const result = await placeBlock(
                bot,
                command.block,
                command.position
            )

            printPlaceResult(result)

            if (!result.success) {
                return createFailureResult(
                    'place',
                    result.reason || 'PLACE_FAILED'
                )
            }

            return createSuccessResult('place', {
                block: result.block,
                position: result.position
            })
        } catch (error) {
            console.error('放置执行异常:', error)
            return createFailureResult('place', 'PLACE_ERROR')
        }
    }

    if (command.action === 'break') {
        try {
            const result = await breakBlock(bot, command.position)

            printBreakResult(result)

            if (!result.success) {
                return createFailureResult(
                    'break',
                    result.reason || 'BREAK_FAILED'
                )
            }

            return createSuccessResult('break', {
                position: result.position
            })
        } catch (error) {
            console.error('破坏执行异常:', error)
            return createFailureResult('break', 'BREAK_ERROR')
        }
    }

    if (command.action === 'navigate') {
        try {
            const result = await navigation.navigateTo(command.position)

            if (result === true) {
                return createSuccessResult('navigate', {
                    position: command.position
                })
            }

            if (result === 'REPLAN_REQUIRED') {
                return createFailureResult('navigate', 'REPLAN_REQUIRED')
            }

            return createFailureResult('navigate', 'NAVIGATION_FAILED')
        } catch (error) {
            console.error('导航执行异常:', error)
            return createFailureResult('navigate', 'NAVIGATION_ERROR')
        }
    }

    return createFailureResult(command.action, 'UNKNOWN_ACTION')
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
