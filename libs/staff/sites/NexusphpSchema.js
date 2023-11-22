/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2023/11/08
 */
'use strict'

const qs = require('qs')
const {getDom, postDom} = require('../../spider/GetData.js')
const {jobs} = require('../../../config/config.js')
const {logger} = require('../../utils/logger.js')
const {toAbsUrl} = require('../../utils/utils.js')
let cookie = jobs.staffMsg.cookie

let self
module.exports = class NexusphpSchema {

  constructor() {
    this.name = this.constructor.name
    self = this
  }

  getOrigin() {
    throw new Error(`getOrigin`)
  }

  getCookie() {
    return cookie
  }

  /**
   * 获取 dom 后的解析操作
   * @param $ dom
   * @param url dom url
   * @param tableSel 表格选择器
   * @param rowsSel 行选择器
   * @param minRows 最小行数, 去掉表格头和尾
   * @param handleRow 行处理函数
   * @returns 处理后的数据数组
   */
  async handleDom($, url, tableSel, rowsSel, minRows, handleRow) {
    const table = $(tableSel),
      rows = table.find(rowsSel).toArray()
    let res = []
    if (rows.length < minRows) {
      logger.info(`No data in ${url}`)
    } else {
      try {
        res = await handleRow($, url, rows)
        res = res.map(r => {
          r.link = toAbsUrl(r.link, url)
          r.userLink = toAbsUrl(r.userLink, url)
          r.uid = self.getUid(r.userLink)
          r.uid = parseInt(r.uid)
          r.title = r.title ? r.title.trim() : ''
          r.detail = r.detail ? r.detail.trim() : ''
          return r
        })
      } catch (e) {
        if (logger.isDebugEnabled()) {
          logger.error(`${url} handleList error: ${e.message}`, e, $.text())
        } else {
          logger.error(`${url} handleList error: ${e.message}`, e)
        }
      }
    }
    return Promise.resolve(res)
  }

  async emptyHandle($) {
    return Promise.resolve({html: $.html(), text: $.text()})
  }

  getUid(userLink) {
    return userLink ? new URL(userLink).searchParams.get('id') : '-1'
  }

  async getStaffBoxList(page = 0) {
    async function handleList($, url, rows) {
      // skip table header and footer
      let res = []
      for (let i = 1; i < rows.length - 1; i++) {
        const cols = $(rows[i]).find('td').toArray()
        let title, link, uid, username, userLink, time, id, isRead, detail, rowType = 'staff'
        title = $(cols[0]).text()
        link = $(cols[0]).find('a')[0].attribs.href
        username = $(cols[1]).text()
        userLink = $(cols[1]).find('a')[0].attribs.href
        time = $(cols[2]).find('span')[0].attribs.title
        isRead = $(cols[3]).text().includes('是')
        id = $(cols[4]).find('input')[0].attribs.value

        let tmp = {title, link, username, userLink, time, id, isRead, detail, rowType}
        if (!isRead) {
          let json = await self.getStaffBoxDetail(id)
          tmp = {...tmp, ...json.data}
        }

        res.push(tmp)
      }
      // 只判每页最后一个是否已读, 如果已读, 则不再获取下一页
      if (!res[res.length - 1].isRead) {
        // if (page === 0) {
        const nextPage = await self.getStaffBoxList(page + 1)
        res = res.concat(nextPage.data)
      }
      return Promise.resolve(res)
    }

    async function wrapper($, url) {
      return self.handleDom($, url, 'form[action] table', 'tr', 2, handleList)
    }

    const url = `${this.getOrigin()}/staffbox.php?page=${page}`
    return getDom(url, wrapper, false, this.getCookie())
  }

  async getReportList(page = 0) {
    async function handleList($, url, rows) {
      // skip table header and footer
      let res = []
      for (let i = 1; i < rows.length - 1; i++) {
        const cols = $(rows[i]).find('td').toArray()
        let title, link, uid, username, userLink, time, id, isRead, detail, type, rowType = 'report'
        title = $(cols[2]).text()
        username = $(cols[1]).text()
        // 系统短讯息没有用户链接
        userLink = $(cols[1]).find('a')[0]?.attribs?.href
        time = $(cols[0]).find('span')[0].attribs.title
        type = $(cols[3]).text()
        detail = $(cols[4]).text()
        isRead = $(cols[5]).text().includes('是')
        id = $(cols[6]).find('input')[0].attribs.value
        // 手动拼接链接, 避免因为缓存跳过
        link = `${url}&id=${id}`

        res.push({title, link, username, userLink, time, id, isRead, detail, type, rowType})
      }
      // 只判每页最后一个是否已读, 如果已读, 则不再获取下一页
      if (!res[res.length - 1].isRead) {
        // if (page === 0) {
        const nextPage = await self.getReportList(page + 1)
        res = res.concat(nextPage.data)
      }
      return Promise.resolve(res)
    }

    async function wrapper($, url) {
      return self.handleDom($, url, 'table table[align=\'center\']', 'tr', 2, handleList)
    }

    const url = `${this.getOrigin()}/reports.php?page=${page}`
    return getDom(url, wrapper, false, this.getCookie())
  }

  async getMessageList(page = 0) {
    async function handleList($, url, rows) {
      // skip table header and footer
      let res = []
      for (let i = 1; i < rows.length - 2; i++) {
        const cols = $(rows[i]).find('td').toArray()
        let title, link, uid, username, userLink, time, id, isRead, detail, rowType = 'message'
        title = $(cols[1]).text()
        link = $(cols[1]).find('a')[0].attribs.href
        username = $(cols[2]).text()
        // 系统短讯息没有用户链接
        userLink = $(cols[2]).find('a')[0]?.attribs?.href
        time = $(cols[3]).find('span')[0].attribs.title
        isRead = $(cols[0]).find('img')[0].attribs.title.includes('已读')
        id = $(cols[4]).find('input')[0].attribs.value

        let tmp = {title, link, username, userLink, time, id, isRead, detail, rowType}
        if (!isRead) {
          let json = await self.getMessageDetail(id)
          tmp = {...tmp, ...json.data}
        }

        res.push(tmp)
      }
      // 只判每页最后一个是否已读, 如果已读, 则不再获取下一页
      if (!res[res.length - 1].isRead) {
        // if (page === 0) {
        const nextPage = await self.getMessageList(page + 1)
        res = res.concat(nextPage.data)
      }
      return Promise.resolve(res)
    }

    async function wrapper($, url) {
      return self.handleDom($, url, 'form[action] table', 'tr', 3, handleList)
    }

    const url = `${this.getOrigin()}/messages.php?action=viewmailbox&box=1&page=${page}`
    return getDom(url, wrapper, false, this.getCookie())
  }

  /**
   * TODO: 分页, 不清楚 url 参数, 搁置
   */
  async getOfferList() {
    async function handleList($, url, rows) {
      // skip table header and footer
      let res = []
      for (let i = 1; i < rows.length; i++) {
        const cols = $(rows[i]).find('td').toArray()
        let title, link, uid, username, userLink, time, id, isRead, detail, rowType = 'offer'
        title = $(cols[1]).text()
        link = $(cols[1]).find('a')[0].attribs.href
        username = $(cols[8]).text()
        userLink = $(cols[8]).find('a')[0]?.attribs?.href
        time = $(cols[6]).find('span')[0].attribs.title
        // isRead = $(cols[3]).text().includes('是')
        isRead = false
        link = toAbsUrl(link, url)
        id = self.getUid(link)

        res.push({title, link, username, userLink, time, id, isRead, detail, rowType})
      }
      return Promise.resolve(res)
    }

    async function wrapper($, url) {
      return self.handleDom($, url, 'table[class=\'torrents\']', 'tr', 1, handleList)
    }

    const url = `${this.getOrigin()}/offers.php`
    return getDom(url, wrapper, false, this.getCookie())
  }


  async getStaffBoxDetail(id) {
    async function handleDetail($, url) {
      let title, detail
      title = $('h1').text()?.replace('管理组信箱-->', '')?.trim()
      detail = $('td[colspan=\'2\'][align=\'left\']').text()?.trim()
      // 很多标签都不支持, 比如 br, img, 不处理了
      // detail = $("td[colspan='2'][align='left']").html()?.replace(/<br>\s?/ig, '\n')
      return Promise.resolve({title, detail})
    }

    const url = `${this.getOrigin()}/staffbox.php?action=viewpm&pmid=${id}&return=`
    return getDom(url, handleDetail, false, this.getCookie())
  }

  async getReportDetail(id) {
    const url = `${this.getOrigin()}/report.php?action=view&id=${id}`
    throw new Error(`暂时不支持获取举报详情`)
  }

  async getMessageDetail(id) {
    async function handleDetail($, url) {
      let title, detail
      title = $('h1').text()
      detail = $('td[colspan=\'2\']').text()
      return Promise.resolve({title, detail})
    }

    const url = `${this.getOrigin()}/messages.php?action=viewmessage&id=${id}`
    return getDom(url, handleDetail, false, this.getCookie())
  }

  async setStaffBoxAnswered(id) {
    const url = `${this.getOrigin()}/staffbox.php?action=takecontactanswered`
    const postBody = qs.stringify({'setanswered[]': id, 'setdealt': '设为已回复'})
    const res = await postDom(url, postBody, self.emptyHandle, self.emptyHandle, false, 0, url, this.getCookie())
    if (res.text) {
      logger.debug(res.text)
    }
    return Promise.resolve()
  }

  async setReportAnswered(id) {
    const url = `${this.getOrigin()}/takeupdate.php`
    const postBody = qs.stringify({'delreport[]': id, 'setdealt': '设为已处理'})
    const res = postDom(url, postBody, self.emptyHandle, self.emptyHandle, false, 0, url, this.getCookie())
    if (res.text) {
      logger.debug(res.text)
    }
    return Promise.resolve()
  }

  async replyStaffBox(uid, pmId, msg) {
    const url = `${this.getOrigin()}/staffbox.php?action=takeanswer`
    let postBody = {
      'color': '0', 'font': '0', 'size': '0',
      'receiver': uid, 'answeringto': pmId, 'body': msg,
    }
    postBody = qs.stringify(postBody)
    const res = postDom(url, postBody, self.emptyHandle, self.emptyHandle, false, 0, url, this.getCookie())
    if (res.text) {
      logger.debug(res.text)
    }
    return Promise.resolve()
  }

  async replyMessage(uid, title, msg) {
    const url = `${this.getOrigin()}/takemessage.php`
    let postBody = {
      // delete: 'yes', origmsg: 'msgId',
      'returnto': this.getOrigin(), 'color': '0', 'font': '0', 'size': '0',
      'receiver': uid, 'subject': `Re: ${title}`, 'body': msg,
    }
    postBody = qs.stringify(postBody)
    const res = postDom(url, postBody, self.emptyHandle, self.emptyHandle, false, 0, url, this.getCookie())
    if (res.text) {
      logger.debug(res.text)
    }
    return Promise.resolve()
  }
}
