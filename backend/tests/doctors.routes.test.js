import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createConnection } from '../src/db/connection.js';
import { migrateUp } from '../src/db/migrate.js';
import { migrations } from '../src/migrations/index.js';
import { createApp } from '../src/app.js';

const WEDNESDAY = '2026-08-05';
const WEDNESDAY_DOW = 3;

function insertDoctor(db, overrides = {}) {
  const doctor = {
    name: 'Dr. Smith',
    department: 'OPD',
    slot_duration_minutes: 30,
    buffer_minutes: 0,
    location: null,
    ...overrides,
  };
  const result = db
    .prepare(
      'INSERT INTO doctors (name, department, slot_duration_minutes, buffer_minutes, location) VALUES (@name, @department, @slot_duration_minutes, @buffer_minutes, @location)',
    )
    .run(doctor);
  return result.lastInsertRowid;
}

function insertWorkingHours(db, doctorId, dayOfWeek, startTime, endTime) {
  db.prepare(
    'INSERT INTO doctor_working_hours (doctor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
  ).run(doctorId, dayOfWeek, startTime, endTime);
}

describe('Doctors API', () => {
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

  describe('GET /api/doctors', () => {
    it('lists all doctors', async () => {
      insertDoctor(db, { name: 'Dr. Smith', department: 'OPD' });
      insertDoctor(db, { name: 'Dr. Lee', department: 'Cardiology' });

      const response = await request(app).get('/api/doctors');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('includes an explicit location when set, falling back to department otherwise', async () => {
      insertDoctor(db, { name: 'Dr. Smith', department: 'OPD', location: 'Building A, Room 101' });
      insertDoctor(db, { name: 'Dr. Lee', department: 'Cardiology' });

      const response = await request(app).get('/api/doctors');

      const smith = response.body.find((d) => d.name === 'Dr. Smith');
      const lee = response.body.find((d) => d.name === 'Dr. Lee');
      expect(smith.location).toBe('Building A, Room 101');
      expect(lee.location).toBe('Cardiology');
    });

    it('filters doctors by department', async () => {
      insertDoctor(db, { name: 'Dr. Smith', department: 'OPD' });
      insertDoctor(db, { name: 'Dr. Lee', department: 'Cardiology' });

      const response = await request(app).get('/api/doctors').query({ department: 'Cardiology' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Dr. Lee');
    });
  });

  describe('GET /api/doctors/:id/availability', () => {
    it('returns available slots for a given date', async () => {
      const doctorId = insertDoctor(db, { slot_duration_minutes: 30 });
      insertWorkingHours(db, doctorId, WEDNESDAY_DOW, '09:00', '10:00');

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
      const doctorId = insertDoctor(db);
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
