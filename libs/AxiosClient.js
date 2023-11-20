/**
 * @author IITII <ccmejx@gmail.com>
 * @date 2022/05/26
 */
'use strict'
const Axios = require('axios'),
  {axiosConf} = require('../config/config')
// const {CookieJar} = require('tough-cookie'),
//   {wrapper} = require('axios-cookiejar-support'),
//   jar = new CookieJar(),
//   axios = Axios.create(axiosConf)

const axios = Axios.create(axiosConf)

// axiosConf.httpsAgent = undefined
// const axiosJar = wrapper(Axios.create({...axiosConf, jar}))

module.exports = {
  axios,
  // axiosJar,
}
