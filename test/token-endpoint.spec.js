require('./login-endpoint.spec')

const chai = require('chai')
const chaiHttp = require('chai-http')

const helpers = require('./helpers')

const db = require('../db')
const utils = require('../utils')
const app = require('../app')

const expect = chai.expect
chai.use(chaiHttp)

const doPost = payload => chai.request(app).post('/token').send(payload)

const doAuthPost = (auth, payload) => chai.request(app).post('/token').set('Authorization', auth).send(payload)

describe('/token', () => {
  let server

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
  })

  it('should return invalid_request error if the grant_type param is missing', async () => {
    const res = await doPost({ client_id: '1', client_secret: 'sec1', code: 'abc' })
    expect(res).to.have.status(400)
    expect(res.body.error).to.equal('invalid_request')
    expect(res.body.error_description).to.equal(`Missing required parameter: grant_type`)
  })

  it('should return invalid_grant error if the grant type is not authzn code', async () => {
    const res = await doPost({ grant_type: 'implicit' })
    expect(res).to.have.status(400)
    expect(res.body.error).to.equal('unsupported_grant_type')
    expect(res.body.error_description).to.equal(`Unsupported grant type`)
  })

  describe('Client auth: authorization header specified', () => {
    it('should return invalid_client error for unsupported authorization header types', async () => {
      const test = async header => {
        const payload =  { grant_type: 'authorization_code', code: 'abc' }
        const res = await doAuthPost(header, payload)
        expect(res).to.have.status(401)
        expect(res.body.error).to.equal('invalid_client')
        expect(res.body.error_description).to.equal(`Unsupported authentication method`)
        expect(res).to.have.header('www-authenticate', 'Basic')
      }

      await test('pqr')
      await test('Basic')
      await test('basic')
      await test('basic ')
      await test('Bearer')
      await test('Bearer abc')
    })

    it('should return invalid_client error for invalid credentials in authzn header', async () => {
      const test = async creds => {
        const enc = utils.encodeBase64
        const payload =  { grant_type: 'authorization_code', code: 'abc' }
        const res = await doAuthPost(`Basic ${utils.encodeBase64(creds)}`, payload)
        expect(res).to.have.status(401)
        expect(res.body.error).to.equal('invalid_client')
        expect(res.body.error_description).to.equal(`Invalid client or secret`)
        expect(res).to.have.header('www-authenticate', 'Basic')
      }

      await test('abc')
      await test('1:')
      await test('1:sdf')
      await test('1000:sec1')
    })
  })

  describe('Client auth: authorization header not specified', () => {
    it('should return invalid_client error when either client_id or client_secret is missing in body', async () => {
      const test = async body => {
        const res = await doPost(body)
        expect(res).to.have.status(401)
        expect(res.body.error).to.equal('invalid_client')
        expect(res.body.error_description).to.equal(`Client authentication failed`)
        expect(res).to.not.have.header('www-authenticate')
      }

      const payload =  { grant_type: 'authorization_code', code: 'abc' }
      await test({ ...payload, client_id: '1' })
      await test({ ...payload, client_id: 'wrong_id' })
      await test({ ...payload, client_secret: 'sec1' })
    })

    it('should return invalid_client error when credentials in body are incorrect', async () => {
      const test = async body => {
        const res = await doPost(body)
        expect(res).to.have.status(401)
        expect(res.body.error).to.equal('invalid_client')
        expect(res.body.error_description).to.equal(`Invalid client or secret`)
        expect(res).to.not.have.header('www-authenticate')
      }

      const payload =  { grant_type: 'authorization_code', code: 'abc' }
      await test({ ...payload, client_id: 'wrong', client_secret: 'sec1' })
      await test({ ...payload, client_id: '1', client_secret: 'wrong' })
      await test({ ...payload, client_id: 'wrong', client_secret: 'wrong' })
      await test({ ...payload, client_id: '2', client_secret: 'sec1' })
      await test({ ...payload, client_id: '1', client_secret: 'sec2' })
    })
  })

  it('should return invalid_request error when the authorization code is not specified', async () => {
    const test = res => {
      expect(res).to.have.status(400)
      expect(res.body.error).to.equal('invalid_request')
      expect(res.body.error_description).to.equal(`Missing required parameter: code`)
    }

    /* Authorization header */
    const payload =  { grant_type: 'authorization_code' }
    const auth = utils.encodeBase64('1:sec1')
    let res = await doAuthPost(`Basic ${auth}`, payload)
    test(res)

    /* Credentials in body */
    res = await doPost({ ...payload, client_id: '1', client_secret: 'sec1' })
    test(res)
  })

  it('should return invalid_grant error when the authorization code is invalid', async () => {
    const auth = utils.encodeBase64('1:sec1')
    const res = await doAuthPost(`Basic ${auth}`, { grant_type: 'authorization_code', code: 'invalid' })
    expect(res).to.have.status(400)
    expect(res.body.error).to.equal('invalid_grant')
    expect(res.body.error_description).to.equal('Invalid authorization code')
  })

  it('should delete the authzn code from DB after it was retrieved', async () => {
    const auth = utils.encodeBase64('1:sec1')
    const res1 = await db.getAuthznCode('abcd1234')
    expect(res1).to.be.not.undefined
    await doAuthPost(`Basic ${auth}`, { grant_type: 'authorization_code', code: 'abcd1234' })
    const res2 = await db.getAuthznCode('abcd1234')
    expect(res2).to.be.undefined
  })

  it('should return invalid_grant error if authzn code is expired', async () => {
    const auth = utils.encodeBase64('1:sec1')
    const res = await doAuthPost(`Basic ${auth}`, { grant_type: 'authorization_code', code: 'abcd2345' })
    expect(res).to.have.status(400)
    expect(res.body.error).to.equal('invalid_grant')
    expect(res.body.error_description).to.equal('Invalid authorization code')
  })

  it('should return invalid_grant error if authzn code was issued to another client', async () => {
    const auth = utils.encodeBase64('1:sec1')
    const res = await doAuthPost(`Basic ${auth}`, { grant_type: 'authorization_code', code: 'abcd3456' })
    expect(res).to.have.status(400)
    expect(res.body.error).to.equal('invalid_grant')
    expect(res.body.error_description).to.equal('Invalid authorization code')
  })

  it('should return invalid_grant error if redirect URIs don\'t match', async () => {
    const auth = utils.encodeBase64('1:sec1')
    const res = await doAuthPost(`Basic ${auth}`, { grant_type: 'authorization_code', code: 'abcd1234', redirect_uri: 'http://localhost:8497' })
    expect(res).to.have.status(400)
    expect(res.body.error).to.equal('invalid_grant')
    expect(res.body.error_description).to.equal('Invalid redirect URI')
  })

  it('should return invalid_grant error if body has a redirect_uri, but the authzn code doesn\'t', async () => {
    const auth = utils.encodeBase64('1:sec1')
    const res = await doAuthPost(`Basic ${auth}`, { grant_type: 'authorization_code', code: 'abcd4567', redirect_uri: 'http://localhost:8498' })
    expect(res).to.have.status(400)
    expect(res.body.error).to.equal('invalid_grant')
    expect(res.body.error_description).to.equal('Invalid redirect URI')
  })

  it('should return invalid_grant error if body doesn\'t have a redirect_uri, but the authzn code does', async () => {
    const auth = utils.encodeBase64('1:sec1')
    const res = await doAuthPost(`Basic ${auth}`, { grant_type: 'authorization_code', code: 'abcd1234' })
    expect(res).to.have.status(400)
    expect(res.body.error).to.equal('invalid_grant')
    expect(res.body.error_description).to.equal('Invalid redirect URI')
  })

  it('should return an access token if no issues were found', async () => {
    const auth = utils.encodeBase64('1:sec1')
    const res = await doAuthPost(`Basic ${auth}`, { grant_type: 'authorization_code', code: 'abcd1234', redirect_uri: 'http://localhost:8498' })

    expect(res).to.have.status(200)
    expect(res).to.have.header('content-type', /^application\/json/)
    expect(res).to.have.header('cache-control', 'no-store')
    expect(res).to.have.header('pragma', 'no-cache')
    expect(res.body.access_token).to.match(/^at-.*/)
    expect(res.body.token_type).to.equal('Bearer')
    expect(res.body.expires_in).to.equal(3600)
  })
})
