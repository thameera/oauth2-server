const express = require('express')
const app = express()

const CLIENTS = [
  {id: '1', name: 'Default client'},
  {id: '2', name: 'Client 2'}
]

app.set('view engine', 'ejs')

app.get('/', (req, res) => {
  res.send('OIDC server')
})

app.get('/authorize', (req, res) => {
  /* ClientID validations */
  const clientId = req.query.client_id
  if (!clientId) {
    res.status(400)
    return res.render('error', {message: 'Missing required parameter: client_id'})
  }
  const client = CLIENTS.find(c => c.id === clientId)
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

  res.status(501)
  res.render('error', {message: '/authorize not fully implemented'})
})

module.exports = app
