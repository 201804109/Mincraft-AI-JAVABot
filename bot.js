const mineflayer = require('mineflayer')
const movement = require('./src/skills/move/basic_movement')
const flight = require('./src/skills/move/flight')
const navigation = require('./src/skills/move/navigation')
const scanner = require('./src/perception/scanner')
const worldMap = require('./src/perception/map')
const worldSync = require('./src/perception/world_sync')
const storage = require('./src/perception/storage')
const parser = require('./src/chat/parser')
const chatListener = require('./src/chat/listener')

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
    worldMap.init()
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
