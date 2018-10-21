const express = require('express')
const session = require('express-session')
const flash = require('connect-flash')
const uuid = require('uuid/v4')

/* Note: the DB is expected to have been initialized by starter script */
const db = require('./db')

const app = express()

app.use(express.urlencoded({ extended: true }))

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

  if (!['token'].includes(responseType)) {
    res.status(400)
    return res.render('error', {message: `Invalid response type: ${responseType}`})
  }

  /* Redirect URL validations */
  const validUris = client.redirect_uris
  if (!validUris || !validUris.length) {
    return res.status(400).render('error', {message: 'No redirect URIs configured for the client'})
  }

  const redirectUri = req.query.redirect_uri || validUris[0]
  if (!validUris.includes(redirectUri)) {
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

  res.redirect(loginSession.redirect_uri)
})

module.exports = app
