/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2023/11/07
 */
'use strict'
const NexusphpSchema = require('./NexusphpSchema')
module.exports = class Xfree extends NexusphpSchema {

  getOrigin() {
    return 'https://pt.2xfree.org'
  }

  /**
   * 没有候选页
   */
  async getOfferList() {
    return Promise.resolve([])
  }
}
