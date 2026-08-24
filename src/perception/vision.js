const { Vec3 } = require('vec3')

const DEFAULT_OPTIONS = {
    maxDistance: 5,
    horizontalFov: 120,
    verticalFov: 20,
    angleStep: 10
}
const SAMPLE_STEP = 0.1
const PLAYER_EYE_HEIGHT = 1.62
const AIR_TYPES = new Set(['air', 'cave_air', 'void_air'])

function scanView(bot, options = {}) {
    if (!bot || !bot.entity || !bot.entity.position) {
        return []
    }

    const settings = getSettings(options)
    const yaw = Number.isFinite(bot.entity.yaw) ? bot.entity.yaw : 0
    const pitch = Number.isFinite(bot.entity.pitch) ? bot.entity.pitch : 0
    const eyePosition = bot.entity.position.offset(0, PLAYER_EYE_HEIGHT, 0)
    const visibleBlocks = new Map()
    const horizontalLimit = settings.horizontalFov / 2
    const verticalLimit = settings.verticalFov / 2

    for (
        let horizontalAngle = -horizontalLimit;
        horizontalAngle <= horizontalLimit;
        horizontalAngle += settings.angleStep
    ) {
        for (
            let verticalAngle = -verticalLimit;
            verticalAngle <= verticalLimit;
            verticalAngle += settings.angleStep
        ) {
            const direction = getViewDirection(
                yaw + toRadians(horizontalAngle),
                clampPitch(pitch + toRadians(verticalAngle))
            )
            const hit = castRay(bot, eyePosition, direction, settings.maxDistance)

            if (!hit) {
                continue
            }

            const key = `${hit.position.x},${hit.position.y},${hit.position.z}`
            const current = visibleBlocks.get(key)

            if (!current || hit.distance < current.distance) {
                visibleBlocks.set(key, {
                    name: hit.block.name,
                    position: {
                        x: hit.position.x,
                        y: hit.position.y,
                        z: hit.position.z
                    },
                    distance: hit.distance
                })
            }
        }
    }

    return Array.from(visibleBlocks.values())
}

function castRay(bot, eyePosition, direction, maxDistance) {
    let lastBlockKey = null
    const steps = Math.ceil(maxDistance / SAMPLE_STEP)

    for (let index = 0; index <= steps; index++) {
        const distance = Math.min(index * SAMPLE_STEP, maxDistance)
        const point = eyePosition.plus(direction.scaled(distance))
        const blockPosition = point.floored()
        const key = `${blockPosition.x},${blockPosition.y},${blockPosition.z}`

        if (key === lastBlockKey) {
            continue
        }

        lastBlockKey = key
        const block = bot.blockAt(blockPosition)

        if (block && !AIR_TYPES.has(block.name)) {
            return {
                block,
                position: block.position,
                distance: eyePosition.distanceTo(point)
            }
        }
    }

    return null
}

function getViewDirection(yaw, pitch) {
    const horizontal = Math.cos(pitch)

    return new Vec3(
        -Math.sin(yaw) * horizontal,
        Math.sin(pitch),
        -Math.cos(yaw) * horizontal
    )
}

function getSettings(options) {
    const settings = {
        maxDistance: options.maxDistance ?? DEFAULT_OPTIONS.maxDistance,
        horizontalFov: options.horizontalFov ?? DEFAULT_OPTIONS.horizontalFov,
        verticalFov: options.verticalFov ?? DEFAULT_OPTIONS.verticalFov,
        angleStep: options.angleStep ?? DEFAULT_OPTIONS.angleStep
    }

    if (!Number.isFinite(settings.maxDistance) || settings.maxDistance < 0) {
        throw new Error('maxDistance必须是非负数')
    }

    if (!Number.isFinite(settings.horizontalFov) || settings.horizontalFov < 0) {
        throw new Error('horizontalFov必须是非负数')
    }

    if (!Number.isFinite(settings.verticalFov) || settings.verticalFov < 0) {
        throw new Error('verticalFov必须是非负数')
    }

    if (!Number.isFinite(settings.angleStep) || settings.angleStep <= 0) {
        throw new Error('angleStep必须是正数')
    }

    return settings
}

function toRadians(degrees) {
    return degrees * Math.PI / 180
}

function clampPitch(pitch) {
    return Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch))
}

module.exports = {
    scanView
}
