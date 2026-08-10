import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createFakePool } from './helpers/fakePool.js';
import { migrateUp } from '../src/db/migrateSingleStore.js';
import { migrations } from '../src/migrations-singlestore/index.js';
import { createPatient } from '../src/repositories/patientsRepository.js';
import { createInvoice } from '../src/repositories/invoicesRepository.js';
import { findPaymentsByInvoice } from '../src/repositories/paymentsRepository.js';
import { chargeGateway, GatewayError } from '../src/services/paymentGateway.js';
import {
  processPayment,
  reconcileWebhookPayment,
  InvoiceNotFoundError,
  PaymentNotFoundError,
  PaymentDeclinedError,
} from '../src/services/paymentsService.js';

vi.mock('../src/services/paymentGateway.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, chargeGateway: vi.fn(actual.chargeGateway) };
});

const VALID_PATIENT = {
  firstName: 'Jane',
  lastName: 'Doe',
  dob: '1990-01-01',
  gender: 'female',
  phone: '555-123-4567',
  email: 'jane.doe@example.com',
  addressLine1: '123 Main St',
  city: 'Springfield',
  emergencyContactName: 'John Doe',
  emergencyContactPhone: '555-987-6543',
  insuranceProvider: 'Acme Health',
  insurancePolicyNumber: 'POL-12345',
};

describe('paymentsService', () => {
  let pool;
  let invoiceId;

  beforeEach(async () => {
    vi.clearAllMocks();
    pool = createFakePool();
    await migrateUp(pool, migrations);
    const patientId = (await createPatient(pool, VALID_PATIENT)).id;
    const { invoice } = await createInvoice(pool, {
      patientId,
      lineItems: [{ description: 'Consultation', quantity: 1, unitPrice: 100 }],
    });
    invoiceId = invoice.id;
  });

  it('throws InvoiceNotFoundError for an unknown invoice', async () => {
    await expect(processPayment(pool, { invoiceId: 9999, amount: 100, method: 'card' })).rejects.toBeInstanceOf(
      InvoiceNotFoundError,
    );
  });

  it('records a cash payment immediately without calling the gateway, and marks the invoice paid', async () => {
    const result = await processPayment(pool, { invoiceId, amount: 100, method: 'cash' });

    expect(chargeGateway).not.toHaveBeenCalled();
    expect(result.payment.status).toBe('succeeded');
    expect(result.invoice.status).toBe('paid');
    expect(result.invoice.amountPaid).toBe(100);
  });

  it('processes a successful card payment on the first attempt and updates the invoice', async () => {
    const result = await processPayment(pool, { invoiceId, amount: 60, method: 'card' });

    expect(chargeGateway).toHaveBeenCalledTimes(1);
    expect(result.payment.status).toBe('succeeded');
    expect(result.invoice.status).toBe('partial');
    expect(result.invoice.amountPaid).toBe(60);
  });

  it('retries a transient gateway timeout and succeeds on a later attempt', async () => {
    chargeGateway
      .mockRejectedValueOnce(new GatewayError('Gateway request timed out', { retryable: true }))
      .mockResolvedValueOnce({ gatewayReference: 'gw_test_1', status: 'succeeded' });

    const result = await processPayment(pool, { invoiceId, amount: 100, method: 'card' });

    expect(chargeGateway).toHaveBeenCalledTimes(2);
    expect(result.payment.status).toBe('succeeded');
    expect(result.invoice.status).toBe('paid');
  });

  it('exhausts retries on repeated timeouts, logs a failed payment, and leaves the invoice untouched', async () => {
    chargeGateway.mockRejectedValue(new GatewayError('Gateway request timed out', { retryable: true }));

    await expect(processPayment(pool, { invoiceId, amount: 100, method: 'card' })).rejects.toMatchObject({
      retryable: true,
    });

    expect(chargeGateway).toHaveBeenCalledTimes(3); // MAX_ATTEMPTS

    const payments = await findPaymentsByInvoice(pool, invoiceId);
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe('failed');
    expect(payments[0].failureReason).toBe('Gateway request timed out');
  });

  it('does not retry a non-retryable decline and reports it clearly', async () => {
    chargeGateway.mockRejectedValueOnce(new GatewayError('Payment was declined', { retryable: false }));

    await expect(processPayment(pool, { invoiceId, amount: 100, method: 'card' })).rejects.toBeInstanceOf(
      PaymentDeclinedError,
    );

    expect(chargeGateway).toHaveBeenCalledTimes(1);
    const payments = await findPaymentsByInvoice(pool, invoiceId);
    expect(payments[0]).toMatchObject({ status: 'failed', failureReason: 'Payment was declined' });
  });

  it('records a pending payment for an async gateway and leaves the invoice untouched until reconciled', async () => {
    chargeGateway.mockResolvedValueOnce({ gatewayReference: 'gw_pending_1', status: 'pending' });

    const result = await processPayment(pool, { invoiceId, amount: 100, method: 'upi' });

    expect(result.payment.status).toBe('pending');
    expect(result.invoice.status).toBe('unpaid');
    expect(result.invoice.amountPaid).toBe(0);
  });

  describe('reconcileWebhookPayment', () => {
    it('applies a succeeded webhook to the invoice', async () => {
      chargeGateway.mockResolvedValueOnce({ gatewayReference: 'gw_pending_2', status: 'pending' });
      await processPayment(pool, { invoiceId, amount: 100, method: 'upi' });

      const result = await reconcileWebhookPayment(pool, { gatewayReference: 'gw_pending_2', status: 'succeeded' });

      expect(result.payment.status).toBe('succeeded');
      expect(result.invoice.status).toBe('paid');
      expect(result.invoice.amountPaid).toBe(100);
    });

    it('marks a failed webhook without touching the invoice', async () => {
      chargeGateway.mockResolvedValueOnce({ gatewayReference: 'gw_pending_3', status: 'pending' });
      await processPayment(pool, { invoiceId, amount: 100, method: 'upi' });

      const result = await reconcileWebhookPayment(pool, {
        gatewayReference: 'gw_pending_3',
        status: 'failed',
        failureReason: 'Card declined post-authorization',
      });

      expect(result.payment).toMatchObject({ status: 'failed', failureReason: 'Card declined post-authorization' });
      expect(result.invoice.status).toBe('unpaid');
    });

    it('throws PaymentNotFoundError for an unknown gateway reference', async () => {
      await expect(
        reconcileWebhookPayment(pool, { gatewayReference: 'gw_unknown', status: 'succeeded' }),
      ).rejects.toBeInstanceOf(PaymentNotFoundError);
    });
  });
});
