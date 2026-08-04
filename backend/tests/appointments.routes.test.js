import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createConnection } from '../src/db/connection.js';
import { migrateUp } from '../src/db/migrate.js';
import { migrations } from '../src/migrations/index.js';
import { createApp } from '../src/app.js';
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

// 2026-08-05 is a Wednesday.
const WEDNESDAY = '2026-08-05';
const WEDNESDAY_DOW = 3;

function insertDoctor(db, overrides = {}) {
  const doctor = { name: 'Dr. Smith', department: 'OPD', slot_duration_minutes: 30, buffer_minutes: 0, ...overrides };
  const result = db
    .prepare(
      'INSERT INTO doctors (name, department, slot_duration_minutes, buffer_minutes) VALUES (@name, @department, @slot_duration_minutes, @buffer_minutes)',
    )
    .run(doctor);
  db.prepare('INSERT INTO doctor_working_hours (doctor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)').run(
    result.lastInsertRowid,
    WEDNESDAY_DOW,
    '09:00',
    '12:00',
  );
  return result.lastInsertRowid;
}

describe('Appointment Scheduling API', () => {
  let db;
  let app;
  let patientId;
  let doctorId;

  beforeEach(() => {
    db = createConnection(':memory:');
    migrateUp(db, migrations);
    app = createApp(db);
    patientId = createPatient(db, VALID_PATIENT).id;
    doctorId = insertDoctor(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('POST /api/appointments', () => {
    it('books an appointment and returns 201', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        patientId,
        doctorId,
        date: WEDNESDAY,
        startTime: '09:00',
        endTime: '09:30',
        status: 'booked',
      });
    });

    it('returns 400 with field errors when required fields are missing', async () => {
      const response = await request(app).post('/api/appointments').send({ patientId, doctorId });
      expect(response.status).toBe(400);
      expect(response.body.errors.date).toBeTruthy();
    });

    it('returns 400 when the patient does not exist', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .send({ patientId: 9999, doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });
      expect(response.status).toBe(400);
      expect(response.body.errors.patientId).toBeTruthy();
    });

    it('returns 400 when the doctor does not exist', async () => {
      const response = await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId: 9999, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });
      expect(response.status).toBe(400);
      expect(response.body.errors.doctorId).toBeTruthy();
    });

    it('rejects an overlapping booking with 409', async () => {
      await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

      const response = await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '09:15', endTime: '09:45' });

      expect(response.status).toBe(409);
    });

    it('does not double-book when two requests race for the same slot', async () => {
      const bookSameSlot = () =>
        request(app)
          .post('/api/appointments')
          .send({ patientId, doctorId, date: WEDNESDAY, startTime: '10:00', endTime: '10:30' });

      const [first, second] = await Promise.all([bookSameSlot(), bookSameSlot()]);
      const statuses = [first.status, second.status].sort();

      expect(statuses).toEqual([201, 409]);
    });
  });

  describe('GET /api/appointments', () => {
    it('filters by doctor and date range', async () => {
      await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

      const response = await request(app)
        .get('/api/appointments')
        .query({ doctorId, dateFrom: WEDNESDAY, dateTo: WEDNESDAY });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });

    it('filters by patient', async () => {
      await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

      const response = await request(app).get('/api/appointments').query({ patientId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    });

    it('returns an empty array when nothing matches the filters', async () => {
      const response = await request(app).get('/api/appointments').query({ doctorId: 9999 });
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('PUT /api/appointments/:id (reschedule)', () => {
    it('reschedules an appointment to a new time', async () => {
      const created = await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

      const response = await request(app)
        .put(`/api/appointments/${created.body.id}`)
        .send({ date: WEDNESDAY, startTime: '10:00', endTime: '10:30' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ startTime: '10:00', endTime: '10:30' });
    });

    it('returns 409 when rescheduling into a slot that is already booked', async () => {
      await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '10:00', endTime: '10:30' });
      const toMove = await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

      const response = await request(app)
        .put(`/api/appointments/${toMove.body.id}`)
        .send({ date: WEDNESDAY, startTime: '10:00', endTime: '10:30' });

      expect(response.status).toBe(409);
    });

    it('returns 404 when rescheduling an appointment that does not exist', async () => {
      const response = await request(app)
        .put('/api/appointments/9999')
        .send({ date: WEDNESDAY, startTime: '10:00', endTime: '10:30' });
      expect(response.status).toBe(404);
    });

    it('returns 409 when rescheduling a cancelled appointment', async () => {
      const created = await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });
      await request(app).delete(`/api/appointments/${created.body.id}`);

      const response = await request(app)
        .put(`/api/appointments/${created.body.id}`)
        .send({ date: WEDNESDAY, startTime: '10:00', endTime: '10:30' });

      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/appointments/:id (cancellation)', () => {
    it('cancels an appointment and returns its updated status', async () => {
      const created = await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

      const response = await request(app).delete(`/api/appointments/${created.body.id}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');
    });

    it('frees up the slot for a new booking after cancellation', async () => {
      const created = await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });
      await request(app).delete(`/api/appointments/${created.body.id}`);

      const response = await request(app)
        .post('/api/appointments')
        .send({ patientId, doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

      expect(response.status).toBe(201);
    });

    it('returns 404 when cancelling an appointment that does not exist', async () => {
      const response = await request(app).delete('/api/appointments/9999');
      expect(response.status).toBe(404);
    });
  });
});
