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
const {
  submitCampaign,
  approveCampaign,
  rejectCampaign,
  resetCampaign,
  getCampaignAuditLogs,
} = require('./src/models/campaignWorkflowModel');
const {
  executeCampaign,
  getExecutionByCampaignId,
  getAllExecutions,
} = require('./src/models/campaignExecutionModel');
const { runGrowthAgent } = require('./src/agents/growthAgent');
const { generateGrowthRecommendation } = require('./src/agents/growthRecommendationAgent');



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

// 10b. GET /api/campaigns/:id/details — Fetch campaign details, analytics evidence & guardrails
app.get('/api/campaigns/:id/details', async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found',
      });
    }

    let evidence = null;
    let explanation = null;

    if (campaign.productA && campaign.productB) {
      try {
        const pairAnalytics = await getProductPairAnalytics({
          minOrdersWithBoth: 1,
          minConfidence: 0.01,
          minLift: 1.0,
          limit: 200,
        });

        const scored = scoreOpportunities(pairAnalytics);
        const explained = explainOpportunities(scored);

        const match = explained.find(
          (o) => o.productA.id === campaign.productA.id && o.productB.id === campaign.productB.id
        );

        if (match) {
          evidence = {
            ordersWithA: match.ordersWithA,
            ordersWithB: match.ordersWithB,
            ordersWithBoth: match.ordersWithBoth,
            missedCustomers: match.missedCustomers,
            confidence: match.confidence,
            lift: match.lift,
            opportunityScore: match.opportunityScore,
            priority: match.priority,
            estimatedRevenueOpportunity: match.estimatedRevenueOpportunity,
          };
          explanation = match.explanation;
        }
      } catch (err) {
        console.warn('Could not link analytics evidence to campaign:', err.message);
      }
    }

    res.json({
      campaign,
      evidence,
      explanation,
      guardrails: {
        maxDiscountPercent: 20,
        maxBudgetLimit: 5000,
        merchantApprovalRequired: true,
        autoExecutionAllowed: false,
      },
    });
  } catch (error) {
    console.error(`Error fetching details for campaign ${req.params.id}:`, error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch campaign details.',
    });
  }
});


// 11. POST /api/campaigns/:id/submit — Submit draft campaign for approval
app.post('/api/campaigns/:id/submit', async (req, res) => {
  try {
    const campaign = await submitCampaign(req.params.id);
    res.json(campaign);
  } catch (error) {
    console.error(`Error submitting campaign ${req.params.id}:`, error.message);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.message,
    });
  }
});

// 12. POST /api/campaigns/:id/approve — Approve pending campaign
app.post('/api/campaigns/:id/approve', async (req, res) => {
  try {
    const campaign = await approveCampaign(req.params.id);
    res.json(campaign);
  } catch (error) {
    console.error(`Error approving campaign ${req.params.id}:`, error.message);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.message,
    });
  }
});

// 13. POST /api/campaigns/:id/reject — Reject pending campaign
app.post('/api/campaigns/:id/reject', async (req, res) => {
  try {
    const reason = req.body && req.body.reason ? req.body.reason : null;
    const campaign = await rejectCampaign(req.params.id, reason);
    res.json(campaign);
  } catch (error) {
    console.error(`Error rejecting campaign ${req.params.id}:`, error.message);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.message,
    });
  }
});

// 14. POST /api/campaigns/:id/reset — Reset rejected campaign to draft
app.post('/api/campaigns/:id/reset', async (req, res) => {
  try {
    const campaign = await resetCampaign(req.params.id);
    res.json(campaign);
  } catch (error) {
    console.error(`Error resetting campaign ${req.params.id}:`, error.message);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.message,
    });
  }
});

// 15. GET /api/campaigns/:id/audit — Fetch campaign audit logs
app.get('/api/campaigns/:id/audit', async (req, res) => {
  try {
    const auditLogs = await getCampaignAuditLogs(req.params.id);
    if (auditLogs === null) {
      return res.status(404).json({
        error: 'Campaign not found',
      });
    }
    res.json(auditLogs);
  } catch (error) {
    console.error(`Error fetching audit logs for campaign ${req.params.id}:`, error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch campaign audit logs.',
    });
  }
});

// 16. POST /api/campaigns/:id/execute — Safely simulate execution of approved campaign
app.post('/api/campaigns/:id/execute', async (req, res) => {
  try {
    const options = {
      forceFail: req.body && req.body.forceFail === true,
    };
    const result = await executeCampaign(req.params.id, options);
    res.json(result);
  } catch (error) {
    console.error(`Execution error for campaign ${req.params.id}:`, error.message);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.message,
    });
  }
});

// 17. GET /api/campaigns/:id/execution — Fetch execution record for campaign
app.get('/api/campaigns/:id/execution', async (req, res) => {
  try {
    const execution = await getExecutionByCampaignId(req.params.id);
    if (!execution) {
      return res.status(404).json({
        error: 'Execution record not found for this campaign',
      });
    }
    res.json({ execution });
  } catch (error) {
    console.error(`Error fetching execution for campaign ${req.params.id}:`, error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch campaign execution.',
    });
  }
});

// 18. GET /api/executions — List all campaign executions
app.get('/api/executions', async (req, res) => {
  try {
    const executions = await getAllExecutions();
    res.json(executions);
  } catch (error) {
    console.error('Error fetching all executions:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch executions list.',
    });
  }
});

// 19. GET /api/agent/growth-preview — Read-only AI Growth Agent preview analysis
app.get('/api/agent/growth-preview', async (req, res) => {
  try {
    const pairAnalytics = await getProductPairAnalytics({
      minOrdersWithBoth: 1,
      minConfidence: 0.01,
      minLift: 1.0,
      limit: 100,
    });

    const scored = scoreOpportunities(pairAnalytics);
    const explained = explainOpportunities(scored);

    if (!explained || explained.length === 0) {
      return res.status(404).json({
        error: 'No growth opportunities available for agent analysis preview.',
      });
    }

    // Optional query parameter filtering by productAId & productBId
    let selectedOpp = explained[0];
    const pAId = parseInt(req.query.productAId, 10);
    const pBId = parseInt(req.query.productBId, 10);

    if (!isNaN(pAId) && !isNaN(pBId)) {
      const match = explained.find((o) => o.productA.id === pAId && o.productB.id === pBId);
      if (match) {
        selectedOpp = match;
      }
    }

    const agentResult = runGrowthAgent(selectedOpp);
    res.json(agentResult);
  } catch (error) {
    console.error('Error running AI Growth Agent preview:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to generate Growth Agent preview analysis.',
    });
  }
});

const { getRelevantMemory, summarizeMemory } = require('./src/agents/agentMemory');

// 20. GET /api/agent/growth-recommendation-preview — Read-only Growth Agent campaign recommendation preview
app.get('/api/agent/growth-recommendation-preview', async (req, res) => {
  try {
    const pairAnalytics = await getProductPairAnalytics({
      minOrdersWithBoth: 1,
      minConfidence: 0.01,
      minLift: 1.0,
      limit: 100,
    });

    const scored = scoreOpportunities(pairAnalytics);
    const explained = explainOpportunities(scored);

    if (!explained || explained.length === 0) {
      return res.status(404).json({
        error: 'No growth opportunities available for recommendation preview.',
      });
    }

    // Optional query parameter filtering by productAId & productBId
    let selectedOpp = explained[0];
    const pAId = parseInt(req.query.productAId, 10);
    const pBId = parseInt(req.query.productBId, 10);

    if (!isNaN(pAId) && !isNaN(pBId)) {
      const match = explained.find((o) => o.productA.id === pAId && o.productB.id === pBId);
      if (match) {
        selectedOpp = match;
      }
    }

    // Query historical merchant decision memory (Read-only)
    const relMemories = await getRelevantMemory(selectedOpp);
    const memorySummary = summarizeMemory(relMemories);

    const recommendationResult = generateGrowthRecommendation(selectedOpp, memorySummary);
    res.json(recommendationResult);
  } catch (error) {
    console.error('Error running Growth Agent recommendation preview:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to generate Growth Agent recommendation preview.',
    });
  }
});

// 20b. GET /api/agent/memory/:campaignId — Read-only endpoint for historical merchant decisions
app.get('/api/agent/memory/:campaignId', async (req, res) => {
  try {
    const campaignId = req.params.campaignId;
    const campaign = await getCampaignById(campaignId);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    const relMemories = await getRelevantMemory({
      productA: campaign.productA,
      productB: campaign.productB,
      type: campaign.type,
      priority: 'MEDIUM',
    });

    const memorySummary = summarizeMemory(relMemories);
    res.json({
      campaignId: parseInt(campaignId, 10),
      memory: memorySummary,
    });
  } catch (error) {
    console.error(`Error fetching agent memory for campaign ${req.params.campaignId}:`, error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch agent memory.',
    });
  }
});

// 21. GET /api/agent/pipeline/:campaignId — Read-only AI Growth Pipeline state trace
app.get('/api/agent/pipeline/:campaignId', async (req, res) => {
  try {
    const campaignId = req.params.campaignId;
    const campaign = await getCampaignById(campaignId);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }

    const auditLogs = await getCampaignAuditLogs(campaignId);

    // Fetch opportunity analytics to produce agent reasoning & recommendation trace
    let opportunity = null;
    let agentResult = null;
    let recommendationResult = null;

    try {
      const pairAnalytics = await getProductPairAnalytics({
        minOrdersWithBoth: 1,
        minConfidence: 0.01,
        minLift: 1.0,
        limit: 100,
      });
      const scored = scoreOpportunities(pairAnalytics);
      const explained = explainOpportunities(scored);

      const match = explained.find(
        (o) => o.productA.id === campaign.productAId && o.productB.id === campaign.productBId
      );

      if (match) {
        opportunity = match;
      } else if (explained.length > 0) {
        opportunity = explained[0];
      }
    } catch (err) {
      console.warn('Pipeline opportunity lookup note:', err.message);
    }

    if (opportunity) {
      try {
        agentResult = runGrowthAgent(opportunity);
        recommendationResult = generateGrowthRecommendation(opportunity);
      } catch (err) {
        console.warn('Pipeline agent execution note:', err.message);
      }
    }

    res.json({
      campaign,
      opportunity: opportunity || {
        productA: campaign.productA,
        productB: campaign.productB,
        estimatedRevenueOpportunity: campaign.estimatedRevenueOpportunity,
      },
      agentAnalysis: agentResult ? agentResult.analysis : null,
      recommendation: recommendationResult ? recommendationResult.recommendation : null,
      workflow: {
        currentStatus: campaign.status,
        auditLogs: auditLogs || [],
      },
      guardrails: {
        maxDiscountPercent: 20,
        maxBudgetLimit: 5000,
        merchantApprovalRequired: true,
        autoExecutionAllowed: false,
      },
    });
  } catch (error) {
    console.error(`Error fetching pipeline for campaign ${req.params.campaignId}:`, error.message);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch AI Growth Pipeline trace.',
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
  console.log(`Agent Preview: http://localhost:${PORT}/api/agent/growth-preview`);
  console.log(`Agent Rec Preview: http://localhost:${PORT}/api/agent/growth-recommendation-preview`);
  console.log(`Agent Pipeline: http://localhost:${PORT}/api/agent/pipeline/:campaignId`);
  console.log(`Campaigns:   http://localhost:${PORT}/api/campaigns`);
  console.log(`Executions:  http://localhost:${PORT}/api/executions`);
  console.log(`Dashboard:   http://localhost:${PORT}`);
});










