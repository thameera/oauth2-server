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
    it('should send back the OIDC Server home page', (done) => {
      chai.request(app)
        .get('/')
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res).to.have.status(200)
          expect(res.text).to.equal('OIDC server')
          done()
        })
    })
  })

  describe('/authorize', () => {
    const errCheck = (path, status, cb) => {
      chai.request(app)
        .get(path)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res).to.have.status(status)

          const { $, $$ } = getSelectors(res.text)
          expect($('title').text).to.equal('Error')
          cb($, $$)
        })
    }

    it('should look for a client ID', (done) => {
      errCheck('/authorize', 400, ($, $$) => {
        expect($('p').textContent).to.equal('Client ID missing')
        done()
      })
    })

    it('should detect an empty client ID', (done) => {
      errCheck('/authorize?client_id=', 400, ($, $$) => {
        expect($('p').textContent).to.equal('Client ID missing')
        done()
      })
    })

    it('should validate the client ID', (done) => {
      errCheck('/authorize?client_id=invalidID', 400, ($, $$) => {
        expect($('p').textContent).to.equal('Invalid client ID: invalidID')
        done()
      })
    })

    it('should show unimplemented error if no other errors are found', (done) => {
      errCheck('/authorize?client_id=1', 501, ($, $$) => {
        expect($('p').textContent).to.equal('/authorize not fully implemented')
        done()
      })
    })
  })
})

