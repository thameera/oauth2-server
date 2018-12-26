const uuid = require('uuid/v4')

const db = require('../db')
const utils = require('../utils')
const config = require('../config')

const generateErrorRedirectUrl = (redirectUri, error, error_desc, state) => {
  const url = new URL(redirectUri)
  url.searchParams.set('error', error)
  url.searchParams.set('error_description', error_desc)
  if (state) {
    url.searchParams.set('state', state)
  }
  return url
}

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

  /* Redirect URL validations */
  const validUris = client.redirect_uris
  if (!validUris || !validUris.length) {
    return res.status(400).render('error', {message: 'No redirect URIs configured for the client'})
  }

  const redirectUri = req.query.redirect_uri || null
  if (redirectUri && !validUris.includes(redirectUri)) {
    return res.status(400).render('error', {message: `Invalid redirect URI: ${redirectUri}`})
  }

  const state = req.query.state || null

  /* Response type validations */
  const responseType = req.query.response_type
  if (!responseType) {
    const url = new URL(redirectUri ? redirectUri : client.redirect_uris[0])
    const url2 = generateErrorRedirectUrl(url, 'invalid_request', 'Missing required parameter: response_type', state)
    return res.redirect(url2)
  }

  if (!['code', 'token'].includes(responseType)) {
    const url = new URL(redirectUri ? redirectUri : client.redirect_uris[0])
    const url2 = generateErrorRedirectUrl(url, 'unsupported_response_type', 'Invalid or unsupported response type', state)
    return res.redirect(url2)
  }

  /* All validations passed. Generate login state */
  const loginID = `login-${uuid()}`

  const expires_at = utils.getExpiryTime(config.LOGIN_SESSION_EXPIRY)
  const loginSession = {
    id: loginID,
    client_id: clientId,
    response_type: responseType,
    redirect_uri: redirectUri,
    originalUrl: req.originalUrl,
    expires_at,
    state,
  }
  await db.createLoginSession(loginSession)

  /* Show login page */
  const err = req.flash('err')
  if (err && err.length) {
    res.locals.err = err[0]
  }
  res.status(200)
  res.render('login', {login_id: loginID})
}

module.exports = authorize
