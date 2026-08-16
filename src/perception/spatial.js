const worldMap = require('./map')

const ROBOT_WIDTH = 0.6
const ROBOT_HEIGHT = 1.8
const ROBOT_HALF_WIDTH = ROBOT_WIDTH / 2
const SWEEP_SAMPLE_STEP = 0.1
const BOUNDARY_EPSILON = 1e-7

function canOccupy(position) {
    const result = checkOccupancy(position)

    if (!result.ok) {
        console.log('[COLLISION] cannot occupy')
        console.log({
            position: result.position,
            part: result.part,
            block: result.block
        })
    }

    return result.ok
}

function canMove(from, to) {
    if (!isValidPosition(from) || !isValidPosition(to)) {
        return blockMove(from, to, 'invalid position', null)
    }

    const dx = to.x - from.x
    const dy = to.y - from.y
    const dz = to.z - from.z

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || Math.abs(dz) > 1) {
        return blockMove(from, to, 'movement too large', null)
    }

    const targetCheck = checkOccupancy(to)
    if (!targetCheck.ok) {
        const reason = dy > 0 && targetCheck.part === 'head'
            ? 'head collision'
            : 'target occupied'
        return blockMove(from, to, reason, targetCheck.block)
    }

    const sweptCheck = checkSweptOccupancy(from, to)
    if (!sweptCheck.ok) {
        return blockMove(from, to, 'swept collision', sweptCheck.block)
    }

    const changedAxes = []
    if (dx !== 0) changedAxes.push({ axis: 'x', delta: dx })
    if (dy !== 0) changedAxes.push({ axis: 'y', delta: dy })
    if (dz !== 0) changedAxes.push({ axis: 'z', delta: dz })

    if (changedAxes.length > 1) {
        for (const intermediate of getIntermediatePositions(from, changedAxes)) {
            const intermediateCheck = checkOccupancy(intermediate)

            if (!intermediateCheck.ok) {
                return blockMove(from, to, 'corner collision', intermediateCheck.block)
            }
        }
    }

    return true
}

function checkOccupancy(position) {
    if (!isValidPosition(position)) {
        return {
            ok: false,
            position: position || null,
            part: 'body',
            block: null
        }
    }

    const bounds = getOccupiedBlockBounds(position)

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
                const block = getBlockInfo(x, y, z)

                if (block.state !== 'AIR') {
                    return {
                        ok: false,
                        position: { x: position.x, y: position.y, z: position.z },
                        part: getCollisionPart(position, y),
                        block
                    }
                }
            }
        }
    }

    return {
        ok: true,
        position: { x: position.x, y: position.y, z: position.z },
        part: null,
        block: null
    }
}

function checkSweptOccupancy(from, to) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dz = to.z - from.z
    const largestAxisDistance = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz))
    const steps = Math.max(1, Math.ceil(largestAxisDistance / SWEEP_SAMPLE_STEP))

    for (let index = 1; index < steps; index++) {
        const t = index / steps
        const position = {
            x: from.x + dx * t,
            y: from.y + dy * t,
            z: from.z + dz * t
        }
        const result = checkOccupancy(position)

        if (!result.ok) {
            return result
        }
    }

    return {
        ok: true,
        position: { x: to.x, y: to.y, z: to.z },
        part: null,
        block: null
    }
}

function getOccupiedBlockBounds(position) {
    const minX = position.x - ROBOT_HALF_WIDTH
    const maxX = position.x + ROBOT_HALF_WIDTH
    const minY = position.y
    const maxY = position.y + ROBOT_HEIGHT
    const minZ = position.z - ROBOT_HALF_WIDTH
    const maxZ = position.z + ROBOT_HALF_WIDTH

    return {
        minX: Math.floor(minX + BOUNDARY_EPSILON),
        maxX: Math.floor(maxX - BOUNDARY_EPSILON),
        minY: Math.floor(minY + BOUNDARY_EPSILON),
        maxY: Math.floor(maxY - BOUNDARY_EPSILON),
        minZ: Math.floor(minZ + BOUNDARY_EPSILON),
        maxZ: Math.floor(maxZ - BOUNDARY_EPSILON)
    }
}

function getCollisionPart(position, blockY) {
    return blockY < position.y + ROBOT_HEIGHT / 2 ? 'body' : 'head'
}

function getIntermediatePositions(from, changedAxes) {
    const positions = []
    const combinations = 2 ** changedAxes.length

    // 排除空集合（from）和全集（to），检查所有轴向组合中间位置。
    for (let mask = 1; mask < combinations - 1; mask++) {
        const position = { x: from.x, y: from.y, z: from.z }

        for (let index = 0; index < changedAxes.length; index++) {
            if ((mask & (1 << index)) !== 0) {
                const { axis, delta } = changedAxes[index]
                position[axis] += delta
            }
        }

        positions.push(position)
    }

    return positions
}

function blockMove(from, to, reason, block) {
    console.log('[MOVE BLOCKED]')
    console.log('from:', formatPosition(from))
    console.log('to:', formatPosition(to))
    console.log('reason:', reason)
    console.log('block:', block)

    return false
}

function getBlockInfo(x, y, z) {
    const block = worldMap.getBlock(x, y, z)
    return { x, y, z, state: block.state }
}

function formatPosition(position) {
    if (!isValidPosition(position)) {
        return String(position)
    }

    return `${position.x},${position.y},${position.z}`
}

function isValidPosition(position) {
    return position && [position.x, position.y, position.z].every(Number.isFinite)
}

module.exports = {
    canOccupy,
    canMove
}
