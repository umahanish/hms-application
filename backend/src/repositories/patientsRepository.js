function toRow(patient) {
  return {
    first_name: patient.firstName,
    last_name: patient.lastName,
    dob: patient.dob,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    address_line1: patient.addressLine1,
    address_line2: patient.addressLine2 ?? null,
    city: patient.city,
    state: patient.state ?? null,
    zip: patient.zip ?? null,
    emergency_contact_name: patient.emergencyContactName,
    emergency_contact_phone: patient.emergencyContactPhone,
    insurance_provider: patient.insuranceProvider,
    insurance_policy_number: patient.insurancePolicyNumber,
  };
}

function toPatient(row) {
  if (!row) return null;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    dob: row.dob,
    gender: row.gender,
    phone: row.phone,
    email: row.email,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    insuranceProvider: row.insurance_provider,
    insurancePolicyNumber: row.insurance_policy_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createPatient(pool, patient) {
  const row = toRow(patient);
  const now = new Date().toISOString();

  const [result] = await pool.execute(
    `INSERT INTO patients (first_name, last_name, dob, gender, phone, email, address_line1, address_line2,
      city, state, zip, emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.first_name,
      row.last_name,
      row.dob,
      row.gender,
      row.phone,
      row.email,
      row.address_line1,
      row.address_line2,
      row.city,
      row.state,
      row.zip,
      row.emergency_contact_name,
      row.emergency_contact_phone,
      row.insurance_provider,
      row.insurance_policy_number,
      now,
      now,
    ],
  );

  return findPatientById(pool, result.insertId);
}

export async function updatePatient(pool, id, patient) {
  const existing = await findPatientById(pool, id);
  if (!existing) return null;

  const row = toRow(patient);
  const now = new Date().toISOString();

  await pool.execute(
    `UPDATE patients SET
      first_name = ?, last_name = ?, dob = ?, gender = ?,
      phone = ?, email = ?, address_line1 = ?, address_line2 = ?,
      city = ?, state = ?, zip = ?, emergency_contact_name = ?,
      emergency_contact_phone = ?, insurance_provider = ?,
      insurance_policy_number = ?, updated_at = ?
     WHERE id = ?`,
    [
      row.first_name,
      row.last_name,
      row.dob,
      row.gender,
      row.phone,
      row.email,
      row.address_line1,
      row.address_line2,
      row.city,
      row.state,
      row.zip,
      row.emergency_contact_name,
      row.emergency_contact_phone,
      row.insurance_provider,
      row.insurance_policy_number,
      now,
      id,
    ],
  );

  return findPatientById(pool, id);
}

export async function findPatientById(pool, id) {
  const [rows] = await pool.execute('SELECT * FROM patients WHERE id = ?', [id]);
  return toPatient(rows[0]);
}

export async function searchPatients(pool, term) {
  const like = `%${term.toLowerCase()}%`;
  const [rows] = await pool.execute(
    `SELECT * FROM patients
     WHERE LOWER(first_name) LIKE ?
        OR LOWER(last_name) LIKE ?
        OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE ?
        OR phone LIKE ?
        OR dob LIKE ?
        OR CAST(id AS CHAR) = ?
     ORDER BY last_name, first_name`,
    [like, like, like, like, like, term],
  );

  return rows.map(toPatient);
}
