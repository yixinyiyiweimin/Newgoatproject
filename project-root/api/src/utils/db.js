const { Pool } = require('pg');
const config = require('../config/env');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  /**
   * Run a query and return all rows.
   * Always use parameterized queries ($1, $2...) to prevent SQL injection.
   */
  async query(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows;
  },

  /**
   * Run a query and return the first row, or null if no results.
   */
  async queryOne(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows[0] || null;
  },

  /**
   * Get a dedicated client for transactions.
   * Caller MUST call client.release() when done.
   */
  async getClient() {
    return await pool.connect();
  },

  pool,
};
