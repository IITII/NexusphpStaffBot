'use strict'
const fs = require('fs'),
  https = require('https'),
  path = require('path')

let config = {
  db: {
    database: process.env.DB_FILE || '../db/db.json',
  },
  cacheFile: path.join(__dirname, '../db/cache.json'),
  staffCache: path.join(__dirname, '../db/staffCache.json'),
  rkToLinkCache: path.join(__dirname, '../db/rkToLinkCache.json'),
  linkToRowInfo: path.join(__dirname, '../db/linkToRowInfo.json'),
  message: {
    groupId: process.env.GROUP_ID || '',
    generalThreadId: process.env.GENERAL_THREAD_ID || '',
    staffMsgThreadId: process.env.STAFF_MSG_THREAD_ID || '',
    adminId: process.env.ADMIN_ID || '',
    botToken: process.env.BOT_TOKEN || '',
    tokens: {},
  },
  telegram: {
    maxMediaGroupLength: 10, // 2-10
    maxMessageRate: 1, // 1
    maxMessageLength: 4096, // 4096
    docMaxSize: 50 * 1024 * 1024, // 50MB
  },
  jobs: {
    staffMsg: {
      name: 'StaffMsg',
      enable: process.env.STAFF_MSG_ENABLE !== 'false',
      // 15 分钟
      period: 15 * 60 * 1000,
      // 推荐使用公用账户进行发送, mod+ 自己拉个群
      cookie: process.env.STAFF_MSG_COOKIE || '',
      // 理论上所有 nexusphp 站点都支持, 这里基于 2xfree 进行开发
      site: process.env.STAFF_MSG_SITE || 'PterClub',
      // site: process.env.STAFF_MSG_SITE || 'Xfree',
    },
  }
}
let axiosConf = {
  // baseURL: 'https://api.telegram.org/bot',
  // proxy: process.env.PROXY,
  proxy: undefined,
  // 时间设置不合理可能会导致订阅超时失败
  timeout: 1000 * 20,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
  },
  // httpsAgent: new https.Agent({
  //   rejectUnauthorized: false,
  // }),
}
let redisConf = {
  url: process.env.REDIS_URL || 'redis://:bot@127.0.0.1:6379',
}


// DO NOT TOUCH UNLESS YOU KNOW WHAT YOU ARE DOING

// config check
if (!config.message.groupId) {
  console.error(`Set groupId first. config.js or GROUP_ID env`)
}
// config convert
const proxy = process.env.PROXY?.replace(/https?:\/\//, '')
if (proxy) {
  config.axios.proxy = {
    host: proxy.split(':')[0],
    port: proxy.split(':')[1],
  }
}
// mkdir(config.clip.baseDir)
if (!config.db.database) {
  config.db.database = '../db/db.json'
}
config.db.database = path.resolve(__dirname, config.db.database)
mkdir(path.dirname(config.db.database))

function mkdir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true})
    console.log(`mkdir ${dir}`)
  }
}

module.exports = {
  ...config,
  axiosConf,
  redisConf,
}
