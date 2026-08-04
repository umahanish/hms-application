import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createConnection } from '../src/db/connection.js';
import { migrateUp } from '../src/db/migrate.js';
import { migrations } from '../src/migrations/index.js';
import { createApp } from '../src/app.js';
import { createPatient } from '../src/repositories/patientsRepository.js';
import { createInvoice } from '../src/repositories/invoicesRepository.js';

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

describe('Payment Processing API', () => {
  let db;
  let app;
  let invoiceId;

  beforeEach(() => {
    db = createConnection(':memory:');
    migrateUp(db, migrations);
    app = createApp(db);
    const patientId = createPatient(db, VALID_PATIENT).id;
    const { invoice } = createInvoice(db, {
      patientId,
      lineItems: [{ description: 'Consultation', quantity: 1, unitPrice: 100 }],
    });
    invoiceId = invoice.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('POST /api/payments', () => {
    it('processes a successful card payment and updates the invoice', async () => {
      const response = await request(app).post('/api/payments').send({ invoiceId, amount: 100, method: 'card' });

      expect(response.status).toBe(201);
      expect(response.body.payment.status).toBe('succeeded');
      expect(response.body.invoice.status).toBe('paid');
    });

    it('records a cash payment without a gateway call', async () => {
      const response = await request(app).post('/api/payments').send({ invoiceId, amount: 100, method: 'cash' });

      expect(response.status).toBe(201);
      expect(response.body.payment.method).toBe('cash');
      expect(response.body.payment.gatewayReference).toBeNull();
    });

    it('returns 400 for validation errors', async () => {
      const response = await request(app).post('/api/payments').send({ invoiceId, amount: -5, method: 'bogus' });
      expect(response.status).toBe(400);
      expect(response.body.errors.amount).toBeTruthy();
      expect(response.body.errors.method).toBeTruthy();
    });

    it('returns 400 when the invoice does not exist', async () => {
      const response = await request(app)
        .post('/api/payments')
        .send({ invoiceId: 9999, amount: 100, method: 'card' });
      expect(response.status).toBe(400);
    });

    it('returns 402 with a clear, non-retryable error on decline and logs the failure', async () => {
      const response = await request(app)
        .post('/api/payments')
        .send({ invoiceId, amount: 100, method: 'card', simulate: 'decline' });

      expect(response.status).toBe(402);
      expect(response.body.retryable).toBe(false);

      const log = await request(app).get('/api/payments').query({ invoiceId });
      expect(log.body).toHaveLength(1);
      expect(log.body[0].status).toBe('failed');
    });

    it('returns 402 with retryable:true after exhausting retries on repeated timeouts', async () => {
      const response = await request(app)
        .post('/api/payments')
        .send({ invoiceId, amount: 100, method: 'card', simulate: 'timeout' });

      expect(response.status).toBe(402);
      expect(response.body.retryable).toBe(true);
    });

    it('records a pending payment for an async gateway without updating the invoice yet', async () => {
      const response = await request(app)
        .post('/api/payments')
        .send({ invoiceId, amount: 100, method: 'upi', simulate: 'pending' });

      expect(response.status).toBe(201);
      expect(response.body.payment.status).toBe('pending');
      expect(response.body.invoice.status).toBe('unpaid');
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('reconciles a pending payment to succeeded and updates the invoice', async () => {
      const pending = await request(app)
        .post('/api/payments')
        .send({ invoiceId, amount: 100, method: 'upi', simulate: 'pending' });

      const webhook = await request(app).post('/api/payments/webhook').send({
        gatewayReference: pending.body.payment.gatewayReference,
        status: 'succeeded',
      });

      expect(webhook.status).toBe(200);
      expect(webhook.body.payment.status).toBe('succeeded');
      expect(webhook.body.invoice.status).toBe('paid');
    });

    it('reconciles a pending payment to failed without touching the invoice', async () => {
      const pending = await request(app)
        .post('/api/payments')
        .send({ invoiceId, amount: 100, method: 'upi', simulate: 'pending' });

      const webhook = await request(app).post('/api/payments/webhook').send({
        gatewayReference: pending.body.payment.gatewayReference,
        status: 'failed',
        failureReason: 'Card declined post-authorization',
      });

      expect(webhook.status).toBe(200);
      expect(webhook.body.payment.status).toBe('failed');
      expect(webhook.body.invoice.status).toBe('unpaid');
    });

    it('returns 404 for an unknown gateway reference', async () => {
      const response = await request(app)
        .post('/api/payments/webhook')
        .send({ gatewayReference: 'gw_unknown', status: 'succeeded' });
      expect(response.status).toBe(404);
    });

    it('returns 400 for an invalid webhook payload', async () => {
      const response = await request(app).post('/api/payments/webhook').send({ status: 'succeeded' });
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/payments?invoiceId=', () => {
    it('returns the full transaction log for an invoice, including failed attempts', async () => {
      await request(app).post('/api/payments').send({ invoiceId, amount: 100, method: 'card', simulate: 'decline' });
      await request(app).post('/api/payments').send({ invoiceId, amount: 100, method: 'card' });

      const response = await request(app).get('/api/payments').query({ invoiceId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.map((p) => p.status).sort()).toEqual(['failed', 'succeeded']);
    });

    it('returns 400 when invoiceId query parameter is missing', async () => {
      const response = await request(app).get('/api/payments');
      expect(response.status).toBe(400);
    });
  });
});
