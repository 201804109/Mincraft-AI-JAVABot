const names = new Map([
    ['navigate', 'navigate'],
    ['place', 'place'],
    ['break', 'break'],
    ['self.getPosition', 'self_getPosition'],
    ['voxel.getBlock', 'voxel_getBlock'],
    ['voxel.getVolume', 'voxel_getVolume'],
    ['voxel.getSurroundings', 'voxel_getSurroundings'],
    ['surface.getColumn', 'surface_getColumn'],
    ['surface.getChunk', 'surface_getChunk'],
    ['surface.getArea', 'surface_getArea'],
    ['area.getAreaSummary', 'area_getAreaSummary'],
    ['area.getAreaGrid', 'area_getAreaGrid'],
    ['area.getRegions', 'area_getRegions']
])
const internalNames = new Map([...names].map(([internal, external]) => [external, internal]))

module.exports = {
    toLLMName: name => names.get(name),
    toInternalName: name => internalNames.get(name)
}
