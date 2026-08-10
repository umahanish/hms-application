export const id = '002_create_scheduling';

export async function up(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      department VARCHAR(100) NOT NULL,
      slot_duration_minutes INT NOT NULL DEFAULT 30,
      buffer_minutes INT NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctor_working_hours (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      doctor_id BIGINT NOT NULL,
      day_of_week INT NOT NULL,
      start_time VARCHAR(5) NOT NULL,
      end_time VARCHAR(5) NOT NULL,
      KEY idx_doctor_working_hours_doctor (doctor_id, day_of_week)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctor_leave (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      doctor_id BIGINT NOT NULL,
      leave_date VARCHAR(10) NOT NULL,
      reason VARCHAR(255),
      KEY idx_doctor_leave_doctor_date (doctor_id, leave_date)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS holidays (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      holiday_date VARCHAR(10) NOT NULL,
      name VARCHAR(150),
      UNIQUE KEY uq_holidays_date (holiday_date)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT NOT NULL,
      doctor_id BIGINT NOT NULL,
      appointment_date VARCHAR(10) NOT NULL,
      start_time VARCHAR(5) NOT NULL,
      end_time VARCHAR(5) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'booked',
      reason VARCHAR(500),
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL,
      KEY idx_appointments_doctor_date (doctor_id, appointment_date),
      KEY idx_appointments_patient (patient_id)
    );
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS appointments;');
  await pool.query('DROP TABLE IF EXISTS holidays;');
  await pool.query('DROP TABLE IF EXISTS doctor_leave;');
  await pool.query('DROP TABLE IF EXISTS doctor_working_hours;');
  await pool.query('DROP TABLE IF EXISTS doctors;');
}
