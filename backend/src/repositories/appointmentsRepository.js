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

function findRow(db, id) {
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
}

export function findAppointmentById(db, id) {
  return toAppointment(findRow(db, id));
}

/**
 * Checks for a scheduling conflict and inserts the appointment inside a single
 * synchronous transaction. better-sqlite3 executes transactions synchronously, so
 * no other request can interleave between the check and the insert, which is what
 * makes this safe against double-booking races within the same process.
 */
export function createAppointment(db, { patientId, doctorId, date, startTime, endTime, reason }) {
  return db.transaction(() => {
    if (hasConflict(db, doctorId, date, startTime, endTime)) {
      throw new SlotConflictError('The selected slot is no longer available');
    }

    const result = db
      .prepare(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time, reason)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(patientId, doctorId, date, startTime, endTime, reason ?? null);

    return findAppointmentById(db, result.lastInsertRowid);
  })();
}

/** Reschedules an existing, non-cancelled appointment to a new date/time, atomically re-checking for conflicts. */
export function rescheduleAppointment(db, id, { date, startTime, endTime, reason }) {
  return db.transaction(() => {
    const existing = findRow(db, id);
    if (!existing) return null;
    if (existing.status === 'cancelled') {
      throw new CancelledAppointmentError('Cannot reschedule a cancelled appointment');
    }

    if (hasConflict(db, existing.doctor_id, date, startTime, endTime, { excludeAppointmentId: id })) {
      throw new SlotConflictError('The selected slot is no longer available');
    }

    db.prepare(
      `UPDATE appointments SET appointment_date = ?, start_time = ?, end_time = ?, reason = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    ).run(date, startTime, endTime, reason ?? existing.reason, id);

    return findAppointmentById(db, id);
  })();
}

export function cancelAppointment(db, id) {
  const existing = findRow(db, id);
  if (!existing) return null;

  db.prepare(
    `UPDATE appointments SET status = 'cancelled', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(id);

  return findAppointmentById(db, id);
}

export function findAppointments(db, { patientId, doctorId, dateFrom, dateTo } = {}) {
  const clauses = [];
  const params = {};

  if (patientId != null) {
    clauses.push('patient_id = @patientId');
    params.patientId = patientId;
  }
  if (doctorId != null) {
    clauses.push('doctor_id = @doctorId');
    params.doctorId = doctorId;
  }
  if (dateFrom) {
    clauses.push('appointment_date >= @dateFrom');
    params.dateFrom = dateFrom;
  }
  if (dateTo) {
    clauses.push('appointment_date <= @dateTo');
    params.dateTo = dateTo;
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM appointments ${where} ORDER BY appointment_date, start_time`)
    .all(params);

  return rows.map(toAppointment);
}
