let data = {
  clients: [],
  login_sessions: []
}

module.exports = {
  init: d => {
    if (d.clients) data.clients = d.clients
    if (d.login_sessions) data.login_sessions = d.login_sessions
  },

  shutdown: () => {
    data = []
  },

  getClientByID: id => data.clients.find(c => c.id === id),

  createLoginSession: o => data.login_sessions.push(o),

  getLoginSessionByID: id => data.login_sessions.find(s => s.id === id),
}
