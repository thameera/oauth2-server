const chai = require('chai')
const chaiHttp = require('chai-http')
const JSDOM = require('jsdom').JSDOM

const app = require('../app')

const expect = chai.expect
chai.use(chaiHttp)

const PORT = 8499

const getSelectors = html => {
  const document = new JSDOM(html).window.document
  return {
    $: s => document.querySelector(s),
    $$: s => document.querySelectorAll(s)
  }
}

describe('App', () => {
  let server

  before(() => {
    server = app.listen(PORT)
  })

  after(() => {
    server.close()
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
  })
})

