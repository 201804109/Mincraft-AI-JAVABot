function getPosition(bot) {
    const { x, y, z } = bot.entity.position

    return { x, y, z }
}

module.exports = {
    getPosition
}
