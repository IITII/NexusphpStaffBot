/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2023/11/07
 */
'use strict'
const NexusphpSchema = require('./NexusphpSchema.js')
module.exports = class PterClub extends NexusphpSchema {

  getOrigin() {
    return process.env.CDN_PTER || 'https://pterclub.com'
  }
}
