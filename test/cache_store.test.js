const { test, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const cache = require('../src/cache')

const testRoot = `test-${process.pid}-${crypto.randomUUID()}`
const testPath = child => `${testRoot}/${child}`

after(async () => {
    await fs.rm(cache.resolveCachePath(testRoot), { recursive: true, force: true })
})

test('cache store creates nested directories and repeated ensure is safe', async () => {
    const directory = testPath('nested/dir')
    await cache.ensureDirectory(directory)
    await cache.ensureDirectory(directory)
    assert.equal(await cache.exists(directory), true)
})

test('writeText atomically writes UTF-8 content and creates parent directories', async () => {
    const file = testPath('write/deep/message.txt')
    const content = '缓存内容 — Minecraft'
    await cache.writeText(file, content)
    assert.equal(await cache.readText(file), content)
    assert.equal(await cache.exists(file), true)
})

test('writeJson and readJson preserve structured data with readable formatting without mutation', async () => {
    const file = testPath('plans/plan.json')
    const input = { name: 'House', nested: { blocks: [1, 2] } }
    const original = structuredClone(input)
    await cache.writeJson(file, input)
    assert.deepEqual(await cache.readJson(file), input)
    assert.deepEqual(input, original)
    assert.match(await cache.readText(file), /\n  "nested"/)
})

test('list returns direct files and directories without absolute paths', async () => {
    const directory = testPath('listing')
    await cache.ensureDirectory(`${directory}/folder`)
    await cache.writeText(`${directory}/one.txt`, '1')
    const entries = await cache.list(directory)
    assert.deepEqual(entries.sort((a, b) => a.name.localeCompare(b.name)), [
        { name: 'folder', type: 'directory' },
        { name: 'one.txt', type: 'file' }
    ])
})

test('missing files have stable errors and exists/remove behavior is explicit', async () => {
    const missing = testPath('missing/file.json')
    assert.equal(await cache.exists(missing), false)
    assert.equal(await cache.remove(missing), false)
    await assert.rejects(cache.readText(missing), { code: 'CACHE_NOT_FOUND' })
    await assert.rejects(cache.readJson(missing), { code: 'CACHE_NOT_FOUND' })
    await assert.rejects(cache.list(missing), { code: 'CACHE_NOT_FOUND' })
})

test('invalid JSON, invalid content, and unrepresentable JSON are reported clearly', async () => {
    const file = testPath('broken.json')
    await cache.writeText(file, '{ bad json')
    await assert.rejects(cache.readJson(file), { code: 'CACHE_INVALID_JSON' })
    await assert.rejects(cache.writeText(testPath('not-text.txt'), {}), { code: 'CACHE_INVALID_CONTENT' })
    await assert.rejects(cache.writeJson(testPath('undefined.json'), undefined), { code: 'CACHE_INVALID_JSON' })
})

test('remove deletes files, rejects directories, and never removes cache root', async () => {
    const file = testPath('remove/me.txt')
    await cache.writeText(file, 'remove me')
    assert.equal(await cache.remove(file), true)
    assert.equal(await cache.exists(file), false)
    await assert.rejects(cache.remove(testPath('remove')), { code: 'CACHE_EXPECTED_FILE' })
    await assert.rejects(cache.remove('.'), { code: 'CACHE_EXPECTED_FILE' })
})

test('all public filesystem operations reject escape paths before touching outside files', async () => {
    const outside = path.resolve(__dirname, '..', 'package.json')
    const before = await fs.readFile(outside, 'utf8')
    const invalidPath = '../package.json'
    const operations = [
        () => cache.ensureDirectory(invalidPath),
        () => cache.exists(invalidPath),
        () => cache.readText(invalidPath),
        () => cache.writeText(invalidPath, 'overwrite'),
        () => cache.readJson(invalidPath),
        () => cache.writeJson(invalidPath, {}),
        () => cache.list(invalidPath),
        () => cache.remove(invalidPath)
    ]
    for (const operation of operations) {
        await assert.rejects(operation(), error =>
            error.code === 'CACHE_PATH_ESCAPE' || error.code === 'CACHE_INVALID_PATH'
        )
    }
    assert.equal(await fs.readFile(outside, 'utf8'), before)
})
