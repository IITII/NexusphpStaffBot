/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2023/07/25
 */
'use strict'
const fs = require('fs')
const {logger} = require('./utils/logger.js')

module.exports = class MapCache {
  constructor(filename) {
    this.filename = filename
    this.cache = new Map()
    this.init()
  }

  init() {
    if (fs.existsSync(this.filename)) {
      try {
        const rawText = fs.readFileSync(this.filename).toString()
        this.cache = new Map(JSON.parse(rawText))
      } catch (e) {
        logger.warn(`Cache init failed: ${e.message}`)
      }
    }
  }

  getCache() {
    return this.cache
  }

  flushCache(new_cache = this.getCache()) {
    fs.writeFileSync(this.filename, JSON.stringify([...new_cache.entries()], null, 2))
    this.cache = new_cache
  }
}
