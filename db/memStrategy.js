let data = {
  clients: []
}

module.exports = {
  init: d => {
    data = d
  },

  shutdown: () => {
    data = []
  },

  getClientByID: id => data.clients.find(c => c.id === id)
}
