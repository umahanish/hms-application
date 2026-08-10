function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Flags existing patients that look like duplicates of the given candidate,
 * matched on normalized first name + last name + DOB + phone.
 */
export async function findDuplicates(pool, candidate, { excludeId } = {}) {
  const dob = candidate.dob;
  if (!dob) return [];

  const [rows] = await pool.execute('SELECT * FROM patients WHERE dob = ?', [dob]);

  const candidateFirst = normalizeName(candidate.firstName);
  const candidateLast = normalizeName(candidate.lastName);
  const candidatePhone = normalizePhone(candidate.phone);

  return rows.filter((row) => {
    if (excludeId != null && row.id === excludeId) return false;
    return (
      normalizeName(row.first_name) === candidateFirst &&
      normalizeName(row.last_name) === candidateLast &&
      normalizePhone(row.phone) === candidatePhone
    );
  });
}
