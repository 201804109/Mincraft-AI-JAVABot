const path = require('node:path')

const CACHE_ROOT = path.resolve(__dirname, '..', '..', 'cache')

function getCacheRoot() {
    return CACHE_ROOT
}

function resolveCachePath(relativePath) {
    if (typeof relativePath !== 'string' || relativePath.trim().length === 0 || relativePath.includes('\0')) {
        throw createPathError('CACHE_INVALID_PATH', 'Cache path must be a non-empty relative path.')
    }

    const normalizedSeparators = relativePath.replace(/[\\/]+/g, path.sep)
    if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath) ||
        /^[a-zA-Z]:/.test(relativePath) || /^[\\/]{2}/.test(relativePath)) {
        throw createPathError('CACHE_INVALID_PATH', 'Absolute paths are not allowed in cache operations.')
    }

    const segments = normalizedSeparators.split(path.sep)
    if (segments.some(segment => segment === '..')) {
        throw createPathError('CACHE_PATH_ESCAPE', 'Cache paths must not contain parent directory traversal.')
    }

    const resolvedPath = path.resolve(CACHE_ROOT, normalizedSeparators)
    const relativeToRoot = path.relative(CACHE_ROOT, resolvedPath)
    if (relativeToRoot === '..' || relativeToRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRoot)) {
        throw createPathError('CACHE_PATH_ESCAPE', 'Resolved cache path is outside the cache root.')
    }

    return resolvedPath
}

function createPathError(code, message) {
    const error = new Error(message)
    error.code = code
    return error
}

module.exports = {
    getCacheRoot,
    resolveCachePath
}
