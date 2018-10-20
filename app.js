const express = require('express')
const uuid = require('uuid/v4')

/* Note: the DB is expected to have been initialized by starter script */
const db = require('./db')

const app = express()

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

  const loginID = `login-${uuid()}`
  res.status(200)
  res.render('login', {login_id: loginID})
})

module.exports = app
