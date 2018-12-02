require('./authorize-endpoint.spec')

const chai = require('chai')
const chaiHttp = require('chai-http')
const moment = require('moment')

const helpers = require('./helpers')
const getSelectors = helpers.getSelectors

const db = require('../db')
const utils = require('../utils')
const app = require('../app')

const expect = chai.expect
chai.use(chaiHttp)

describe('/login', () => {
  let server
  let agent = null
  const origMomentNow = moment.now

  beforeEach(async () => {
    await db.init({
      strategy: 'memory',
      data: helpers.INIT_DATA
    })
    server = app.listen(helpers.PORT)

    // Agent is used to preserve cookies
    agent = chai.request.agent(app)

    await db.createLoginSession({
      id: 'login-pqr123',
      client_id: '1',
      response_type: 'code',
      redirect_uri: 'http://localhost:8498',
      originalUrl: '/authorize?client_id=1&response_type=code',
      expires_at: Date.now() + 50000,
      state: null,
    })
    await db.createLoginSession({
      id: 'login-pqr345',
      client_id: '1',
      response_type: 'code',
      redirect_uri: 'http://localhost:8498',
      originalUrl: '/authorize?client_id=1&response_type=code',
      expires_at: Date.now() + 50000,
      state: 'abcDE3!',
    })
    await db.createLoginSession({
      id: 'login-pqr456',
      client_id: '1',
      response_type: 'code',
      originalUrl: '/authorize?client_id=1&response_type=code',
      expires_at: Date.now() - 1000,
      state: null,
    })
  })

  afterEach(() => {
    server.close()
    db.shutdown()

    moment.now = origMomentNow
    agent.close()
  })

  const doPost = async (login_id, username, password) => {
    return await agent.post('/login').type('form').send({
      username,
      password,
      login_id
    })
  }

  it('should show error page for invalid login session', async () => {
    const res = await doPost('login-xyz', 'some@email.com', 'abc')

    expect(res).to.have.status(400)
    expect(res).to.have.header('content-type', /^text\/html/)

    const { $, $$ } = getSelectors(res.text)
    expect($('title').text).to.equal('Error')
    expect($('p').textContent).to.equal('Invalid or expired login session')
  })

  it('should show error page for invalid login session, even if credentials are correct', async () => {
    const res = await doPost('login-xyz', 'test@example.com', 'pass')

    expect(res).to.have.status(400)
    expect(res).to.have.header('content-type', /^text\/html/)

    const { $, $$ } = getSelectors(res.text)
    expect($('title').text).to.equal('Error')
    expect($('p').textContent).to.equal('Invalid or expired login session')
  })

  it('should show error page for expired login session', async () => {
    const res = await doPost('login-pqr456', 'test@example.com', 'pass')

    expect(res).to.have.status(400)
    expect(res).to.have.header('content-type', /^text\/html/)

    const { $, $$ } = getSelectors(res.text)
    expect($('title').text).to.equal('Error')
    expect($('p').textContent).to.equal('Invalid or expired login session')
  })

  const invalidUserPassTest = async (user, pass) => {
    const res = await doPost('login-pqr123', user, pass)
    expect(res).to.have.status(200)
    expect(res).to.have.header('content-type', /^text\/html/)

    const { $, $$ } = getSelectors(res.text)
    expect($('title').text).to.equal('Login')
    expect($('h1').textContent).to.equal('User Login')
    expect($('.error').textContent).to.equal('Invalid username or password')
  }

  it('should fail for empty email address', async () => {
    await invalidUserPassTest('', 'pass')
  })

  it('should fail for wrong email address', async () => {
    await invalidUserPassTest('wrong@example.com', 'pass')
  })

  it('should fail for empty password', async () => {
    await invalidUserPassTest('test@example.com', '')
  })

  it('should fail for wrong password', async () => {
    await invalidUserPassTest('test@example.com', 'wrong')
  })

  const testHappyFlow = async login_id => {
    const FIXED_TIME = 1540117200000
    moment.now = () => +new Date(FIXED_TIME)

    const res = await agent.post('/login').type('form').redirects(0).send({
      username: 'test@example.com',
      password: 'pass',
      login_id: login_id
    })

    expect(res).to.have.status(302)
    const url = new URL(res.headers.location)
    const code = url.searchParams.get('code')
    expect(code).to.not.be.null
    expect(code).to.have.length(32)

    const authznCode = await db.getAuthznCode(code)
    expect(authznCode).to.be.not.null
    expect(authznCode).to.be.not.undefined
    expect(authznCode.context.client_id).to.equal('1')
    expect(authznCode.context.redirect_uri).to.equal('http://localhost:8498')
    expect(authznCode.context.email).to.equal('test@example.com')
    expect(authznCode.context.expires_at).to.equal(FIXED_TIME + 10 * 60 * 1000)

    return url
  }

  it('should create an authzn code and redirect with that code', async () => {
    await testHappyFlow('login-pqr123')
  })

  it('should redirect to client\'s first redirect_uri if no redirect URI was in login session', async () => {
    await testHappyFlow('login-pqr123')
  })

  it('should return the state when a state is present in login session', async () => {
    const url = await testHappyFlow('login-pqr345')
    const state = url.searchParams.get('state')
    expect(state).to.equal('abcDE3!')
  })

  it('should not return a state when a state is not present in login session', async () => {
    const url = await testHappyFlow('login-pqr123')
    const state = url.searchParams.get('state')
    expect(state).to.be.null
  })

  it('should delete loginSession after successful authentication', async () => {
    await testHappyFlow('login-pqr123')
    const session = await db.getLoginSessionByID('login-pqr123')
    expect(session).to.be.undefined
  })
})
