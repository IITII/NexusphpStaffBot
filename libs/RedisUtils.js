/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2022/06/26
 */
'use strict'

const redis = require('./RedisClient.js')
const {logger} = require('./utils/logger.js')
const {check, taskName, taskLimit} = require('../config/config.js')

async function redis_init() {
  const name = `redis_utils`
  if (redis.isOpen) {
    return redis
  } else {
    return await redis.connect()
      .then(_ => {
        logger.info(`${name} Connected`)
      })
      .then(_ => redis)
      .catch(err => {
        logger.error(`${name} Connect Error`, err)
      })
  }
}

async function redis_add_sub(url, uid, taskKey = taskName) {
  await redis_init()
  const text = await redis.HGET(taskKey, url)
  let json = {uid: [], latest: [], nextTime: -1}
  if (text) {
    json = JSON.parse(text)
    if (!json.uid.includes(uid)) {
      json.uid.push(uid)
    }
  } else {
    json.uid.push(uid)
    json.nextTime = get_random_next(0)
  }
  await redis.HSET(taskKey, url, JSON.stringify(json))
}

async function redis_remove_sub(url, uid, taskKey = taskName) {
  await redis_init()
  const text = await redis.HGET(taskKey, url)
  let json = {uid: [], latest: [], nextTime: -1}
  if (text) {
    json = JSON.parse(text)
    if (json.uid.includes(uid)) {
      json.uid = json.uid.filter(_ => _ !== uid)
      if (json.uid.length === 0) {
        await redis.HDEL(taskKey, url)
      } else {
        await redis.HSET(taskKey, url, JSON.stringify(json))
      }
    }
  }
}

async function HSET(url, json, taskKey = taskName) {
  await redis_init()
  return await redis.HSET(taskKey, url, JSON.stringify(json))
}

async function HGET(url, taskKey = taskName) {
  await redis_init()
  return JSON.parse(await redis.HGET(taskKey, url))
}

async function HGETALL(taskKey = taskName) {
  await redis_init()
  let res = {}
  const hMap = await redis.HGETALL(taskKey)
  if (hMap) {
    for (const k in hMap) {
      hMap[k] = JSON.parse(hMap[k])
    }
    res = hMap
  }
  return res
}

async function HSETALL(data, taskKey = taskName) {
  await redis_init()
  const mul = redis.multi()
  for (const k in data) {
    mul.HSET(taskKey, k, JSON.stringify(data[k]))
  }
  await mul.exec()
}

/**
 * get next exec time with random wait time
 * @example breakTime = 3h => [3h * 0.8, 3h * 1.2]
 */
function get_random_next(breakTime) {
  const curr = Date.now()
  if (breakTime === 0) return curr
  const negative = Math.random() < 0.5
  const random = Math.floor(Math.random() * breakTime * check.randomRate)
  const breakT = negative ? breakTime - random : breakTime + random
  return curr + breakT
}

async function get_sent_sub(prefix = taskLimit.sub_prefix.url) {
  await redis_init()
  const keys = await redis.KEYS(`${prefix}*`)
  // const mul = redis.multi()
  // keys.forEach(k => mul.get(k))
  // return await mul.exec()
  return keys.map(k => k.replace(prefix, ''))
}

async function set_sent_sub(url_texts, prefix = taskLimit.sub_prefix, expire = taskLimit.sub_expire) {
  if (Array.isArray(url_texts) && url_texts.length === 0) return
  await redis_init()
  const mul = redis.multi()
  url_texts.forEach(({url, text}) => {
    mul.SETEX(`${prefix.url}${url}`, expire, text)
    mul.SETEX(`${prefix.text}${text}`, expire, url)
  })
  await mul.exec()
}

module.exports = {
  redis_add_sub,
  redis_remove_sub,
  HGET,
  HSET,
  HGETALL,
  HSETALL,
  get_random_next,
  get_sent_sub,
  set_sent_sub,
}
