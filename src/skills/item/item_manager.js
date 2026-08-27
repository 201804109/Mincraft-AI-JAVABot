const INVENTORY_UPDATE_TIMEOUT = 5000
const INVENTORY_POLL_INTERVAL = 500
const HOTBAR_START = 36
const HOTBAR_END = 44
const ITEM_NAME_PATTERN = /^[a-z0-9_:-]+$/

function getItemCount(bot, itemName) {
    if (!hasInventory(bot) || !isValidItemName(itemName)) {
        return 0
    }

    const registryName = getRegistryName(itemName)

    return bot.inventory.items()
        .filter(item => item.name === registryName)
        .reduce((total, item) => total + (Number(item.count) || 0), 0)
}

function hasItem(bot, itemName, count) {
    if (!Number.isInteger(count)) {
        return false
    }

    if (count <= 0) {
        return true
    }

    return getItemCount(bot, itemName) >= count
}

async function ensureItem(bot, itemName, count) {
    console.log('[ItemManager]')
    console.log('Checking item:')
    console.log(itemName)

    if (!isValidItemName(itemName) || !Number.isInteger(count) || count <= 0) {
        console.log('Invalid item request.')
        return false
    }

    if (hasItem(bot, itemName, count)) {
        console.log('Item available.')
        return true
    }

    console.log('Item missing.')
    return creativeAcquire(bot, itemName, count)
}

async function equipItem(bot, itemName) {
    if (!hasInventory(bot) || !isValidItemName(itemName) || typeof bot.equip !== 'function') {
        return false
    }

    const registryName = getRegistryName(itemName)
    const item = bot.inventory.items().find(candidate => candidate.name === registryName)
    if (!item) {
        return false
    }

    try {
        await bot.equip(item, 'hand')
        return true
    } catch (error) {
        console.error('[ItemManager] Equip failed:', error)
        return false
    }
}

async function creativeAcquire(bot, itemName, count) {
    if (!hasCreativeInventory(bot) || !hasInventory(bot)) {
        console.log('Creative inventory unavailable.')
        return false
    }

    const registryName = getRegistryName(itemName)
    const itemDefinition = bot.registry.itemsByName[registryName]

    if (!itemDefinition) {
        console.log('Item not found in registry.')
        return false
    }

    const Item = require('prismarine-item')(bot.registry)
    const stackSize = itemDefinition.stackSize || 64
    let remaining = count - getItemCount(bot, itemName)

    if (remaining <= 0) {
        return true
    }

    console.log('Acquiring item from creative inventory:')
    console.log(itemName)

    try {
        for (const slot of getHotbarSlots(bot, registryName)) {
            if (remaining <= 0) {
                break
            }

            const current = bot.inventory.slots[slot]
            const currentCount = current?.name === registryName ? current.count : 0
            const availableSpace = stackSize - currentCount

            if (availableSpace <= 0) {
                continue
            }

            const addedCount = Math.min(remaining, availableSpace)
            const item = new Item(
                itemDefinition.id,
                currentCount + addedCount,
                current?.metadata ?? 0
            )

            await bot.creative.setInventorySlot(slot, item)
            remaining -= addedCount
        }
    } catch (error) {
        console.error('[ItemManager] Creative acquire failed:', error)
        return false
    }

    if (remaining > 0) {
        console.log('Not enough hotbar capacity.')
        return false
    }

    console.log('Waiting for item:')
    console.log(itemName)

    const acquired = await waitForItem(bot, itemName, count)

    if (acquired) {
        console.log('Inventory updated.')
        return true
    }

    console.log('Timeout waiting item.')
    return false
}

function getHotbarSlots(bot, itemName) {
    const matching = []
    const empty = []
    const occupied = []

    for (let slot = HOTBAR_START; slot <= HOTBAR_END; slot++) {
        const item = bot.inventory.slots[slot]

        if (item?.name === itemName) {
            matching.push(slot)
        } else if (!item) {
            empty.push(slot)
        } else {
            occupied.push(slot)
        }
    }

    return [...matching, ...empty, ...occupied]
}

async function waitForItem(bot, itemName, count) {
    const deadline = Date.now() + INVENTORY_UPDATE_TIMEOUT

    while (Date.now() < deadline) {
        if (hasItem(bot, itemName, count)) {
            return true
        }

        await sleep(INVENTORY_POLL_INTERVAL)
    }

    return hasItem(bot, itemName, count)
}

function hasInventory(bot) {
    return bot &&
        bot.inventory &&
        typeof bot.inventory.items === 'function'
}

function hasCreativeInventory(bot) {
    return bot &&
        bot.registry &&
        bot.registry.itemsByName &&
        bot.creative &&
        typeof bot.creative.setInventorySlot === 'function'
}

function isValidItemName(itemName) {
    return typeof itemName === 'string' && ITEM_NAME_PATTERN.test(itemName)
}

function getRegistryName(itemName) {
    return itemName.startsWith('minecraft:')
        ? itemName.slice('minecraft:'.length)
        : itemName
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
    getItemCount,
    hasItem,
    ensureItem,
    equipItem
}
