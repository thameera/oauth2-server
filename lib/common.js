const randomstring = require('randomstring')

const db = require('../db')
const utils = require('../utils')
const config = require('../config')

const createAccessToken = async ({ clientID, email }) => {
  const token = `at-${randomstring.generate({ length: 32, charset: 'alphanumeric' })}`
  const expires_at = utils.getExpiryTime(config.ACCESS_TOKEN_EXPIRY)
  const at = {
    token,
    expires_at,
    issued_at: Date.now(),
    client_id: clientID,
    email,
  }
  await db.createAccessToken(at)
  return token
}

module.exports = {
  createAccessToken,
}
