// ─────────────────────────────────────────────
// RevGen — AI Merchant Growth Agent
// Backend Server (Express)
// ─────────────────────────────────────────────

const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

const pool = require('./src/db');
const { getProductPairAnalytics } = require('./src/analytics/productPairs');
const { scoreOpportunities } = require('./src/analytics/opportunityScoring');
const { explainOpportunities } = require('./src/analytics/opportunityExplanation');
const { recommendCampaign } = require('./src/analytics/campaignRecommendation');
const {
  createCampaign,
  getAllCampaigns,
  getCampaignById,
} = require('./src/models/campaignModel');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

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

// 1. GET /api/dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    // Execute aggregate queries for overall business metrics
    const metricsQuery = `
      SELECT
        COALESCE(SUM(total_amount), 0) AS total_revenue,
        COUNT(*) AS total_orders,
        COALESCE(AVG(total_amount), 0) AS avg_order_value
      FROM orders
    `;

    const customersQuery = `SELECT COUNT(*) AS total_customers FROM customers`;
    const productsQuery = `SELECT COUNT(*) AS total_products FROM products`;

    const [metricsResult, customersResult, productsResult] = await Promise.all([
      pool.query(metricsQuery),
      pool.query(customersQuery),
      pool.query(productsQuery),
    ]);

    const metrics = metricsResult.rows[0];
    const totalCustomers = parseInt(customersResult.rows[0].total_customers, 10);
    const totalProducts = parseInt(productsResult.rows[0].total_products, 10);

    res.json({
      totalRevenue: parseFloat(metrics.total_revenue),
      totalOrders: parseInt(metrics.total_orders, 10),
      averageOrderValue: parseFloat(metrics.avg_order_value),
      totalCustomers: totalCustomers,
      totalProducts: totalProducts,
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to load dashboard data.',
    });
  }
});

// 2. GET /api/top-products
app.get('/api/top-products', async (req, res) => {
  try {
    const query = `
      SELECT
        p.id,
        p.name,
        p.category,
        SUM(oi.quantity)::INTEGER AS units_sold,
        SUM(oi.quantity * oi.price)::NUMERIC(12,2) AS revenue
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      GROUP BY p.id, p.name, p.category
      ORDER BY revenue DESC
      LIMIT 5
    `;

    const result = await pool.query(query);

    const topProducts = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      unitsSold: parseInt(row.units_sold, 10),
      revenue: parseFloat(row.revenue),
    }));

    res.json(topProducts);
  } catch (error) {
    console.error('Error fetching top products:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to load top products data.',
    });
  }
});

// 3. GET /api/recent-orders
app.get('/api/recent-orders', async (req, res) => {
  try {
    const query = `
      SELECT
        o.id AS order_id,
        c.name AS customer_name,
        o.total_amount,
        o.created_at
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `;

    const result = await pool.query(query);

    const recentOrders = result.rows.map((row) => ({
      id: row.order_id,
      customerName: row.customer_name,
      totalAmount: parseFloat(row.total_amount),
      createdAt: row.created_at,
    }));

    res.json(recentOrders);
  } catch (error) {
    console.error('Error fetching recent orders:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to load recent orders data.',
    });
  }
});

// 4. GET /api/analytics/product-pairs
app.get('/api/analytics/product-pairs', async (req, res) => {
  try {
    const minOrdersWithBoth = req.query.minBoth ? parseInt(req.query.minBoth, 10) : 5;
    const minConfidence = req.query.minConfidence ? parseFloat(req.query.minConfidence) : 0.05;
    const minLift = req.query.minLift ? parseFloat(req.query.minLift) : 1.0;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;

    const pairAnalytics = await getProductPairAnalytics({
      minOrdersWithBoth,
      minConfidence,
      minLift,
      limit,
    });

    res.json(pairAnalytics);
  } catch (error) {
    console.error('Error fetching product pair analytics:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to compute product pair analytics.',
    });
  }
});

// 5. GET /api/analytics/opportunities
app.get('/api/analytics/opportunities', async (req, res) => {
  try {
    const minOrdersWithBoth = req.query.minBoth ? parseInt(req.query.minBoth, 10) : 5;
    const minConfidence = req.query.minConfidence ? parseFloat(req.query.minConfidence) : 0.05;
    const minLift = req.query.minLift ? parseFloat(req.query.minLift) : 1.0;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;

    // Fetch candidate pairs from Stage 1 analytics
    const pairAnalytics = await getProductPairAnalytics({
      minOrdersWithBoth,
      minConfidence,
      minLift,
      limit,
    });

    // Score and rank opportunities using deterministic 4-component model
    const opportunities = scoreOpportunities(pairAnalytics);

    res.json(opportunities);
  } catch (error) {
    console.error('Error computing opportunity scores:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to compute opportunity scores.',
    });
  }
});

// 6. GET /api/analytics/opportunities/explained
app.get('/api/analytics/opportunities/explained', async (req, res) => {
  try {
    const minOrdersWithBoth = req.query.minBoth ? parseInt(req.query.minBoth, 10) : 5;
    const minConfidence = req.query.minConfidence ? parseFloat(req.query.minConfidence) : 0.05;
    const minLift = req.query.minLift ? parseFloat(req.query.minLift) : 1.0;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;

    // 1. Fetch candidate pairs from Stage 1 analytics
    const pairAnalytics = await getProductPairAnalytics({
      minOrdersWithBoth,
      minConfidence,
      minLift,
      limit,
    });

    // 2. Score and rank opportunities using Stage 2 scoring model
    const scoredOpportunities = scoreOpportunities(pairAnalytics);

    // 3. Generate structured merchant explanations for each opportunity
    const explainedOpportunities = explainOpportunities(scoredOpportunities);

    res.json(explainedOpportunities);
  } catch (error) {
    console.error('Error generating opportunity explanations:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to generate opportunity explanations.',
    });
  }
});

// 7. GET /api/campaigns/recommendation — Preview bounded campaign proposal
app.get('/api/campaigns/recommendation', async (req, res) => {
  try {
    const pAId = req.query.productAId ? parseInt(req.query.productAId, 10) : null;
    const pBId = req.query.productBId ? parseInt(req.query.productBId, 10) : null;

    // Fetch candidate pairs from analytics
    const pairAnalytics = await getProductPairAnalytics({
      minOrdersWithBoth: 1,
      minConfidence: 0.01,
      minLift: 1.0,
      limit: 200,
    });

    const scoredOpportunities = scoreOpportunities(pairAnalytics);

    let matchingOpp = null;
    if (pAId && pBId) {
      matchingOpp = scoredOpportunities.find(
        (opp) => opp.productA.id === pAId && opp.productB.id === pBId
      );
    } else {
      matchingOpp = scoredOpportunities[0];
    }

    if (!matchingOpp) {
      return res.status(404).json({
        error: 'Opportunity not found for specified product pair',
      });
    }

    const proposal = recommendCampaign(matchingOpp);
    res.json(proposal);
  } catch (error) {
    console.error('Error generating campaign recommendation:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to generate campaign recommendation preview.',
    });
  }
});

// 8. POST /api/campaigns — Create a campaign draft
app.post('/api/campaigns', async (req, res) => {
  try {
    const campaign = await createCampaign(req.body);
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Campaign creation error:', error.message);
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
});

// 9. GET /api/campaigns — List all campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await getAllCampaigns();
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch campaigns.',
    });
  }
});

// 10. GET /api/campaigns/:id — Fetch single campaign
app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found',
      });
    }
    res.json(campaign);
  } catch (error) {
    console.error(`Error fetching campaign ${req.params.id}:`, error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch campaign.',
    });
  }
});

// ─── Start Server ───────────────────────────
app.listen(PORT, () => {
  console.log(`RevGen API is running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`DB test:     http://localhost:${PORT}/api/db-test`);
  console.log(`Analytics:  http://localhost:${PORT}/api/analytics/product-pairs`);
  console.log(`Opportunities: http://localhost:${PORT}/api/analytics/opportunities`);
  console.log(`Explained:   http://localhost:${PORT}/api/analytics/opportunities/explained`);
  console.log(`Recommendation: http://localhost:${PORT}/api/campaigns/recommendation`);
  console.log(`Campaigns:   http://localhost:${PORT}/api/campaigns`);
  console.log(`Dashboard:   http://localhost:${PORT}`);
});





