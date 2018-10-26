const randomstring = require('randomstring')

const db = require('../db')
const utils = require('../utils')
const config = require('../config')

const login = async (req, res) => {
  const loginID = req.body.login_id
  if (!loginID) {
    return res.status(400).render('error', {message: 'Invalid login session'})
  }
  const loginSession = db.getLoginSessionByID(loginID)
  if (!loginSession || utils.isExpired(loginSession.expires_at)) {
    return res.status(400).render('error', {message: 'Invalid or expired login session'})
  }
  await db.deleteLoginSession(loginSession.id)

  const username = req.body.username
  const password = req.body.password

  if (!username || !password) {
    req.flash('err', 'Invalid username or password')
    return res.redirect(loginSession.originalUrl)
  }

  const user = await db.getUserByEmail(username)
  if (!user || (password !== user.password)) {
    req.flash('err', 'Invalid username or password')
    return res.redirect(loginSession.originalUrl)
  }

  /* Generate authzn code */
  const code = randomstring.generate({ length: 32, charset: 'alphanumeric' })
  const expires_at = utils.getExpiryTime(config.AUTHZN_CODE_EXPIRY)
  const context = {
    client_id: loginSession.client_id,
    redirect_uri: loginSession.redirect_uri,
    email: username,
    expires_at,
  }
  await db.createAuthznCode({ code, context })

  let redirectUri = loginSession.redirect_uri
  if (!redirectUri) {
    const client = await db.getClientByID(loginSession.client_id)
    redirectUri = client.redirect_uris[0]
  }
  const url = new URL(redirectUri)
  url.searchParams.set('code', code)

  res.redirect(url)
}

module.exports = login
