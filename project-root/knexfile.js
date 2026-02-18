/**
 * Knex Configuration
 * 
 * Connects to PostgreSQL on Raspberry Pi via Tailscale.
 * Migration files live in /database/migrations/
 * 
 * Usage from project root:
 *   npx knex migrate:latest           -- apply all pending migrations
 *   npx knex migrate:rollback         -- undo last migration
 *   npx knex migrate:status           -- show which migrations have run
 *   npx knex migrate:make <name>      -- create a new migration file
 * 
 * The knex_migrations table is created automatically in the public schema
 * to track which migrations have been applied.
 */

require('dotenv').config({ path: './api/.env' });

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || '100.64.127.73',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'raspberry_123',
    },
    migrations: {
      directory: './database/migrations',
    },
    // Knex tracks applied migrations in this table
    // It creates it automatically on first run
    pool: {
      min: 1,
      max: 5,
    },
  },
};
