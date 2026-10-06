const names = new Map([
    ['navigate', 'navigate'],
    ['place', 'place'],
    ['break', 'break'],
    ['batch_place', 'batch_place'],
    ['batch_break', 'batch_break'],
    ['self.getPosition', 'self_getPosition'],
    ['voxel.getBlock', 'voxel_getBlock'],
    ['voxel.getVolume', 'voxel_getVolume'],
    ['voxel.getSurroundings', 'voxel_getSurroundings'],
    ['surface.getColumn', 'surface_getColumn'],
    ['surface.getChunk', 'surface_getChunk'],
    ['surface.getArea', 'surface_getArea'],
    ['area.getAreaSummary', 'area_getAreaSummary'],
    ['area.getAreaGrid', 'area_getAreaGrid'],
    ['area.getRegions', 'area_getRegions'],
    ['building.plan.list', 'building_plan_list'],
    ['building.plan.get', 'building_plan_get'],
    ['building.plan.createDraft', 'building_plan_createDraft'],
    ['building.plan.updateDraft', 'building_plan_updateDraft'],
    ['building.plan.commitDraft', 'building_plan_commitDraft'],
    ['build_from_plan', 'build_from_plan']
])
const internalNames = new Map([...names].map(([internal, external]) => [external, internal]))

module.exports = {
    toLLMName: name => names.get(name),
    toInternalName: name => internalNames.get(name)
}
