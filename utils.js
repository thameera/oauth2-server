const moment = require('moment')

const getExpiryTime = ({ value, unit }) => moment().add(value, unit).valueOf()

module.exports = {
  getExpiryTime,
}
