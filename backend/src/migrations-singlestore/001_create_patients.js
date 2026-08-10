export const id = '001_create_patients';

export async function up(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      dob VARCHAR(10) NOT NULL,
      gender VARCHAR(20) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      email VARCHAR(255) NOT NULL,
      address_line1 VARCHAR(255) NOT NULL,
      address_line2 VARCHAR(255),
      city VARCHAR(100) NOT NULL,
      state VARCHAR(100),
      zip VARCHAR(20),
      emergency_contact_name VARCHAR(150) NOT NULL,
      emergency_contact_phone VARCHAR(30) NOT NULL,
      insurance_provider VARCHAR(150) NOT NULL,
      insurance_policy_number VARCHAR(100) NOT NULL,
      created_at VARCHAR(30) NOT NULL,
      updated_at VARCHAR(30) NOT NULL,
      KEY idx_patients_name (last_name, first_name),
      KEY idx_patients_dob (dob),
      KEY idx_patients_phone (phone)
    );
  `);
}

export async function down(pool) {
  await pool.query('DROP TABLE IF EXISTS patients;');
}
