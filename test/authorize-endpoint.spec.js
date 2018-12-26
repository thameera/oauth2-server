require('./app.spec')

const chai = require('chai')
const chaiHttp = require('chai-http')
const moment = require('moment')

const helpers = require('./helpers')
const getSelectors = helpers.getSelectors

const db = require('../db')
const app = require('../app')

const expect = chai.expect
chai.use(chaiHttp)

describe('/authorize', () => {
  const origMomentNow = moment.now

  beforeEach(async () => {
    await db.init({
      strategy: 'memory',
      data: helpers.INIT_DATA
    })
    server = app.listen(helpers.PORT)
  })

  afterEach(() => {
    server.close()
    db.shutdown()
    moment.now = origMomentNow
  })

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

  const responseTypeErrCheck = async path => {
    const res = await chai.request(app).get(path).redirects(0)
    expect(res).to.have.status(302)
    const url = new URL(res.headers.location)
    const pathname = url.pathname.endsWith('/') ? url.pathname.slice(0, url.pathname.length - 1) : url.pathname
    return {
      path: url.origin + pathname,
      error: url.searchParams.get('error'),
      error_desc: url.searchParams.get('error_description'),
      state: url.searchParams.get('state')
    }
  }

  it('should look for a response type', async () => {
    const r = await responseTypeErrCheck('/authorize?client_id=1&redirect_uri=http://localhost:8498')
    expect(r.path).to.equal('http://localhost:8498')
    expect(r.error).to.equal('invalid_request')
    expect(r.error_desc).to.equal('Missing required parameter: response_type')
  })

  it('should detect an empty response type', async () => {
    const r = await responseTypeErrCheck('/authorize?client_id=1&redirect_uri=http://localhost:8498&response_type=')
    expect(r.path).to.equal('http://localhost:8498')
    expect(r.error).to.equal('invalid_request')
    expect(r.error_desc).to.equal('Missing required parameter: response_type')
  })

  it('should look validate the response type', async () => {
    const r = await responseTypeErrCheck('/authorize?client_id=1&redirect_uri=http://localhost:8498&response_type=pqr')
    expect(r.path).to.equal('http://localhost:8498')
    expect(r.error).to.equal('unsupported_response_type')
    expect(r.error_desc).to.equal('Invalid or unsupported response type')
  })

  it('should send back state when response type is invalid and a state was specified', async () => {
    let r = await responseTypeErrCheck('/authorize?client_id=1&redirect_uri=http://localhost:8498&state=abc123')
    expect(r.state).to.equal('abc123')

    r = await responseTypeErrCheck('/authorize?client_id=1&redirect_uri=http://localhost:8498&response_type=pqr&state=abc123')
    expect(r.state).to.equal('abc123')
  })

  it('should not send back state when response type is invalid and no state was specified', async () => {
    let r = await responseTypeErrCheck('/authorize?client_id=1&redirect_uri=http://localhost:8498')
    expect(r.state).to.be.null

    r = await responseTypeErrCheck('/authorize?client_id=1&redirect_uri=http://localhost:8498&response_type=pqr')
    expect(r.state).to.be.null
  })

  const loginPageCheck = res => {
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
  }

  it('should show the login page if no errors are found', async () => {
    // authzn code grant
    const res1 = await chai.request(app).get('/authorize?client_id=1&response_type=code')
    loginPageCheck(res1)

    // implicit grant
    const res2 = await chai.request(app).get('/authorize?client_id=1&response_type=token')
    loginPageCheck(res2)
  })

  const getLoginSession = async url => {
    const res = await chai.request(app).get(url)

    expect(res).to.have.status(200)
    const { $, $$ } = getSelectors(res.text)

    const idInput = $('input#login_id')
    const loginID = idInput.getAttribute('value')
    const session = await db.getLoginSessionByID(loginID)
    return { session, loginID }
  }

  const checkLoginSession = async url => {
    const FIXED_TIME = 1540117200000
    moment.now = () => +new Date(FIXED_TIME)

    const { session, loginID } = await getLoginSession(url)

    expect(session).to.be.not.undefined
    expect(session.id).to.equal(loginID)
    expect(session.client_id).to.equal('1')
    expect(session.originalUrl).to.equal(url)
    expect(session.expires_at).to.equal(FIXED_TIME + 8 * 60 * 60 * 1000)

    return session
  }

  it('should create a login session in DB with all details (code grant)', async () => {
    const session = await checkLoginSession('/authorize?client_id=1&response_type=code')
    expect(session.response_type).to.equal('code')
  })

  it('should create a login session in DB with all details (implicit grant)', async () => {
    const session = await checkLoginSession('/authorize?client_id=1&response_type=token')
    expect(session.response_type).to.equal('token')
  })

  it('should set redirect_uri in login session when a redirect uri is provided', async () => {
    const url = '/authorize?client_id=1&response_type=code&redirect_uri=http://localhost:8498'
    const { session } = await getLoginSession(url)

    expect(session).to.be.not.undefined
    expect(session.redirect_uri).to.equal('http://localhost:8498')
  })

  it('should not set redirect_uri in login session when a redirect uri is not provided', async () => {
    const url = '/authorize?client_id=1&response_type=code'
    const { session } = await getLoginSession(url)

    expect(session).to.be.not.undefined
    expect(session.redirect_uri).to.be.null
  })

  it('should set state in login session when a state is provided', async () => {
    const url = '/authorize?client_id=1&response_type=code&state=abc'
    const { session } = await getLoginSession(url)

    expect(session).to.be.not.undefined
    expect(session.state).to.equal('abc')
  })

  it('should not set state in login session when a state is not provided', async () => {
    const url = '/authorize?client_id=1&response_type=code'
    const { session } = await getLoginSession(url)

    expect(session).to.be.not.undefined
    expect(session.state).to.be.null
  })
})
