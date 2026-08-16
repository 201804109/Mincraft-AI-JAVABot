const spatial = require('../../perception/spatial')
const {
    MAX_SEARCH_NODES,
    MAX_SEARCH_DISTANCE
} = require('../../../config/navigation_config')

class PathPlanner {
    findPath(start, goal, options = {}) {
        if (!isValidPosition(start) || !isValidPosition(goal)) {
            return null
        }

        const startPosition = normalize(start)
        const goalPosition = normalize(goal)
        const maxSearchDistance = options.maxSearchDistance ?? MAX_SEARCH_DISTANCE
        const maxNodes = options.maxNodes ?? MAX_SEARCH_NODES

        if (distance(startPosition, goalPosition) > maxSearchDistance) {
            return null
        }

        const startSpatialPosition = voxelToSpatialPosition(startPosition)
        if (!spatial.canOccupy(startSpatialPosition)) {
            return null
        }

        const goalSpatialPosition = voxelToSpatialPosition(goalPosition)
        if (!spatial.canOccupy(goalSpatialPosition)) {
            console.log('voxel target:', formatPosition(goalPosition))
            console.log('spatial check position:', formatPosition(goalSpatialPosition))
            return null
        }

        const open = new MinHeap(compareNodes)
        const openCosts = new Map()
        const closed = new Set()
        const startNode = createNode(
            startPosition,
            0,
            distance(startPosition, goalPosition),
            null
        )

        open.push(startNode)
        openCosts.set(positionKey(startPosition), 0)

        let visitedNodes = 0

        while (open.size > 0 && visitedNodes < maxNodes) {
            const current = open.pop()
            const currentKey = positionKey(current.position)

            if (closed.has(currentKey)) {
                continue
            }

            const bestKnownCost = openCosts.get(currentKey)
            if (bestKnownCost !== undefined && current.gCost > bestKnownCost) {
                continue
            }

            visitedNodes++

            if (samePosition(current.position, goalPosition)) {
                return reconstructPath(current)
            }

            closed.add(currentKey)

            for (const neighborPosition of getNeighbors(current.position)) {
                const neighborKey = positionKey(neighborPosition)

                if (
                    closed.has(neighborKey) ||
                    distance(startPosition, neighborPosition) > maxSearchDistance
                ) {
                    continue
                }

                const movementCost = getMovementCost(current.position, neighborPosition)
                const gCost = current.gCost + movementCost
                const knownCost = openCosts.get(neighborKey)

                if (knownCost !== undefined && gCost >= knownCost) {
                    continue
                }

                const hCost = distance(neighborPosition, goalPosition)
                const neighbor = createNode(neighborPosition, gCost, hCost, current)
                openCosts.set(neighborKey, gCost)
                open.push(neighbor)
            }
        }

        return null
    }
}

function getNeighbors(position) {
    const directions = [
        { dx: 1, dy: 0, dz: 0 },
        { dx: -1, dy: 0, dz: 0 },
        { dx: 0, dy: 0, dz: 1 },
        { dx: 0, dy: 0, dz: -1 },
        { dx: 1, dy: 0, dz: 1 },
        { dx: 1, dy: 0, dz: -1 },
        { dx: -1, dy: 0, dz: 1 },
        { dx: -1, dy: 0, dz: -1 },
        { dx: 0, dy: 1, dz: 0 },
        { dx: 0, dy: -1, dz: 0 }
    ]
    const neighbors = []

    for (const { dx, dy, dz } of directions) {
        const neighbor = {
            x: position.x + dx,
            y: position.y + dy,
            z: position.z + dz
        }

        if (spatial.canMove(
            voxelToSpatialPosition(position),
            voxelToSpatialPosition(neighbor)
        )) {
            neighbors.push(neighbor)
        }
    }

    return neighbors
}

function getMovementCost(from, to) {
    const dx = Math.abs(to.x - from.x)
    const dz = Math.abs(to.z - from.z)

    return dx === 1 && dz === 1 ? Math.sqrt(2) : 1
}

function reconstructPath(node) {
    const path = []
    let current = node

    while (current) {
        path.push(current.position)
        current = current.parent
    }

    return path.reverse()
}

function createNode(position, gCost, hCost, parent) {
    return {
        position,
        gCost,
        hCost,
        fCost: gCost + hCost,
        parent
    }
}

function compareNodes(a, b) {
    return a.fCost - b.fCost || a.hCost - b.hCost
}

function normalize(position) {
    return {
        x: Math.floor(position.x),
        y: Math.floor(position.y),
        z: Math.floor(position.z)
    }
}

function voxelToSpatialPosition(position) {
    return {
        x: position.x + 0.5,
        y: position.y,
        z: position.z + 0.5
    }
}

function formatPosition(position) {
    return `(${position.x},${position.y},${position.z})`
}

function isValidPosition(position) {
    return position && [position.x, position.y, position.z].every(Number.isFinite)
}

function samePosition(a, b) {
    return a.x === b.x && a.y === b.y && a.z === b.z
}

function positionKey(position) {
    return `${position.x},${position.y},${position.z}`
}

function distance(a, b) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dz = b.z - a.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

class MinHeap {
    constructor(compare) {
        this.items = []
        this.compare = compare
    }

    get size() {
        return this.items.length
    }

    push(value) {
        this.items.push(value)
        this._bubbleUp(this.items.length - 1)
    }

    pop() {
        const first = this.items[0]
        const last = this.items.pop()

        if (this.items.length > 0) {
            this.items[0] = last
            this._sinkDown(0)
        }

        return first
    }

    _bubbleUp(index) {
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2)
            if (this.compare(this.items[index], this.items[parent]) >= 0) {
                break
            }
            ;[this.items[index], this.items[parent]] = [this.items[parent], this.items[index]]
            index = parent
        }
    }

    _sinkDown(index) {
        while (true) {
            const left = index * 2 + 1
            const right = left + 1
            let smallest = index

            if (left < this.items.length && this.compare(this.items[left], this.items[smallest]) < 0) {
                smallest = left
            }
            if (right < this.items.length && this.compare(this.items[right], this.items[smallest]) < 0) {
                smallest = right
            }
            if (smallest === index) {
                break
            }

            ;[this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]]
            index = smallest
        }
    }
}

module.exports = {
    PathPlanner
}
