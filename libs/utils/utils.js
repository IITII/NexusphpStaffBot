/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2022/05/26
 */
'use strict'
const fs = require('fs'),
  {mapLimit} = require('async'),
  dayjs = require('dayjs')
const {logger} = require('./logger.js')
const path = require('path')

/**
 * Calc how much time spent on run function.
 * @param prefix prefix
 * @param func Run function
 * @param args function's args
 */
async function spendTime(prefix, func, ...args) {
  return await new Promise(async (resolve, reject) => {
    let start = new Date()
    logger.info(`${prefix} start...`)
    try {
      const res = await func.apply(this, args)
      return resolve(res)
    } catch (e) {
      return reject(e)
    } finally {
      const spent = new Date() - start
      const cost = timeHuman(spent)
      logger.info(`${prefix} end. Spent ${cost}`)
    }
  })
}

async function sleep(ms) {
  return await new Promise(resolve => setTimeout(resolve, ms))
}

async function currMapLimit(array, limit = 10, func) {
  return mapLimit(array, limit, async (item, cb) => {
    return func(item).finally(cb)
  })
}

function mkdir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true})
    console.log(`mkdir ${dir}`)
  }
}

/**
 * 爬虫速率限制
 * @param func 消费数组内每个对象的函数
 * @param array 数据数组
 * @param duration 每次执行的时间间隔
 * @param forceWait
 * @param limit 并发上限
 * @param random 是否添加随机延迟 默认：0-100 ms
 */
async function reqRateLimit(func, array, duration = 1000,
                            forceWait = false,
                            limit = 1, random = true) {
  return mapLimit(array, limit, async (item, cb) => {
    const start = new Date()
    return await Promise.resolve()
      .then(async () => await func(item))
      // return await func(item)
      .then(async _ => {
        const spent = new Date() - start
        if (spent < duration) {
          let sleepTime = duration
          if (!forceWait) {
            sleepTime -= spent
          }
          if (random) {
            sleepTime += Math.random() * 100
          }
          await sleep(sleepTime)
        }
        return _
      })
      .finally(cb)
  })
}


function timeHuman(mills, frac = 2) {
  const seconds = 1000
  const units = [
    {unit: 'd', value: 24 * 60 * 60 * seconds},
    {unit: 'h', value: 60 * 60 * seconds},
    {unit: 'm', value: 60 * seconds},
  ]
  let res = ''
  let time = mills
  units.forEach(u => {
    if (time >= u.value) {
      res += `${Math.floor(time / u.value)}${u.unit}`
      time %= u.value
    }
  })
  res += `${(time / seconds).toFixed(frac)}s`
  return res
}

function zipWithIndex(arr) {
  let i = 0
  return arr.map(item => [item, i++])
}

function urlResolve(from, to) {
  const resolvedUrl = new URL(to, new URL(from, 'resolve://'))
  if (resolvedUrl.protocol === 'resolve:') {
    // `from` is a relative URL.
    const {pathname, search, hash} = resolvedUrl
    return pathname + search + hash
  }
  return resolvedUrl.toString()
}

function fileToHttpUrl(prefix, dir, baseDir, encode = false) {
  baseDir = baseDir || ''
  let res = urlResolve(prefix, path.relative(baseDir, dir))
  return encode ? encodeURI(res) : res
}

function formatDate(curr = Date.now(), format = 'YYYY/MM/DD HH:mm') {
  return dayjs(curr).format(format)
}

function minDiff(start, end = Date.now()) {
  return dayjs(end).diff(dayjs(start), 'minutes')
}

function base64Encode(str, magic = 'base64_') {
  return magic + Buffer.from(str).toString('base64')
}

function base64Decode(str, magic = 'base64_') {
  return Buffer.from(str.replace(magic, ''), 'base64').toString()
}

function arrToAbsUrl(urls, origin) {
  return urls.map(u => toAbsUrl(u, origin))
}

function toAbsUrl(url, origin) {
  if (!url) return ''
  let base = url.startsWith('/') ? new URL(origin).origin : origin
  return urlResolve(base, url)
}

function regexExec(str, regex, index, throwNotMatch = false) {
  let res = ''
  if (str) {
    let reg = regex.exec(str)
    if (reg && reg[index]) {
      res = reg[index]
    }
  }
  if (throwNotMatch && !res) {
    throw new Error(`${str} not match ${regex}, check data or set 'throwNotMatch' to false`)
  } else {
    return res
  }
}

function getFutureDay(range = 3, format = 'YYYYMMDD') {
  const res = [], today = dayjs()
  for (let i = 0; i < range; i++) {
    res.push(today.add(i, 'day').format(format))
  }
  return res
}

module.exports = {
  mkdir,
  spendTime,
  sleep,
  currMapLimit,
  fileToHttpUrl,
  reqRateLimit,
  timeHuman,
  zipWithIndex,
  urlResolve,
  formatDate,
  minDiff,
  base64Encode,
  base64Decode,
  arrToAbsUrl,
  toAbsUrl,
  regexExec,
  getFutureDay,
}
