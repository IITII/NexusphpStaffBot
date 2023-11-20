/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2022/06/26
 */
'use strict'

const {createClient} = require('redis')
const {redisConf} = require('../config/config.js')
const {logger} = require('./utils/logger.js')
const client = createClient(redisConf)

client.on('error', (err) => logger.error('Redis Client Error', err))

module.exports = client
