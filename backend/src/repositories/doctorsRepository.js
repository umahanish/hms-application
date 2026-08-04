function toDoctor(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    slotDurationMinutes: row.slot_duration_minutes,
    bufferMinutes: row.buffer_minutes,
  };
}

export function findDoctorById(db, id) {
  return toDoctor(db.prepare('SELECT * FROM doctors WHERE id = ?').get(id));
}

export function listDoctors(db, { department } = {}) {
  const rows = department
    ? db.prepare('SELECT * FROM doctors WHERE department = ? ORDER BY name').all(department)
    : db.prepare('SELECT * FROM doctors ORDER BY name').all();
  return rows.map(toDoctor);
}
