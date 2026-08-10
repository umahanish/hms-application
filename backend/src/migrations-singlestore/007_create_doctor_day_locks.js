/**
 * better-sqlite3's synchronous transactions used to make check-then-insert booking
 * safe for free (no other request could interleave). Against a real networked
 * SingleStore connection that guarantee is gone, so booking/reschedule now takes a
 * row lock (SELECT ... FOR UPDATE) on the (doctor_id, appointment_date) row here
 * before running the buffer-aware conflict check, serializing concurrent attempts
 * to book the same doctor's day.
 */
export const id = '007_create_doctor_day_locks';

export async function up(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctor_day_locks (
      doctor_id BIGINT NOT NULL,
      appointment_date VARCHAR(10) NOT NULL,
      PRIMARY KEY (doctor_id, appointment_date)
    );
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS doctor_day_locks;');
}
