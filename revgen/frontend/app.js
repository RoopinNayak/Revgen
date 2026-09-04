// ─────────────────────────────────────────────
// RevGen — AI Merchant Growth Agent
// Frontend Application (Vanilla JS)
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();

  // Accessibility: Allow Escape key to close active modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeWorkflowModal();
      closeAuditModal();
      closeDetailsModal();
      closeCreateModal();
    }
  });
});


function initDashboard() {
  loadDashboard();
  loadCampaigns();
  loadRevenueDashboard();
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

// Utility: Escape HTML to prevent XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
window.loadedOpportunities = [];

async function loadGrowthOpportunities() {
  const container = document.getElementById('opportunities-container');
  if (!container) return;

  try {
    const response = await fetch('/api/analytics/opportunities/explained?limit=5');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const opportunities = await response.json();
    window.loadedOpportunities = opportunities;
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

    <div style="display: flex; gap: var(--spacing-sm);">
      <button class="btn btn-primary" style="flex: 1;" type="button" onclick="openCreateModalFromOpportunityIndex(${index})">
        <span>Create Campaign</span>
      </button>
      <button id="${btnId}" class="btn-details" style="flex: 1;" type="button" aria-expanded="false" onclick="toggleDetailsPanel('${detailsPanelId}', '${btnId}')">
        <span>View Details</span>
        <span class="btn-details-arrow">▼</span>
      </button>
    </div>

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
      <button class="btn btn-primary" type="button" id="exec-btn-${camp.id}" onclick="openExecuteModal(${camp.id})">
        <span>🚀 Execute Campaign</span>
      </button>
    `;
  } else if (rawStatus === 'executing') {
    actionButtonsHtml = `
      <span class="executing-banner">⏳ Executing...</span>
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
      <button class="btn btn-outline btn-sm" type="button" onclick="openExecutionResultModal(${camp.id})">
        <span>View Execution</span>
      </button>
    `;
  } else if (rawStatus === 'failed') {
    actionButtonsHtml = `
      <span class="failed-banner">✗ Failed</span>
      <button class="btn btn-secondary btn-sm" type="button" onclick="openResetModal(${camp.id})">
        <span>Reset to Draft</span>
      </button>
      <button class="btn btn-outline btn-sm" type="button" onclick="openAuditModal(${camp.id})">
        <span>View Audit</span>
      </button>
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
      <button class="btn btn-outline" type="button" onclick="openDetailsModal(${camp.id})">
        <span>View Details</span>
      </button>
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
      let badgeClass = '';

      if (log.action === 'campaign_submitted') { icon = '📤'; actionLabel = 'Campaign Submitted for Review'; }
      if (log.action === 'campaign_approved') { icon = '✅'; actionLabel = 'Campaign Approved'; badgeClass = 'audit-badge-success'; }
      if (log.action === 'campaign_rejected') { icon = '❌'; actionLabel = 'Campaign Rejected'; badgeClass = 'audit-badge-danger'; }
      if (log.action === 'campaign_reset') { icon = '🔄'; actionLabel = 'Campaign Reset to Draft'; }
      if (log.action === 'campaign_execution_started') { icon = '🚀'; actionLabel = 'Execution Started'; badgeClass = 'audit-badge-executing'; }
      if (log.action === 'razorpay_test_order_created') { icon = '⚡'; actionLabel = 'Razorpay Test Order Created'; badgeClass = 'audit-badge-razorpay'; }
      if (log.action === 'campaign_execution_completed') { icon = '✓'; actionLabel = 'Execution Completed'; badgeClass = 'audit-badge-success'; }
      if (log.action === 'campaign_execution_failed') { icon = '❌'; actionLabel = 'Execution Failed'; badgeClass = 'audit-badge-danger'; }
      if (log.action === 'duplicate_execution_prevented') { icon = 'ℹ️'; actionLabel = 'Duplicate Execution Prevented'; }

      const actorLabel = (log.actor || 'merchant').toUpperCase();
      const d = log.details || {};
      const reasonText = d.reason || null;
      const errorText = d.error || null;
      const orderId = d.razorpayOrderId || null;
      const mode = d.executionMode || null;
      const amountINR = d.amountINR || d.transactionAmountINR || null;

      item.innerHTML = `
        <div class="audit-icon">${icon}</div>
        <div class="audit-content">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="audit-action">${escapeHtml(actionLabel)}</span>
            ${mode ? `<span class="tx-badge badge-${mode === 'razorpay_test' ? 'razorpay' : 'simulation'}">${mode === 'razorpay_test' ? '⚡ Razorpay Test' : '🔬 Simulation'}</span>` : ''}
          </div>
          <div class="audit-meta">
            <span>Actor: <strong>${escapeHtml(actorLabel)}</strong></span>
            <span>Date: ${formatDate(log.createdAt)}</span>
          </div>
          ${orderId ? `<div class="audit-order-box">Order ID: <code class="order-id-chip">${escapeHtml(orderId)}</code> &middot; Amount: <strong>${formatCurrency(amountINR || 0)}</strong> (Test Mode)</div>` : ''}
          ${errorText ? `
            <div class="audit-error-box">
              <span class="audit-error-title">Failure Reason:</span>
              <span>${escapeHtml(errorText)}</span>
              <div class="audit-trust-note">🛡️ Safety Guarantee: No fake order created &middot; No real money charged &middot; Campaign marked failed</div>
            </div>
          ` : ''}
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

// ─── Campaign Details & Analytics Evidence Modal ───
async function openDetailsModal(campaignId) {
  const overlay = document.getElementById('details-modal-overlay');
  const bodyContainer = document.getElementById('details-modal-body');
  const footerContainer = document.getElementById('details-modal-footer');
  const titleEl = document.getElementById('details-modal-title');

  if (!overlay || !bodyContainer || !footerContainer) return;

  if (titleEl) {
    titleEl.textContent = `Campaign #${campaignId} Details & AI Growth Pipeline Trace`;
  }
  bodyContainer.innerHTML = '<div class="loading-state">Loading AI Growth Pipeline trace...</div>';
  overlay.classList.remove('hidden');

  try {
    const response = await fetch(`/api/agent/pipeline/${campaignId}`);
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const camp = data.campaign || {};
    const ev = data.opportunity || {};
    const agentAnalysis = data.agentAnalysis || {};
    const exp = data.explanation || {};
    const gr = data.guardrails || {};

    const pAName = camp.productA ? camp.productA.name : (ev.productA ? ev.productA.name : 'Product A');
    const pBName = camp.productB ? camp.productB.name : (ev.productB ? ev.productB.name : 'Product B');
    const rawStatus = (camp.status || 'draft').toLowerCase();

    const statusMap = {
      draft: 'DRAFT',
      pending_approval: 'PENDING APPROVAL',
      approved: 'APPROVED',
      rejected: 'REJECTED',
      completed: 'COMPLETED',
    };

    const statusText = statusMap[rawStatus] || rawStatus.toUpperCase();
    const statusClass = `status-${rawStatus}`;

    const priorityClass =
      ev.priority === 'HIGH'
        ? 'priority-high'
        : ev.priority === 'MEDIUM'
        ? 'priority-medium'
        : 'priority-low';

    // 1. Render Pipeline Stepper Progress
    const isApproved = rawStatus === 'approved';
    const isPending = rawStatus === 'pending_approval';
    const isRejected = rawStatus === 'rejected';

    const pipelineStepperHtml = `
      <div class="details-section-title">⚡ AI Growth Decision Pipeline Trace</div>
      <div class="pipeline-stepper" style="background: rgba(0,0,0,0.2); padding: var(--spacing-sm); border-radius: var(--radius-md); margin-bottom: var(--spacing-sm);">
        <div class="pipeline-step active">
          <div class="step-badge">1</div>
          <div class="step-title">Opportunity</div>
          <div class="step-desc">${escapeHtml(pAName)} → ${escapeHtml(pBName)}</div>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="pipeline-step active">
          <div class="step-badge">2</div>
          <div class="step-title">Growth Agent</div>
          <div class="step-desc">Analyzed</div>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="pipeline-step active">
          <div class="step-badge">3</div>
          <div class="step-title">Recommendation</div>
          <div class="step-desc">${camp.discountPercent}% / ${formatCurrency(camp.budgetLimit)}</div>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="pipeline-step active">
          <div class="step-badge">4</div>
          <div class="step-title">Draft Created</div>
          <div class="step-desc">Campaign #${camp.id}</div>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="pipeline-step ${isApproved ? 'active' : (isPending ? 'active' : (isRejected ? 'active' : ''))}">
          <div class="step-badge">5</div>
          <div class="step-title">Merchant Review</div>
          <div class="step-desc">${escapeHtml(statusText)}</div>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="pipeline-step ${rawStatus === 'completed' || rawStatus === 'executing' ? 'active' : 'disabled'}">
          <div class="step-badge">6</div>
          <div class="step-title">Razorpay Execution</div>
          <div class="step-desc">${rawStatus === 'completed' ? '✓ Test Mode Order Created' : (isApproved ? 'Ready for Execution' : 'Awaiting Approval')}</div>
        </div>
      </div>
    `;

    // 2. Render AI Agent Decision Summary & Quality Meters
    let agentSummaryHtml = '';
    if (agentAnalysis && agentAnalysis.reasoning) {
      const oppStrength = agentAnalysis.opportunityStrength || 'STRONG';
      const recConfScore = Math.round((agentAnalysis.recommendationConfidence || 0.85) * 100);
      const recConfLabel = agentAnalysis.recommendationConfidenceLabel || 'HIGH';
      const isReviewRequired = agentAnalysis.recommendationStatus === 'REVIEW_REQUIRED';

      const strengthClass = oppStrength.toLowerCase().replace(/_/g, '-');

      agentSummaryHtml = `
        <div class="details-section-title">🤖 AI Growth Agent Decision Center &amp; Quality Analysis</div>
        
        <!-- Decision Quality & Confidence Meters -->
        <div class="decision-meter-container">
          <div class="meter-card">
            <span class="meter-label">Opportunity Strength</span>
            <div class="meter-val-row">
              <span class="badge-priority priority-${strengthClass === 'very-strong' || strengthClass === 'strong' ? 'high' : (strengthClass === 'moderate' ? 'medium' : 'low')}">${escapeHtml(oppStrength.replace(/_/g, ' '))}</span>
            </div>
            <div class="meter-bar">
              <div class="meter-fill ${strengthClass}" style="width: ${oppStrength === 'VERY_STRONG' ? '95%' : (oppStrength === 'STRONG' ? '80%' : (oppStrength === 'MODERATE' ? '55%' : '30%'))}"></div>
            </div>
          </div>

          <div class="meter-card">
            <span class="meter-label">Recommendation Confidence</span>
            <div class="meter-val-row">
              <span>${recConfScore}% (${escapeHtml(recConfLabel)})</span>
            </div>
            <div class="meter-bar">
              <div class="meter-fill" style="width: ${recConfScore}%"></div>
            </div>
          </div>
        </div>

        ${isReviewRequired || agentAnalysis.reviewReason ? `
          <div class="review-required-banner">
            <strong>⚠️ REVIEW REQUIRED:</strong> ${escapeHtml(agentAnalysis.reviewReason || 'The available evidence requires merchant discretion. Review the opportunity metrics carefully before creating or approving a proposal.')}
          </div>
        ` : ''}

        <div class="details-block" style="background: rgba(99, 102, 241, 0.08); padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); border-left: 3px solid var(--accent-light); margin-top: 8px;">
          <span class="details-label">Agent Reasoning</span>
          <p class="details-text">${escapeHtml(agentAnalysis.reasoning)}</p>
        </div>

        <!-- Business Impact Cards -->
        ${agentAnalysis.businessImpact ? `
          <div class="business-impact-grid">
            <div class="impact-card">
              <div class="impact-card-title">Customer Behavior</div>
              <div class="impact-card-desc">${escapeHtml(agentAnalysis.businessImpact.customerBehaviorStrength || '')}</div>
            </div>
            <div class="impact-card">
              <div class="impact-card-title">Opportunity Size</div>
              <div class="impact-card-desc">${escapeHtml(agentAnalysis.businessImpact.opportunitySize || '')}</div>
            </div>
            <div class="impact-card">
              <div class="impact-card-title">Revenue Upside</div>
              <div class="impact-card-desc">${escapeHtml(agentAnalysis.businessImpact.revenuePotential || '')}</div>
            </div>
            <div class="impact-card">
              <div class="impact-card-title">Strategic Alignment</div>
              <div class="impact-card-desc">${escapeHtml(agentAnalysis.businessImpact.strategicValue || '')}</div>
            </div>
          </div>
        ` : ''}

        <!-- Decision Rationales -->
        ${data.recommendationRationale ? `
          <div class="details-section-title" style="margin-top: 8px;">Parameter Rationale</div>
          <div class="rationale-grid">
            <div class="rationale-item"><span class="rationale-label">Segment:</span> ${escapeHtml(data.recommendationRationale.segmentReason || '')}</div>
            <div class="rationale-item"><span class="rationale-label">Discount:</span> ${escapeHtml(data.recommendationRationale.discountReason || '')}</div>
            <div class="rationale-item"><span class="rationale-label">Budget:</span> ${escapeHtml(data.recommendationRationale.budgetReason || '')}</div>
          </div>
        ` : ''}

        <!-- Historical Merchant Context (Agent Memory) -->
        ${data.memory || agentAnalysis.memory ? `
          <div class="details-section-title" style="margin-top: 8px;">🧠 Historical Merchant Context (Agent Memory)</div>
          <div class="details-block" style="background: rgba(16, 185, 129, 0.05); padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); border-left: 3px solid #34d399;">
            <span class="details-label">Merchant Decision History</span>
            <p class="details-text">${escapeHtml((data.memory || agentAnalysis.memory).summary || 'No relevant merchant decision history available yet.')}</p>
            ${(data.memory || agentAnalysis.memory).insights && (data.memory || agentAnalysis.memory).insights.length > 0 ? `
              <ul style="margin-top: 6px; padding-left: 18px; font-size: 0.8rem; color: var(--text-secondary);">
                ${(data.memory || agentAnalysis.memory).insights.map(i => `<li>${escapeHtml(i)}</li>`).join('')}
              </ul>
            ` : ''}
            <div style="font-size: 0.725rem; color: var(--text-muted); font-style: italic; margin-top: 6px;">
              ℹ Historical merchant context is informational and does not override current opportunity analytics.
            </div>
          </div>
        ` : ''}
      `;
    }

    // 3. Render Analytics Evidence Block
    let evidenceHtml = '';
    if (ev.confidence !== undefined) {
      evidenceHtml = `
        <div class="details-section-title">Analytics Evidence &amp; Visualizer (Non-Editable Trusted Data)</div>
        <div class="evidence-flow-visualizer">
          <div class="flow-step">
            <div class="flow-step-icon">📦</div>
            <span class="flow-label">Trigger Product A</span>
            <span class="flow-val">${escapeHtml(pAName)}</span>
          </div>
          <span class="flow-arrow">→</span>
          <div class="flow-step">
            <div class="flow-step-icon">🛒</div>
            <span class="flow-label">Orders with A</span>
            <span class="flow-val">${formatNumber(ev.ordersWithA)}</span>
          </div>
          <span class="flow-arrow">→</span>
          <div class="flow-step">
            <div class="flow-step-icon">🤝</div>
            <span class="flow-label">Bought Together</span>
            <span class="flow-val">${formatNumber(ev.ordersWithBoth)}</span>
          </div>
          <span class="flow-arrow">→</span>
          <div class="flow-step">
            <div class="flow-step-icon">🎯</div>
            <span class="flow-label">Missed Opportunity</span>
            <span class="flow-val">${formatNumber(ev.missedCustomers)}</span>
          </div>
          <span class="flow-arrow">→</span>
          <div class="flow-step">
            <div class="flow-step-icon">✨</div>
            <span class="flow-label">Target Product B</span>
            <span class="flow-val">${escapeHtml(pBName)}</span>
          </div>
        </div>

        <div class="opp-metrics-grid" style="margin-top: var(--spacing-sm);">
          <div class="opp-metric-item">
            <span class="opp-metric-label">Confidence</span>
            <span class="opp-metric-value">${formatPercent(ev.confidence)}</span>
          </div>
          <div class="opp-metric-item">
            <span class="opp-metric-label">Lift</span>
            <span class="opp-metric-value">${formatLift(ev.lift)}</span>
          </div>
          <div class="opp-metric-item">
            <span class="opp-metric-label">Orders Together</span>
            <span class="opp-metric-value">${formatNumber(ev.ordersWithBoth)}</span>
          </div>
          <div class="opp-metric-item">
            <span class="opp-metric-label">Missed Customers</span>
            <span class="opp-metric-value">${formatNumber(ev.missedCustomers)}</span>
          </div>
          <div class="opp-metric-item">
            <span class="opp-metric-label">Opportunity Score</span>
            <span class="opp-metric-value">${(ev.opportunityScore || 0).toFixed(1)} / 100</span>
          </div>
          <div class="opp-metric-item">
            <span class="opp-metric-label">Priority</span>
            <span class="opp-metric-value"><span class="badge-priority ${priorityClass}">${escapeHtml(ev.priority)}</span></span>
          </div>
        </div>
      `;
    }


    // 4. Render Guardrails Block
    const guardrailsHtml = `
      <div class="details-section-title">Safety &amp; Guardrails</div>
      <div class="guardrails-box">
        <div class="guardrails-grid">
          <div class="guardrail-item">
            <span class="guardrail-label">Max Discount Bound</span>
            <span class="guardrail-val">${gr.maxDiscountPercent || 20}%</span>
          </div>
          <div class="guardrail-item">
            <span class="guardrail-label">Max Budget Bound</span>
            <span class="guardrail-val">${formatCurrency(gr.maxBudgetLimit || 5000)}</span>
          </div>
          <div class="guardrail-item">
            <span class="guardrail-label">Merchant Approval</span>
            <span class="guardrail-status">✓ REQUIRED</span>
          </div>
          <div class="guardrail-item">
            <span class="guardrail-label">Auto Execution</span>
            <span class="guardrail-val" style="color: var(--error);">DISABLED</span>
          </div>
        </div>
        <p class="safety-note">🛡️ Approval only changes campaign status. Execution is disabled in MVP and requires controlled integration.</p>
      </div>
    `;

    // Workflow actions inside details modal footer
    let actionButtonsHtml = '';
    if (rawStatus === 'draft') {
      actionButtonsHtml = `
        <button class="btn btn-primary" type="button" onclick="closeDetailsModal(); openSubmitModal(${camp.id});">
          <span>Submit for Approval</span>
        </button>
      `;
    } else if (rawStatus === 'pending_approval') {
      actionButtonsHtml = `
        <button class="btn btn-success" type="button" onclick="closeDetailsModal(); openApproveModal(${camp.id});">
          <span>Approve</span>
        </button>
        <button class="btn btn-danger" type="button" onclick="closeDetailsModal(); openRejectModal(${camp.id});">
          <span>Reject</span>
        </button>
      `;
    } else if (rawStatus === 'approved') {
      actionButtonsHtml = `
        <button class="btn btn-primary" type="button" onclick="closeDetailsModal(); openExecuteModal(${camp.id});">
          <span>🚀 Execute Campaign</span>
        </button>
      `;
    } else if (rawStatus === 'rejected') {
      actionButtonsHtml = `
        <button class="btn btn-secondary" type="button" onclick="closeDetailsModal(); openResetModal(${camp.id});">
          <span>Reset to Draft</span>
        </button>
      `;
    } else if (rawStatus === 'completed' || rawStatus === 'executed') {
      actionButtonsHtml = `
        <span class="completed-banner">✓ Completed</span>
        <button class="btn btn-outline" type="button" onclick="closeDetailsModal(); openExecutionResultModal(${camp.id});">
          <span>View Execution</span>
        </button>
      `;
    } else if (rawStatus === 'failed') {
      actionButtonsHtml = `<span class="failed-banner">✗ Execution Failed</span>`;
    }

    footerContainer.innerHTML = `
      <button class="btn btn-outline" type="button" onclick="closeDetailsModal(); openAuditModal(${camp.id});">
        <span>View Audit History</span>
      </button>
      ${actionButtonsHtml}
      <button class="btn btn-secondary" type="button" onclick="closeDetailsModal()">Close</button>
    `;

    bodyContainer.innerHTML = `
      ${pipelineStepperHtml}

      <!-- Campaign Configuration Section -->
      <div class="details-section-title">Campaign Configuration</div>
      <div class="campaign-top-row">
        <h3 class="campaign-title">${escapeHtml(camp.title || '')}</h3>
        <span class="badge-status ${statusClass}">${escapeHtml(statusText)}</span>
      </div>

      ${isApproved ? `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 8px 12px; margin-bottom: 8px; font-size: 0.85rem; color: #34d399; font-weight: 600;">
          ✓ APPROVED — Ready for Razorpay Test Mode Execution
        </div>
      ` : ''}

      <div class="campaign-relation">
        <span>${escapeHtml(pAName)}</span>
        <span>→</span>
        <span>${escapeHtml(pBName)}</span>
      </div>

      <div class="campaign-meta-row">
        <span class="badge-type">${escapeHtml((camp.type || 'cross_sell').replace(/_/g, '-').toUpperCase())}</span>
        <span class="badge-segment">Segment: ${escapeHtml((camp.targetSegment || 'all').toUpperCase())}</span>
      </div>

      <div class="campaign-metrics-grid">
        <div class="campaign-metric-item">
          <span class="campaign-metric-label">Discount %</span>
          <span class="campaign-metric-value">${camp.discountPercent}%</span>
        </div>
        <div class="campaign-metric-item">
          <span class="campaign-metric-label">Budget Limit</span>
          <span class="campaign-metric-value">${formatCurrency(camp.budgetLimit)}</span>
        </div>
        <div class="campaign-metric-item">
          <span class="campaign-metric-label">Estimated Revenue Opportunity</span>
          <span class="campaign-metric-value highlight">${formatCurrency(camp.estimatedRevenueOpportunity)}</span>
        </div>
        <div class="campaign-metric-item">
          <span class="campaign-metric-label">Created / Updated</span>
          <span class="campaign-metric-value">${formatDate(camp.createdAt)}</span>
        </div>
      </div>

      ${agentSummaryHtml}
      ${evidenceHtml}
      ${guardrailsHtml}
    `;
  } catch (error) {
    console.error(`Error loading details for campaign ${campaignId}:`, error);
    bodyContainer.innerHTML = '<div class="error-state">Unable to load campaign details. Please try again.</div>';
  }
}

function closeDetailsModal() {
  const overlay = document.getElementById('details-modal-overlay');
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

// ─── Create Campaign Draft Modal Handlers ───
async function openCreateModalFromOpportunityIndex(index) {
  const opp = window.loadedOpportunities && window.loadedOpportunities[index];
  if (!opp) {
    showToast('Unable to find opportunity data.', 'error');
    return;
  }
  await openCreateModalFromOpportunity(opp);
}

async function openCreateModalFromOpportunity(opp) {
  const overlay = document.getElementById('create-modal-overlay');
  const bodyContainer = document.getElementById('create-modal-body');
  const confirmBtn = document.getElementById('create-confirm-btn');

  if (!overlay || !bodyContainer || !confirmBtn) return;

  const pAName = opp.productA ? opp.productA.name : 'Product A';
  const pBName = opp.productB ? opp.productB.name : 'Product B';

  // Show loading state while fetching Growth Agent recommendation preview
  titleEl = overlay.querySelector('.modal-title');
  if (titleEl) titleEl.textContent = 'Create Campaign Draft from AI Growth Agent';
  
  bodyContainer.innerHTML = '<div class="loading-state">Fetching AI Growth Agent recommendation...</div>';
  confirmBtn.disabled = true;
  overlay.classList.remove('hidden');

  let agentData = null;
  if (window.lastAnalysisRecommendation && window.lastAnalysisOpportunity?.productA?.id === opp.productA?.id) {
    agentData = {
      opportunity: opp,
      recommendation: window.lastAnalysisRecommendation,
      analysis: window.lastAnalysisRecommendation,
    };
  } else {
    try {
      const queryStr = opp.productA && opp.productB ? `?productAId=${opp.productA.id}&productBId=${opp.productB.id}` : '';
      const response = await fetch(`/api/agent/growth-recommendation-preview${queryStr}`);
      if (response.ok) {
        agentData = await response.json();
      }
    } catch (err) {
      console.warn('Could not fetch Growth Agent preview, falling back to local opportunity metrics:', err);
    }
  }

  // Fallback defaults if agent API call is unavailable
  const analysis = agentData?.analysis || {};
  const recommendation = agentData?.recommendation || {};
  const opportunity = agentData?.opportunity || opp;
  const exp = opp.explanation || {};

  const defaultTitle = recommendation.title || exp.title || `Cross-sell ${pBName} to ${pAName} buyers`;
  const defaultDesc = recommendation.description || exp.recommendation || `Offer ${pBName} to customers who previously purchased ${pAName}.`;
  const defaultSegment = (recommendation.targetSegment || opp.targetSegment || 'premium').toLowerCase();
  const defaultDiscount = recommendation.discountPercent !== undefined ? recommendation.discountPercent : 10;
  const defaultBudget = recommendation.budgetLimit !== undefined ? recommendation.budgetLimit : 5000;

  const priorityClass =
    opportunity.priority === 'HIGH'
      ? 'priority-high'
      : opportunity.priority === 'MEDIUM'
      ? 'priority-medium'
      : 'priority-low';

  bodyContainer.innerHTML = `
    <!-- AI Growth Agent Recommendation Insight -->
    <div class="details-section-title">⚡ AI Growth Agent Insight</div>
    
    <div class="campaign-relation" style="margin-bottom: var(--spacing-sm);">
      <span>${escapeHtml(pAName)}</span>
      <span>→</span>
      <span>${escapeHtml(pBName)}</span>
    </div>

    ${analysis.reasoning ? `
      <div class="details-block" style="background: rgba(99, 102, 241, 0.08); padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); border-left: 3px solid var(--accent-light);">
        <span class="details-label">Agent Reasoning</span>
        <p class="details-text">${escapeHtml(analysis.reasoning)}</p>
      </div>
    ` : ''}

    ${analysis.recommendedAction ? `
      <div class="details-block" style="margin-top: 6px;">
        <span class="details-label">Agent Recommended Strategy</span>
        <p class="details-text">${escapeHtml(analysis.recommendedAction)}</p>
      </div>
    ` : ''}

    <!-- Analytics Evidence Grid -->
    <div class="details-section-title" style="margin-top: var(--spacing-md);">Opportunity Analytics Evidence</div>
    <div class="opp-metrics-grid">
      <div class="opp-metric-item">
        <span class="opp-metric-label">Confidence</span>
        <span class="opp-metric-value">${formatPercent(opportunity.confidence)}</span>
      </div>
      <div class="opp-metric-item">
        <span class="opp-metric-label">Lift</span>
        <span class="opp-metric-value">${formatLift(opportunity.lift)}</span>
      </div>
      <div class="opp-metric-item">
        <span class="opp-metric-label">Missed Customers</span>
        <span class="opp-metric-value">${formatNumber(opportunity.missedCustomers)}</span>
      </div>
      <div class="opp-metric-item">
        <span class="opp-metric-label">Opportunity Score</span>
        <span class="opp-metric-value">${(opportunity.opportunityScore || 0).toFixed(1)} / 100</span>
      </div>
      <div class="opp-metric-item">
        <span class="opp-metric-label">Priority</span>
        <span class="opp-metric-value"><span class="badge-priority ${priorityClass}">${escapeHtml(opportunity.priority)}</span></span>
      </div>
      <div class="opp-metric-item">
        <span class="opp-metric-label">Est. Revenue</span>
        <span class="opp-metric-value highlight">${formatCurrency(opportunity.estimatedRevenueOpportunity)}</span>
      </div>
    </div>

    <!-- Editable Campaign Configuration Form -->
    <div class="details-section-title" style="margin-top: var(--spacing-md);">Campaign Configuration (Merchant Review)</div>

    <div class="form-group">
      <label for="create-title-input" class="form-label">Campaign Title *</label>
      <input type="text" id="create-title-input" class="form-input" value="${escapeHtml(defaultTitle)}">
    </div>

    <div class="form-group">
      <label for="create-desc-input" class="form-label">Description</label>
      <textarea id="create-desc-input" class="form-textarea">${escapeHtml(defaultDesc)}</textarea>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="create-segment-select" class="form-label">Target Segment</label>
        <select id="create-segment-select" class="form-select">
          <option value="premium" ${defaultSegment === 'premium' ? 'selected' : ''}>Premium</option>
          <option value="regular" ${defaultSegment === 'regular' ? 'selected' : ''}>Regular</option>
          <option value="budget" ${defaultSegment === 'budget' ? 'selected' : ''}>Budget</option>
          <option value="all" ${defaultSegment === 'all' ? 'selected' : ''}>All Customers</option>
        </select>
      </div>

      <div class="form-group">
        <label for="create-discount-input" class="form-label">Discount % (Max 20%) *</label>
        <input type="number" id="create-discount-input" class="form-input" min="0" max="20" step="1" value="${defaultDiscount}">
      </div>

      <div class="form-group">
        <label for="create-budget-input" class="form-label">Budget Limit (₹, Max ₹5,000) *</label>
        <input type="number" id="create-budget-input" class="form-input" min="0" max="5000" step="100" value="${defaultBudget}">
      </div>
    </div>

    <!-- Safety & Guardrails Section -->
    <div class="details-section-title" style="margin-top: var(--spacing-md);">Campaign Guardrails</div>
    <div class="guardrails-box">
      <div class="guardrails-grid">
        <div class="guardrail-item">
          <span class="guardrail-label">Max Discount Bound</span>
          <span class="guardrail-val">20%</span>
        </div>
        <div class="guardrail-item">
          <span class="guardrail-label">Max Budget Bound</span>
          <span class="guardrail-val">₹5,000</span>
        </div>
        <div class="guardrail-item">
          <span class="guardrail-label">Merchant Approval</span>
          <span class="guardrail-status">✓ REQUIRED</span>
        </div>
        <div class="guardrail-item">
          <span class="guardrail-label">Auto Execution</span>
          <span class="guardrail-val" style="color: var(--error);">DISABLED</span>
        </div>
      </div>
      <p class="safety-note">🛡️ Creating this campaign only creates a draft. It does not submit, approve, or execute the campaign.</p>
    </div>
  `;

  confirmBtn.disabled = false;
  confirmBtn.textContent = 'Create Campaign Draft';
  confirmBtn.onclick = () => handleCreateCampaignSubmit(opportunity);
}


function closeCreateModal() {
  const overlay = document.getElementById('create-modal-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

async function handleCreateCampaignSubmit(opp) {
  const titleInput = document.getElementById('create-title-input');
  const descInput = document.getElementById('create-desc-input');
  const segmentSelect = document.getElementById('create-segment-select');
  const discountInput = document.getElementById('create-discount-input');
  const budgetInput = document.getElementById('create-budget-input');
  const confirmBtn = document.getElementById('create-confirm-btn');

  if (!titleInput || !discountInput || !budgetInput) return;

  const title = titleInput.value.trim();
  const description = descInput ? descInput.value.trim() : '';
  const targetSegment = segmentSelect ? segmentSelect.value : 'all';
  const discountPercent = parseFloat(discountInput.value);
  const budgetLimit = parseFloat(budgetInput.value);

  // Frontend Validation
  if (!title) {
    showToast('Campaign title is required.', 'error');
    titleInput.focus();
    return;
  }

  if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 20) {
    showToast('Discount percent must be a number between 0 and 20%.', 'error');
    discountInput.focus();
    return;
  }

  if (isNaN(budgetLimit) || budgetLimit < 0 || budgetLimit > 5000) {
    showToast('Budget limit must be a number between ₹0 and ₹5,000.', 'error');
    budgetInput.focus();
    return;
  }

  const validSegments = ['budget', 'regular', 'premium', 'all'];
  if (!validSegments.includes(targetSegment)) {
    showToast('Invalid target segment selected.', 'error');
    return;
  }

  const payload = {
    productAId: opp.productA.id,
    productBId: opp.productB.id,
    type: 'cross_sell',
    targetSegment: targetSegment,
    discountPercent: discountPercent,
    budgetLimit: budgetLimit,
    title: title,
    description: description,
    estimatedRevenueOpportunity: opp.estimatedRevenueOpportunity,
    targetCount: opp.missedCustomers || 0,
  };

  // Prevent duplicate submission
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Creating Draft...';
  }

  try {
    const response = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error || data.message || 'Unable to create campaign draft.';
      showToast(errMsg, 'error');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Create Campaign Draft';
      }
      return;
    }

    closeCreateModal();
    showToast('✓ Campaign draft created successfully', 'success');

    // Refresh campaigns list (Backend is source of truth)
    await loadCampaigns();

    // Automatically open details modal for newly created campaign
    if (data && data.id) {
      openDetailsModal(data.id);
    }
  } catch (error) {
    console.error('Error creating campaign draft:', error);
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Create Campaign Draft';
    }
  }
}

// ─── Stage 4: On-Demand Growth Analysis ──────────────────────
let isGrowthAnalysisRunning = false;

async function runOnDemandGrowthAnalysis() {
  if (isGrowthAnalysisRunning) return;

  const btn = document.getElementById('btn-run-growth-analysis');
  const panel = document.getElementById('growth-analysis-panel');

  if (!btn || !panel) return;

  isGrowthAnalysisRunning = true;
  btn.disabled = true;

  const originalBtnHTML = btn.innerHTML;
  btn.innerHTML = '<span class="analysis-spinner" style="width:16px;height:16px;border-width:2px;"></span> <span>Analyzing...</span>';

  // Show live loading panel
  panel.classList.remove('hidden');

  const oppContainer = document.getElementById('opportunities-container');
  if (oppContainer) {
    oppContainer.innerHTML = '<div class="loading-state">Analyzing purchase patterns...</div>';
  }

  const statusMessages = [
    '🔄 Fetching fresh merchant transaction data...',
    '🔎 Evaluating all product-pair cross-sell associations...',
    '🤖 AI is analyzing and comparing candidate opportunities with Qwen3...',
    '🎯 Formulating bounded campaign strategy and customer insights...',
    '🛡️ Validating financial safety guardrails and discount limits...',
  ];

  let msgIdx = 0;
  panel.innerHTML = `
    <div class="analysis-loading-box">
      <div class="analysis-spinner"></div>
      <div class="analysis-loading-title">On-Demand AI Growth Analysis</div>
      <div id="analysis-status-text" class="analysis-loading-status">${escapeHtml(statusMessages[0])}</div>
      <p class="details-disclaimer" style="max-width:500px;margin:0 auto;">Analyzing live store catalog and customer purchase patterns. This may take a moment while the local AI reasoning model evaluates opportunities.</p>
    </div>
  `;

  const statusInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % statusMessages.length;
    const statusElem = document.getElementById('analysis-status-text');
    if (statusElem) {
      statusElem.textContent = statusMessages[msgIdx];
    }
  }, 4000);

  try {
    const response = await fetch('/api/agent/run-growth-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    clearInterval(statusInterval);

    if (response.status === 409) {
      showToast('⚠️ Growth analysis is already running. Please wait.', 'warning');
      panel.innerHTML = `
        <div class="analysis-card" style="text-align:center;padding:var(--spacing-lg);">
          <div style="font-size:1.5rem;margin-bottom:8px;">⏳</div>
          <div class="analysis-loading-title">Analysis in Progress</div>
          <p class="details-text">Another growth analysis is currently executing. Please wait a moment and try again.</p>
        </div>
      `;
      return;
    }

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.analysisStatus === 'no_opportunity') {
      renderZeroOpportunityResult(panel, data);
      if (oppContainer) {
        oppContainer.innerHTML = '<div class="empty-state">No growth opportunities found.</div>';
      }
    } else if (data.analysisStatus === 'success') {
      renderGrowthAnalysisResult(panel, data);
      loadGrowthOpportunities();
      showToast('✓ AI Growth Analysis complete!', 'success');
    } else {
      throw new Error(data.message || 'Unknown response status');
    }
  } catch (error) {
    clearInterval(statusInterval);
    console.error('Growth analysis error:', error);
    showToast('Unable to complete growth analysis. Please try again.', 'error');
    if (oppContainer) {
      oppContainer.innerHTML = `
        <div class="empty-state">
          <p style="font-weight: 500; margin-bottom: 4px;">No growth analysis run yet.</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">Click <strong>Run Growth Analysis</strong> to discover opportunities.</p>
        </div>
      `;
    }
    panel.innerHTML = `
      <div class="analysis-card" style="border-color:rgba(239, 68, 68, 0.4);padding:var(--spacing-lg);">
        <div class="analysis-card-header" style="color:#f87171;">⚠️ Analysis Notice</div>
        <p class="details-text">Could not complete live growth analysis. Please verify backend service and retry.</p>
        <div class="analysis-actions">
          <button class="btn btn-secondary" onclick="runOnDemandGrowthAnalysis()">Try Again</button>
        </div>
      </div>
    `;
  } finally {
    clearInterval(statusInterval);
    isGrowthAnalysisRunning = false;
    btn.disabled = false;
    btn.innerHTML = originalBtnHTML;
  }
}

function renderZeroOpportunityResult(container, data) {
  container.innerHTML = `
    <div class="analysis-card" style="text-align:center;padding:var(--spacing-xl);">
      <div style="font-size:2rem;margin-bottom:8px;">🔍</div>
      <div class="analysis-loading-title">No Actionable Growth Opportunities Found</div>
      <p class="details-text" style="max-width:550px;margin:8px auto var(--spacing-md);">
        RevGen evaluated the current catalog and transactions but did not identify cross-sell pairs meeting minimum statistical confidence and lift thresholds.
      </p>
      <div class="analysis-meta-chips" style="justify-content:center;">
        <span class="analysis-chip">Total Scored Opportunities: <strong>0</strong></span>
        <span class="analysis-chip">Analysis ID: <strong>${escapeHtml(data.analysisId || 'N/A')}</strong></span>
      </div>
    </div>
  `;
}

function renderGrowthAnalysisResult(container, data) {
  const opp = data.selectedOpportunity;
  const recWrapper = data.recommendation || {};
  const rec = recWrapper.recommendation || {};
  const timing = data.timing || {};
  const safety = data.safety || {};
  const explain = data.explainability || {};
  const memory = data.selection?.memoryContext || recWrapper.memoryContext || {};
  const method = recWrapper.recommendationMethod || data.selection?.selectionMethod || 'llm';

  const isAIMethod = method === 'llm';
  const methodBadgeClass = isAIMethod ? 'badge-ai-mode' : 'badge-fallback-mode';
  const methodBadgeText = isAIMethod ? '🤖 AI Recommendation' : 'ℹ️ Deterministic Strategy';

  const durationSec = timing.totalDurationMs ? (timing.totalDurationMs / 1000).toFixed(1) : '1.2';
  const priorityClass = `priority-${(opp.priority || 'medium').toLowerCase()}`;

  window.lastAnalysisOpportunity = opp;
  window.lastAnalysisRecommendation = rec;

  const hasMemory = Boolean(memory.memoryAvailable && memory.relevantDecisionCount > 0);
  const memoryMessage = hasMemory
    ? `RevGen found ${memory.relevantDecisionCount} relevant previous merchant decision(s) for this opportunity context.`
    : 'No relevant merchant history found. Recommendation is based purely on current opportunity evidence.';

  container.innerHTML = `
    <div class="analysis-result-header">
      <div class="analysis-title-group">
        <span style="font-size:1.3rem;">⚡</span>
        <div>
          <div style="font-weight:700;font-size:1.1rem;color:var(--text-primary);">On-Demand Growth Opportunity &amp; Strategy</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);">
            Analyzed <strong>${escapeHtml(String(data.totalOpportunitiesCount || 84))}</strong> opportunities in <strong>${durationSec}s</strong> &middot; ID: <code>${escapeHtml(data.analysisId || '')}</code>
          </div>
        </div>
      </div>
      <span class="analysis-badge ${methodBadgeClass}">${escapeHtml(methodBadgeText)}</span>
    </div>

    <div class="analysis-grid">
      <!-- Left Column: Deterministic Evidence (Why this opportunity?) -->
      <div class="analysis-card">
        <div class="analysis-card-header">
          <span>📊 Why This Opportunity? (Evidence)</span>
          <span class="badge-priority ${priorityClass}">${escapeHtml(opp.priority || 'MEDIUM')}</span>
        </div>

        <div style="display:flex;align-items:center;gap:8px;font-size:1rem;font-weight:700;color:var(--text-primary);margin:4px 0;">
          <span>${escapeHtml(opp.productA?.name || 'Product A')}</span>
          <span style="color:var(--accent-light);">→</span>
          <span>${escapeHtml(opp.productB?.name || 'Product B')}</span>
        </div>

        <div class="opp-metrics-grid" style="grid-template-columns:repeat(2, 1fr);gap:8px;margin-top:4px;">
          <div class="opp-metric-item">
            <span class="opp-metric-label">Opportunity Score</span>
            <span class="opp-metric-value highlight">${(opp.opportunityScore || 0).toFixed(1)} / 100</span>
          </div>
          <div class="opp-metric-item">
            <span class="opp-metric-label">Confidence</span>
            <span class="opp-metric-value">${formatPercent(opp.confidence)}</span>
          </div>
          <div class="opp-metric-item">
            <span class="opp-metric-label">Lift Ratio</span>
            <span class="opp-metric-value">${formatLift(opp.lift)}</span>
          </div>
          <div class="opp-metric-item">
            <span class="opp-metric-label">Missed Customers</span>
            <span class="opp-metric-value">${formatNumber(opp.missedCustomers || 0)}</span>
          </div>
        </div>

        <div class="opp-metric-item" style="margin-top:4px;">
          <span class="opp-metric-label">Estimated Revenue Opportunity</span>
          <span class="opp-metric-value highlight" style="font-size:1.05rem;">${formatCurrency(opp.estimatedRevenueOpportunity || 0)}</span>
        </div>

        <div class="analysis-meta-chips">
          <span class="analysis-chip">Co-Purchase Orders: <strong>${formatNumber(opp.ordersWithBoth || 0)}</strong></span>
          <span class="analysis-chip">Target Price: <strong>${formatCurrency(opp.productB?.price || 0)}</strong></span>
        </div>

        <!-- Merchant Memory Block -->
        <div class="analysis-card-header" style="margin-top:var(--spacing-sm);font-size:0.8rem;">
          <span>🧠 Merchant Memory Context</span>
          <span style="font-size:0.75rem;color:var(--text-secondary);">${hasMemory ? 'Relevant Context Active' : 'No Prior History'}</span>
        </div>
        <p class="details-text" style="font-size:0.8rem;margin:2px 0;">${escapeHtml(memoryMessage)}</p>
        ${explain.historicalContext ? `
          <div class="rationale-item" style="font-size:0.78rem;padding:4px 8px;">
            <span class="rationale-label">Historical Context:</span> ${escapeHtml(explain.historicalContext)}
          </div>
        ` : ''}
      </div>

      <!-- Right Column: AI Campaign Recommendation & Reasoning -->
      <div class="analysis-card">
        <div class="analysis-card-header">
          <span>🎯 Proposed Campaign Strategy</span>
          <span class="badge-type">${escapeHtml((rec.offerType || 'bundle').toUpperCase())}</span>
        </div>

        <div style="font-size:1.05rem;font-weight:700;color:var(--text-primary);">${escapeHtml(rec.title || 'Cross-sell Campaign')}</div>
        <p class="details-text" style="margin:2px 0;">${escapeHtml(rec.description || '')}</p>

        <div class="opp-metrics-grid" style="grid-template-columns:repeat(3, 1fr);gap:8px;margin-top:6px;">
          <div class="opp-metric-item">
            <span class="opp-metric-label">Target Segment</span>
            <span class="opp-metric-value" style="text-transform:capitalize;">${escapeHtml(rec.targetSegment || 'regular')}</span>
          </div>
          <div class="opp-metric-item">
            <span class="opp-metric-label">Discount</span>
            <span class="opp-metric-value highlight">${rec.recommendedDiscount || 10}%</span>
          </div>
          <div class="opp-metric-item">
            <span class="opp-metric-label">Budget Limit</span>
            <span class="opp-metric-value highlight">${formatCurrency(rec.recommendedBudget || 5000)}</span>
          </div>
        </div>

        ${explain.whySelected || rec.reasoning ? `
          <div class="rationale-item" style="margin-top:6px;">
            <span class="rationale-label">🤖 AI Rationale:</span> ${escapeHtml(explain.whySelected || rec.reasoning)}
          </div>
        ` : ''}

        ${rec.customerInsight ? `
          <div class="rationale-item">
            <span class="rationale-label">💡 Customer Insight:</span> ${escapeHtml(rec.customerInsight)}
          </div>
        ` : ''}

        ${rec.riskFactors && rec.riskFactors.length > 0 ? `
          <div style="font-size:0.75rem;color:#fca5a5;margin-top:4px;">
            <strong>Caveats:</strong> ${escapeHtml(rec.riskFactors.join('; '))}
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Safety & Review Actions -->
    <div style="margin-top:var(--spacing-md);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--spacing-sm);">
      <div class="hitl-chips" style="margin:0;">
        <span class="hitl-chip">✓ Merchant Approval Required</span>
        <span class="hitl-chip">✓ Max Discount: 20%</span>
        <span class="hitl-chip">✓ Max Budget: ₹5,000</span>
        <span class="hitl-chip warning">✓ Auto Execution: DISABLED</span>
      </div>

      <button class="btn btn-primary" onclick="openCreateModalFromAnalysis()">
        <span>Create Campaign Draft</span>
        <span>→</span>
      </button>
    </div>
  `;
}

function openCreateModal(index) {
  return openCreateModalFromOpportunityIndex(index);
}

function openCreateModalFromAnalysis() {
  if (!window.lastAnalysisOpportunity) {
    showToast('No opportunity selected.', 'error');
    return;
  }

  const opp = window.lastAnalysisOpportunity;
  openCreateModalFromOpportunity(opp);
}

// ─── Razorpay Campaign Execution ─────────────────────────────

/**
 * Opens a confirmation modal before executing a campaign via Razorpay Test Mode.
 */
function openExecuteModal(campaignId) {
  openWorkflowModal({
    title: '🚀 Execute Campaign via Razorpay Test Mode',
    message: 'This will create a Razorpay TEST MODE order for the discounted Product B price. No real money will be charged. This action cannot be undone.',
    confirmText: 'Execute Test Campaign',
    confirmClass: 'btn-primary',
    showReasonInput: false,
    onConfirm: () => handleCampaignExecution(campaignId, false),
  });
}

/**
 * Handles the actual campaign execution via POST /api/campaigns/:id/execute.
 * Shows loading state and renders the result.
 */
async function handleCampaignExecution(campaignId, forceFail = false) {
  const confirmBtn = document.getElementById('modal-confirm-btn');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Creating Razorpay Test Mode order...';
  }

  try {
    const response = await fetch(`/api/campaigns/${campaignId}/execute${forceFail ? '?forceFail=true' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceFail }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error || data.message || 'Execution failed.';
      closeWorkflowModal();
      showToast(`❌ Execution Failed: ${errMsg}`, 'error');
      loadCampaigns();
      loadRevenueDashboard();
      return;
    }

    closeWorkflowModal();

    // Determine if Razorpay was actually called
    const rzpCalled = data.razorpay?.razorpayCalled === true;
    const isIdempotent = data.razorpay?.idempotent === true || data.simulation?.idempotent === true;

    if (isIdempotent) {
      showToast('ℹ️ Campaign was already executed (idempotent).', 'info');
    } else if (rzpCalled) {
      showToast('✓ Razorpay Test Mode order created successfully!', 'success');
    } else {
      showToast('✓ Campaign executed (simulation mode).', 'success');
    }

    // Refresh campaigns list and revenue dashboard
    loadCampaigns();
    loadRevenueDashboard();

    // Show execution result
    showExecutionResult(campaignId, data);
  } catch (error) {
    console.error(`Error executing campaign ${campaignId}:`, error);
    closeWorkflowModal();
    showToast(`Execution error: ${error.message}`, 'error');
    loadCampaigns();
    loadRevenueDashboard();
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
    }
  }
}

/**
 * Shows the execution result in the details modal.
 */
function showExecutionResult(campaignId, data) {
  const overlay = document.getElementById('details-modal-overlay');
  const bodyContainer = document.getElementById('details-modal-body');
  const footerContainer = document.getElementById('details-modal-footer');
  const titleEl = document.getElementById('details-modal-title');

  if (!overlay || !bodyContainer || !footerContainer) return;

  if (titleEl) {
    titleEl.textContent = `Campaign #${campaignId} — Execution Result`;
  }

  const exec = data.execution || {};
  const rzp = data.razorpay || data.simulation || {};
  const camp = data.campaign || {};

  const rzpCalled = rzp.razorpayCalled === true;
  const isIdempotent = rzp.idempotent === true;
  const isTestMode = rzp.mode === 'test';
  const orderId = rzp.razorpayOrderId || exec.details?.razorpayOrderId || null;
  const amountINR = rzp.amountINR || (exec.details?.razorpayAmountINR) || 0;
  const amountPaise = rzp.amount || (exec.details?.razorpayAmountPaise) || 0;

  const modeLabel = rzpCalled ? 'Razorpay Test Mode' : 'Simulation';
  const modeBadgeClass = rzpCalled ? 'badge-ai-mode' : 'badge-fallback-mode';

  bodyContainer.innerHTML = `
    <div style="text-align:center;margin-bottom:var(--spacing-md);">
      <div style="font-size:2.5rem;margin-bottom:8px;">${exec.status === 'completed' ? '✅' : '❌'}</div>
      <div style="font-size:1.2rem;font-weight:700;color:var(--text-primary);">
        ${exec.status === 'completed' ? 'Execution Completed' : 'Execution Failed'}
      </div>
      <span class="analysis-badge ${modeBadgeClass}" style="margin-top:8px;display:inline-block;">
        ${rzpCalled ? '🔗 Razorpay Test Mode' : '🔄 Simulation'}
      </span>
      ${isIdempotent ? '<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px;">ℹ️ Idempotent: returned existing execution</div>' : ''}
    </div>

    ${rzpCalled ? `
    <div class="details-section-title">🔗 Razorpay Test Mode Order</div>
    <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:var(--radius-md);padding:var(--spacing-md);">
      <div class="campaign-metrics-grid">
        <div class="campaign-metric-item">
          <span class="campaign-metric-label">Order ID</span>
          <span class="campaign-metric-value" style="font-family:monospace;font-size:0.8rem;">${escapeHtml(orderId || 'N/A')}</span>
        </div>
        <div class="campaign-metric-item">
          <span class="campaign-metric-label">Amount (INR)</span>
          <span class="campaign-metric-value highlight">${formatCurrency(amountINR)}</span>
        </div>
        <div class="campaign-metric-item">
          <span class="campaign-metric-label">Amount (Paise)</span>
          <span class="campaign-metric-value">${formatNumber(amountPaise)}</span>
        </div>
        <div class="campaign-metric-item">
          <span class="campaign-metric-label">Currency</span>
          <span class="campaign-metric-value">INR</span>
        </div>
      </div>
      <div style="margin-top:var(--spacing-sm);padding:8px 12px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:var(--radius-sm);font-size:0.8rem;color:#fbbf24;">
        ⚠️ This is a <strong>Test Mode</strong> transaction. No real money was charged. This order exists only in the Razorpay Test Mode sandbox.
      </div>
    </div>
    ` : ''}

    <div class="details-section-title" style="margin-top:var(--spacing-md);">📊 Execution Details</div>
    <div class="campaign-metrics-grid">
      <div class="campaign-metric-item">
        <span class="campaign-metric-label">Execution Mode</span>
        <span class="campaign-metric-value">${escapeHtml(exec.executionMode || modeLabel)}</span>
      </div>
      <div class="campaign-metric-item">
        <span class="campaign-metric-label">Status</span>
        <span class="campaign-metric-value">${escapeHtml((exec.status || '').toUpperCase())}</span>
      </div>
      <div class="campaign-metric-item">
        <span class="campaign-metric-label">Target Customers</span>
        <span class="campaign-metric-value">${formatNumber(exec.targetCount || 0)}</span>
      </div>
      <div class="campaign-metric-item">
        <span class="campaign-metric-label">Simulated Conversions</span>
        <span class="campaign-metric-value">${formatNumber(exec.simulatedConversions || 0)}</span>
      </div>
      <div class="campaign-metric-item">
        <span class="campaign-metric-label">Simulated Revenue</span>
        <span class="campaign-metric-value highlight">${formatCurrency(exec.simulatedRevenue || 0)}</span>
      </div>
      <div class="campaign-metric-item">
        <span class="campaign-metric-label">Est. Revenue Opportunity</span>
        <span class="campaign-metric-value">${formatCurrency(exec.estimatedRevenueOpportunity || 0)}</span>
      </div>
    </div>
  `;

  footerContainer.innerHTML = `
    <button class="btn btn-outline" type="button" onclick="closeDetailsModal(); openAuditModal(${campaignId});">
      <span>View Audit Trail</span>
    </button>
    <button class="btn btn-secondary" type="button" onclick="closeDetailsModal()">Close</button>
  `;

  overlay.classList.remove('hidden');
}

/**
 * Opens the execution result modal for a completed campaign.
 */
async function openExecutionResultModal(campaignId) {
  const overlay = document.getElementById('details-modal-overlay');
  const bodyContainer = document.getElementById('details-modal-body');
  const titleEl = document.getElementById('details-modal-title');

  if (!overlay || !bodyContainer) return;

  if (titleEl) {
    titleEl.textContent = `Campaign #${campaignId} — Execution Result`;
  }
  bodyContainer.innerHTML = '<div class="loading-state">Loading execution data...</div>';
  overlay.classList.remove('hidden');

  try {
    const response = await fetch(`/api/campaigns/${campaignId}/execution`);
    if (!response.ok) {
      bodyContainer.innerHTML = '<div class="empty-state">No execution record found for this campaign.</div>';
      return;
    }

    const data = await response.json();
    showExecutionResult(campaignId, { execution: data.execution, razorpay: {
      razorpayCalled: data.execution?.executionMode === 'razorpay_test',
      mode: data.execution?.executionMode === 'razorpay_test' ? 'test' : 'simulation',
      razorpayOrderId: data.execution?.details?.razorpayOrderId || null,
      amountINR: data.execution?.details?.razorpayAmountINR || 0,
      amount: data.execution?.details?.razorpayAmountPaise || 0,
    }, campaign: { id: campaignId, status: 'completed' }});
  } catch (error) {
    console.error(`Error loading execution for campaign ${campaignId}:`, error);
    bodyContainer.innerHTML = '<div class="error-state">Unable to load execution data.</div>';
  }
}

// ─── Revenue & ROI Dashboard ──────────────────────────────────

/**
 * Loads revenue, ROI, and transaction execution data from GET /api/dashboard/revenue
 */
async function loadRevenueDashboard() {
  try {
    const response = await fetch('/api/dashboard/revenue');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading revenue dashboard`);
    }

    const data = await response.json();
    const summary = data.summary || {};
    const roi = data.roi || {};
    const transactions = data.transactions || [];

    // 1. Update KPI Card values
    const testValEl = document.getElementById('rev-kpi-test-value');
    if (testValEl) testValEl.textContent = formatCurrency(summary.testRevenue || summary.testTransactionValue || 0);

    const execCampEl = document.getElementById('rev-kpi-executed-campaigns');
    if (execCampEl) execCampEl.textContent = `${formatNumber(summary.executedCampaigns || 0)} / ${formatNumber(summary.totalCampaigns || 0)}`;

    const oppEl = document.getElementById('rev-kpi-opportunity');
    if (oppEl) oppEl.textContent = formatCurrency(summary.estimatedRevenueOpportunity || 0);

    const custEl = document.getElementById('rev-kpi-customers');
    if (custEl) custEl.textContent = formatNumber(summary.estimatedAdditionalCustomers || 0);

    const roiEl = document.getElementById('rev-kpi-roi');
    const roiSubtextEl = document.getElementById('rev-kpi-roi-subtext');
    if (roiEl) {
      if (roi.estimatedRoi !== null && roi.estimatedRoi !== undefined) {
        roiEl.textContent = `${roi.estimatedRoi}%`;
        roiEl.classList.add('highlight');
        if (roiSubtextEl) roiSubtextEl.textContent = 'Estimated ROI based on campaign upside';
      } else {
        roiEl.textContent = 'N/A';
        roiEl.classList.remove('highlight');
        if (roiSubtextEl) roiSubtextEl.textContent = 'Realized ROI unavailable (sandbox)';
      }
    }

    // 2. Update 3 Pillars Distinction Cards
    const distEstEl = document.getElementById('dist-est-opportunity');
    if (distEstEl) distEstEl.textContent = formatCurrency(summary.estimatedRevenueOpportunity || 0);

    const distTestEl = document.getElementById('dist-test-value');
    if (distTestEl) distTestEl.textContent = formatCurrency(summary.testRevenue || summary.testTransactionValue || 0);

    const distRealEl = document.getElementById('dist-real-revenue');
    if (distRealEl) distRealEl.textContent = formatCurrency(0); // Explicitly zero

    // 3. Render Transaction Table Rows
    const tbody = document.getElementById('transactions-table-body');
    if (!tbody) return;

    if (transactions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="table-empty">
            No campaign executions recorded yet. Approve and execute a campaign to view live transaction data.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = transactions.map((tx) => renderTransactionRow(tx)).join('');
  } catch (error) {
    console.error('Error loading revenue dashboard:', error);
    const tbody = document.getElementById('transactions-table-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="table-empty" style="color: var(--error);">
            Unable to load transaction records: ${escapeHtml(error.message)}
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Renders an individual transaction row for the dashboard table.
 */
function renderTransactionRow(tx) {
  const isRazorpay = tx.executionMode === 'razorpay_test';
  const modeBadgeClass = isRazorpay ? 'badge-razorpay' : 'badge-simulation';
  const modeLabel = isRazorpay ? '⚡ Razorpay Test' : '🔬 Simulation';

  let statusBadgeClass = 'badge-completed';
  if (tx.executionStatus === 'failed') statusBadgeClass = 'badge-failed';
  if (tx.executionStatus === 'started' || tx.executionStatus === 'executing') statusBadgeClass = 'badge-executing';

  const pairLabel = (tx.productA && tx.productB)
    ? `${escapeHtml(tx.productA.name)} → ${escapeHtml(tx.productB.name)}`
    : 'Cross-sell Pair';

  const orderIdDisplay = tx.razorpayOrderId
    ? `<code class="order-id-chip">${escapeHtml(tx.razorpayOrderId)}</code>`
    : '<span class="text-muted">N/A (Simulation)</span>';

  const txAmount = tx.transactionAmountINR || tx.discountedUnitPrice || 0;

  return `
    <tr>
      <td><strong>#${tx.id}</strong></td>
      <td>
        <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(tx.campaignName)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">Campaign #${tx.campaignId} &middot; ${escapeHtml(tx.campaignType)}</div>
      </td>
      <td>
        <span style="font-size:0.85rem; color:var(--text-secondary);">${pairLabel}</span>
      </td>
      <td>
        <span class="tx-badge ${modeBadgeClass}">${modeLabel}</span>
      </td>
      <td>
        <span class="tx-badge ${statusBadgeClass}">${escapeHtml((tx.executionStatus || '').toUpperCase())}</span>
      </td>
      <td>${orderIdDisplay}</td>
      <td style="font-weight:700; color:var(--accent-light);">${formatCurrency(txAmount)}</td>
      <td style="font-size:0.8rem; color:var(--text-secondary);">${formatDate(tx.executedAt || tx.createdAt)}</td>
      <td>
        <button class="btn btn-outline btn-sm" type="button" onclick="openExecutionResultModal(${tx.campaignId})">
          <span>View</span>
        </button>
      </td>
    </tr>
  `;
}
