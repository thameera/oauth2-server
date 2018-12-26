const db = require('../db')
const utils = require('../utils')
const config = require('../config')
const common = require('./common')

const token = async (req, res) => {
  const throwError = (status, error, error_description) => res.status(status).json({ error, error_description })

  const body = req.body || {}
  const grant = body.grant_type
  if (!grant) {
    return throwError(400, 'invalid_request', 'Missing required parameter: grant_type')
  }
  if (grant !== 'authorization_code') {
    return throwError(400, 'unsupported_grant_type', 'Unsupported grant type')
  }

  let client = null

  /* Client authentication */
  const auth = req.headers['authorization']
  if (auth) { /* Authorization header is present */

    const parts = auth.trim().split(' ')
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'basic') {
      res.set('WWW-Authenticate', 'Basic')
      return throwError(401, 'invalid_client', 'Unsupported authentication method')
    }
    const creds = utils.decodeBase64(parts[1]).split(':')
    client = await db.getClientByID(creds[0])
    if (!client || client.secret !== creds[1]) {
      res.set('WWW-Authenticate', 'Basic')
      return throwError(401, 'invalid_client', 'Invalid client or secret')
    }

  } else { /* No Authorization header sent */

    if (!body.client_id || !body.client_secret) {
      return throwError(401, 'invalid_client', 'Client authentication failed')
    }
    client = await db.getClientByID(body.client_id)
    if (!client || client.secret !== body.client_secret) {
      return throwError(401, 'invalid_client', 'Invalid client or secret')
    }

  }

  if (!body.code) {
    return throwError(400, 'invalid_request', 'Missing required parameter: code')
  }

  const authznCode = await db.getAuthznCode(body.code)

  // Is valid code?
  if (!authznCode) {
    return throwError(400, 'invalid_grant', 'Invalid authorization code')
  }
  await db.deleteAuthznCode(body.code)
  const ctx = authznCode.context

  // Validate code expiry
  if (utils.isExpired(ctx.expires_at)) {
    return throwError(400, 'invalid_grant', 'Invalid authorization code')
  }
  // Validate if code was issued to same client
  if (ctx.client_id !== client.id) {
    return throwError(400, 'invalid_grant', 'Invalid authorization code')
  }
  // Validate if redirect URI matches
  if (body.redirect_uri ||  ctx.redirect_uri) {
    if (body.redirect_uri !== ctx.redirect_uri) {
      return throwError(400, 'invalid_grant', 'Invalid redirect URI')
    }
  }

  const token = await common.createAccessToken({ clientID: client.id, email: ctx.email })

  res.set('Cache-control', 'no-store')
  res.set('Pragma', 'no-cache')
  res.status(200).json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: utils.getExpiresInSeconds(config.ACCESS_TOKEN_EXPIRY),
  })
}

module.exports = token
