const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { getCacheRoot, resolveCachePath } = require('../src/cache/path_policy')

test('cache root is derived from module location and relative paths resolve inside it', () => {
    const root = getCacheRoot()
    assert.equal(root, path.resolve(__dirname, '..', 'cache'))
    assert.equal(resolveCachePath('building/plans/house.json'), path.join(root, 'building', 'plans', 'house.json'))
    assert.equal(resolveCachePath('workspace\\task_001.json'), path.join(root, 'workspace', 'task_001.json'))
    assert.equal(resolveCachePath('building/drafts/test.json'), path.join(root, 'building', 'drafts', 'test.json'))
})

test('path policy rejects traversal, absolute, drive, UNC, empty, and mixed separator paths', () => {
    for (const input of ['../package.json', '../../.env', 'building/../../../src/index.js']) {
        assert.throws(() => resolveCachePath(input), { code: 'CACHE_PATH_ESCAPE' })
    }
    for (const input of ['', '   ', '/etc/passwd', 'C:\\Windows\\win.ini', '\\\\server\\share\\file', 'C:relative.txt']) {
        assert.throws(() => resolveCachePath(input), { code: 'CACHE_INVALID_PATH' })
    }
    assert.throws(() => resolveCachePath('building\\..\\..//package.json'), { code: 'CACHE_PATH_ESCAPE' })
})

test('every accepted normalized path remains under cache root', () => {
    const root = getCacheRoot()
    for (const input of ['building/plans/a.json', 'workspace\\nested\\file.txt', 'test-area']) {
        const resolved = resolveCachePath(input)
        const relative = path.relative(root, resolved)
        assert.notEqual(relative, '..')
        assert.equal(path.isAbsolute(relative), false)
        assert.equal(relative.startsWith(`..${path.sep}`), false)
    }
})
