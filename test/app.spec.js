const chai = require('chai')
const chaiHttp = require('chai-http')
const JSDOM = require('jsdom').JSDOM
const moment = require('moment')

const db = require('../db')
const app = require('../app')

const expect = chai.expect
chai.use(chaiHttp)

const PORT = 8499
const INIT_DATA = {
  clients: [
    {id: '1', name: 'Default client', redirect_uris: ['http://localhost:8498', 'http://localhost:8497']},
    {id: '2', name: 'Client 2', redirect_uris: ['http://localhost:8490']},
    {id: '3', name: 'Client 3', redirect_uris: []},
  ],
  users: [
    {email: 'test@example.com', password: 'pass'},
  ],
}

const getSelectors = html => {
  const document = new JSDOM(html).window.document
  return {
    $: s => document.querySelector(s),
    $$: s => document.querySelectorAll(s)
  }
}

describe('App', () => {
  let server

  before(async () => {
    await db.init({
      strategy: 'memory',
      data: INIT_DATA
    })
    server = app.listen(PORT)
  })

  after(() => {
    server.close()
    db.shutdown()
  })

  describe('/', () => {
    it('should send back the OIDC Server home page', async () => {
      const res = await chai.request(app).get('/')
      expect(res).to.have.status(200)
      expect(res).to.have.header('content-type', /^text\/html/)
      expect(res.text).to.equal('OIDC server')
    })
  })

  describe('/authorize', () => {
    const errCheck = async (path, status) => {
      const res = await chai.request(app).get(path)
      expect(res).to.have.status(status)
      expect(res).to.have.header('content-type', /^text\/html/)

      const { $, $$ } = getSelectors(res.text)
      expect($('title').text).to.equal('Error')
      return { $ }
    }

    it('should look for a client ID', async () => {
      const { $ } = await errCheck('/authorize', 400)
      expect($('p').textContent).to.equal('Missing required parameter: client_id')
    })

    it('should detect an empty client ID', async () => {
      const { $ } = await errCheck('/authorize?client_id=', 400)
      expect($('p').textContent).to.equal('Missing required parameter: client_id')
    })

    it('should validate the client ID', async () => {
      const { $ } = await errCheck('/authorize?client_id=invalidID', 400)
      expect($('p').textContent).to.equal('Invalid client ID: invalidID')
    })

    it('should look for a response type', async () => {
      const { $ } = await errCheck('/authorize?client_id=1', 400)
      expect($('p').textContent).to.equal('Missing required parameter: response_type')
    })

    it('should detect an empty response type', async () => {
      const { $ } = await errCheck('/authorize?client_id=1&response_type=', 400)
      expect($('p').textContent).to.equal('Missing required parameter: response_type')
    })

    it('should look validate the response type', async () => {
      const { $ } = await errCheck('/authorize?client_id=1&response_type=pqr', 400)
      expect($('p').textContent).to.equal('Invalid response type: pqr')
    })

    it('should check if the client has registered redirect URIs if a redirect URI is not specified', async () => {
      const { $ } = await errCheck('/authorize?client_id=3&response_type=code', 400)
      expect($('p').textContent).to.equal('No redirect URIs configured for the client')
    })

    it('should check if the client has registered redirect URIs if a redirect URI is specified', async () => {
      const { $ } = await errCheck('/authorize?client_id=3&response_type=code&redirect_uri=http://localhost:8498', 400)
      expect($('p').textContent).to.equal('No redirect URIs configured for the client')
    })

    it('should validate the redirect uri against registered redirect uris', async () => {
      const { $ } = await errCheck('/authorize?client_id=1&response_type=code&redirect_uri=http://localhost:8500', 400)
      expect($('p').textContent).to.equal('Invalid redirect URI: http://localhost:8500')
    })

    it('should show the login page if no errors are found', async () => {
      const res = await chai.request(app).get('/authorize?client_id=1&response_type=code')
      expect(res).to.have.status(200)
      expect(res).to.have.header('content-type', /^text\/html/)

      const { $, $$ } = getSelectors(res.text)
      expect($('title').text).to.equal('Login')
      expect($('h1').textContent).to.equal('User Login')

      const form = $('form')
      expect(form.getAttribute('action')).to.equal('/login')
      expect(form.getAttribute('method').toLowerCase()).to.equal('post')

      const userInput = $('input#username')
      expect(userInput.getAttributeNames()).to.include('required')
      expect(userInput.getAttribute('type')).to.equal('text')
      expect(userInput.getAttribute('name')).to.equal('username')
      const pwInput = $('input#password')
      expect(pwInput.getAttributeNames()).to.include('required')
      expect(pwInput.getAttribute('type')).to.equal('password')
      expect(pwInput.getAttribute('name')).to.equal('password')
      const idInput = $('input#login_id')
      expect(idInput.getAttribute('type')).to.equal('hidden')
      expect(idInput.getAttribute('name')).to.equal('login_id')
      expect(idInput.getAttribute('value')).to.match(/^login-.*/)
      const button = $('input#submit')
      expect(button.getAttribute('type')).to.equal('submit')
    })

    it('should create a login session in DB with all details', async () => {
      const url = '/authorize?client_id=1&response_type=code'
      const res = await chai.request(app).get(url)

      expect(res).to.have.status(200)
      const { $, $$ } = getSelectors(res.text)

      const idInput = $('input#login_id')
      const loginID = idInput.getAttribute('value')
      session = await db.getLoginSessionByID(loginID)

      expect(session).to.be.not.null
      expect(session.id).to.equal(loginID)
      expect(session.client_id).to.equal('1')
      expect(session.response_type).to.equal('code')
      expect(session.originalUrl).to.equal(url)
    })
  })

  describe('/login', () => {
    let agent = null
    const origMomentNow = moment.now

    before(async () => {
      // Agent is used to preserve cookies
      agent = chai.request.agent(app)

      await db.createLoginSession({
        id: 'login-pqr123',
        client_id: '1',
        response_type: 'code',
        redirect_uri: 'http://localhost:8498',
        originalUrl: '/authorize?client_id=1&response_type=code',
      })
    })

    afterEach(() => {
      moment.now = origMomentNow
    })

    after(() => {
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
      expect($('p').textContent).to.equal('Invalid login session')
    })

    it('should show error page for invalid login session, even if credentials are correct', async () => {
      const res = await doPost('login-xyz', 'test@example.com', 'pass')

      expect(res).to.have.status(400)
      expect(res).to.have.header('content-type', /^text\/html/)

      const { $, $$ } = getSelectors(res.text)
      expect($('title').text).to.equal('Error')
      expect($('p').textContent).to.equal('Invalid login session')
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

    it('should create an authzn code and redirect with that code', async () => {
      const FIXED_TIME = 1540117200000
      moment.now = () => +new Date(FIXED_TIME)

      const res = await agent.post('/login').type('form').redirects(0).send({
        username: 'test@example.com',
        password: 'pass',
        login_id: 'login-pqr123'
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
    })
  })
})
