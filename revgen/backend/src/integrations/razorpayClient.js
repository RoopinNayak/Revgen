// ─────────────────────────────────────────────
// RevGen — Razorpay Test Mode Integration Client
// ─────────────────────────────────────────────
//
// Isolated Razorpay integration layer for RevGen.
//
// Security Controls:
// 1. Credentials MUST come from environment variables only.
// 2. Secrets are NEVER returned in API responses.
// 3. Only TEST MODE operations are implemented.
// 4. No live payment functionality exists in this module.
// 5. Amount validation prevents accidental misuse.
// ─────────────────────────────────────────────

const Razorpay = require('razorpay');

// ─── Amount Conversion Helpers ──────────────

/**
 * Converts an INR amount (rupees) to paise (smallest currency unit).
 *
 * Razorpay requires amounts in the smallest currency unit.
 * For INR: ₹100 = 10000 paise.
 *
 * @param {number} amountInRupees - Amount in INR (rupees). Must be a positive finite number.
 * @returns {number} Amount in paise (integer).
 * @throws {Error} If amount is invalid.
 */
function toPaise(amountInRupees) {
  if (amountInRupees === undefined || amountInRupees === null) {
    throw new Error('Amount is required');
  }

  if (typeof amountInRupees !== 'number' || isNaN(amountInRupees)) {
    throw new Error('Amount must be a valid number');
  }

  if (!isFinite(amountInRupees)) {
    throw new Error('Amount must be finite');
  }

  if (amountInRupees <= 0) {
    throw new Error('Amount must be positive');
  }

  // Round to avoid floating point precision issues (e.g., 19.99 * 100)
  return Math.round(amountInRupees * 100);
}

/**
 * Converts paise back to INR rupees.
 *
 * @param {number} amountInPaise - Amount in paise.
 * @returns {number} Amount in INR (rupees).
 */
function toRupees(amountInPaise) {
  if (typeof amountInPaise !== 'number' || isNaN(amountInPaise) || !isFinite(amountInPaise)) {
    throw new Error('Paise amount must be a valid finite number');
  }
  return amountInPaise / 100;
}

// ─── Configuration ──────────────────────────

/**
 * Checks if Razorpay Test Mode credentials are configured.
 *
 * @returns {{ configured: boolean, mode: string, provider: string, reason?: string }}
 */
function isConfigured() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  const hasKeyId = typeof keyId === 'string' && keyId.trim().length > 0;
  const hasKeySecret = typeof keySecret === 'string' && keySecret.trim().length > 0;

  if (!hasKeyId || !hasKeySecret) {
    const missing = [];
    if (!hasKeyId) missing.push('RAZORPAY_KEY_ID');
    if (!hasKeySecret) missing.push('RAZORPAY_KEY_SECRET');

    return {
      configured: false,
      mode: 'test',
      provider: 'razorpay',
      reason: `Razorpay test credentials are not configured. Missing: ${missing.join(', ')}`,
    };
  }

  // Detect test mode by key prefix convention (Razorpay test keys start with 'rzp_test_')
  const isTestKey = keyId.startsWith('rzp_test_');

  return {
    configured: true,
    mode: isTestKey ? 'test' : 'unknown',
    provider: 'razorpay',
    // IMPORTANT: never return keySecret or keyId values
  };
}

// ─── Razorpay Instance ──────────────────────

let _razorpayInstance = null;

/**
 * Returns a singleton Razorpay SDK instance.
 * Only creates an instance if credentials are configured.
 *
 * @returns {Razorpay|null}
 */
function _getInstance() {
  const status = isConfigured();
  if (!status.configured) {
    return null;
  }

  if (!_razorpayInstance) {
    _razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  return _razorpayInstance;
}

/**
 * Resets the singleton instance (used for testing).
 */
function _resetInstance() {
  _razorpayInstance = null;
}

// ─── Order Operations ───────────────────────

/**
 * Creates a Razorpay Test Mode order.
 *
 * @param {{ amount: number, currency?: string, receipt?: string, notes?: object }} options
 *   - amount: Amount in INR (rupees). Converted to paise internally.
 *   - currency: Currency code (default: 'INR').
 *   - receipt: Optional receipt identifier.
 *   - notes: Optional key-value metadata.
 *
 * @returns {Promise<{ success: boolean, mode: string, order: object }>}
 * @throws {Error} If credentials are not configured or Razorpay API fails.
 */
async function createTestOrder({ amount, currency = 'INR', receipt, notes } = {}) {
  // 1. Check configuration
  const status = isConfigured();
  if (!status.configured) {
    const err = new Error(status.reason || 'Razorpay test credentials are not configured');
    err.statusCode = 503;
    err.configurationError = true;
    throw err;
  }

  // 2. Enforce test mode only
  if (status.mode !== 'test') {
    const err = new Error('RevGen only supports Razorpay Test Mode. Live mode keys are not permitted.');
    err.statusCode = 403;
    throw err;
  }

  // 3. Validate and convert amount
  const amountPaise = toPaise(amount);

  // 4. Build order parameters
  const orderParams = {
    amount: amountPaise,
    currency: currency.toUpperCase(),
    receipt: receipt || `revgen_test_${Date.now()}`,
  };

  if (notes && typeof notes === 'object') {
    orderParams.notes = notes;
  }

  // 5. Create order via Razorpay SDK
  const instance = _getInstance();
  if (!instance) {
    const err = new Error('Razorpay client could not be initialized');
    err.statusCode = 500;
    throw err;
  }

  try {
    const order = await instance.orders.create(orderParams);

    // Return sanitized response (never include credentials or sensitive SDK internals)
    return {
      success: true,
      mode: 'test',
      order: {
        id: order.id,
        amount: order.amount,
        amountInRupees: toRupees(order.amount),
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        createdAt: order.created_at,
      },
    };
  } catch (apiError) {
    // Structured error — do NOT expose raw Razorpay error internals
    const err = new Error(
      `Razorpay API error: ${apiError.error?.description || apiError.message || 'Unknown error'}`
    );
    err.statusCode = apiError.statusCode || 502;
    err.razorpayError = true;
    throw err;
  }
}

// ─── Exports ────────────────────────────────

module.exports = {
  // Configuration
  isConfigured,

  // Amount helpers
  toPaise,
  toRupees,

  // Order operations
  createTestOrder,

  // Testing utilities
  _resetInstance,
  _getInstance,
};
