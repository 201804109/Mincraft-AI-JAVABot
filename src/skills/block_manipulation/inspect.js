const { Vec3 } = require('vec3')
const { scanView } = require('../../perception/vision')

const VIEW_STABILIZATION_DELAY = 300

async function inspectPosition(bot, position) {
    if (!bot || !bot.entity || !bot.entity.position || typeof bot.lookAt !== 'function') {
        throw new Error('inspectPosition需要有效的bot实例')
    }

    if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) {
        throw new Error('inspectPosition需要有效的目标坐标')
    }

    const center = new Vec3(
        position.x + 0.5,
        position.y + 0.5,
        position.z + 0.5
    )

    console.log('机器人当前位置:')
    console.log('position:')
    console.log(`x: ${bot.entity.position.x}`)
    console.log(`y: ${bot.entity.position.y}`)
    console.log(`z: ${bot.entity.position.z}`)
    console.log('目标观察点:')
    console.log('target:')
    console.log(`x: ${center.x}`)
    console.log(`y: ${center.y}`)
    console.log(`z: ${center.z}`)
    console.log('lookAt之前:')
    console.log(`yaw: ${bot.entity.yaw}`)
    console.log(`pitch: ${bot.entity.pitch}`)

    await bot.lookAt(center)
    await sleep(VIEW_STABILIZATION_DELAY)

    console.log('lookAt之后:')
    console.log(`yaw: ${bot.entity.yaw}`)
    console.log(`pitch: ${bot.entity.pitch}`)

    return scanView(bot)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
    inspectPosition
}
