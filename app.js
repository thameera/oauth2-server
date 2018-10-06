require('dotenv').config()

const express = require('express')
const app = express()

app.get('/', (req, res) => {
  res.send('OIDC server')
})

const port = process.env.PORT || 8400
app.listen(port, () => console.log(`Server listening on port ${port}`))
