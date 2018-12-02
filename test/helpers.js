const JSDOM = require('jsdom').JSDOM

/* Helper data */
const PORT = 8499

const INIT_DATA = {
  authzn_codes: [
    { code: 'abcd1234', context: { client_id: '1', redirect_uri: 'http://localhost:8498', email: 'test@example.com', expires_at: Date.now() + 50000 } },
    { code: 'abcd2345', context: { client_id: '1', redirect_uri: 'http://localhost:8498', email: 'test@example.com', expires_at: Date.now() } },
    { code: 'abcd3456', context: { client_id: '2', redirect_uri: 'http://localhost:8498', email: 'test@example.com', expires_at: Date.now() + 50000 } },
    { code: 'abcd4567', context: { client_id: '1', email: 'test@example.com', expires_at: Date.now() + 50000 } },
  ],
  clients: [
    {id: '1', secret: 'sec1', name: 'Default client', redirect_uris: ['http://localhost:8498', 'http://localhost:8497']},
    {id: '2', secret: 'sec2', name: 'Client 2', redirect_uris: ['http://localhost:8490']},
    {id: '3', secret: 'sec3', name: 'Client 3', redirect_uris: []},
  ],
  users: [
    {email: 'test@example.com', password: 'pass'},
  ],
}

/* Helper functions */

const getSelectors = html => {
  const document = new JSDOM(html).window.document
  return {
    $: s => document.querySelector(s),
    $$: s => document.querySelectorAll(s)
  }
}

module.exports = {
  PORT,
  INIT_DATA,
  getSelectors,
}
