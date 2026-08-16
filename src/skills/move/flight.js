const { voxelToWorld } = require('./coordinate')

let bot = null

function init(_bot) {
    bot = _bot
}

async function flyTo(position) {
    if (!bot) {
        console.log('Bot未初始化')
        return
    }

    if (!isVoxelPosition(position)) {
        throw new Error('flyTo需要整数voxel坐标')
    }

    const worldPosition = voxelToWorld(position)
    console.log('[Flight] voxel:', formatPosition(position))
    console.log('[Flight] world:', formatPosition(worldPosition))

    await bot.creative.flyTo(worldPosition)
}

function isVoxelPosition(position) {
    return position && [position.x, position.y, position.z].every(Number.isInteger)
}

function formatPosition(position) {
    return `(${position.x},${position.y},${position.z})`
}

module.exports = {
    init,
    flyTo
}
