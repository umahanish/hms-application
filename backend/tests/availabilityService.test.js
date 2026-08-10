import { describe, expect, it, beforeEach } from 'vitest';
import { createFakePool } from './helpers/fakePool.js';
import { migrateUp } from '../src/db/migrateSingleStore.js';
import { migrations } from '../src/migrations-singlestore/index.js';
import { getDoctorAvailability, hasConflict } from '../src/services/availability.js';

async function insertDoctor(pool, overrides = {}) {
  const doctor = { name: 'Dr. Smith', department: 'OPD', slot_duration_minutes: 30, buffer_minutes: 0, ...overrides };
  const [result] = await pool.execute(
    'INSERT INTO doctors (name, department, slot_duration_minutes, buffer_minutes) VALUES (?, ?, ?, ?)',
    [doctor.name, doctor.department, doctor.slot_duration_minutes, doctor.buffer_minutes],
  );
  return result.insertId;
}

async function insertWorkingHours(pool, doctorId, dayOfWeek, startTime, endTime) {
  await pool.execute(
    'INSERT INTO doctor_working_hours (doctor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
    [doctorId, dayOfWeek, startTime, endTime],
  );
}

async function insertPatient(pool) {
  const [result] = await pool.execute(
    `INSERT INTO patients (first_name, last_name, dob, gender, phone, email, address_line1, city,
      emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'Jane',
      'Doe',
      '1990-01-01',
      'female',
      '555-1234',
      'jane@example.com',
      '123 Main St',
      'Springfield',
      'John',
      '555-9999',
      'Acme',
      'POL-1',
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  );
  return result.insertId;
}

async function insertAppointment(pool, { doctorId, date, startTime, endTime, patientId, status = 'booked' }) {
  const resolvedPatientId = patientId ?? (await insertPatient(pool));
  const now = new Date().toISOString();
  const [result] = await pool.execute(
    `INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [resolvedPatientId, doctorId, date, startTime, endTime, status, now, now],
  );
  return result.insertId;
}

// 2026-08-05 is a Wednesday (day_of_week = 3).
const WEDNESDAY = '2026-08-05';
const WEDNESDAY_DOW = 3;

describe('getDoctorAvailability', () => {
  let pool;

  beforeEach(async () => {
    pool = createFakePool();
    await migrateUp(pool, migrations);
  });

  it('returns null for an unknown doctor', async () => {
    expect(await getDoctorAvailability(pool, 999, WEDNESDAY)).toBeNull();
  });

  it('computes open slots from working hours minus existing bookings', async () => {
    const doctorId = await insertDoctor(pool, { slot_duration_minutes: 30, buffer_minutes: 0 });
    await insertWorkingHours(pool, doctorId, WEDNESDAY_DOW, '09:00', '10:00');
    await insertAppointment(pool, { doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

    const availability = await getDoctorAvailability(pool, doctorId, WEDNESDAY);

    expect(availability.slots).toEqual([{ startTime: '09:30', endTime: '10:00' }]);
  });

  it('returns no slots when the doctor is on leave that day', async () => {
    const doctorId = await insertDoctor(pool);
    await insertWorkingHours(pool, doctorId, WEDNESDAY_DOW, '09:00', '10:00');
    await pool.execute('INSERT INTO doctor_leave (doctor_id, leave_date, reason) VALUES (?, ?, ?)', [
      doctorId,
      WEDNESDAY,
      'Conference',
    ]);

    expect(await getDoctorAvailability(pool, doctorId, WEDNESDAY)).toMatchObject({ onLeave: true, slots: [] });
  });

  it('returns no slots on a hospital-wide holiday', async () => {
    const doctorId = await insertDoctor(pool);
    await insertWorkingHours(pool, doctorId, WEDNESDAY_DOW, '09:00', '10:00');
    await pool.execute('INSERT INTO holidays (holiday_date, name) VALUES (?, ?)', [WEDNESDAY, 'National Day']);

    expect(await getDoctorAvailability(pool, doctorId, WEDNESDAY)).toMatchObject({ isHoliday: true, slots: [] });
  });

  it('applies department-specific slot durations independently per doctor', async () => {
    const opdDoctor = await insertDoctor(pool, { department: 'OPD', slot_duration_minutes: 15 });
    const specialistDoctor = await insertDoctor(pool, { department: 'Cardiology', slot_duration_minutes: 45 });
    await insertWorkingHours(pool, opdDoctor, WEDNESDAY_DOW, '09:00', '10:00');
    await insertWorkingHours(pool, specialistDoctor, WEDNESDAY_DOW, '09:00', '10:00');

    expect((await getDoctorAvailability(pool, opdDoctor, WEDNESDAY)).slots).toHaveLength(4);
    expect((await getDoctorAvailability(pool, specialistDoctor, WEDNESDAY)).slots).toHaveLength(1);
  });

  it('includes bookedSlots so the UI can render both available and booked slots', async () => {
    const doctorId = await insertDoctor(pool);
    await insertWorkingHours(pool, doctorId, WEDNESDAY_DOW, '09:00', '10:00');
    await insertAppointment(pool, { doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

    const availability = await getDoctorAvailability(pool, doctorId, WEDNESDAY);

    expect(availability.bookedSlots).toEqual([{ startTime: '09:00', endTime: '09:30' }]);
  });

  it('excludes a given appointment from the booked list, e.g. when rescheduling it', async () => {
    const doctorId = await insertDoctor(pool);
    await insertWorkingHours(pool, doctorId, WEDNESDAY_DOW, '09:00', '10:00');
    const appointmentId = await insertAppointment(pool, {
      doctorId,
      date: WEDNESDAY,
      startTime: '09:00',
      endTime: '09:30',
    });

    const availability = await getDoctorAvailability(pool, doctorId, WEDNESDAY, {
      excludeAppointmentId: appointmentId,
    });

    expect(availability.slots).toContainEqual({ startTime: '09:00', endTime: '09:30' });
  });
});

describe('hasConflict', () => {
  let pool;

  beforeEach(async () => {
    pool = createFakePool();
    await migrateUp(pool, migrations);
  });

  it('treats an unknown doctor as a conflict', async () => {
    expect(await hasConflict(pool, 999, WEDNESDAY, '09:00', '09:30')).toBe(true);
  });

  it('returns false when the slot does not overlap any booking', async () => {
    const doctorId = await insertDoctor(pool);
    await insertAppointment(pool, { doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

    expect(await hasConflict(pool, doctorId, WEDNESDAY, '10:00', '10:30')).toBe(false);
  });

  it('returns true when the slot overlaps an existing booking', async () => {
    const doctorId = await insertDoctor(pool);
    await insertAppointment(pool, { doctorId, date: WEDNESDAY, startTime: '09:00', endTime: '09:30' });

    expect(await hasConflict(pool, doctorId, WEDNESDAY, '09:15', '09:45')).toBe(true);
  });

  it('returns true when a slot falls within the doctor buffer time around a booking', async () => {
    const doctorId = await insertDoctor(pool, { buffer_minutes: 15 });
    await insertAppointment(pool, { doctorId, date: WEDNESDAY, startTime: '09:30', endTime: '10:00' });

    expect(await hasConflict(pool, doctorId, WEDNESDAY, '10:00', '10:30')).toBe(true);
  });

  it('ignores a cancelled appointment when checking for conflicts', async () => {
    const doctorId = await insertDoctor(pool);
    await insertAppointment(pool, {
      doctorId,
      date: WEDNESDAY,
      startTime: '09:00',
      endTime: '09:30',
      status: 'cancelled',
    });

    expect(await hasConflict(pool, doctorId, WEDNESDAY, '09:00', '09:30')).toBe(false);
  });

  it('excludes the appointment being rescheduled from its own conflict check', async () => {
    const doctorId = await insertDoctor(pool);
    const appointmentId = await insertAppointment(pool, {
      doctorId,
      date: WEDNESDAY,
      startTime: '09:00',
      endTime: '09:30',
    });

    expect(
      await hasConflict(pool, doctorId, WEDNESDAY, '09:00', '09:30', { excludeAppointmentId: appointmentId }),
    ).toBe(false);
  });
});
