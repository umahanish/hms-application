import { chargeGateway, GatewayError } from './paymentGateway.js';
import {
  recordSucceededPayment,
  recordPendingPayment,
  recordFailedPayment,
  reconcilePendingPayment,
} from '../repositories/paymentsRepository.js';
import { findInvoiceById } from '../repositories/invoicesRepository.js';

export class InvoiceNotFoundError extends Error {}
export class PaymentNotFoundError extends Error {}

export class PaymentDeclinedError extends Error {
  constructor(message, { retryable = false } = {}) {
    super(message);
    this.name = 'PaymentDeclinedError';
    this.retryable = retryable;
  }
}

const MAX_ATTEMPTS = 3; // 1 initial attempt + 2 retries on transient/timeout failures

/**
 * Charges a patient's invoice through the payment gateway (or, for cash, just
 * records the manual reconciliation entry directly), retrying transient gateway
 * failures up to MAX_ATTEMPTS. Every outcome — success, pending, or exhausted
 * failure — is written to the payments table as a transaction log entry.
 */
export async function processPayment(db, { invoiceId, amount, method, simulate }) {
  const invoice = findInvoiceById(db, invoiceId);
  if (!invoice) {
    throw new InvoiceNotFoundError('Invoice not found');
  }

  if (method === 'cash') {
    const payment = recordSucceededPayment(db, { invoiceId, amount, method, gatewayReference: null });
    return { payment, invoice: findInvoiceById(db, invoiceId) };
  }

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await chargeGateway({ amount, method, simulate });

      if (result.status === 'pending') {
        const payment = recordPendingPayment(db, {
          invoiceId,
          amount,
          method,
          gatewayReference: result.gatewayReference,
        });
        return { payment, invoice: findInvoiceById(db, invoiceId), attempts: attempt };
      }

      const payment = recordSucceededPayment(db, {
        invoiceId,
        amount,
        method,
        gatewayReference: result.gatewayReference,
      });
      return { payment, invoice: findInvoiceById(db, invoiceId), attempts: attempt };
    } catch (error) {
      lastError = error;
      const isRetryable = error instanceof GatewayError && error.retryable;
      if (!isRetryable || attempt === MAX_ATTEMPTS) {
        break;
      }
    }
  }

  recordFailedPayment(db, { invoiceId, amount, method, failureReason: lastError.message });
  throw new PaymentDeclinedError(lastError.message, { retryable: lastError.retryable ?? false });
}

/** Applies an async payment gateway webhook/callback to the matching pending payment. */
export function reconcileWebhookPayment(db, { gatewayReference, status, failureReason }) {
  const payment = reconcilePendingPayment(db, gatewayReference, { status, failureReason });
  if (!payment) {
    throw new PaymentNotFoundError('No pending payment found for that gateway reference');
  }
  return { payment, invoice: findInvoiceById(db, payment.invoiceId) };
}
