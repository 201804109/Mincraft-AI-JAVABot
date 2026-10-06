const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { getCacheRoot, resolveCachePath } = require('./path_policy')

async function ensureDirectory(relativePath) {
    const targetPath = resolveCachePath(relativePath)
    await ensureDirectoryWithoutSymlinks(targetPath)
}

async function exists(relativePath) {
    const targetPath = resolveCachePath(relativePath)
    await assertNoSymlinkComponents(targetPath)
    try {
        await fs.access(targetPath)
        return true
    } catch (error) {
        if (error && error.code === 'ENOENT') return false
        throw createIoError('Unable to check cache path.', error)
    }
}

async function readText(relativePath) {
    const targetPath = resolveCachePath(relativePath)
    await assertNoSymlinkComponents(targetPath)
    try {
        return await fs.readFile(targetPath, 'utf8')
    } catch (error) {
        throw mapFileError(error, 'Unable to read cache file.')
    }
}

async function writeText(relativePath, content) {
    if (typeof content !== 'string') {
        throw createStoreError('CACHE_INVALID_CONTENT', 'Cache text content must be a string.')
    }
    const targetPath = resolveCachePath(relativePath)
    const parentPath = path.dirname(targetPath)
    await ensureDirectoryWithoutSymlinks(parentPath)
    await assertNoSymlinkComponents(targetPath)

    const tempPath = path.join(parentPath, `.${path.basename(targetPath)}.${process.pid}.${crypto.randomUUID()}.tmp`)
    try {
        await fs.writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx' })
        await fs.rename(tempPath, targetPath)
    } catch (error) {
        try {
            await fs.unlink(tempPath)
        } catch (cleanupError) {
            if (!cleanupError || cleanupError.code !== 'ENOENT') {
                // Keep the original write/rename error as the actionable failure.
            }
        }
        throw createIoError('Unable to write cache file.', error)
    }
}

async function readJson(relativePath) {
    const text = await readText(relativePath)
    try {
        return JSON.parse(text)
    } catch (cause) {
        const error = createStoreError('CACHE_INVALID_JSON', `Cache file contains invalid JSON: ${relativePath}`, cause)
        throw error
    }
}

async function writeJson(relativePath, data) {
    let serialized
    try {
        serialized = JSON.stringify(data, null, 2)
    } catch (cause) {
        throw createStoreError('CACHE_INVALID_JSON', 'Cache data could not be serialized as JSON.', cause)
    }
    if (typeof serialized !== 'string') {
        throw createStoreError('CACHE_INVALID_JSON', 'Cache data could not be serialized as JSON.')
    }
    await writeText(relativePath, serialized)
}

async function list(relativePath) {
    const targetPath = resolveCachePath(relativePath)
    await assertNoSymlinkComponents(targetPath)
    let entries
    try {
        entries = await fs.readdir(targetPath, { withFileTypes: true })
    } catch (error) {
        throw mapFileError(error, 'Unable to list cache directory.')
    }

    const result = []
    for (const entry of entries) {
        if (entry.isSymbolicLink()) {
            throw createStoreError('CACHE_SYMLINK_NOT_ALLOWED', `Symbolic links are not allowed in cache: ${entry.name}`)
        }
        if (entry.isFile()) result.push({ name: entry.name, type: 'file' })
        else if (entry.isDirectory()) result.push({ name: entry.name, type: 'directory' })
    }
    return result
}

async function remove(relativePath) {
    const targetPath = resolveCachePath(relativePath)
    if (targetPath === getCacheRoot()) {
        throw createStoreError('CACHE_EXPECTED_FILE', 'The cache root cannot be removed as a file.')
    }
    await assertNoSymlinkComponents(targetPath)

    let stats
    try {
        stats = await fs.lstat(targetPath)
    } catch (error) {
        if (error && error.code === 'ENOENT') return false
        throw createIoError('Unable to inspect cache path before removal.', error)
    }
    if (stats.isSymbolicLink()) {
        throw createStoreError('CACHE_SYMLINK_NOT_ALLOWED', 'Symbolic links are not allowed in cache operations.')
    }
    if (!stats.isFile()) {
        throw createStoreError('CACHE_EXPECTED_FILE', 'Cache remove only supports files.')
    }

    try {
        await fs.unlink(targetPath)
        return true
    } catch (error) {
        throw createIoError('Unable to remove cache file.', error)
    }
}

async function ensureDirectoryWithoutSymlinks(targetPath) {
    try {
        await fs.mkdir(getCacheRoot(), { recursive: true })
    } catch (error) {
        throw createIoError('Unable to create cache root.', error)
    }
    const rootStats = await lstatOrNull(getCacheRoot())
    if (!rootStats || rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
        throw createStoreError('CACHE_SYMLINK_NOT_ALLOWED', 'Cache root must be a real directory.')
    }

    const relative = path.relative(getCacheRoot(), targetPath)
    const segments = relative ? relative.split(path.sep) : []
    let current = getCacheRoot()

    for (const segment of segments) {
        current = path.join(current, segment)
        try {
            await fs.mkdir(current)
        } catch (error) {
            if (!error || error.code !== 'EEXIST') throw createIoError('Unable to create cache directory.', error)
        }
        const stats = await lstatOrNull(current)
        if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) {
            throw createStoreError('CACHE_SYMLINK_NOT_ALLOWED', 'Cache paths must contain real directories, not symbolic links.')
        }
    }
}

async function assertNoSymlinkComponents(targetPath) {
    const relative = path.relative(getCacheRoot(), targetPath)
    const segments = relative ? relative.split(path.sep) : []
    let current = getCacheRoot()
    const rootStats = await lstatOrNull(current)
    if (rootStats && (rootStats.isSymbolicLink() || !rootStats.isDirectory())) {
        throw createStoreError('CACHE_SYMLINK_NOT_ALLOWED', 'Cache root must be a real directory.')
    }

    for (const segment of segments) {
        current = path.join(current, segment)
        const stats = await lstatOrNull(current)
        if (!stats) return
        if (stats.isSymbolicLink()) {
            throw createStoreError('CACHE_SYMLINK_NOT_ALLOWED', 'Symbolic links are not allowed in cache paths.')
        }
    }
}

async function lstatOrNull(targetPath) {
    try {
        return await fs.lstat(targetPath)
    } catch (error) {
        if (error && error.code === 'ENOENT') return null
        throw createIoError('Unable to inspect cache path.', error)
    }
}

function mapFileError(error, message) {
    if (error && error.code === 'ENOENT') {
        return createStoreError('CACHE_NOT_FOUND', message, error)
    }
    if (error && (error.code === 'EISDIR' || error.code === 'ENOTDIR')) {
        return createStoreError('CACHE_EXPECTED_FILE', message, error)
    }
    return createIoError(message, error)
}

function createIoError(message, cause) {
    return createStoreError('CACHE_IO_ERROR', message, cause)
}

function createStoreError(code, message, cause) {
    const error = new Error(message, cause ? { cause } : undefined)
    error.code = code
    return error
}

module.exports = {
    ensureDirectory,
    exists,
    readText,
    writeText,
    readJson,
    writeJson,
    list,
    remove
}
