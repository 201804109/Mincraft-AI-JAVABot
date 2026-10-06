function transformPosition(origin, localPosition) {
    assertPosition(origin, 'origin')
    assertPosition(localPosition, 'localPosition')

    const worldPosition = {
        x: origin.x + localPosition.x,
        y: origin.y + localPosition.y,
        z: origin.z + localPosition.z
    }

    assertPosition(worldPosition, 'worldPosition')
    return worldPosition
}

function transformBuildingPlan(plan) {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
        throw new TypeError('plan must be an object.')
    }
    assertPosition(plan.origin, 'plan.origin')
    if (!Array.isArray(plan.blocks)) {
        throw new TypeError('plan.blocks must be an array.')
    }

    return {
        formatVersion: plan.formatVersion,
        name: plan.name,
        origin: { ...plan.origin },
        size: { ...plan.size },
        blocks: plan.blocks.map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                throw new TypeError(`plan.blocks[${index}] must be an object.`)
            }
            return {
                block: item.block,
                position: transformPosition(plan.origin, item.position)
            }
        })
    }
}

function assertPosition(position, name) {
    if (!position || typeof position !== 'object' || Array.isArray(position) ||
        !['x', 'y', 'z'].every(axis => Number.isFinite(position[axis]))) {
        throw new TypeError(`${name} must have finite numeric x, y, and z coordinates.`)
    }
}

module.exports = {
    transformPosition,
    transformBuildingPlan
}
