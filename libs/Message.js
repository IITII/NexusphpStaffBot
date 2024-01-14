/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2023/09/03
 */
'use strict'

const {Markup} = require('telegraf')
const {logger} = require('./utils/logger.js')
const {bot} = require('./message/TelegramBot.js')
const {message, telegram} = require('../config/config.js')
const {sleep} = require('./utils/utils.js')
const {maxMessageLength} = telegram

async function sendTextToAdmin(text) {
  return sendTextMsg(message.groupId, text, undefined, false, '\n', undefined, message.generalThreadId)
}

/**
 * 从发送消息的回调里面, 删除 TG 消息
 */
async function deleteMsgHandle(tgRes, timeout = 2000) {
  let id = setTimeout(async () => {
    let chatId = tgRes.chat.id || tgRes.result?.chat.id
    let message_id = tgRes.message_id || tgRes.result?.message_id
    await deleteMsg(chatId, message_id, true)
  }, timeout)
  return Promise.resolve(id)
}

/**
 * 删除 TG 消息
 * @param chat_id 群组 id
 * @param message_id 消息 id
 * @param noThrow 是否抛出异常
 */
async function deleteMsg(chat_id, message_id, noThrow = false) {
  let res = Promise.resolve()
  try {
    res = await handle429(0, deleteMessage, chat_id, message_id)
  } catch (e) {
    logger.warn(`deleteMsg failed: ${e.message}`, e)
    if (!noThrow) {
      throw e
    }
  }
  return res
}

async function sendStaffMsg(text, links = [], parse_mode = 'html', groupId = message.groupId, message_thread_id = message.generalMsgThreadId) {
  const opts = {
    parse_mode, disable_web_page_preview: true, message_thread_id,
    ...Markup.inlineKeyboard(links.map(({text, url, type}) => {
      switch (type) {
        case 'url':
          return Markup.button.url(text, url)
        // case 'switch_inline_query':
        //   return [Markup.button.switchToChat(text, url)]
        case 'cb':
        default:
          return Markup.button.callback(text, url)
      }
    }))
  }
  return sendTextMsg429(groupId, text, opts)
}

async function sendTextMsg(chat_id, text, message_id, preview, sep = '\n', parse_mode = undefined, message_thread_id = undefined) {
  const opts = {
    reply_to_message_id: message_id,
    parse_mode: parse_mode === undefined ? 'Markdown' : parse_mode,
    message_thread_id,
    // disable_notification: true,
    // protect_content: true
  }
  opts.disable_web_page_preview = !preview
  return sendTextMsg429(chat_id, text, opts, sep)
}

async function sendTextMsg429(chat_id, text, opts, sep = '\n') {
  if (text.length > maxMessageLength) {
    const split = text.split(sep)
    const rawText = []
    let len = 0
    let tmp = []
    for (let t of split) {
      if (t > maxMessageLength) {
        t = t.substring(0, maxMessageLength)
      }
      if (len + t.length + sep.length > maxMessageLength) {
        rawText.push(JSON.parse(JSON.stringify(tmp)).join(sep))
        tmp = [t]
        len = t.length + sep.length
      } else {
        tmp.push(t)
        len += t.length + sep.length
      }
    }
    rawText.push(JSON.parse(JSON.stringify(tmp)).join(sep))
    logger.debug(`${chat_id}: split ${text.length} to ${rawText.length}`)
    let res = {}
    for (let t of rawText) {
      res = await sendTextMsg429(chat_id, t, opts, sep)
    }
    // 只保留最后一次 sendMsg 的结果
    return res
  } else {
    logger.debug(`${chat_id}: ${text}`)
    return handle429(0, sendMessage, chat_id, text, opts)
  }
}

const sendMessage = (chat_id, text, opts) => bot.telegram.sendMessage(chat_id, text, opts)
const deleteMessage = (chat_id, message_id) => bot.telegram.deleteMessage(chat_id, message_id)

async function handle429(retry = 0, handle, ...args) {
  const msg_429 = 'Too Many Requests: retry after'
  let res
  try {
    res = await handle.apply(this, args)
  } catch (e) {
    const eMsg = e.message
    if (eMsg.includes(msg_429)) {
      const index = eMsg.indexOf(msg_429)
      const sleepTimeRaw = eMsg.substring(index + msg_429.length)
      const sleepTime = parseInt(sleepTimeRaw) + 1
      const retryMsg = `retry ${retry + 1} after ${sleepTime}s`
      logger.warn(`${args.join(', ') || ''}: ${retryMsg}`)
      await sleep(sleepTime * 1000)
      return handle429(retry + 1, handle, ...args)
    } else {
      throw e
    }
  }
  return res
}

module.exports = {
  sendTextMsg,
  sendTextToAdmin,
  sendStaffMsg,
  deleteMsg,
  deleteMsgHandle,
}
