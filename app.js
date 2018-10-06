require('dotenv').config()

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
    return res.render('error', {message: 'Client ID missing'})
  }
  const client = CLIENTS.find(c => c.id === clientId)
  if (!client) {
    return res.render('error', {message: `Invalid client ID: ${clientId}`})
  }
  console.log(client)

  res.render('error', {message: '/authorize not fully implemented'})
})

const port = process.env.PORT || 8400
app.listen(port, () => console.log(`Server listening on port ${port}`))
