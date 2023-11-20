/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2022/07/04
 */
'use strict'
const {Telegraf} = require('telegraf')
const {PROXY} = require('../../config/config.js')
const HttpsProxyAgent = require('https-proxy-agent')

const {message} = require('../../config/config.js')
const {botToken} = message

if (!botToken) {
  throw new Error(`Set BotToken first. config.js or BOT_TOKEN env`)
}

const botMap = new Map()
const getBot = token => {
  if (!token) {
    throw new Error('token is not defined')
  }

  if (botMap.has(token)) {
    // 好像没法判断 bot 是否已经停止, 先就这样吧
    return botMap.get(token)
  }
  let bot = new Telegraf(token)
  if (PROXY) {
    const agent = new HttpsProxyAgent(PROXY)
    bot = new Telegraf(token, {
      telegram: {agent},
    })
  }
  botMap.set(token, bot)
  return bot
}

let bot = getBot(botToken)

module.exports = {
  bot,
  getBot,
}
