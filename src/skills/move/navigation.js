const { Vec3 } = require('vec3')
const { PathPlanner } = require('./planner')
const pathFollower = require('./path_follow')
const scanner = require('../../perception/scanner')
const worldMap = require('../../perception/map')

const MAP_CHECK_RADIUS = 8
const ACTIVE_SCAN_RADIUS = 16
const UNKNOWN_RATIO_THRESHOLD = 0.1

let bot = null
const planner = new PathPlanner()

function init(_bot) {
    bot = _bot
    pathFollower.init(_bot)
}

async function navigateTo(target) {
    if (!bot) {
        console.log('Bot未初始化')
        return false
    }

    if (!target || ![target.x, target.y, target.z].every(Number.isFinite)) {
        return false
    }

    const destination = new Vec3(target.x, target.y, target.z)

    if (!prepareNavigationMap(destination)) {
        return false
    }

    const current = bot.entity.position.clone()
    const path = planner.findPath(current, destination)

    if (!path) {
        return false
    }

    return pathFollower.followPath(path)
}

function prepareNavigationMap(target) {
    if (getUnknownRatio(target, MAP_CHECK_RADIUS) <= UNKNOWN_RATIO_THRESHOLD) {
        return true
    }

    const scanResult = scanner.scanAt(target, ACTIVE_SCAN_RADIUS)
    if (!scanResult) {
        return false
    }

    return getUnknownRatio(target, MAP_CHECK_RADIUS) <= UNKNOWN_RATIO_THRESHOLD
}

function getUnknownRatio(position, radius) {
    const centerX = Math.floor(position.x)
    const centerY = Math.floor(position.y)
    const centerZ = Math.floor(position.z)
    let unknownBlocks = 0
    let totalBlocks = 0

    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                totalBlocks++

                if (worldMap.getBlock(x, y, z).state === 'UNKNOWN') {
                    unknownBlocks++
                }
            }
        }
    }

    return totalBlocks === 0 ? 1 : unknownBlocks / totalBlocks
}

function stop() {
    // 当前执行层没有可取消的底层 flight API。
}

module.exports = {
    init,
    navigateTo,
    prepareNavigationMap,
    stop
}
