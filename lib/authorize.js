const uuid = require('uuid/v4')

const db = require('../db')
const utils = require('../utils')
const config = require('../config')

const authorize = async (req, res) => {
  /* ClientID validations */
  const clientId = req.query.client_id
  if (!clientId) {
    res.status(400)
    return res.render('error', {message: 'Missing required parameter: client_id'})
  }
  const client = await db.getClientByID(clientId)
  if (!client) {
    res.status(400)
    return res.render('error', {message: `Invalid client ID: ${clientId}`})
  }
  //console.log(client)

  /* Response type validations */
  const responseType = req.query.response_type
  if (!responseType) {
    res.status(400)
    return res.render('error', {message: 'Missing required parameter: response_type'})
  }

  if (!['code'].includes(responseType)) {
    res.status(400)
    return res.render('error', {message: `Invalid response type: ${responseType}`})
  }

  /* Redirect URL validations */
  const validUris = client.redirect_uris
  if (!validUris || !validUris.length) {
    return res.status(400).render('error', {message: 'No redirect URIs configured for the client'})
  }

  const redirectUri = req.query.redirect_uri || null
  if (redirectUri && !validUris.includes(redirectUri)) {
    return res.status(400).render('error', {message: `Invalid redirect URI: ${redirectUri}`})
  }

  const loginID = `login-${uuid()}`

  const expires_at = utils.getExpiryTime(config.LOGIN_SESSION_EXPIRY)
  const loginSession = {
    id: loginID,
    client_id: clientId,
    response_type: responseType,
    redirect_uri: redirectUri,
    originalUrl: req.originalUrl,
    expires_at,
  }
  await db.createLoginSession(loginSession)

  const err = req.flash('err')
  if (err && err.length) {
    res.locals.err = err[0]
  }
  res.status(200)
  res.render('login', {login_id: loginID})
}

module.exports = authorize
