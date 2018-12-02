const chai = require('chai')
const chaiHttp = require('chai-http')

const helpers = require('./helpers')

const app = require('../app')

const expect = chai.expect
chai.use(chaiHttp)

describe('/', () => {
  let server

  beforeEach(async () => {
    server = app.listen(helpers.PORT)
  })

  afterEach(() => {
    server.close()
  })

  it('should send back the OAuth Server home page', async () => {
    const res = await chai.request(app).get('/')
    expect(res).to.have.status(200)
    expect(res).to.have.header('content-type', /^text\/html/)
    expect(res.text).to.equal('OAuth 2.0 server')
  })
})

