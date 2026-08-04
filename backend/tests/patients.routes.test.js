import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createConnection } from '../src/db/connection.js';
import { migrateUp } from '../src/db/migrate.js';
import { migrations } from '../src/migrations/index.js';
import { createApp } from '../src/app.js';

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

describe('Patient Registration REST API', () => {
  let db;
  let app;

  beforeEach(() => {
    db = createConnection(':memory:');
    migrateUp(db, migrations);
    app = createApp(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('POST /api/patients', () => {
    it('creates a new patient record and returns 201', async () => {
      const response = await request(app).post('/api/patients').send(VALID_PATIENT);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ firstName: 'Jane', lastName: 'Doe' });
      expect(response.body.id).toBeDefined();
    });

    it('returns 400 with field errors when required fields are missing', async () => {
      const response = await request(app).post('/api/patients').send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toMatchObject({ firstName: expect.any(String) });
    });

    it('returns 400 for an invalid email format', async () => {
      const response = await request(app)
        .post('/api/patients')
        .send({ ...VALID_PATIENT, email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.errors.email).toBeTruthy();
    });

    it('flags a duplicate on matching name + DOB + phone without blocking creation', async () => {
      await request(app).post('/api/patients').send(VALID_PATIENT);
      const response = await request(app).post('/api/patients').send(VALID_PATIENT);

      expect(response.status).toBe(201);
      expect(response.body.duplicateWarning).toBe(true);
    });

    it('returns 400 with an error payload for malformed JSON', async () => {
      const response = await request(app)
        .post('/api/patients')
        .set('Content-Type', 'application/json')
        .send('{not valid json');

      expect(response.status).toBe(400);
      expect(response.body.message).toBeTruthy();
    });
  });

  describe('GET /api/patients/:id', () => {
    it('returns the patient when found', async () => {
      const created = await request(app).post('/api/patients').send(VALID_PATIENT);

      const response = await request(app).get(`/api/patients/${created.body.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ firstName: 'Jane', lastName: 'Doe' });
    });

    it('returns 404 when the patient does not exist', async () => {
      const response = await request(app).get('/api/patients/9999');
      expect(response.status).toBe(404);
      expect(response.body.message).toBeTruthy();
    });
  });

  describe('GET /api/patients?search=', () => {
    it('returns matching patients by name', async () => {
      await request(app).post('/api/patients').send(VALID_PATIENT);

      const response = await request(app).get('/api/patients').query({ search: 'jane' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({ firstName: 'Jane' });
    });

    it('returns matching patients by phone', async () => {
      await request(app).post('/api/patients').send(VALID_PATIENT);

      const response = await request(app).get('/api/patients').query({ search: '555-123-4567' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });

    it('returns matching patients by DOB', async () => {
      await request(app).post('/api/patients').send(VALID_PATIENT);

      const response = await request(app).get('/api/patients').query({ search: '1990-01-01' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });

    it('returns an empty array when nothing matches', async () => {
      const response = await request(app).get('/api/patients').query({ search: 'nobody' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('returns 400 when the search query parameter is missing', async () => {
      const response = await request(app).get('/api/patients');
      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/patients/:id', () => {
    it('updates an existing patient and returns 200', async () => {
      const created = await request(app).post('/api/patients').send(VALID_PATIENT);

      const response = await request(app)
        .put(`/api/patients/${created.body.id}`)
        .send({ ...VALID_PATIENT, firstName: 'Janet' });

      expect(response.status).toBe(200);
      expect(response.body.firstName).toBe('Janet');
    });

    it('returns 404 when updating a patient that does not exist', async () => {
      const response = await request(app).put('/api/patients/9999').send(VALID_PATIENT);
      expect(response.status).toBe(404);
    });

    it('returns 400 with field errors when the update payload is invalid', async () => {
      const created = await request(app).post('/api/patients').send(VALID_PATIENT);

      const response = await request(app)
        .put(`/api/patients/${created.body.id}`)
        .send({ ...VALID_PATIENT, email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.errors.email).toBeTruthy();
    });
  });
});
