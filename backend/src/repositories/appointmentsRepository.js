import { hasConflict } from '../services/availability.js';

export class SlotConflictError extends Error {}
export class CancelledAppointmentError extends Error {}

function toAppointment(row) {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    date: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findRow(pool, id) {
  const [rows] = await pool.execute('SELECT * FROM appointments WHERE id = ?', [id]);
  return rows[0];
}

export async function findAppointmentById(pool, id) {
  return toAppointment(await findRow(pool, id));
}

/**
 * Takes a row lock on (doctor_id, date) so concurrent booking/reschedule attempts
 * for the same doctor's day serialize instead of racing between the conflict check
 * and the insert/update below.
 */
async function lockDoctorDay(connection, doctorId, date) {
  await connection.execute(
    'INSERT INTO doctor_day_locks (doctor_id, appointment_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE doctor_id = doctor_id',
    [doctorId, date],
  );
  await connection.execute(
    'SELECT * FROM doctor_day_locks WHERE doctor_id = ? AND appointment_date = ? FOR UPDATE',
    [doctorId, date],
  );
}

/** Checks for a scheduling conflict and inserts the appointment inside a single, doctor/day-locked transaction. */
export async function createAppointment(pool, { patientId, doctorId, date, startTime, endTime, reason }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await lockDoctorDay(connection, doctorId, date);

    if (await hasConflict(connection, doctorId, date, startTime, endTime)) {
      throw new SlotConflictError('The selected slot is no longer available');
    }

    const now = new Date().toISOString();
    const [result] = await connection.execute(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time, status, reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'booked', ?, ?, ?)`,
      [patientId, doctorId, date, startTime, endTime, reason ?? null, now, now],
    );

    await connection.commit();
    return await findAppointmentById(pool, result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Reschedules an existing, non-cancelled appointment to a new date/time, atomically re-checking for conflicts. */
export async function rescheduleAppointment(pool, id, { date, startTime, endTime, reason }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [id]);
    const existing = existingRows[0];
    if (!existing) {
      await connection.commit();
      return null;
    }
    if (existing.status === 'cancelled') {
      throw new CancelledAppointmentError('Cannot reschedule a cancelled appointment');
    }

    await lockDoctorDay(connection, existing.doctor_id, date);

    if (await hasConflict(connection, existing.doctor_id, date, startTime, endTime, { excludeAppointmentId: id })) {
      throw new SlotConflictError('The selected slot is no longer available');
    }

    const now = new Date().toISOString();
    await connection.execute(
      `UPDATE appointments SET appointment_date = ?, start_time = ?, end_time = ?, reason = ?, updated_at = ?
       WHERE id = ?`,
      [date, startTime, endTime, reason ?? existing.reason, now, id],
    );

    await connection.commit();
    return await findAppointmentById(pool, id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function cancelAppointment(pool, id) {
  const existing = await findRow(pool, id);
  if (!existing) return null;

  const now = new Date().toISOString();
  await pool.execute(`UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?`, [now, id]);

  return findAppointmentById(pool, id);
}

export async function findAppointments(pool, { patientId, doctorId, dateFrom, dateTo } = {}) {
  const clauses = [];
  const params = [];

  if (patientId != null) {
    clauses.push('patient_id = ?');
    params.push(patientId);
  }
  if (doctorId != null) {
    clauses.push('doctor_id = ?');
    params.push(doctorId);
  }
  if (dateFrom) {
    clauses.push('appointment_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    clauses.push('appointment_date <= ?');
    params.push(dateTo);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT * FROM appointments ${where} ORDER BY appointment_date, start_time`,
    params,
  );

  return rows.map(toAppointment);
}
