// ─────────────────────────────────────────────
// RevGen — AI Merchant Growth Agent
// Backend Server (Express)
// ─────────────────────────────────────────────

const express = require('express');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const pool = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────
app.use(express.json());

// ─── Routes ─────────────────────────────────

// Health-check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RevGen API',
  });
});

// Database test endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');

    res.json({
      status: 'ok',
      database: 'revgen',
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error('Database connection error:', error.message);

    res.status(500).json({
      status: 'error',
      message: 'Unable to connect to the database.',
    });
  }
});

// ─── Start Server ───────────────────────────
app.listen(PORT, () => {
  console.log(`RevGen API is running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`DB test:     http://localhost:${PORT}/api/db-test`);
});
