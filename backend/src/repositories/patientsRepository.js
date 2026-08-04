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

export function createPatient(db, patient) {
  const row = toRow(patient);
  const result = db
    .prepare(
      `INSERT INTO patients (first_name, last_name, dob, gender, phone, email, address_line1, address_line2,
        city, state, zip, emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number)
       VALUES (@first_name, @last_name, @dob, @gender, @phone, @email, @address_line1, @address_line2,
        @city, @state, @zip, @emergency_contact_name, @emergency_contact_phone, @insurance_provider, @insurance_policy_number)`,
    )
    .run(row);

  return findPatientById(db, result.lastInsertRowid);
}

export function updatePatient(db, id, patient) {
  const existing = findPatientById(db, id);
  if (!existing) return null;

  const row = toRow(patient);
  db.prepare(
    `UPDATE patients SET
      first_name = @first_name, last_name = @last_name, dob = @dob, gender = @gender,
      phone = @phone, email = @email, address_line1 = @address_line1, address_line2 = @address_line2,
      city = @city, state = @state, zip = @zip, emergency_contact_name = @emergency_contact_name,
      emergency_contact_phone = @emergency_contact_phone, insurance_provider = @insurance_provider,
      insurance_policy_number = @insurance_policy_number,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = @id`,
  ).run({ ...row, id });

  return findPatientById(db, id);
}

export function findPatientById(db, id) {
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  return toPatient(row);
}

export function searchPatients(db, term) {
  const like = `%${term.toLowerCase()}%`;
  const rows = db
    .prepare(
      `SELECT * FROM patients
       WHERE lower(first_name) LIKE @like
          OR lower(last_name) LIKE @like
          OR lower(first_name || ' ' || last_name) LIKE @like
          OR phone LIKE @like
          OR dob LIKE @like
          OR CAST(id AS TEXT) = @term
       ORDER BY last_name, first_name`,
    )
    .all({ like, term });

  return rows.map(toPatient);
}
