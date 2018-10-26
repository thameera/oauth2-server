const express = require('express')
const session = require('express-session')
const flash = require('connect-flash')

const routes = {
  home: require('./lib/home'),
  authorize: require('./lib/authorize'),
  login: require('./lib/login'),
  token: require('./lib/token'),
}

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

/* Routes */
app.get('/', routes.home)

app.get('/authorize', routes.authorize)

app.post('/login', routes.login)

app.post('/token', routes.token)

module.exports = app
