const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth.routes');
const db = require('./utils/db');

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS for frontend
app.use(express.json()); // Parse JSON bodies
app.use(morgan('dev')); // HTTP logging

// Health check endpoint (no auth required)
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1 AS healthy');
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: error.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
  console.log(`[ENV] Environment: ${config.nodeEnv}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[SERVER] SIGTERM received, closing server...');
  await db.pool.end();
  process.exit(0);
});
