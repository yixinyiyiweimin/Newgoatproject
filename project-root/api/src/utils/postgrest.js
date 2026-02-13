// PostgREST HTTP client wrapper
// Per BLL.md Part 5 - Every service uses this to talk to the database
const axios = require('axios');
const env = require('../config/env');

const client = axios.create({ baseURL: env.POSTGREST_URL });

module.exports = {
  // GET with filters
  async get(schema, table, params = {}, headers = {}) {
    const res = await client.get(`/${schema}/${table}`, { params, headers });
    return res.data;
  },

  // POST (create)
  async create(schema, table, body) {
    const res = await client.post(`/${schema}/${table}`, body, {
      headers: { Prefer: 'return=representation' }
    });
    return res.data;
  },

  // PATCH (update) with filter
  async update(schema, table, filter, body) {
    const res = await client.patch(`/${schema}/${table}?${filter}`, body, {
      headers: { Prefer: 'return=representation' }
    });
    return res.data;
  },

  // DELETE with filter
  async remove(schema, table, filter) {
    await client.delete(`/${schema}/${table}?${filter}`);
  }
};
