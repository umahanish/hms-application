export function findDoctorById(db, id) {
  const row = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    slotDurationMinutes: row.slot_duration_minutes,
    bufferMinutes: row.buffer_minutes,
  };
}
