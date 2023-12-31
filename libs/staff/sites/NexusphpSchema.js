/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2023/11/08
 */
'use strict'

const qs = require('qs')
const {groupBy, difference} = require('lodash')
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
          r.trLink = toAbsUrl(r.trLink, url)
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

  /**
   * 读取链接中的 id 信息
   */
  getUid(userLink) {
    return userLink ? new URL(userLink).searchParams.get('id') : '-1'
  }

  /**
   * 获取管理组私信列表
   */
  async getStaffBoxList(minId = -1, page = 0) {
    async function handleList($, url, rows) {
      // skip table header and footer
      let res = []
      for (let i = 1; i < rows.length - 1; i++) {
        const cols = $(rows[i]).find('td').toArray()
        let title, link, uid, username, userLink, time, id, isRead, detail, rowType = 'staff'
        title = $(cols[0]).text()
        link = $(cols[0]).find('a')[0].attribs.href
        username = $(cols[1]).text()
        // 申请删除账号后, 用户名会变成 (无此帐户)
        userLink = $(cols[1]).find('a')[0]?.attribs?.href
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
      let ids = res.map(_ => parseFloat(_.id) || 0).filter(_ => _ > 0).sort()
      if (minId > 0 && ids.length > 0) {
        // 因为 page++, id --. 筛选 id 最小值, 如果小于等于 minId, 则不再获取下一页
        let min = ids[0]
        logger.debug(`getStaffBoxList by minId, page: ${page}, minId: ${minId}, currMin: ${min}`)
        if (min > minId) {
          const nextPage = await self.getStaffBoxList(minId, page + 1)
          res = res.concat(nextPage.data)
        }
      } else {
        // 判每页最后一个是否已读, 如果已读, 则不再获取下一页
        logger.debug(`getStaffBoxList by read, page: ${page}, minId: ${minId}`)
        if (!res[res.length - 1]?.isRead) {
          const nextPage = await self.getStaffBoxList(minId, page + 1)
          res = res.concat(nextPage.data)
        }
      }
      return Promise.resolve(res)
    }

    async function wrapper($, url) {
      return self.handleDom($, url, 'form[action] table', 'tr', 2, handleList)
    }

    const url = `${this.getOrigin()}/staffbox.php?page=${page}`
    return getDom(url, wrapper, false, this.getCookie())
  }

  /**
   * 获取举报列表
   */
  async getReportList(minId = -1, page = 0) {
    async function handleList($, url, rows) {
      if (rows.length > 0 && $(rows[0]).text().includes('没有举报信息')) {
        logger.debug(`没有举报消息 in ${url}`)
        return Promise.resolve([])
      }
      // skip table header and footer
      let res = []
      for (let i = 1; i < rows.length - 1; i++) {
        const cols = $(rows[i]).find('td').toArray()
        let title, link, trLink, addLink, uid, username, userLink, time, id, isRead, detail, type, rowType = 'report'
        title = $(cols[2]).text()
        trLink = $(cols[2]).find('a')[0]?.attribs?.href
        username = $(cols[1]).text()
        // 系统短讯息没有用户链接
        userLink = $(cols[1]).find('a')[0]?.attribs?.href
        time = $(cols[0]).find('span')[0].attribs.title
        type = $(cols[3]).text()
        detail = $(cols[4]).text()
        isRead = $(cols[5]).text().includes('是')
        id = $(cols[6]).find('input')[0].attribs.value
        // 手动拼接链接, 避免因为缓存跳过
        // 举报太多翻页了, 导致重复举报...
        addLink = url
        link = `${self.getOrigin()}/reports.php?id=${id}`

        res.push({title, link, trLink, addLink, username, userLink, time, id, isRead, detail, type, rowType})
      }
      let ids = res.map(_ => parseFloat(_.id) || 0).filter(_ => _ > 0).sort()
      if (minId > 0 && ids.length > 0) {
        // 因为 page++, id --. 筛选 id 最小值, 如果小于等于 minId, 则不再获取下一页
        let min = ids[0]
        logger.debug(`getReportList by minId, page: ${page}, minId: ${minId}, currMin: ${min}`)
        if (min > minId) {
          const nextPage = await self.getReportList(minId, page + 1)
          res = res.concat(nextPage.data)
        }
      } else {
        // 判每页最后一个是否已读, 如果已读, 则不再获取下一页
        logger.debug(`getReportList by read, page: ${page}, minId: ${minId}`)
        if (!res[res.length - 1]?.isRead) {
          const nextPage = await self.getReportList(minId, page + 1)
          res = res.concat(nextPage.data)
        }
      }
      return Promise.resolve(res)
    }

    async function wrapper($, url) {
      return self.handleDom($, url, 'table table[align=\'center\']', 'tr', 2, handleList)
    }

    const url = `${this.getOrigin()}/reports.php?page=${page}`
    return getDom(url, wrapper, false, this.getCookie())
  }

  /**
   * 获取私信列表
   */
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
      if (!res[res.length - 1]?.isRead) {
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
   * 获取候选列表
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


  /**
   * 获取管理组私信详情
   * @param id pmId
   */
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

  /**
   * 获取举报详情
   */
  async getReportDetail(id) {
    const url = `${this.getOrigin()}/report.php?action=view&id=${id}`
    throw new Error(`暂时不支持获取举报详情`)
  }

  /**
   * 获取私信详情
   */
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

  /**
   * 设置管理组私信为已处理
   */
  async setStaffBoxAnswered(id) {
    const url = `${this.getOrigin()}/staffbox.php?action=takecontactanswered`
    const postBody = qs.stringify({'setanswered[]': id, 'setdealt': '设为已回复'})
    const res = await postDom(url, postBody, self.emptyHandle, self.emptyHandle, false, 0, url, this.getCookie())
    if (res.text) {
      logger.debug(res.text)
    }
    return Promise.resolve()
  }

  /**
   * 设置举报为已处理
   */
  async setReportAnswered(id) {
    const url = `${this.getOrigin()}/takeupdate.php`
    const postBody = qs.stringify({'delreport[]': id, 'setdealt': '设为已处理'})
    const res = postDom(url, postBody, self.emptyHandle, self.emptyHandle, false, 0, url, this.getCookie())
    if (res.text) {
      logger.debug(res.text)
    }
    return Promise.resolve()
  }

  /**
   * 回复管理组私信
   */
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

  /**
   * 回复私信
   */
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

  /**
   * 获取`编辑用户`部分详情 <br>
   * 数据形式: 1. 下拉选择, 2. 文本输入 3. 圆形单选 4. 复选框 5. textarea<br>
   * 1: select 2: input 3: input[type='radio'] 4: input[type='checkbox'] 5. textarea[name]<br>
   * 禁用/隐藏形式: 1. select[disable] 2. input[disable] 3. input[type='hidden']
   */
  async getModTaskDetail(uid) {
    if (!uid) throw new Error(`uid is empty`)

    async function handleDom($, url) {
      console.log(url)
      let inputs = $("form[action='modtask.php'] input[value]").get(),
        selects = $("form[action='modtask.php'] select[name]").get(),
        textareas = $("form[action='modtask.php'] textarea[name]").get()
      let res = {}
      if (inputs.length === 0) {
        logger.warn(`No data in ${url}, 可能是没权限, 或者编辑自己`)
      } else {
        let grouped = groupBy(inputs.map(_ => _.attribs), 'name')
        delete grouped['undefined']
        let formatGroups = {}, formatValues = {}
        for (const k in grouped) {
          let gv = grouped[k]
          if (gv.length < 1) {
            throw new Error(`unknown key: ${k} for value length === 0`)
          } else if (gv.length === 1) {
            formatGroups[k] = gv[0]
            formatValues[k] = gv[0].value
          } else {
            let tmp
            switch (gv[0].type) {
              case 'radio':
                tmp = gv.filter(_ => _.checked)
                break
              case 'checkbox':
              default:
                throw new Error(`unknown type: ${gv[0].type}`)
            }
            if (tmp.length === 0) {
              throw new Error(`unable to get value for ${k} in ${JSON.stringify(gv)}`)
            } else {
              formatGroups[k] = tmp[0]
              formatValues[k] = tmp[0].value
            }
          }
        }
        res = {formatGroups, formatValues}
      }
      res.GET_DATA = Object.keys(res.formatGroups || {}).length !== 0
      return Promise.resolve(res)
    }

    const url = `${this.getOrigin()}/userdetails.php?id=${uid}`
    return getDom(url, handleDom, false, this.getCookie())
  }

  /**
   * 启用下载权限
   */
  // async enableDownloadPermission(uid) {
  //   let modTask = await this.getModTaskDetail(uid)
  //   console.log(modTask)
  // }
}
