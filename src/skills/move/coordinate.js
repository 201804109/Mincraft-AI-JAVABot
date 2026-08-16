const { Vec3 } = require('vec3')

function voxelToWorld(position) {
    return new Vec3(
        position.x + 0.5,
        position.y,
        position.z + 0.5
    )
}

function worldToVoxel(position) {
    return new Vec3(
        Math.floor(position.x),
        Math.floor(position.y),
        Math.floor(position.z)
    )
}

module.exports = {
    voxelToWorld,
    worldToVoxel
}
