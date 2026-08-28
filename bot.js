const mineflayer = require('mineflayer')
const movement = require('./src/skills/move/basic_movement')
const flight = require('./src/skills/move/flight')
const navigation = require('./src/skills/move/navigation')
const scanner = require('./src/perception/scanner')
const worldMap = require('./src/perception/map')
const worldSync = require('./src/perception/world_sync')
const storage = require('./src/perception/storage')
const surfaceMap = require('./src/map_analysis/surface/map')
const parser = require('./src/chat/parser')
const chatListener = require('./src/chat/listener')

let surfaceSubscriptions = []

const bot = mineflayer.createBot({
    host: '127.0.0.1',
    port: 25565,
    username: 'CityRobot001',
    auth: 'offline',
    version: '1.20.1'
})


bot.on('login', ()=>{

    console.log("登录服务器")

})


bot.on('spawn', ()=>{
    console.log("进入世界")
    bot.chat("Hello!")
    disconnectSurfaceMap()
    worldMap.init()
    surfaceMap.init(worldMap)
    surfaceSubscriptions = [
        worldMap.onBlockChanged(({ x, z }) => surfaceMap.markDirty(x, z)),
        worldMap.onChunkChanged(({ chunkX, chunkZ }) => {
            surfaceMap.markChunkDirty(chunkX, chunkZ)
        }),
        worldMap.onChunkRemoved(({ chunkX, chunkZ }) => {
            surfaceMap.removeChunk(chunkX, chunkZ)
        })
    ]
    const savedMap = storage.load()
    worldMap.loadMap(savedMap)
    scanner.init(bot)
    worldSync.init(bot, worldMap)
    scanner.start(16, 2000)

    movement.init(bot)
    flight.init(bot)
    navigation.init(bot)

    chatListener(bot, parser)
})


bot.on('kicked',(reason)=>{

    console.log("被踢:")
    console.log(reason)

})


bot.on('error',(err)=>{

    console.log("错误:")
    console.log(err)

})

function disconnectSurfaceMap() {
    for (const unsubscribe of surfaceSubscriptions) {
        unsubscribe()
    }

    surfaceSubscriptions = []
}
