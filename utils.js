const moment = require('moment')

const encodeBase64 = val => Buffer.from(val, 'ascii').toString('base64')
const decodeBase64 = val => Buffer.from(val, 'base64').toString('ascii')

const getExpiryTime = ({ value, unit }) => moment().add(value, unit).valueOf()
const isExpired = expiry => moment().isAfter(moment(expiry))

module.exports = {
  encodeBase64,
  decodeBase64,
  getExpiryTime,
  isExpired,
}
