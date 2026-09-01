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
  loadCampaigns();
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

// 3. Load Merchant Growth Campaigns
async function loadCampaigns() {
  const container = document.getElementById('campaigns-container');
  if (!container) return;

  try {
    const response = await fetch('/api/campaigns');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const campaigns = await response.json();
    container.innerHTML = '';

    if (!Array.isArray(campaigns) || campaigns.length === 0) {
      container.innerHTML = '<div class="empty-state">No campaigns created yet.</div>';
      return;
    }

    campaigns.forEach((camp) => {
      const card = renderCampaignCard(camp);
      container.appendChild(card);
    });
  } catch (error) {
    console.error('Error loading campaigns:', error);
    if (container) {
      container.innerHTML = '<div class="error-state">Unable to load campaigns. Please try again.</div>';
    }
  }
}

// Render individual campaign card
function renderCampaignCard(camp) {
  const card = document.createElement('div');
  card.className = 'campaign-card';

  // Human-friendly status badge mapping
  let statusText = 'DRAFT';
  let statusClass = 'status-draft';

  const rawStatus = (camp.status || '').toLowerCase();
  if (rawStatus === 'draft') {
    statusText = 'DRAFT';
    statusClass = 'status-draft';
  } else if (rawStatus === 'pending_approval') {
    statusText = 'PENDING APPROVAL';
    statusClass = 'status-pending_approval';
  } else if (rawStatus === 'approved') {
    statusText = 'APPROVED';
    statusClass = 'status-approved';
  } else if (rawStatus === 'rejected') {
    statusText = 'REJECTED';
    statusClass = 'status-rejected';
  } else if (rawStatus === 'completed' || rawStatus === 'executed') {
    statusText = 'COMPLETED';
    statusClass = 'status-completed';
  } else {
    statusText = rawStatus.toUpperCase().replace(/_/g, ' ');
    statusClass = `status-${rawStatus}`;
  }

  // Product A and Product B names
  const pAName = camp.productA ? camp.productA.name : 'Product A';
  const pBName = camp.productB ? camp.productB.name : 'Product B';
  const typeText = (camp.type || 'cross_sell').replace(/_/g, '-').toUpperCase();
  const segmentText = (camp.targetSegment || 'all').toUpperCase();

  // Workflow Control Buttons based strictly on backend state
  let actionButtonsHtml = '';
  if (rawStatus === 'draft') {
    actionButtonsHtml = `
      <button class="btn btn-primary" type="button" onclick="openSubmitModal(${camp.id})">
        <span>Submit for Approval</span>
      </button>
    `;
  } else if (rawStatus === 'pending_approval') {
    actionButtonsHtml = `
      <button class="btn btn-success" type="button" onclick="openApproveModal(${camp.id})">
        <span>Approve</span>
      </button>
      <button class="btn btn-danger" type="button" onclick="openRejectModal(${camp.id})">
        <span>Reject</span>
      </button>
    `;
  } else if (rawStatus === 'approved') {
    actionButtonsHtml = `
      <span class="approved-banner">✓ Approved</span>
    `;
  } else if (rawStatus === 'rejected') {
    actionButtonsHtml = `
      <button class="btn btn-secondary" type="button" onclick="openResetModal(${camp.id})">
        <span>Reset to Draft</span>
      </button>
    `;
  } else if (rawStatus === 'completed' || rawStatus === 'executed') {
    actionButtonsHtml = `
      <span class="completed-banner">✓ Completed</span>
    `;
  }

  card.innerHTML = `
    <div class="campaign-top-row">
      <h3 class="campaign-title">${escapeHtml(camp.title || '')}</h3>
      <span class="badge-status ${statusClass}">${escapeHtml(statusText)}</span>
    </div>

    <div class="campaign-relation">
      <span>${escapeHtml(pAName)}</span>
      <span>→</span>
      <span>${escapeHtml(pBName)}</span>
    </div>

    <div class="campaign-meta-row">
      <span class="badge-type">${escapeHtml(typeText)}</span>
      <span class="badge-segment">Segment: ${escapeHtml(segmentText)}</span>
    </div>

    <div class="campaign-metrics-grid">
      <div class="campaign-metric-item">
        <span class="campaign-metric-label">Discount</span>
        <span class="campaign-metric-value">${camp.discountPercent}%</span>
      </div>
      <div class="campaign-metric-item">
        <span class="campaign-metric-label">Budget Limit</span>
        <span class="campaign-metric-value">${formatCurrency(camp.budgetLimit)}</span>
      </div>
      <div class="campaign-metric-item">
        <span class="campaign-metric-label">Estimated Opportunity</span>
        <span class="campaign-metric-value highlight">${formatCurrency(camp.estimatedRevenueOpportunity)}</span>
      </div>
      <div class="campaign-metric-item">
        <span class="campaign-metric-label">Created Date</span>
        <span class="campaign-metric-value">${formatDate(camp.createdAt)}</span>
      </div>
    </div>

    <div class="campaign-actions-row">
      ${actionButtonsHtml}
      <button class="btn btn-outline" type="button" onclick="openAuditModal(${camp.id})">
        <span>View Audit</span>
      </button>
    </div>
  `;

  return card;
}

// ─── Workflow Confirmation & Rejection Modals ───
let activeWorkflowAction = null;

function openSubmitModal(campaignId) {
  openWorkflowModal({
    title: 'Submit Campaign?',
    message: 'Are you sure you want to submit this campaign for merchant approval?',
    confirmText: 'Submit',
    confirmClass: 'btn-primary',
    showReasonInput: false,
    onConfirm: () => handleWorkflowAction(campaignId, 'submit'),
  });
}

function openApproveModal(campaignId) {
  openWorkflowModal({
    title: 'Approve Campaign?',
    message: 'This will mark the campaign as approved. It will NOT execute the campaign or create any payment.',
    confirmText: 'Approve Campaign',
    confirmClass: 'btn-success',
    showReasonInput: false,
    onConfirm: () => handleWorkflowAction(campaignId, 'approve'),
  });
}

function openRejectModal(campaignId) {
  openWorkflowModal({
    title: 'Reject Campaign',
    message: 'Specify an optional reason for rejecting this campaign:',
    confirmText: 'Reject Campaign',
    confirmClass: 'btn-danger',
    showReasonInput: true,
    onConfirm: (reason) => handleWorkflowAction(campaignId, 'reject', { reason }),
  });
}

function openResetModal(campaignId) {
  openWorkflowModal({
    title: 'Reset Campaign?',
    message: 'This will move the rejected campaign back to draft.',
    confirmText: 'Reset to Draft',
    confirmClass: 'btn-secondary',
    showReasonInput: false,
    onConfirm: () => handleWorkflowAction(campaignId, 'reset'),
  });
}

function openWorkflowModal({ title, message, confirmText, confirmClass, showReasonInput, onConfirm }) {
  const overlay = document.getElementById('workflow-modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const msgEl = document.getElementById('modal-message');
  const inputContainer = document.getElementById('modal-input-container');
  const reasonInput = document.getElementById('reject-reason-input');
  const confirmBtn = document.getElementById('modal-confirm-btn');

  if (!overlay || !titleEl || !msgEl || !confirmBtn) return;

  titleEl.textContent = title;
  msgEl.textContent = message;
  confirmBtn.textContent = confirmText;
  confirmBtn.className = `btn ${confirmClass}`;

  if (showReasonInput) {
    inputContainer.classList.remove('hidden');
    reasonInput.value = '';
  } else {
    inputContainer.classList.add('hidden');
  }

  activeWorkflowAction = () => {
    const reason = showReasonInput ? reasonInput.value : null;
    onConfirm(reason);
  };

  confirmBtn.onclick = activeWorkflowAction;
  overlay.classList.remove('hidden');
}

function closeWorkflowModal() {
  const overlay = document.getElementById('workflow-modal-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
  activeWorkflowAction = null;
}

// Execute Workflow API Call (Submit / Approve / Reject / Reset)
async function handleWorkflowAction(campaignId, action, payload = null) {
  const confirmBtn = document.getElementById('modal-confirm-btn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = `${action.charAt(0).toUpperCase() + action.slice(1)}ing...`;
  }

  try {
    const response = await fetch(`/api/campaigns/${campaignId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error || data.message || `Failed to ${action} campaign.`;
      showToast(errMsg, 'error');
      if (confirmBtn) {
        confirmBtn.disabled = false;
      }
      return;
    }

    closeWorkflowModal();

    // Show appropriate success notification
    let toastMessage = 'Action completed successfully.';
    if (action === 'submit') toastMessage = '✓ Campaign submitted for approval';
    if (action === 'approve') toastMessage = '✓ Campaign approved successfully';
    if (action === 'reject') toastMessage = '✓ Campaign rejected';
    if (action === 'reset') toastMessage = '✓ Campaign reset to draft';

    showToast(toastMessage, 'success');

    // Refresh campaigns list from backend (Backend is source of truth)
    loadCampaigns();
  } catch (error) {
    console.error(`Error performing ${action} on campaign ${campaignId}:`, error);
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }
  }
}

// ─── Audit Trail Modal ───
async function openAuditModal(campaignId) {
  const overlay = document.getElementById('audit-modal-overlay');
  const container = document.getElementById('audit-timeline-container');
  const titleEl = document.getElementById('audit-modal-title');

  if (!overlay || !container) return;

  titleEl.textContent = `Campaign #${campaignId} Audit Trail`;
  container.innerHTML = '<div class="loading-state">Loading audit events...</div>';
  overlay.classList.remove('hidden');

  try {
    const response = await fetch(`/api/campaigns/${campaignId}/audit`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const auditLogs = await response.json();
    container.innerHTML = '';

    if (!Array.isArray(auditLogs) || auditLogs.length === 0) {
      container.innerHTML = '<div class="empty-state">No audit events recorded yet for this campaign.</div>';
      return;
    }

    auditLogs.forEach((log) => {
      const item = document.createElement('div');
      item.className = 'audit-item';

      let actionLabel = log.action.replace(/_/g, ' ').toUpperCase();
      let icon = '📝';
      if (log.action === 'campaign_submitted') icon = '📤';
      if (log.action === 'campaign_approved') icon = '✅';
      if (log.action === 'campaign_rejected') icon = '❌';
      if (log.action === 'campaign_reset') icon = '🔄';

      const actorLabel = (log.actor || 'merchant').toUpperCase();
      const reasonText = log.details && log.details.reason ? log.details.reason : null;

      item.innerHTML = `
        <div class="audit-icon">${icon}</div>
        <div class="audit-content">
          <span class="audit-action">${escapeHtml(actionLabel)}</span>
          <div class="audit-meta">
            <span>Actor: <strong>${escapeHtml(actorLabel)}</strong></span>
            <span>Date: ${formatDate(log.createdAt)}</span>
          </div>
          ${reasonText ? `<div class="audit-reason">Reason: "${escapeHtml(reasonText)}"</div>` : ''}
        </div>
      `;

      container.appendChild(item);
    });
  } catch (error) {
    console.error(`Error loading audit trail for campaign ${campaignId}:`, error);
    container.innerHTML = '<div class="error-state">Unable to load campaign audit history.</div>';
  }
}

function closeAuditModal() {
  const overlay = document.getElementById('audit-modal-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// ─── Toast Notifications ───
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✓';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `
    <span>${icon}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 4000);
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


