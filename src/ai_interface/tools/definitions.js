const POSITION_PROPERTIES = {
    x: { type: 'number' },
    y: { type: 'number' },
    z: { type: 'number' }
}

const BLOCK_POSITION_PROPERTIES = {
    x: { type: 'integer' },
    y: { type: 'integer' },
    z: { type: 'integer' }
}

const AREA_BOUNDS_SCHEMA = {
    type: 'object',
    properties: {
        minX: { type: 'integer' },
        maxX: { type: 'integer' },
        minZ: { type: 'integer' },
        maxZ: { type: 'integer' }
    },
    required: ['minX', 'maxX', 'minZ', 'maxZ']
}

const VOLUME_BOUNDS_SCHEMA = {
    type: 'object',
    properties: {
        ...AREA_BOUNDS_SCHEMA.properties,
        minY: { type: 'integer' },
        maxY: { type: 'integer' }
    },
    required: ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ']
}

const AREA_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        resolution: {
            type: 'integer',
            minimum: 1
        }
    }
}

const TOOL_DEFINITIONS = [
    {
        name: 'self.getPosition',
        type: 'query',
        description: 'Get the current live position of the Minecraft bot, not the player. Coordinates may be fractional.',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'voxel.getBlock',
        type: 'query',
        description: 'Read one integer voxel from the existing Raw World Map; does not scan Minecraft. observed:false / UNKNOWN means no reliable observation, NOT air. lastSeen and confidence describe observation freshness.',
        parameters: {
            type: 'object',
            properties: BLOCK_POSITION_PROPERTIES,
            required: ['x', 'y', 'z']
        }
    },
    {
        name: 'voxel.getVolume',
        type: 'query',
        description: 'Get observed blocks within a voxel volume',
        parameters: {
            type: 'object',
            properties: {
                bounds: VOLUME_BOUNDS_SCHEMA
            },
            required: ['bounds']
        }
    },
    {
        name: 'voxel.getSurroundings',
        type: 'query',
        description: 'Read existing Raw World Map around the floored current bot position; no active scan. Use horizontalRadius <= 8 and verticalRadius <= 4 for Agent requests. coverage < 1 is incomplete knowledge, not failure; blocks omit air and unknown voxels.',
        parameters: {
            type: 'object',
            properties: {
                horizontalRadius: {
                    type: 'integer',
                    minimum: 0
                },
                verticalRadius: {
                    type: 'integer',
                    minimum: 0
                }
            },
            required: ['horizontalRadius', 'verticalRadius']
        }
    },
    {
        name: 'surface.getColumn',
        type: 'query',
        description: 'Read a cached Surface column without scanning. top is only the highest observed non-air block, not guaranteed ground, roof, safe footing or full world height. observed:false means unknown. Surface data may be stale and has no freshness timestamp.',
        parameters: {
            type: 'object',
            properties: {
                x: { type: 'integer' },
                z: { type: 'integer' }
            },
            required: ['x', 'z']
        }
    },
    {
        name: 'surface.getChunk',
        type: 'query',
        description: 'Get surface information for one Minecraft chunk',
        parameters: {
            type: 'object',
            properties: {
                chunkX: { type: 'integer' },
                chunkZ: { type: 'integer' }
            },
            required: ['chunkX', 'chunkZ']
        }
    },
    {
        name: 'surface.getArea',
        type: 'query',
        description: 'Get surface columns within an area',
        parameters: {
            type: 'object',
            properties: {
                bounds: AREA_BOUNDS_SCHEMA
            },
            required: ['bounds']
        }
    },
    {
        name: 'area.getAreaSummary',
        type: 'query',
        description: 'Summarize existing Surface Map, without scanning: coverage, dominantBlock, height and regions. Agent bounds must have inclusive width <= 64 and depth <= 64. Data may be stale; coverage is observed-column coverage, not freshness. Regions are connected dominant-material cells, not semantic houses or forests.',
        parameters: {
            type: 'object',
            properties: {
                bounds: AREA_BOUNDS_SCHEMA,
                options: AREA_OPTIONS_SCHEMA
            },
            required: ['bounds']
        }
    },
    {
        name: 'area.getAreaGrid',
        type: 'query',
        description: 'Get a grid analysis of a surface area',
        parameters: {
            type: 'object',
            properties: {
                bounds: AREA_BOUNDS_SCHEMA,
                options: AREA_OPTIONS_SCHEMA
            },
            required: ['bounds']
        }
    },
    {
        name: 'area.getRegions',
        type: 'query',
        description: 'Get detected regions within a surface area',
        parameters: {
            type: 'object',
            properties: {
                bounds: AREA_BOUNDS_SCHEMA,
                options: AREA_OPTIONS_SCHEMA
            },
            required: ['bounds']
        }
    },
    {
        name: 'navigate',
        type: 'action',
        description: 'Navigate the Minecraft bot to a position',
        parameters: {
            type: 'object',
            properties: {
                position: {
                    type: 'object',
                    properties: POSITION_PROPERTIES,
                    required: ['x', 'y', 'z']
                }
            },
            required: ['position']
        }
    },
    {
        name: 'place',
        type: 'action',
        description: 'Place a block at a position',
        parameters: {
            type: 'object',
            properties: {
                block: {
                    type: 'string',
                    minLength: 1
                },
                position: {
                    type: 'object',
                    properties: BLOCK_POSITION_PROPERTIES,
                    required: ['x', 'y', 'z']
                }
            },
            required: ['block', 'position']
        }
    },
    {
        name: 'break',
        type: 'action',
        description: 'Break a block at a position',
        parameters: {
            type: 'object',
            properties: {
                position: {
                    type: 'object',
                    properties: BLOCK_POSITION_PROPERTIES,
                    required: ['x', 'y', 'z']
                }
            },
            required: ['position']
        }
    }
]

module.exports = TOOL_DEFINITIONS
