let data = {
  clients: [],
  login_sessions: [],
  users: [],
}

module.exports = {
  init: d => {
    if (d.clients) data.clients = d.clients
    if (d.login_sessions) data.login_sessions = d.login_sessions
    if (d.users) data.users = d.users
  },

  shutdown: () => {
    data = []
  },

  getClientByID: id => data.clients.find(c => c.id === id),

  createLoginSession: o => data.login_sessions.push(o),

  getLoginSessionByID: id => data.login_sessions.find(s => s.id === id),

  getUserByEmail: email => {
    const emailLower = email.toLowerCase()
    return data.users.find(u => u.email.toLowerCase() === emailLower)
  },
}
