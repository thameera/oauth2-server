const moment = require('moment')

const encodeBase64 = val => Buffer.from(val, 'ascii').toString('base64')
const decodeBase64 = val => Buffer.from(val, 'base64').toString('ascii')

const getExpiryTime = ({ value, unit }) => moment().add(value, unit).valueOf()

module.exports = {
  encodeBase64,
  decodeBase64,
  getExpiryTime,
}
