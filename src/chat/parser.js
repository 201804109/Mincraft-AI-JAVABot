module.exports = function(message) {
    const parts = message.trim().split(/\s+/)
    const command = parts[0]

    if (command === '破坏') {
        if (parts.length !== 4) {
            printBreakUsage()
            return
        }

        const x = Number(parts[1])
        const y = Number(parts[2])
        const z = Number(parts[3])

        if (![x, y, z].every(Number.isInteger)) {
            printBreakUsage()
            return
        }

        return {
            action: 'break',
            position: { x, y, z }
        }
    }

    if (command === '放置') {
        if (parts.length !== 5) {
            printPlaceUsage()
            return
        }

        const x = Number(parts[1])
        const y = Number(parts[2])
        const z = Number(parts[3])
        const blockName = parts[4]

        if (![x, y, z].every(Number.isInteger) || !blockName) {
            printPlaceUsage()
            return
        }

        return {
            action: 'place',
            block: blockName,
            position: { x, y, z }
        }
    }

    if (command === '导航') {
        const x = Number(parts[1])
        const y = Number(parts[2])
        const z = Number(parts[3])

        if (![x, y, z].every(Number.isFinite)) {
            console.log('导航坐标无效')
            return
        }

        return {
            action: 'navigate',
            position: { x, y, z }
        }
    }

    return undefined
}

function printPlaceUsage() {
    console.log('参数错误:')
    console.log('正确格式:')
    console.log('放置 x y z 方块名称')
}

function printBreakUsage() {
    console.log('参数错误:')
    console.log('正确格式:')
    console.log('破坏 x y z')
}
