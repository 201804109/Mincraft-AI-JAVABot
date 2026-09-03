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
        description: 'Get current position of Minecraft bot',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'voxel.getBlock',
        type: 'query',
        description: 'Get a block from the observed voxel map',
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
        description: 'Get observed blocks surrounding the Minecraft bot',
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
        description: 'Get surface information for one world column',
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
        description: 'Get a summarized analysis of a surface area',
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
