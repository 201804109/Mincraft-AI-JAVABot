const pathPolicy = require('./path_policy')
const cacheStore = require('./cache_store')

module.exports = {
    ...pathPolicy,
    ...cacheStore
}
