import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers/setupTestApp.js';

const WEDNESDAY = '2026-08-05';
const WEDNESDAY_DOW = 3;

async function insertDoctor(pool, overrides = {}) {
  const doctor = {
    name: 'Dr. Smith',
    department: 'OPD',
    slot_duration_minutes: 30,
    buffer_minutes: 0,
    location: null,
    ...overrides,
  };
  const [result] = await pool.execute(
    'INSERT INTO doctors (name, department, slot_duration_minutes, buffer_minutes, location) VALUES (?, ?, ?, ?, ?)',
    [doctor.name, doctor.department, doctor.slot_duration_minutes, doctor.buffer_minutes, doctor.location],
  );
  return result.insertId;
}

async function insertWorkingHours(pool, doctorId, dayOfWeek, startTime, endTime) {
  await pool.execute(
    'INSERT INTO doctor_working_hours (doctor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
    [doctorId, dayOfWeek, startTime, endTime],
  );
}

describe('Doctors API', () => {
  let app;
  let pool;

  beforeEach(async () => {
    ({ app, pool } = await setupTestApp());
  });

  describe('GET /api/doctors', () => {
    it('lists all doctors', async () => {
      await insertDoctor(pool, { name: 'Dr. Smith', department: 'OPD' });
      await insertDoctor(pool, { name: 'Dr. Lee', department: 'Cardiology' });

      const response = await request(app).get('/api/doctors');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('includes an explicit location when set, falling back to department otherwise', async () => {
      await insertDoctor(pool, { name: 'Dr. Smith', department: 'OPD', location: 'Building A, Room 101' });
      await insertDoctor(pool, { name: 'Dr. Lee', department: 'Cardiology' });

      const response = await request(app).get('/api/doctors');

      const smith = response.body.find((d) => d.name === 'Dr. Smith');
      const lee = response.body.find((d) => d.name === 'Dr. Lee');
      expect(smith.location).toBe('Building A, Room 101');
      expect(lee.location).toBe('Cardiology');
    });

    it('filters doctors by department', async () => {
      await insertDoctor(pool, { name: 'Dr. Smith', department: 'OPD' });
      await insertDoctor(pool, { name: 'Dr. Lee', department: 'Cardiology' });

      const response = await request(app).get('/api/doctors').query({ department: 'Cardiology' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Dr. Lee');
    });
  });

  describe('GET /api/doctors/:id/availability', () => {
    it('returns available slots for a given date', async () => {
      const doctorId = await insertDoctor(pool, { slot_duration_minutes: 30 });
      await insertWorkingHours(pool, doctorId, WEDNESDAY_DOW, '09:00', '10:00');

      const response = await request(app)
        .get(`/api/doctors/${doctorId}/availability`)
        .query({ date: WEDNESDAY });

      expect(response.status).toBe(200);
      expect(response.body.slots).toEqual([
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '09:30', endTime: '10:00' },
      ]);
    });

    it('returns 400 when the date query parameter is missing', async () => {
      const doctorId = await insertDoctor(pool);
      const response = await request(app).get(`/api/doctors/${doctorId}/availability`);
      expect(response.status).toBe(400);
    });

    it('returns 404 for an unknown doctor', async () => {
      const response = await request(app)
        .get('/api/doctors/9999/availability')
        .query({ date: WEDNESDAY });
      expect(response.status).toBe(404);
    });
  });
});
