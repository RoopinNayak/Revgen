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

// ─── Campaign Details & Analytics Evidence Modal ───
async function openDetailsModal(campaignId) {
  const overlay = document.getElementById('details-modal-overlay');
  const bodyContainer = document.getElementById('details-modal-body');
  const footerContainer = document.getElementById('details-modal-footer');
  const titleEl = document.getElementById('details-modal-title');

  if (!overlay || !bodyContainer || !footerContainer) return;

  titleEl.textContent = `Campaign #${campaignId} Details & Analytics Evidence`;
  bodyContainer.innerHTML = '<div class="loading-state">Loading campaign details & analytics evidence...</div>';
  overlay.classList.remove('hidden');

  try {
    const response = await fetch(`/api/campaigns/${campaignId}/details`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const camp = data.campaign;
    const ev = data.evidence;
    const exp = data.explanation;
    const gr = data.guardrails || {};

    if (!camp) {
      bodyContainer.innerHTML = '<div class="error-state">Unable to load campaign details.</div>';
      return;
    }

    const pAName = camp.productA ? camp.productA.name : 'Product A';
    const pBName = camp.productB ? camp.productB.name : 'Product B';
    const rawStatus = (camp.status || '').toLowerCase();

    // Render Status Badges & Metadata
    let statusText = rawStatus.toUpperCase().replace(/_/g, ' ');
    let statusClass = `status-${rawStatus}`;

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
      actionButtonsHtml = `<span class="approved-banner">✓ Approved</span>`;
    } else if (rawStatus === 'rejected') {
      actionButtonsHtml = `
        <button class="btn btn-secondary" type="button" onclick="closeDetailsModal(); openResetModal(${camp.id});">
          <span>Reset to Draft</span>
        </button>
      `;
    } else if (rawStatus === 'completed' || rawStatus === 'executed') {
      actionButtonsHtml = `<span class="completed-banner">✓ Completed</span>`;
    }

    footerContainer.innerHTML = `
      <button class="btn btn-outline" type="button" onclick="closeDetailsModal(); openAuditModal(${camp.id});">
        <span>View Audit History</span>
      </button>
      ${actionButtonsHtml}
      <button class="btn btn-secondary" type="button" onclick="closeDetailsModal()">Close</button>
    `;

    // Render Evidence Block
    let evidenceHtml = '';
    if (ev) {
      const priorityClass =
        ev.priority === 'HIGH'
          ? 'priority-high'
          : ev.priority === 'MEDIUM'
          ? 'priority-medium'
          : 'priority-low';

      evidenceHtml = `
        <div class="details-section-title">Analytics Evidence &amp; Purchase Behavior</div>
        
        <!-- Evidence Visualizer Flow -->
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

        <!-- Evidence Metrics Grid -->
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
    } else {
      evidenceHtml = `
        <div class="details-section-title">Analytics Evidence</div>
        <div class="empty-state">Analytics evidence is currently unavailable.</div>
      `;
    }

    // Render Explanation Block
    let explanationHtml = '';
    if (exp) {
      explanationHtml = `
        <div class="details-section-title">Recommendation Explanation</div>
        <div class="details-block">
          <span class="details-label">Why This Opportunity</span>
          <p class="details-text">${escapeHtml(exp.reason || '')}</p>
        </div>
        <div class="details-block">
          <span class="details-label">Recommendation Strategy</span>
          <p class="details-text">${escapeHtml(exp.recommendation || '')}</p>
        </div>
        <div class="details-block">
          <span class="details-label">Estimated Revenue Opportunity</span>
          <p class="details-text">${escapeHtml(exp.opportunity || '')}</p>
        </div>
        <p class="details-disclaimer">${escapeHtml(exp.disclaimer || '')}</p>
      `;
    }

    // Render Guardrails Block
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
        <p class="safety-note">🛡️ Approval only changes campaign status. It does not execute the campaign or create a payment.</p>
      </div>
    `;

    bodyContainer.innerHTML = `
      <!-- Campaign Configuration Section -->
      <div class="details-section-title">Campaign Configuration</div>
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

      ${evidenceHtml}
      ${explanationHtml}
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
  try {
    const queryStr = opp.productA && opp.productB ? `?productAId=${opp.productA.id}&productBId=${opp.productB.id}` : '';
    const response = await fetch(`/api/agent/growth-recommendation-preview${queryStr}`);
    if (response.ok) {
      agentData = await response.json();
    }
  } catch (err) {
    console.warn('Could not fetch Growth Agent preview, falling back to local opportunity metrics:', err);
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




