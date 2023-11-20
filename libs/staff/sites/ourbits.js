/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2023/11/07
 */
'use strict'
const NexusphpSchema = require('./NexusphpSchema.js')
const {toAbsUrl} = require('../../utils/utils.js')
const {getDom} = require('../../spider/GetData.js')

let self
module.exports = class Ourbits extends NexusphpSchema {
  constructor() {
    super()
    self = this
  }

  getOrigin() {
    return 'https://ourbits.club'
  }

  async getOfferList() {
    async function handleList($, url, rows) {
      // skip table header and footer
      let res = []
      for (let i = 1; i < rows.length; i++) {
        const cols = $(rows[i]).find('td').toArray()
        let title, link, uid, username, userLink, time, id, isRead, detail, rowType = 'offer'
        title = $($(cols[1]).find('a')[0]).text()
        link = $(cols[1]).find('a')[0].attribs.href
        detail = $($(cols[1])).text()?.replace(title, '')
        username = $(cols[6]).text()
        userLink = $(cols[6]).find('a')[0]?.attribs?.href
        time = $(cols[5]).find('span')[0]?.attribs?.title
        // isRead = $(cols[3]).text().includes('是')
        isRead = false
        link = toAbsUrl(link, url)
        id = self.getUid(link)

        // 观众存在嵌套表格, 需要过滤无效数据
        if (title && link && time) {
          res.push({title, link, username, userLink, time, id, isRead, detail, rowType})
        }
      }
      return Promise.resolve(res)
    }

    async function wrapper($, url) {
      return self.handleDom($, url, "table[class*='torrents']", 'tr', 1, handleList)
    }

    const url = `${this.getOrigin()}/offers.php`
    return getDom(url, wrapper, false, this.getCookie())
  }
}
