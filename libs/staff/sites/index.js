/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2023/11/07
 */
'use strict'
const PterClub = require('./pterclub.js')
const Xfree = require('./2xfree.js')
const Audiences = require('./audiences.js')
const Ourbits = require('./ourbits.js')

// new Xfree().getReportList().then(console.log)
// new Xfree().getMessageList().then(console.log)
// new Xfree().getStaffBoxList().then(console.log)
// new Xfree().setStaffBoxAnswered(401).then(console.log)
// new Xfree().setReportAnswered(109).then(console.log)
// new Xfree().getMessageDetail(33226).then(console.log)
// new Xfree().getStaffBoxDetail(399).then(console.log)
// new Xfree().replyStaffBox(3379, 400, 'text').then(console.log)
// new Xfree().getModTaskDetail(3379).then(console.log)
// new Xfree().getModTaskDetail(4482).then(console.log)
// new Xfree().enableDownloadPermission(4482).then(console.log)
// new PterClub().getReportList().then(console.log)
// new PterClub().getMessageList().then(console.log)
// new PterClub().getStaffBoxList().then(console.log)
// new PterClub().getOfferList().then(console.log)
// new Audiences().getMessageList().then(console.log)
// new Audiences().getOfferList().then(console.log)
// new Ourbits().getStaffBoxList().then(console.log)
// new Ourbits().getReportList().then(console.log)
// new Ourbits().getMessageList().then(console.log)
// new Ourbits().getOfferList().then(console.log)


module.exports = {PterClub, Xfree, Audiences, Ourbits}
