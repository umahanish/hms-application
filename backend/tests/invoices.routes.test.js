import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers/setupTestApp.js';
import { createPatient } from '../src/repositories/patientsRepository.js';

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

const LINE_ITEMS = [
  { description: 'Consultation', quantity: 1, unitPrice: 100 },
  { description: 'Lab test', quantity: 2, unitPrice: 25 },
];

describe('Billing & Invoice API', () => {
  let app;
  let patientId;

  beforeEach(async () => {
    const setup = await setupTestApp();
    app = setup.app;
    patientId = (await createPatient(setup.pool, VALID_PATIENT)).id;
  });

  function agent() {
    return {
      get: (path) => request(app).get(path).set('x-user-role', 'billing-staff'),
      post: (path) => request(app).post(path).set('x-user-role', 'billing-staff'),
      put: (path) => request(app).put(path).set('x-user-role', 'billing-staff'),
      delete: (path) => request(app).delete(path).set('x-user-role', 'billing-staff'),
    };
  }

  describe('authorization', () => {
    it('returns 401 without an x-user-role header', async () => {
      const response = await request(app).get('/api/invoices');
      expect(response.status).toBe(401);
    });

    it('returns 403 for a role that is not billing-staff or admin', async () => {
      const response = await request(app).get('/api/invoices').set('x-user-role', 'front-desk');
      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/invoices', () => {
    it('generates an invoice with accurate subtotal/discount/tax/total calculation', async () => {
      const response = await agent()
        .post('/api/invoices')
        .send({ patientId, lineItems: LINE_ITEMS, discountPercent: 10, taxPercent: 8 });

      // subtotal 150, discount 15 -> taxable 135, tax 10.8 -> total 145.8
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        patientId,
        subtotal: 150,
        discountAmount: 15,
        taxAmount: 10.8,
        total: 145.8,
        status: 'unpaid',
        amountPaid: 0,
      });
      expect(response.body.lineItems).toHaveLength(2);
    });

    it('returns 400 when line items are missing', async () => {
      const response = await agent().post('/api/invoices').send({ patientId, lineItems: [] });
      expect(response.status).toBe(400);
      expect(response.body.errors.lineItems).toBeTruthy();
    });

    it('returns 400 when a line item has an invalid quantity', async () => {
      const response = await agent()
        .post('/api/invoices')
        .send({ patientId, lineItems: [{ description: 'Bad', quantity: 0, unitPrice: 10 }] });
      expect(response.status).toBe(400);
    });

    it('returns 400 when the patient does not exist', async () => {
      const response = await agent().post('/api/invoices').send({ patientId: 9999, lineItems: LINE_ITEMS });
      expect(response.status).toBe(400);
      expect(response.body.errors.patientId).toBeTruthy();
    });

    it('is idempotent: reusing the same idempotencyKey returns the original invoice instead of creating a new one', async () => {
      const first = await agent()
        .post('/api/invoices')
        .send({ patientId, lineItems: LINE_ITEMS, idempotencyKey: 'req-abc-123' });
      const second = await agent()
        .post('/api/invoices')
        .send({ patientId, lineItems: LINE_ITEMS, idempotencyKey: 'req-abc-123' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body.id).toBe(first.body.id);

      const all = await agent().get('/api/invoices').query({ patient: patientId });
      expect(all.body).toHaveLength(1);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('retrieves an invoice by id', async () => {
      const created = await agent().post('/api/invoices').send({ patientId, lineItems: LINE_ITEMS });
      const response = await agent().get(`/api/invoices/${created.body.id}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(created.body.id);
    });

    it('returns 404 for an unknown invoice', async () => {
      const response = await agent().get('/api/invoices/9999');
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/invoices?patient=', () => {
    it('returns all invoices for a patient', async () => {
      await agent().post('/api/invoices').send({ patientId, lineItems: LINE_ITEMS });
      await agent().post('/api/invoices').send({ patientId, lineItems: LINE_ITEMS });

      const response = await agent().get('/api/invoices').query({ patient: patientId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('returns every invoice when no filters are given, for the billing dashboard', async () => {
      await agent().post('/api/invoices').send({ patientId, lineItems: LINE_ITEMS });
      await agent().post('/api/invoices').send({ patientId, lineItems: LINE_ITEMS });

      const response = await agent().get('/api/invoices');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('filters by status', async () => {
      const created = await agent().post('/api/invoices').send({ patientId, lineItems: LINE_ITEMS });
      await agent().put(`/api/invoices/${created.body.id}/status`).send({ status: 'paid' });
      await agent().post('/api/invoices').send({ patientId, lineItems: LINE_ITEMS });

      const response = await agent().get('/api/invoices').query({ status: 'paid' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('paid');
    });

    it('rejects an invalid status filter', async () => {
      const response = await agent().get('/api/invoices').query({ status: 'not-a-status' });
      expect(response.status).toBe(400);
    });

    it('filters by department', async () => {
      await agent().post('/api/invoices').send({ patientId, lineItems: LINE_ITEMS, department: 'OPD' });
      await agent().post('/api/invoices').send({ patientId, lineItems: LINE_ITEMS, department: 'Cardiology' });

      const response = await agent().get('/api/invoices').query({ department: 'Cardiology' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].department).toBe('Cardiology');
    });
  });

  describe('PUT /api/invoices/:id/status', () => {
    it('transitions an invoice from unpaid to partial to paid', async () => {
      const created = await agent().post('/api/invoices').send({ patientId, lineItems: LINE_ITEMS });

      const partial = await agent().put(`/api/invoices/${created.body.id}/status`).send({ status: 'partial' });
      expect(partial.status).toBe(200);
      expect(partial.body.status).toBe('partial');

      const paid = await agent().put(`/api/invoices/${created.body.id}/status`).send({ status: 'paid' });
      expect(paid.status).toBe(200);
      expect(paid.body.status).toBe('paid');
    });

    it('rejects an invalid status value', async () => {
      const created = await agent().post('/api/invoices').send({ patientId, lineItems: LINE_ITEMS });
      const response = await agent()
        .put(`/api/invoices/${created.body.id}/status`)
        .send({ status: 'not-a-status' });
      expect(response.status).toBe(400);
    });

    it('returns 404 when updating the status of an unknown invoice', async () => {
      const response = await agent().put('/api/invoices/9999/status').send({ status: 'paid' });
      expect(response.status).toBe(404);
    });
  });
});
