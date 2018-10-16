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
      expect(res.text).to.equal('OIDC server')
    })
  })

  describe('/authorize', () => {
    const errCheck = async (path, status) => {
      const res = await chai.request(app).get(path)
      expect(res).to.have.status(status)

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

    it('should show unimplemented error if no other errors are found', async () => {
      const { $ } = await errCheck('/authorize?client_id=1&response_type=token', 501)
      expect($('p').textContent).to.equal('/authorize not fully implemented')
    })
  })
})

