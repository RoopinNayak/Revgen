// ─────────────────────────────────────────────
// RevGen — AI Merchant Growth Agent
// Frontend Application (Vanilla JS)
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

function initDashboard() {
  loadDashboard();
  loadGrowthOpportunities();
  loadTopProducts();
  loadRecentOrders();
}

// Utility: Format currency in INR
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

// Utility: Format integer numbers
function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num);
}

// Utility: Format decimal probability as percentage string (e.g. 0.256 -> 25.6%)
function formatPercent(decimal) {
  if (typeof decimal !== 'number' || isNaN(decimal)) return '0.0%';
  return `${(decimal * 100).toFixed(1)}%`;
}

// Utility: Format lift ratio (e.g. 4.13 -> 4.13×)
function formatLift(lift) {
  if (typeof lift !== 'number' || isNaN(lift)) return '1.00×';
  return `${lift.toFixed(2)}×`;
}

// Utility: Format ISO date string
function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// Show error message banner (top of page)
function showError(message) {
  const banner = document.getElementById('error-banner');
  const errorMsg = document.getElementById('error-message');
  if (banner && errorMsg) {
    errorMsg.textContent = message;
    banner.classList.remove('hidden');
  }
}

// 1. Load Dashboard KPI Metrics
async function loadDashboard() {
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    document.getElementById('kpi-revenue').textContent = formatCurrency(data.totalRevenue);
    document.getElementById('kpi-orders').textContent = formatNumber(data.totalOrders);
    document.getElementById('kpi-aov').textContent = formatCurrency(data.averageOrderValue);
    document.getElementById('kpi-customers').textContent = formatNumber(data.totalCustomers);
    document.getElementById('kpi-products').textContent = formatNumber(data.totalProducts);
  } catch (error) {
    console.error('Error loading dashboard KPI metrics:', error);
    showError('Unable to load dashboard summary metrics.');
  }
}

// 2. Load Growth Opportunities
async function loadGrowthOpportunities() {
  const container = document.getElementById('opportunities-container');
  if (!container) return;

  try {
    const response = await fetch('/api/analytics/opportunities/explained?limit=5');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const opportunities = await response.json();
    container.innerHTML = '';

    if (!Array.isArray(opportunities) || opportunities.length === 0) {
      container.innerHTML = '<div class="empty-state">No growth opportunities found.</div>';
      return;
    }

    opportunities.forEach((opp, index) => {
      const card = renderOpportunityCard(opp, index);
      container.appendChild(card);
    });
  } catch (error) {
    console.error('Error loading growth opportunities:', error);
    if (container) {
      container.innerHTML = '<div class="error-state">Unable to load growth opportunities.</div>';
    }
  }
}

// Render individual opportunity card
function renderOpportunityCard(opp, index) {
  const card = document.createElement('div');
  card.className = 'opp-card';

  const priorityClass =
    opp.priority === 'HIGH'
      ? 'priority-high'
      : opp.priority === 'MEDIUM'
      ? 'priority-medium'
      : 'priority-low';

  const scorePct = Math.min(100, Math.max(0, opp.opportunityScore || 0));
  const exp = opp.explanation || {};

  const detailsPanelId = `opp-details-${index}`;
  const btnId = `opp-btn-${index}`;

  card.innerHTML = `
    <div class="opp-top-row">
      <span class="badge-priority ${priorityClass}">${escapeHtml(opp.priority)}</span>
      <div class="opp-score-box">
        <span class="opp-score-label">Opportunity Score</span>
        <span class="opp-score-value">${(opp.opportunityScore || 0).toFixed(1)} / 100</span>
        <div class="score-bar-bg">
          <div class="score-bar-fill" style="width: ${scorePct}%;"></div>
        </div>
      </div>
    </div>

    <h3 class="opp-title">${escapeHtml(exp.title || '')}</h3>
    <p class="opp-summary">${escapeHtml(exp.summary || '')}</p>

    <div class="opp-metrics-grid">
      <div class="opp-metric-item">
        <span class="opp-metric-label">Confidence</span>
        <span class="opp-metric-value">${formatPercent(opp.confidence)}</span>
      </div>
      <div class="opp-metric-item">
        <span class="opp-metric-label">Lift</span>
        <span class="opp-metric-value">${formatLift(opp.lift)}</span>
      </div>
      <div class="opp-metric-item">
        <span class="opp-metric-label">Orders Together</span>
        <span class="opp-metric-value">${formatNumber(opp.ordersWithBoth)}</span>
      </div>
      <div class="opp-metric-item">
        <span class="opp-metric-label">Missed</span>
        <span class="opp-metric-value">${formatNumber(opp.missedCustomers)}</span>
      </div>
      <div class="opp-metric-item" style="grid-column: span 2;">
        <span class="opp-metric-label">Potential Revenue</span>
        <span class="opp-metric-value highlight">${formatCurrency(opp.estimatedRevenueOpportunity)}</span>
      </div>
    </div>

    <button id="${btnId}" class="btn-details" type="button" aria-expanded="false" onclick="toggleDetailsPanel('${detailsPanelId}', '${btnId}')">
      <span>View Details</span>
      <span class="btn-details-arrow">▼</span>
    </button>

    <div id="${detailsPanelId}" class="opp-details-panel hidden">
      <div class="details-block">
        <span class="details-label">Why This Opportunity</span>
        <p class="details-text">${escapeHtml(exp.reason || '')}</p>
      </div>

      <div class="details-block">
        <span class="details-label">Recommendation</span>
        <p class="details-text">${escapeHtml(exp.recommendation || '')}</p>
      </div>

      <div class="details-block">
        <span class="details-label">Estimated Opportunity</span>
        <p class="details-text">${escapeHtml(exp.opportunity || '')}</p>
      </div>

      <p class="details-disclaimer">${escapeHtml(exp.disclaimer || '')}</p>
    </div>
  `;

  return card;
}

// Toggle View Details panel open/closed
function toggleDetailsPanel(panelId, btnId) {
  const panel = document.getElementById(panelId);
  const btn = document.getElementById(btnId);

  if (panel && btn) {
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
      panel.classList.remove('hidden');
      btn.classList.add('expanded');
      btn.setAttribute('aria-expanded', 'true');
      btn.querySelector('span').textContent = 'Hide Details';
    } else {
      panel.classList.add('hidden');
      btn.classList.remove('expanded');
      btn.setAttribute('aria-expanded', 'false');
      btn.querySelector('span').textContent = 'View Details';
    }
  }
}

// 3. Load Top Products
async function loadTopProducts() {
  const tbody = document.getElementById('top-products-body');
  try {
    const response = await fetch('/api/top-products');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const products = await response.json();
    tbody.innerHTML = '';

    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No top products found.</td></tr>';
      return;
    }

    products.forEach((product, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="rank-pill">${index + 1}</span></td>
        <td><strong>${escapeHtml(product.name)}</strong></td>
        <td><span class="badge-category">${escapeHtml(product.category)}</span></td>
        <td>${formatNumber(product.unitsSold)}</td>
        <td><strong>${formatCurrency(product.revenue)}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading top products:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Failed to load top products.</td></tr>';
    }
    showError('Unable to load top products list.');
  }
}

// 4. Load Recent Orders
async function loadRecentOrders() {
  const tbody = document.getElementById('recent-orders-body');
  try {
    const response = await fetch('/api/recent-orders');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const orders = await response.json();
    tbody.innerHTML = '';

    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No recent orders found.</td></tr>';
      return;
    }

    orders.forEach((order) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${order.id}</td>
        <td>${escapeHtml(order.customerName)}</td>
        <td><strong>${formatCurrency(order.totalAmount)}</strong></td>
        <td>${formatDate(order.createdAt)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading recent orders:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Failed to load recent orders.</td></tr>';
    }
    showError('Unable to load recent orders list.');
  }
}

// Helper to escape HTML and prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
