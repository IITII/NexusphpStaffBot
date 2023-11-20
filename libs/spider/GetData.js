'use strict'
const encoding = require('encoding')
const {load} = require('cheerio')
const cloudscraper = require('cloudscraper')

const {logger} = require('../utils/logger.js')
const {timeHuman, currMapLimit} = require('../utils/utils.js')
const {axios} = require('../AxiosClient.js')

async function retryError(...args) {
  throw new Error(`todo`)
}

async function getJson(url, handleJson, cf) {
  return await new Promise(async (resolve) => {
    const start = new Date()
    let res = {data: {}, original: url, cost: 0, isSuccess: false, isHandled: false}
    logger.debug(`Getting Data from ${url}`)
    let req
    if (cf) {
      // no support proxy
      req = cloudscraper(url)
    } else {
      req = axios.get(url, {
        responseType: 'application/json',
        headers: {
          'referer': url,
          Host: new URL(url).host,
          Connection: 'keep-alive',
        },
      }).then(_ => _.data)
    }
    await req.then(_ => JSON.parse(_))
      .then(j => {
        res.data = j
        res.isSuccess = true
      })
      .then(async _ => res.data = await handleJson(res.data, url))
      .then(_ => res.isHandled = true)
      .catch(e => {
        logger.debug(`Get Data failed, url: ${url}`)
        logger.debug(e)
      })
      .finally(() => {
        const cost = new Date() - start
        const h_cost = timeHuman(cost)
        res.cost = cost
        res.original = url
        logger.debug(`Get Data from ${url} cost: ${h_cost}`)
        return resolve(res)
      })
  })
}

async function getDom(url, handle_dom, cf, cookie) {
  return await new Promise(async (resolve) => {
    const start = new Date()
    let res = {original: url, cost: 0, isSuccess: false}
    logger.debug(`Getting Data from ${url}`)
    let dom
    if (cf) {
      // no support proxy
      dom = cloudscraper(url)
        .then(res => load(res))
    } else {
      dom = axios.get(url, {
        // responseType: 'arraybuffer',
        headers: {
          'referer': url,
          Host: new URL(url).host,
          // Connection: 'keep-alive',
          Cookie: cookie || undefined,
        },
      })
        .then(res => {
          let buf = res.data
          let utf8 = 'utf8'
          let try_utf8 = buf.toString()
          let $ = load(try_utf8)
          let content = $('meta[http-equiv="Content-Type" i]').attr('content')?.split(';').pop().split('=').pop()
          content = content?.replace(/-_/g, '').toLowerCase()
          if (content && content !== utf8) {
            try {
              buf = encoding.convert(buf, utf8, content)
            } catch (e) {
              buf = encoding.convert(buf, utf8, 'GBK')
            }
            $ = load(buf.toString())
          }
          return $
        })
    }
    await dom.then(async $ => res.data = await handle_dom($, url))
      .then(_ => res.isSuccess = true)
      .catch(e => {
        logger.debug(`Get Data failed, url: ${url}`)
        logger.debug(e)
      })
      .finally(() => {
        const cost = new Date() - start
        const h_cost = timeHuman(cost)
        logger.debug(`Get Data from ${url} cost: ${h_cost}`)
        // logger.debug(`Get Data: ${res.imgs.length} from ${url} cost: ${h_cost}`)
        res.cost = cost
        res.original = url
        return resolve(res)
      })
  })
}

/**
 * post 请求 dom
 * @param url post url
 * @param postBody post body
 * @param handle_dom 处理 dom 的函数
 * @param handle_error 处理错误的函数
 * @param parse 失败时是否需要将dom解析后传入handle_error
 * @param retry 重试次数
 * @param original 原始url
 * @param cookies cookie
 * @returns 处理后数据
 */
async function postDom(url, postBody, handle_dom, handle_error, parse, retry, original, cookies = undefined) {
  original = original || url
  return await new Promise(async resolve => {
    const start = new Date()
    let res = {original: url, cost: 0,}
    logger.debug(`Getting Data from ${url}`)
    await axios.post(url, postBody, {
      responseType: 'document',
      headers: {
        'referer': original,
        Host: new URL(url).host,
        Connection: 'keep-alive',
        Cookie: cookies,
      },
    })
      .then(res => load(res?.data))
      .then(async $ => res = await handle_dom($, url))
      .then(_ => res.isSuccess = true)
      .catch(async e => {
        if (handle_error && retry < 3 && e?.response?.status === 403) {
          let e_dom = parse ? await load(e.response.data) : e
          logger.debug(`Get --------------, url: ${e.response.data.split('\n').filter(_ => _.includes('gallery')).length}`)
          res = await handle_error(e_dom, url, e, retry)
        } else {
          logger.debug(`Get Data failed, url: ${url}`)
          logger.debug(e)
        }
      })
      .finally(() => {
        const cost = new Date() - start
        const h_cost = timeHuman(cost)
        logger.debug(`Get Data from ${url} cost: ${h_cost}`)
        // logger.debug(`Get Data: ${res.imgs.length} from ${url} cost: ${h_cost}`)
        res.cost = cost
        res.original = url
        return resolve(res)
      })
  })
}

async function getJsonData(url, match, urlRewrite, jsonData, handleData, cf = undefined) {
  url = match(url)
  let arr = [].concat(urlRewrite(url))
  async function wrapper(url) {
    return jsonData(url, handleData, cf)
  }
  let allData = await currMapLimit(arr, 1, wrapper)
  return aggMultiRes(allData)
}

async function getDomData(url, match, urlRewrite, getDom, handleData, cf = undefined, cookie = undefined) {
  url = match(url)
  let arr = [].concat(urlRewrite(url))
  async function wrapper(url) {
    return getDom(url, handleData, cf, cookie)
  }
  let allData = await currMapLimit(arr, 1, wrapper)
  return aggMultiRes(allData)
}

/**
 * 将多个网页数据合并, 比如耗时, 所有页面直接相加
 */
function aggMultiRes(allData) {
  let res = {}, tmp
  for (const k in allData[0]) {
    for (const data of allData) {
      tmp = data[k]
      switch (typeof tmp) {
        case 'number':
        case 'bigint':
          res[k] = (res[k] || 0) + tmp
          break
        case 'object':
          if (Array.isArray(tmp)) {
            res[k] = [].concat(res[k] || []).concat(tmp)
          } else {
            res[k] = res[k] ? res[k] : tmp
            logger.error(`unknown obj type: ${typeof tmp}`, tmp)
          }
          break
        case 'string':
        case 'undefined':
        case 'boolean':
          res[k] = res[k] ? res[k] : tmp
          break
        default:
          throw new Error(`unknown type: ${typeof tmp}`)
      }
    }
  }
  return res
}


module.exports = {
  getJson, getDom, postDom, retryError, getJsonData, getDomData,
}
