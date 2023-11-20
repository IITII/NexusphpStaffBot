/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2023/07/25
 */
'use strict'
const fs = require('fs')
const {logger} = require('./utils/logger.js')

module.exports = class FileCache {
  constructor(filename) {
    this.filename = filename
    this.cache = {}
    this.init()
  }

  init() {
    if (fs.existsSync(this.filename)) {
      try {
        const rawText = fs.readFileSync(this.filename).toString()
        this.cache = JSON.parse(rawText)
      } catch (e) {
        logger.warn(`Cache init failed: ${e.message}`)
      }
    }
  }

  getCache() {
    return this.cache
  }

  flushCache(new_cache) {
    fs.writeFileSync(this.filename, JSON.stringify(new_cache))
    this.cache = new_cache
  }
}
