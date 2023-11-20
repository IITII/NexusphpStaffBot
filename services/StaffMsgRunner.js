/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2023/09/26
 */
'use strict'

const config = require('../config/config.js')
const runnerConf = config.jobs.staffMsg
const FileCache = require('../libs/FileCache.js'),
  MapCache = require('../libs/MapCache.js'),
  rkToLinkMap = new MapCache(config.rkToLinkCache),
  linkToRowInfoMap = new MapCache(config.linkToRowInfo),
  fileCache = new FileCache(config.staffCache)
const {logger} = require('../libs/utils/logger.js')
const {sendStaffMsg} = require('../libs/Message.js')
const sites = require('../libs/staff/sites'),
  Site = sites[runnerConf.site]
if (!Site) {
  throw new Error(`No support site: ${runnerConf.site}, supported sites: ${Object.keys(sites)}`)
}
const site = new Site()
let interval
let busy = false
let currentTask = null
let cache = {}

const start = () => {
  if (!runnerConf.enable) {
    logger.info(`${runnerConf.name} task disabled`)
    return
  }
  interval = setInterval(run, runnerConf.period)
}

const stop = () => clearInterval(interval)


async function run() {
  if (busy) {
    logger.warn(`${runnerConf.name} task busy, skip`, currentTask)
    // await send_to_subscriber(`#busy\n\nsub task busy, skip\n`, currentTask.info.uid, [], JSON.stringify(currentTask))
    return
  }
  busy = true
  logger.warn(`${runnerConf.name} task start...`)
  cache = fileCache.getCache()
  cache.staff = cache.staff ? cache.staff : []
  await task(runnerConf)
  fileCache.flushCache(cache)
  rkToLinkMap.flushCache()
  linkToRowInfoMap.flushCache()
  busy = false
}

async function task(conf) {
  let staffList = await site.getStaffBoxList()
  await handleList(staffList)
  let reportList = await site.getReportList()
  await handleList(reportList)
  let messageList = await site.getMessageList()
  await handleList(messageList)
  let offerList = await site.getOfferList()
  await handleList(offerList)
}

function getTitleByRowType(rowType) {
  switch (rowType) {
    case 'staff':
      return '管理组信箱'
    case 'report':
      return '举报信箱'
    case 'message':
      return '私信'
    case 'offer':
      return '候选'
    default:
      return `未知${rowType}`
  }
}

async function handleList(list) {
  let unReads = list.data.filter(_ => !_.isRead).filter(_ => !cache.staff.includes(_.link))
  for (let unRead of unReads) {
    let msg = `<b>#${getTitleByRowType(unRead.rowType)}</b>
标题: ${unRead.title}
时间: ${unRead.time}
发送人: ${unRead.username}`
    if (unRead.detail) {
      msg += `\n内容:\n${unRead.detail}`
    }
    const links = [{type: 'url', text: '查看详情', url: unRead.link}]
    if (['staff', 'report'].includes(unRead.rowType)) {
      links.push({type: 'cb', text: `设为已处理`, url: `cb_${unRead.rowType}_${unRead.id}`})
    }
    const tgRes = await sendStaffMsg(msg, links)
    logger.debug(`tgRes: ${JSON.stringify(tgRes)}`)
    let message_id = tgRes.message_id || tgRes.result?.message_id
    const rk = `${config.message.groupId}_${config.message.staffMsgThreadId}_${message_id}`
    rkToLinkMap.getCache().set(rk, unRead.link)
    linkToRowInfoMap.getCache().set(unRead.link, JSON.parse(JSON.stringify(unRead)))
    cache.staff.push(unRead.link)
  }
}

async function setAnswered(rowType, rowId) {
  switch (rowType) {
    case 'staff':
      return await site.setStaffBoxAnswered(rowId)
    case 'report':
      return await site.setReportAnswered(rowId)
    // case 'message':
    //   await site.setMessageAnswered(rowId)
    //   break
    default:
      throw new Error(`No support rowType: ${rowType}`)
  }
}

/**
 * 根据 tg 消息里面的 chatId, msgId, threadId 拼接 rk, 从 rkToLinkMap 获取对应的链接
 * 获取到的链接再从 linkToRowInfoMap 获取对应的 rowInfo, 根据 rowInfo 的 rowType, uid, id 回复对应的内容
 * 任意一项变量值不存在都可以认为是无效消息, 直接跳过
 */
async function handleTgMsg(ctx) {
  const message = ctx.message || ctx.update.message || ctx.editedMessage
  const chat_id = message?.chat.id,
    message_id = message?.message_id,
    message_thread_id = message?.message_thread_id,
    text = message?.text || message?.caption,
    reply_to_message_id = message?.reply_to_message?.message_id,
    reply_to_message_thread_id = message?.reply_to_message?.message_thread_id
  logger.debug(`chat_id: ${chat_id}, message_id: ${message_id}, message_thread_id: ${message_thread_id}, reply_to_message_id: ${reply_to_message_id}, reply_to_message_thread_id: ${reply_to_message_thread_id}`)
  if (chat_id && reply_to_message_id && reply_to_message_thread_id) {
    let rk = `${chat_id}_${reply_to_message_thread_id}_${reply_to_message_id}`
    logger.debug(`rk: ${rk}`)
    if (rkToLinkMap.getCache().has(rk)) {
      let link = rkToLinkMap.getCache().get(rk)
      if (linkToRowInfoMap.getCache().has(link)) {
        let rowInfo = linkToRowInfoMap.getCache().get(link)
        if (rowInfo && rowInfo.uid) {
          logger.debug(`rk: ${rk}, rowInfo: ${JSON.stringify(rowInfo)}`)
          switch (rowInfo.rowType) {
            case 'staff':
              await site.replyStaffBox(rowInfo.uid, rowInfo.id, text)
              break
            case 'message':
              await site.replyMessage(rowInfo.uid, rowInfo.title, text)
              break
            case 'report':
            // await site.setReportAnswered(rowInfo.id)
            // break
            default:
              throw new Error(`No support rowType: ${rowInfo.rowType}`)
          }
          rkToLinkMap.getCache().delete(rk)
          linkToRowInfoMap.getCache().delete(link)
          rkToLinkMap.flushCache()
          linkToRowInfoMap.flushCache()
          await ctx.reply(`已回复`, {reply_to_message_id: message_id})
        }
      }
    }
  } else {
    logger.debug(`Not a valid message: ${JSON.stringify(message)}`, chat_id, message_id, message_thread_id, reply_to_message_id, reply_to_message_thread_id)
  }
}


// sendStaffMsg('test').then(console.log).catch(console.error)

module.exports = {
  start, stop, run, setAnswered, handleTgMsg,
}
