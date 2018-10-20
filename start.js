require('dotenv').config()

const db = require('./db')
const app = require('./app')

await db.init({
  strategy: 'memory',
  data: {
    clients: [
      {id: '1', name: 'Default client'},
      {id: '2', name: 'Client 2'}
    ]
  }
})

const port = process.env.PORT || 8400
app.listen(port, () => console.log(`Server listening on port ${port}`))
