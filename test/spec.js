const chai = require('chai')
const chaiHttp = require('chai-http')
const JSDOM = require('jsdom').JSDOM

const db = require('../db')
const app = require('../app')

const expect = chai.expect
chai.use(chaiHttp)

const PORT = 8499
const INIT_DATA = {
  clients: [
    {id: '1', name: 'Default client'},
    {id: '2', name: 'Client 2'}
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

    it('should show the login page if no errors are found', async () => {
      const res = await chai.request(app).get('/authorize?client_id=1&response_type=token')
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
      const url = '/authorize?client_id=1&response_type=token'
      const res = await chai.request(app).get(url)

      expect(res).to.have.status(200)
      const { $, $$ } = getSelectors(res.text)

      const idInput = $('input#login_id')
      const loginID = idInput.getAttribute('value')
      session = await db.getLoginSessionByID(loginID)

      expect(session).to.be.not.null
      expect(session.id).to.equal(loginID)
      expect(session.client_id).to.equal('1')
      expect(session.response_type).to.equal('token')
      expect(session.originalUrl).to.equal(url)
    })
  })

  describe('/login', () => {
    let agent = null

    before(async () => {
      // Agent is used to preserve cookies
      agent = chai.request.agent(app)

      await db.createLoginSession({
        id: 'login-pqr123',
        client_id: '1',
        response_type: 'token',
        originalUrl: '/authorize?client_id=1&response_type=token',
      })
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

    it('should give unimplemented error for valid credentials', async () => {
      const res = await doPost('login-pqr123', 'test@example.com', 'pass')

      expect(res).to.have.status(501)
      expect(res).to.have.header('content-type', /^text\/html/)

      const { $, $$ } = getSelectors(res.text)
      expect($('title').text).to.equal('Error')
      expect($('p').textContent).to.equal('/login not fully implemented')
    })
  })
})

