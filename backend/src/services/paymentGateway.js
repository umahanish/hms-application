export class GatewayError extends Error {
  constructor(message, { retryable = false } = {}) {
    super(message);
    this.name = 'GatewayError';
    this.retryable = retryable;
  }
}

let referenceCounter = 0;
function nextReference() {
  referenceCounter += 1;
  return `gw_${Date.now().toString(36)}_${referenceCounter}`;
}

/**
 * Stands in for a real payment gateway (Stripe/Razorpay/etc). `simulate` lets
 * callers force a specific outcome without real gateway credentials:
 *  - 'succeed' (default): immediate success
 *  - 'pending': gateway accepted the charge but confirms later via webhook
 *  - 'decline': hard failure, not retryable
 *  - 'timeout': transient failure, retryable
 */
export async function chargeGateway({ amount, method, simulate = 'succeed' }) {
  if (simulate === 'timeout') {
    throw new GatewayError('Gateway request timed out', { retryable: true });
  }
  if (simulate === 'decline') {
    throw new GatewayError('Payment was declined', { retryable: false });
  }
  if (simulate === 'pending') {
    return { gatewayReference: nextReference(), status: 'pending' };
  }
  return { gatewayReference: nextReference(), status: 'succeeded' };
}
