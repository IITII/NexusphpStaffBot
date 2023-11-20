/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2023/09/03
 */
'use strict'
const fs = require('fs'),
  path = require('path'),
  log4js = require('log4js'),
  config = require('../../config/log4js'),
  LOG_NAME = process.env.LOG_NAME || 'staff_bot'
/**
 * Logger Level: trace, debug, info, warn, error and fatal levels
 */
log4js.configure(config)
const logger = log4js.getLogger(LOG_NAME)

/**
 * Telegram bot logger middleware
 */
const loggerMiddleware = async (ctx, next) => {
  const start = new Date()
  return next()
    .then(() => {
      let message = ctx.update.message || ctx.update.edited_message || ctx.update.callback_query
      if (logger.isDebugEnabled()) {
        logger.debug(`cost: ${new Date() - start}ms ${JSON.stringify(message)}`)
      } else {
        let log = {
          cost: `${new Date() - start}ms`,
          updateType: ctx.updateType,
          username: `@${message.from.username}`,
          name: `${message.from.first_name} ${message.from.last_name}`,
          id: message.from.id,
          chatType: message.chat.type,
          updateSubTypes: ctx.updateSubTypes || '',
          content: message.text || message.photo[0].file_unique_id,
        }
        logger.info(JSON.stringify(log))
      }
    })
    .catch(e => {
      logger.error(e)
    })
}

module.exports = {
  logger,
  loggerMiddleware,
}
