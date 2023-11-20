/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2022/05/31
 */
'use strict'
const fs = require('fs'),
  path = require('path')
const APPEND_TO_FILE = process.env.APPEND_TO_FILE !== 'false'
const loggerLevel = process.env.LOG_LEVEL || 'DEBUG'
const logDir = process.env.LOG_DIR || path.resolve(__dirname, '../logs')

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir)
  console.log(`[INFO] Create log directory: ${logDir}`)
}

let config = {
  'appenders': {
    console: {type: 'console'},
    'app': {
      'type': 'dateFile',
      'filename': `${logDir}/app.log`,
      'pattern': '-yyyy-MM-dd',
      // 10M
      'maxLogSize': 10 * 1024 * 1024,
      'numBackups': 7,
      'category': 'http',
      compress: false,
    },
    'errors': {
      'type': 'logLevelFilter',
      'level': 'ERROR',
      'appender': 'errorFile',
    },
    'errorFile': {
      'type': 'file',
      'filename': `${logDir}/errors.log`,
      // 10M
      'maxLogSize': 10 * 1024 * 1024,
      'numBackups': 3,
    },
  },
  'categories': {
    'default': {
      'appenders': ['console'],
      'level': loggerLevel,
      enableCallStack: true,
    },
  },
}

if (APPEND_TO_FILE) {
  ['app', 'errors'].forEach(c => {
    config.categories.default.appenders.push(c)
  })
}

module.exports = config
