const { placeBlock } = require('../../skills/block_manipulation/block_place')
const { breakBlock } = require('../../skills/block_manipulation/block_break')
const navigation = require('../../skills/move/navigation')
const {
    createSuccessResult,
    createFailureResult
} = require('../result')
const { validateAction } = require('./validator')

async function executeAction(bot, name, parameters) {
    const validation = validateAction(name, parameters)

    if (!validation.valid) {
        return createFailureResult('action', name, validation.reason)
    }

    if (name === 'place') {
        try {
            const result = await placeBlock(
                bot,
                parameters.block,
                parameters.position
            )

            printPlaceResult(result)

            if (!result.success) {
                return createFailureResult(
                    'action',
                    'place',
                    result.reason || 'PLACE_FAILED'
                )
            }

            return createSuccessResult('action', 'place', {
                block: result.block,
                position: result.position
            })
        } catch (error) {
            console.error('放置执行异常:', error)
            return createFailureResult('action', 'place', 'PLACE_ERROR')
        }
    }

    if (name === 'break') {
        try {
            const result = await breakBlock(bot, parameters.position)

            printBreakResult(result)

            if (!result.success) {
                return createFailureResult(
                    'action',
                    'break',
                    result.reason || 'BREAK_FAILED'
                )
            }

            return createSuccessResult('action', 'break', {
                position: result.position
            })
        } catch (error) {
            console.error('破坏执行异常:', error)
            return createFailureResult('action', 'break', 'BREAK_ERROR')
        }
    }

    if (name === 'navigate') {
        try {
            const result = await navigation.navigateTo(parameters.position)

            if (result === true) {
                return createSuccessResult('action', 'navigate', {
                    position: parameters.position
                })
            }

            if (result === 'REPLAN_REQUIRED') {
                return createFailureResult(
                    'action',
                    'navigate',
                    'REPLAN_REQUIRED'
                )
            }

            return createFailureResult(
                'action',
                'navigate',
                'NAVIGATION_FAILED'
            )
        } catch (error) {
            console.error('导航执行异常:', error)
            return createFailureResult(
                'action',
                'navigate',
                'NAVIGATION_ERROR'
            )
        }
    }
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
