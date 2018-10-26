const memStrategy = require('./memStrategy')

let initialized = false
let strategy = null

const init = async opts => {
  if (initialized) {
    throw new Error('ERROR: Initialized already initialized DB')
    return
  }

  if (opts.strategy === 'memory') {
    strategy = memStrategy
    if (!opts.data) {
      throw new Error('ERROR: Initial data not provided')
      return
    }
    await strategy.init(opts.data)
  } else {
    throw new Error('ERROR: Invalid DB strategy or no strategy provided')
  }

  initialized = true
}

const shutdown = async () => {
  await strategy.shutdown()
  strategy = null
  initialized = false
}

const getClientByID = id => strategy.getClientByID(id)
const createLoginSession = session => strategy.createLoginSession(session)
const getLoginSessionByID = id => strategy.getLoginSessionByID(id)
const deleteLoginSession = id => strategy.deleteLoginSession(id)
const getUserByEmail = email => strategy.getUserByEmail(email)
const createAuthznCode = code => strategy.createAuthznCode(code)
const getAuthznCode = code => strategy.getAuthznCode(code)
const deleteAuthznCode = code => strategy.deleteAuthznCode(code)
const createAccessToken = code => strategy.createAccessToken(code)

module.exports = {
  init,
  shutdown,
  getClientByID,
  createLoginSession,
  deleteLoginSession,
  getLoginSessionByID,
  getUserByEmail,
  createAuthznCode,
  getAuthznCode,
  deleteAuthznCode,
  createAccessToken,
}
