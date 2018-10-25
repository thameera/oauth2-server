const chai = require('chai')
const moment = require('moment')

const utils = require('../utils')

const expect = chai.expect

describe('Utils', () => {
  describe('encodeBase64()', () => {
    it('should correctly encode ascii values to base64', () => {
      expect(utils.encodeBase64('abc')).to.equal('YWJj')
      expect(utils.encodeBase64('x123:PQ')).to.equal('eDEyMzpQUQ==')
    })
  })

  describe('decodeBase64()', () => {
    it('should correctly decode base64 values to strings', () => {
      expect(utils.decodeBase64('YWJj')).to.equal('abc')
      expect(utils.decodeBase64('eDEyMzpQUQ==')).to.equal('x123:PQ')
    })
  })

  describe('getExpiryTime()', () => {
    const origNow = moment.now
    const FIXED_TIME = 1540117000000

    before(() => {
      moment.now = () => +new Date(FIXED_TIME)
    })

    after(() => {
      moment.now = () => origNow
    })

    it('should add time specified by the rule in minutes', () => {
      const exp = utils.getExpiryTime({ value: 7, unit: 'minutes' })
      expect(exp).to.equal(FIXED_TIME + 7 * 60 * 1000)
    })

    it('should add time specified by the rule in hours', () => {
      const exp = utils.getExpiryTime({ value: 2, unit: 'hours' })
      expect(exp).to.equal(FIXED_TIME + 2 * 60 * 60 * 1000)
    })
  })

  describe('isExpired()', () => {
    const origNow = moment.now
    const FIXED_TIME = 1540117000000

    before(() => {
      moment.now = () => +new Date(FIXED_TIME)
    })

    after(() => {
      moment.now = () => origNow
    })

    it('should return true for expired dates', () => {
      expect(utils.isExpired(FIXED_TIME - 1000)).to.be.true
    })

    it('should return false for non-expired dates', () => {
      expect(utils.isExpired(FIXED_TIME + 1000)).to.be.false
    })
  })
})
