require('dotenv').config()

const express = require('express')
const app = express()

app.set('view engine', 'ejs')

app.get('/', (req, res) => {
  res.send('OIDC server')
})

app.get('/authorize', (req, res) => {
  res.render('error', {message: '/authorize not fully implemented'})
})

const port = process.env.PORT || 8400
app.listen(port, () => console.log(`Server listening on port ${port}`))
