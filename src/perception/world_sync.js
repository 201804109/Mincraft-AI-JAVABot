let activeBot = null
let activeWorldMap = null

function init(bot, worldMap) {
    if (!bot || typeof bot.on !== 'function') {
        throw new Error('world_sync需要有效的bot实例')
    }

    if (!worldMap || typeof worldMap.updateBlock !== 'function') {
        throw new Error('world_sync需要有效的worldMap实例')
    }

    stop()
    activeBot = bot
    activeWorldMap = worldMap
    activeBot.on('blockUpdate', handleBlockUpdate)
}

function stop() {
    if (activeBot) {
        activeBot.removeListener('blockUpdate', handleBlockUpdate)
    }

    activeBot = null
    activeWorldMap = null
}

function handleBlockUpdate(oldBlock, newBlock) {
    if (!activeWorldMap || !newBlock || !newBlock.position) {
        return
    }

    const { x, y, z } = newBlock.position
    const blockName = newBlock.name

    if (![x, y, z].every(Number.isFinite) || typeof blockName !== 'string') {
        return
    }

    if (
        oldBlock &&
        oldBlock.name === blockName &&
        oldBlock.position &&
        oldBlock.position.x === x &&
        oldBlock.position.y === y &&
        oldBlock.position.z === z
    ) {
        return
    }

    activeWorldMap.updateBlock(x, y, z, blockName)
}

module.exports = {
    init,
    stop
}
