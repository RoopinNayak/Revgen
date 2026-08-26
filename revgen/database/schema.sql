-- ─────────────────────────────────────────────
-- RevGen — AI Merchant Growth Agent
-- Database Schema
-- ─────────────────────────────────────────────
-- Run this file against the `revgen` database:
--
--   docker exec -i revgen-db psql -U postgres -d revgen < database/schema.sql
--
-- Uses CREATE TABLE IF NOT EXISTS so it can
-- safely be run more than once.
-- ─────────────────────────────────────────────


-- ─── 1. products ────────────────────────────
-- Stores the merchant's product catalog.

CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  category      VARCHAR(100) NOT NULL,
  price         NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  stock         INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  description   TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ─── 2. customers ───────────────────────────
-- Stores the merchant's customers.

CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  segment       VARCHAR(20) NOT NULL DEFAULT 'regular'
                  CHECK (segment IN ('budget', 'regular', 'premium')),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ─── 3. orders ──────────────────────────────
-- Represents customer orders.

CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  total_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON orders(customer_id);


-- ─── 4. order_items ─────────────────────────
-- Individual products contained in an order.
-- `price` captures the product price at purchase time,
-- since the current product price may change later.

CREATE TABLE IF NOT EXISTS order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id),
  product_id    INTEGER NOT NULL REFERENCES products(id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  price         NUMERIC(10, 2) NOT NULL CHECK (price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON order_items(product_id);


-- ─── 5. campaigns ───────────────────────────
-- AI-generated growth campaigns.
-- The 20% max discount is a business safety rule
-- enforced here as an extra layer. Application
-- code will also enforce this limit.

CREATE TABLE IF NOT EXISTS campaigns (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  type              VARCHAR(20) NOT NULL
                      CHECK (type IN ('upsell', 'cross_sell')),
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
                      CHECK (status IN (
                        'draft',
                        'pending_approval',
                        'approved',
                        'rejected',
                        'executing',
                        'completed',
                        'failed'
                      )),
  discount_percent  NUMERIC(5, 2) NOT NULL DEFAULT 0
                      CHECK (discount_percent >= 0 AND discount_percent <= 20),
  budget_limit      NUMERIC(12, 2) NOT NULL DEFAULT 0
                      CHECK (budget_limit >= 0),
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ─── 6. audit_logs ──────────────────────────
-- Records important actions by the AI agent,
-- merchant, and backend system.

CREATE TABLE IF NOT EXISTS audit_logs (
  id            SERIAL PRIMARY KEY,
  action        VARCHAR(255) NOT NULL,
  actor         VARCHAR(20) NOT NULL
                  CHECK (actor IN ('ai', 'merchant', 'system')),
  status        VARCHAR(20) NOT NULL
                  CHECK (status IN ('success', 'failed', 'rejected')),
  details       JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
