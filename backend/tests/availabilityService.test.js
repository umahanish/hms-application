import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createConnection } from '../src/db/connection.js';
import { migrateUp } from '../src/db/migrate.js';
import { migrations } from '../src/migrations/index.js';
import { getDoctorAvailability, hasConflict } from '../src/services/availability.js';

function insertDoctor(db, overrides = {}) {
  const doctor = { name: 'Dr. Smith', department: 'OPD', slot_duration_minutes: 30, buffer_minutes: 0, ...overrides };
  const result = db
    .prepare(
      'INSERT INTO doctors (name, department, slot_duration_minutes, buffer_minutes) VALUES (@name, @department, @slot_duration_minutes, @buffer_minutes)',
    )
    .run(doctor);
  return result.lastInsertRowid;
}

function insertWorkingHours(db, doctorId, dayOfWeek, startTime, endTime) {
  db.prepare(
    'INSERT INTO doctor_working_hours (doctor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
  ).run(doctorId, dayOfWeek, startTime, endTime);
}

function insertPatient(db) {
  const result = db
    .prepare(
      `INSERT INTO patients (first_name, last_name, dob, gender, phone, email, address_line1, city,
        emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number)
       VALUES ('Jane', 'Doe', '1990-01-01', 'female', '555-1234', 'jane@example.com', '123 Main St', 'Springfield',
        'John', '555-9999', 'Acme', 'POL-1')`,
    )
    .run();
  return result.lastInsertRowid;
}

function insertAppointment(db, { doctorId, date, startTime, endTime, patientId, status = 'booked' }) {
  const resolvedPatientId = patientId ?? insertPatient(db);
  const result = db
    .prepare(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(resolvedPatientId, doctorId, date, startTime, endTime, status);
  return result.lastInsertRowid;
}

// 2026-08-05 is a Wednesday (day_of_week = 3).
const WEDNESDAY = '2026-08-05';
const WEDNESDAY_DOW = 3;

describe('getDoctorAvailability', () => {
  let db;

  beforeEach(() => {
    db = createConnection(':memory:');
    migrateUp(db, migrations);
  });

  afterEach(() => {
    db.close();
  });

  it('returns null for an unknown doctor', () => {
    expect(getDoctorAvailability(db, 999, WEDNESDAY)).toBeNull();
  });

  it('computes open slots from working hours minus existing bookings', () => {
    const doctorId = insertDoctor(db, { slot_duration_minutes: 30, buffer_minutes: 0 });
    insertWorkingHours(db, doctorId, WEDNESDAY_DOW, '09:00', '10:00');
    insertAppointment(db, { doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

    const availability = getDoctorAvailability(db, doctorId, WEDNESDAY);

    expect(availability.slots).toEqual([{ startTime: '09:30', endTime: '10:00' }]);
  });

  it('returns no slots when the doctor is on leave that day', () => {
    const doctorId = insertDoctor(db);
    insertWorkingHours(db, doctorId, WEDNESDAY_DOW, '09:00', '10:00');
    db.prepare('INSERT INTO doctor_leave (doctor_id, leave_date, reason) VALUES (?, ?, ?)').run(
      doctorId,
      WEDNESDAY,
      'Conference',
    );

    expect(getDoctorAvailability(db, doctorId, WEDNESDAY)).toMatchObject({ onLeave: true, slots: [] });
  });

  it('returns no slots on a hospital-wide holiday', () => {
    const doctorId = insertDoctor(db);
    insertWorkingHours(db, doctorId, WEDNESDAY_DOW, '09:00', '10:00');
    db.prepare('INSERT INTO holidays (holiday_date, name) VALUES (?, ?)').run(WEDNESDAY, 'National Day');

    expect(getDoctorAvailability(db, doctorId, WEDNESDAY)).toMatchObject({ isHoliday: true, slots: [] });
  });

  it('applies department-specific slot durations independently per doctor', () => {
    const opdDoctor = insertDoctor(db, { department: 'OPD', slot_duration_minutes: 15 });
    const specialistDoctor = insertDoctor(db, { department: 'Cardiology', slot_duration_minutes: 45 });
    insertWorkingHours(db, opdDoctor, WEDNESDAY_DOW, '09:00', '10:00');
    insertWorkingHours(db, specialistDoctor, WEDNESDAY_DOW, '09:00', '10:00');

    expect(getDoctorAvailability(db, opdDoctor, WEDNESDAY).slots).toHaveLength(4);
    expect(getDoctorAvailability(db, specialistDoctor, WEDNESDAY).slots).toHaveLength(1);
  });

  it('excludes a given appointment from the booked list, e.g. when rescheduling it', () => {
    const doctorId = insertDoctor(db);
    insertWorkingHours(db, doctorId, WEDNESDAY_DOW, '09:00', '10:00');
    const appointmentId = insertAppointment(db, { doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

    const availability = getDoctorAvailability(db, doctorId, WEDNESDAY, { excludeAppointmentId: appointmentId });

    expect(availability.slots).toContainEqual({ startTime: '09:00', endTime: '09:30' });
  });
});

describe('hasConflict', () => {
  let db;

  beforeEach(() => {
    db = createConnection(':memory:');
    migrateUp(db, migrations);
  });

  afterEach(() => {
    db.close();
  });

  it('treats an unknown doctor as a conflict', () => {
    expect(hasConflict(db, 999, WEDNESDAY, '09:00', '09:30')).toBe(true);
  });

  it('returns false when the slot does not overlap any booking', () => {
    const doctorId = insertDoctor(db);
    insertAppointment(db, { doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

    expect(hasConflict(db, doctorId, WEDNESDAY, '10:00', '10:30')).toBe(false);
  });

  it('returns true when the slot overlaps an existing booking', () => {
    const doctorId = insertDoctor(db);
    insertAppointment(db, { doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

    expect(hasConflict(db, doctorId, WEDNESDAY, '09:15', '09:45')).toBe(true);
  });

  it('returns true when a slot falls within the doctor buffer time around a booking', () => {
    const doctorId = insertDoctor(db, { buffer_minutes: 15 });
    insertAppointment(db, { doctorId, date: WEDNESDAY, startTime: '09:30', endTime: '10:00' });

    expect(hasConflict(db, doctorId, WEDNESDAY, '10:00', '10:30')).toBe(true);
  });

  it('ignores a cancelled appointment when checking for conflicts', () => {
    const doctorId = insertDoctor(db);
    insertAppointment(db, { doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30', status: 'cancelled' });

    expect(hasConflict(db, doctorId, WEDNESDAY, '09:00', '09:30')).toBe(false);
  });

  it('excludes the appointment being rescheduled from its own conflict check', () => {
    const doctorId = insertDoctor(db);
    const appointmentId = insertAppointment(db, { doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

    expect(
      hasConflict(db, doctorId, WEDNESDAY, '09:00', '09:30', { excludeAppointmentId: appointmentId }),
    ).toBe(false);
  });
});
