const _ = require('lodash')

const DEFAULTS = {
  access_tokens: [],
  authzn_codes: [],
  clients: [],
  login_sessions: [],
  users: [],
}

let data = _.cloneDeep(DEFAULTS)

module.exports = {
  init: d => {
    if (d.access_tokens) data.access_tokens = _.cloneDeep(d.access_tokens)
    if (d.authzn_codes) data.authzn_codes = _.cloneDeep(d.authzn_codes)
    if (d.clients) data.clients = _.cloneDeep(d.clients)
    if (d.login_sessions) data.login_sessions = _.cloneDeep(d.login_sessions)
    if (d.users) data.users = _.cloneDeep(d.users)
  },

  shutdown: () => {
    data = _.cloneDeep(DEFAULTS)
  },

  getClientByID: id => data.clients.find(c => c.id === id),

  createLoginSession: o => data.login_sessions.push(o),

  getLoginSessionByID: id => data.login_sessions.find(s => s.id === id),

  deleteLoginSession: id => _.remove(data.login_sessions, s => s.id === id),

  getUserByEmail: email => {
    const emailLower = email.toLowerCase()
    return data.users.find(u => u.email.toLowerCase() === emailLower)
  },

  createAuthznCode: code => data.authzn_codes.push(code),

  getAuthznCode: code => data.authzn_codes.find(c => c.code === code),

  deleteAuthznCode: code => _.remove(data.authzn_codes, c => c.code === code),

  createAccessToken: at => data.access_tokens.push(at),
}
