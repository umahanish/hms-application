function toDoctor(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    slotDurationMinutes: row.slot_duration_minutes,
    bufferMinutes: row.buffer_minutes,
    location: row.location ?? row.department,
  };
}

export async function findDoctorById(pool, id) {
  const [rows] = await pool.execute('SELECT * FROM doctors WHERE id = ?', [id]);
  return toDoctor(rows[0]);
}

export async function listDoctors(pool, { department } = {}) {
  const [rows] = department
    ? await pool.execute('SELECT * FROM doctors WHERE department = ? ORDER BY name', [department])
    : await pool.execute('SELECT * FROM doctors ORDER BY name');
  return rows.map(toDoctor);
}
