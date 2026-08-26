// ─────────────────────────────────────────────
// RevGen — AI Merchant Growth Agent
// Frontend Application (Vanilla JS)
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

function initDashboard() {
  loadDashboard();
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

// Utility: Format ISO date string
function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// Show error message banner
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

// 2. Load Top Products
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

// 3. Load Recent Orders
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
