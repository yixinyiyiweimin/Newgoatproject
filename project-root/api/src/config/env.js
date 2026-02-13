require('dotenv').config();

const env = {
  PORT: process.env.PORT || 3000,
  POSTGREST_URL: process.env.POSTGREST_URL || 'https://raspberrypi.tail08c084.ts.net:10000',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
};

// Validate required env vars
if (!env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in .env');
  process.exit(1);
}

module.exports = env;
