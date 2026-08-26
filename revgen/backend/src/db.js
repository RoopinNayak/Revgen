// ─────────────────────────────────────────────
// RevGen — PostgreSQL Connection Pool
// ─────────────────────────────────────────────
//
// This module creates a reusable connection pool
// using the `pg` package. Other backend modules
// can import this pool to run SQL queries.
//
// The connection string is read from the
// DATABASE_URL environment variable.
// ─────────────────────────────────────────────

const { Pool } = require('pg');

// Create a connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log when the pool connects successfully
pool.on('connect', () => {
  console.log('Connected to RevGen PostgreSQL database.');
});

// Log pool-level errors (e.g. lost connection)
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

// Export the pool so other modules can use it
module.exports = pool;
