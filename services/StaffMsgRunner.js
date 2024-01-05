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
const {sendStaffMsg, deleteMsg} = require('../libs/Message.js')
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
  try {
    logger.warn(`${runnerConf.name} task start...`)
    cache = fileCache.getCache()
    cache.staff = cache.staff ? cache.staff : []
    cache.linkToMsgRK = cache.linkToMsgRK || {}
    cache.rowType = cache.rowType || {}
    await task(runnerConf)
    fileCache.flushCache(cache)
    rkToLinkMap.flushCache()
    linkToRowInfoMap.flushCache()
  } catch (e) {
    logger.error(`Run failed: ${runnerConf.name}, ${e.message}`, e)
  }
  busy = false
}

async function task(conf) {
  if (!conf.disableStaff) {
    cache.rowType.staff = cache.rowType?.staff || {}
    let minId = getMinIdByRowType('staff')
    let staffList = await site.getStaffBoxList(minId)
    await handleList(staffList, conf)
  }
  if (!conf.disableReport) {
    cache.rowType.report = cache.rowType?.report || {}
    let minId = getMinIdByRowType('report')
    let reportList = await site.getReportList(minId)
    await handleList(reportList, conf)
  }
  if (!conf.disableMessage) {
    cache.rowType.message = cache.rowType?.message || {}
    let messageList = await site.getMessageList()
    await handleList(messageList, conf)
  }
  if (!conf.disableOffer) {
    cache.rowType.offer = cache.rowType?.offer || {}
    let offerList = await site.getOfferList()
    await handleList(offerList, conf)
  }
}

async function handleList(list, conf) {
  let reads = list.data.filter(_ => _.isRead)
  let unReads = list.data.filter(_ => !_.isRead).filter(_ => !cache.staff.includes(_.link))
  logger.debug(`list: ${JSON.stringify(list)}, unReads: ${JSON.stringify(unReads)}, reads: ${JSON.stringify(reads)}`)
  // 处理已读
  for (let rowInfo of reads) {
    const rk = cache.linkToMsgRK[rowInfo.link]
    if (rk) {
      const [groupId, threadId, message_id] = rk.split('_')
      logger.info(`delete msg: groupId: ${groupId}, threadId: ${threadId}, message_id: ${message_id} for ${rowInfo.link}`)
      await deleteMsg(groupId, message_id, true)

      // 清理缓存
      let rowInfo = linkToRowInfoMap.getCache().get(rowInfo.link)
      cache?.linkToMsgRK && delete cache.linkToMsgRK[rowInfo.link]
      cache?.rowType[rowInfo.rowType] && delete cache.rowType[rowInfo.rowType][rowInfo.link]
      rkToLinkMap.getCache().delete(rk)
      linkToRowInfoMap.getCache().delete(rowInfo.link)
    }
  }
  // 处理未读
  for (let rowInfo of unReads) {
    let msg = buildMsgByRowInfo(conf, rowInfo)
    let links = buildLinksByRowInfo(conf, rowInfo)
    const {groupId, threadId} = getGroupThreadIdByRowType(rowInfo.rowType)
    const tgRes = await sendStaffMsg(msg, links, 'html', groupId, threadId)
    logger.debug(`tgRes: ${JSON.stringify(tgRes)}`)
    let message_id = tgRes.message_id || tgRes.result?.message_id
    const rk = `${groupId}_${threadId}_${message_id}`
    rkToLinkMap.getCache().set(rk, rowInfo.link)
    linkToRowInfoMap.getCache().set(rowInfo.link, JSON.parse(JSON.stringify(rowInfo)))
    cache.staff.push(rowInfo.link)
    cache.linkToMsgRK[rowInfo.link] = rk
    cache.rowType[rowInfo.rowType][rowInfo.link] = rk
  }
}

function getMinIdByRowType(rowType) {
  let ids = [...cache.rowType[rowType].keys()]
    .map(link => linkToRowInfoMap.getCache().get(link))
    .map(_ => parseFloat(_.id) || -1)
    .filter(_ => 0).sort()
  return ids.length > 1 ? ids[0] : -1
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

function getGroupThreadIdByRowType(rowType) {
  let groupId, threadId
  switch (rowType) {
    case 'staff':
      // groupId = config.jobs.staffMsg.staffMsgGroupId
      // threadId = config.jobs.staffMsg.staffMsgThreadId
      // break
    case 'report':
      // groupId = config.jobs.staffMsg.reportMsgGroupId
      // threadId = config.jobs.staffMsg.reportMsgThreadId
      // break
    case 'message':
      // groupId = config.jobs.staffMsg.messageMsgGroupId
      // threadId = config.jobs.staffMsg.messageMsgThreadId
      // break
    case 'offer':
      // groupId = config.jobs.staffMsg.offerMsgGroupId
      // threadId = config.jobs.staffMsg.offerMsgThreadId
      groupId = config.jobs.staffMsg[`${rowType}MsgGroupId`]
      threadId = config.jobs.staffMsg[`${rowType}MsgThreadId`]
      break
    default:
      logger.error(`[getGroupThreadIdByRowType] No support rowType: ${rowType}`)
      groupId = config.message.groupId
      threadId = config.message.generalMsgThreadId
      break
  }
  return {groupId, threadId}
}

function buildMsgByRowInfo(conf, rowInfo) {
  let msg = `<b>#${getTitleByRowType(rowInfo.rowType)}</b>
时间: ${rowInfo.time}
标题: ${rowInfo.title}`

  if (rowInfo.username && conf[`${rowInfo.rowType}ShowUser`]) {
    msg += `\n发送人: ${rowInfo.username}\n`
  }
  if (rowInfo.detail) {
    msg += `\n内容:\n${rowInfo.detail}`
  }
  return msg
}

function buildLinksByRowInfo(conf, rowInfo) {
  let links = [{type: 'url', text: '查看详情', url: rowInfo.link}]
  if (['staff', 'report'].includes(rowInfo.rowType)) {
    links.push({type: 'cb', text: `设为已处理`, url: `cb_${rowInfo.rowType}_${rowInfo.id}`})
  }
  if (['report'].includes(rowInfo.rowType) && rowInfo.trLink) {
    links = [
      {type: 'url', text: `种子详情`, url: rowInfo.trLink},
      {type: 'url', text: '查看详情', url: rowInfo.addLink},
      ...links.slice(1)
    ]
  }
  return links
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
          // 清理缓存
          rkToLinkMap.getCache().delete(rk)
          linkToRowInfoMap.getCache().delete(link)
          let cache = fileCache.getCache()
          cache?.linkToMsgRK && delete cache.linkToMsgRK[link]
          cache?.rowType[rowInfo.rowType] && delete cache.rowType[rowInfo.rowType][rowInfo.link]
          // 刷新缓存
          fileCache.flushCache(cache)
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
