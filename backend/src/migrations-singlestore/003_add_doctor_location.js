export const id = '003_add_doctor_location';

export async function up(pool) {
  await pool.query('ALTER TABLE doctors ADD COLUMN location VARCHAR(150);');
}

export async function down(pool) {
  await pool.query('ALTER TABLE doctors DROP COLUMN location;');
}
