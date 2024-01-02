'use strict'

const {logger, loggerMiddleware} = require('./libs/utils/logger.js'),
  {bot} = require('./libs/message/TelegramBot.js'),
  StaffMsgRunner = require('./services/StaffMsgRunner.js')
const {sendTextToAdmin} = require('./libs/Message.js')
const {formatDate} = require('./libs/utils/utils.js')

const actions = [
  [/.+/, action_async_handler],
]

async function action_async_handler(ctx) {
  const {match, update} = ctx
  const message = update?.callback_query?.message
  const action = match[0]
  let [prefix, rowType, rowId] = action?.split('_')
  logger.debug('action_async_handler', message, action, prefix, rowType, rowId)
  if (prefix && rowType && rowId) {
    await StaffMsgRunner.setAnswered(rowType, rowId)
    setTimeout(() => {
      ctx.deleteMessage(message.message_id)
    }, 2000)
    return ctx.answerCbQuery(`摆烂成功~, 2s 后自动删除~`)
  } else {
    return ctx.answerCbQuery(`unknown: ${action}!!!`)
  }
}

function lis_err(err) {
  logger.error(err)
  const exitArr = [
    'Bot stopped',
    '409: Conflict: terminated by other getUpdates request',
  ]
  if (err.message && exitArr.some(_ => err.message.includes(_))) {
    process.exit(0)
  }
}

function lis_stop() {
  const stopped = `Bot stopped at ${formatDate(Date.now(), 'YYYY/MM/DD HH:mm:ss')}`
  logger.info(stopped)
  return Promise.resolve()
    // .then(_ => sendTextToAdmin(stopped))
    .then(_ => StaffMsgRunner.stop())
    .then(_ => bot.stop())
    .finally(_ => {
      process.exit(0)
    })
}

// bot commands
async function main() {
  // return await bot_command.start(bot).then(_ => bot)
  const started = `Bot started at ${formatDate(Date.now(), 'YYYY/MM/DD HH:mm:ss')}`
  logger.info(started)
  // return sendTextToAdmin(started)
  return Promise.resolve()
}

/**
 * reset bot commands
 * @see https://github.com/telegraf/telegraf/issues/1589
 * @see https://github.com/jxxghp/MoviePilot/blob/0214beb6798f161623bf294266b1121040e83a41/app/modules/telegram/telegram.py#L216
 */
async function resetBotCommand(bot) {
  const commands = [
    {command: 'staff', description: '手动检查'},
    {command: 'id', description: '获取当前聊天的 ChatId, 话题 ID, 消息 ID'},
    {command: 'json', description: '以 json 格式获取消息内容-调试用'},
  ]
  await bot.telegram.deleteMyCommands()
  return bot.telegram.setMyCommands(commands)
}

// Error Handling
Promise.resolve()
  .then(_ => StaffMsgRunner.start())
  .then(_ => main())
  .then(_ => resetBotCommand(bot))
  .then(_ => {
    // Enable graceful stop
    process.on('uncaughtException' || 'unhandledRejection', lis_err)
    process.on('SIGINT' || 'SIGTERM', lis_stop)
    bot.use(loggerMiddleware)
    bot.command('id', ctx => {
      let message = ctx.update.message || ctx.update.edited_message || ctx.update.callback_query
      let msg = `ChatId: \`${message.chat.id}\`
话题 ID: \`${message.message_thread_id || '当前 Chat 非话题'}\`
消息 ID: \`${message.message_id}\``
      return ctx.reply(msg, {parse_mode: 'Markdown'})
    })
    bot.command('json', ctx => {
      let msg = ctx.update.message || ctx.update.edited_message || ctx.update.callback_query
      return ctx.reply(JSON.stringify(msg))
    })
    bot.command('staff', ctx => {
      StaffMsgRunner.run().then(r => ctx.reply('StaffMsgRunner run finished'))
      return ctx.reply('StaffMsgRunner start...')
    })
    actions.forEach(([action, handler]) => {
      bot.action(action, handler)
    })
    bot.on('message', ctx => StaffMsgRunner.handleTgMsg(ctx))
    return bot.launch()
  })
  .catch(err => {
    logger.error(err)
  })
