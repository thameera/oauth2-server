require('dotenv').config()

const db = require('./db')
const app = require('./app')

const run = async () => {
  await db.init({
    strategy: 'memory',
    data: {
      clients: [
        {id: '1', name: 'Default client', redirect_uris: ['http://localhost:8200', 'http://localhost:8201']},
        {id: '2', name: 'Client 2', redirect_uris: ['http://localhost:8200']},
      ],
      users: [
        {email: 'test@example.com', password: 'f'},
      ]
    }
  })

  const port = process.env.PORT || 8400
  app.listen(port, () => console.log(`Server listening on port ${port}`))
}

run()
