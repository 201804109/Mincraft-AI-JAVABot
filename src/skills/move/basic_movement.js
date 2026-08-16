let bot = null

function init(_bot) {
    bot = _bot
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function holdControl(control, time) {
    if (!bot) {
        console.log('Bot未初始化')
        return
    }

    bot.setControlState(control, true)

    try {
        await sleep(time)
    } finally {
        bot.setControlState(control, false)
    }
}

async function moveForward(time) {
    await holdControl('forward', time)
}

async function moveBackward(time) {
    await holdControl('back', time)
}

async function moveLeft(time) {
    await holdControl('left', time)
}

async function moveRight(time) {
    await holdControl('right', time)
}

async function jump() {
    await holdControl('jump', 100)
}

async function sneak(time) {
    await holdControl('sneak', time)
}

function stop() {
    if (!bot) {
        console.log('Bot未初始化')
        return
    }

    bot.clearControlStates()
}

async function lookYaw(degree) {
    if (!bot) {
        console.log('Bot未初始化')
        return
    }

    const yaw = degree * Math.PI / 180
    await bot.look(yaw, bot.entity.pitch)
}

async function lookAt(position) {
    if (!bot) {
        console.log('Bot未初始化')
        return
    }

    await bot.lookAt(position)
}

module.exports = {
    init,
    moveForward,
    moveBackward,
    moveLeft,
    moveRight,
    jump,
    sneak,
    stop,
    lookYaw,
    lookAt
}
