const express = require('express')
const session = require('express-session')
const flash = require('connect-flash')
const uuid = require('uuid/v4')
const randomstring = require('randomstring')

/* Note: the DB is expected to have been initialized by starter script */
const db = require('./db')

const config = require('./config')
const utils = require('./utils')

const app = express()

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(session({
  secret: 'TODO change this',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60000 }
}))
app.use(flash())

app.set('view engine', 'ejs')

app.get('/', (req, res) => {
  res.send('OIDC server')
})

app.get('/authorize', async (req, res) => {
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

  const loginSession = {
    id: loginID,
    client_id: clientId,
    response_type: responseType,
    redirect_uri: redirectUri,
    originalUrl: req.originalUrl,
  }
  await db.createLoginSession(loginSession)

  const err = req.flash('err')
  if (err && err.length) {
    res.locals.err = err[0]
  }
  res.status(200)
  res.render('login', {login_id: loginID})
})

app.post('/login', async (req, res) => {
  const loginID = req.body.login_id
  if (!loginID) {
    return res.status(400).render('error', {message: 'Invalid login session'})
  }
  const loginSession = db.getLoginSessionByID(loginID)
  if (!loginSession) {
    return res.status(400).render('error', {message: 'Invalid login session'})
  }

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

  const url = new URL(loginSession.redirect_uri)
  url.searchParams.set('code', code)

  res.redirect(url)
})

app.post('/token', async (req, res) => {
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

  if (!authznCode) {
    return throwError(400, 'invalid_grant', 'Invalid authorization code')
  }
  await db.deleteAuthznCode(body.code)

  res.status(501).json({ error: 'Token endpoint not implemented yet' })
})

module.exports = app
