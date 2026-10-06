function sortPlaceTasks(tasks) {
    return sortTasks(tasks, task => task && task.position, 'place')
}

function sortBreakTasks(tasks) {
    return sortTasks(tasks, task => task, 'break')
}

function applyScanPath(layer) {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
        throw new TypeError('layer must be an object.')
    }
    if (!Array.isArray(layer.break)) {
        throw new TypeError('layer.break must be an array.')
    }
    if (!Array.isArray(layer.place)) {
        throw new TypeError('layer.place must be an array.')
    }

    return {
        ...layer,
        break: sortBreakTasks(layer.break),
        place: sortPlaceTasks(layer.place)
    }
}

function sortTasks(tasks, getPosition, taskType) {
    if (!Array.isArray(tasks)) {
        throw new TypeError(`${taskType} tasks must be an array.`)
    }

    const rows = new Map()
    tasks.forEach((task, index) => {
        const position = getPosition(task)
        if (!task || typeof task !== 'object' || Array.isArray(task) ||
            !position || typeof position !== 'object' || Array.isArray(position) ||
            !Number.isInteger(position.x) || !Number.isInteger(position.z)) {
            throw new TypeError(`Each ${taskType} task must have integer X and Z coordinates.`)
        }
        if (!rows.has(position.z)) rows.set(position.z, [])
        rows.get(position.z).push({ task, x: position.x, index })
    })

    const orderedRows = [...rows.keys()].sort((a, b) => a - b)
    const sorted = []
    orderedRows.forEach((z, rowIndex) => {
        const row = rows.get(z)
        const direction = rowIndex % 2 === 0 ? 1 : -1
        row.sort((a, b) => direction * (a.x - b.x) || a.index - b.index)
        for (const entry of row) sorted.push(entry.task)
    })
    return sorted
}

module.exports = {
    sortPlaceTasks,
    sortBreakTasks,
    applyScanPath
}
