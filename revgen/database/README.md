# RevGen — Database

This directory contains the database schema and seed scripts for RevGen.

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | PostgreSQL table definitions (6 tables) |
| `seed.js` | Synthetic data generator with realistic purchasing patterns |
| `package.json` | Dependencies for the seed script (`pg`) |

## Setup

```bash
# 1. Apply the schema (from the revgen/ root)
docker exec -i revgen-db psql -U postgres -d revgen < database/schema.sql

# 2. Install seed script dependencies
cd database
npm install

# 3. Seed the database
npm run seed

# 4. Verify data only (no changes)
npm run verify
```

## Reset & Reseed

Running `npm run seed` always resets the database first (deletes all existing rows), then generates a fresh dataset. The data is deterministic — same seed produces the same dataset every time.
