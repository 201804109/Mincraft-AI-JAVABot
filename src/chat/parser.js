const movement = require('../skills/move/basic_movement')
const flight = require('../skills/move/flight')
const navigation = require('../skills/move/navigation')
const { inspectPosition } = require('../skills/block_manipulation/inspect')
const Vec3 = require('vec3')

module.exports = async function(message, bot) {
    const parts = message.trim().split(/\s+/)
    const command = parts[0]

    if (command === '放置') {
        if (parts.length !== 5) {
            printPlaceUsage()
            return
        }

        const x = Number(parts[1])
        const y = Number(parts[2])
        const z = Number(parts[3])
        const blockName = parts[4]

        if (![x, y, z].every(Number.isInteger) || !blockName) {
            printPlaceUsage()
            return
        }

        return {
            action: 'place',
            block: blockName,
            position: { x, y, z }
        }
    }

    if (command === '飞到') {
        const x = Number(parts[1])
        const y = Number(parts[2])
        const z = Number(parts[3])

        if (![x, y, z].every(Number.isFinite)) {
            console.log('飞行坐标无效')
            return
        }

        const position = new Vec3(x, y, z)
        await flight.flyTo(position)
        return
    }

    if (command === '导航') {
        const x = Number(parts[1])
        const y = Number(parts[2])
        const z = Number(parts[3])

        if (![x, y, z].every(Number.isFinite)) {
            console.log('导航坐标无效')
            return
        }

        const target = new Vec3(x, y, z)
        await navigation.navigateTo(target)
        return
    }

    if (command === '看') {
        const x = Number(parts[1])
        const y = Number(parts[2])
        const z = Number(parts[3])

        if (![x, y, z].every(Number.isFinite)) {
            console.log('观察坐标无效')
            return
        }

        const parsedCommand = {
            action: 'inspect',
            position: { x, y, z }
        }
        const blocks = await inspectPosition(bot, parsedCommand.position)
        printVisionResult(parsedCommand.position, blocks)
        return parsedCommand
    }

    if (command === '跳跃') {
        await movement.jump()
        return
    }

    const value = Number(parts[1])

    if (command === '转向') {
        if (!Number.isFinite(value)) {
            console.log('转向角度无效')
            return
        }

        await movement.lookYaw(value)
        return
    }

    const timedActions = {
        移动: movement.moveForward,
        后退: movement.moveBackward,
        左移: movement.moveLeft,
        右移: movement.moveRight,
        潜行: movement.sneak
    }

    const action = timedActions[command]
    if (!action) {
        return
    }

    if (!Number.isFinite(value) || value <= 0) {
        console.log('动作时间无效')
        return
    }

    await action(value * 1000)
}

function printVisionResult(target, blocks) {
    console.log('观察方向:')
    console.log(`${target.x} ${target.y} ${target.z}`)

    if (blocks.length === 0) {
        console.log('没有发现可见方块')
        return
    }

    console.log('发现方块:')

    for (const block of blocks) {
        console.log(block.name)
        console.log(`(${block.position.x},${block.position.y},${block.position.z})`)
    }
}

function printPlaceUsage() {
    console.log('参数错误:')
    console.log('正确格式:')
    console.log('放置 x y z 方块名称')
}
