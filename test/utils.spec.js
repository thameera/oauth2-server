const chai = require('chai')
const moment = require('moment')

const utils = require('../utils')

const expect = chai.expect

describe('Utils', () => {
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
})
