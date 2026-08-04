import './PatientProfile.css';

export default function PatientProfile({ patient, onEdit, error }) {
  if (error) {
    return (
      <div className="patient-profile">
        <p role="alert" className="profile-error">
          {error}
        </p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="patient-profile">
        <p className="profile-empty">Select a patient to view their profile.</p>
      </div>
    );
  }

  const visits = patient.visitHistory ?? [];

  return (
    <div className="patient-profile">
      <header className="profile-header">
        <h2>
          {patient.firstName} {patient.lastName}
        </h2>
        <button type="button" onClick={() => onEdit?.(patient)}>
          Edit
        </button>
      </header>

      <section aria-label="Demographics">
        <h3>Demographics</h3>
        <dl>
          <dt>Date of Birth</dt>
          <dd>{patient.dob || 'Not provided'}</dd>
          <dt>Gender</dt>
          <dd>{patient.gender || 'Not provided'}</dd>
          <dt>Phone</dt>
          <dd>{patient.phone || 'Not provided'}</dd>
          <dt>Email</dt>
          <dd>{patient.email || 'Not provided'}</dd>
          <dt>Address</dt>
          <dd>
            {[patient.addressLine1, patient.city, patient.state, patient.zip]
              .filter(Boolean)
              .join(', ') || 'Not provided'}
          </dd>
        </dl>
      </section>

      <section aria-label="Insurance">
        <h3>Insurance</h3>
        <dl>
          <dt>Provider</dt>
          <dd>{patient.insuranceProvider || 'Not provided'}</dd>
          <dt>Policy Number</dt>
          <dd>{patient.insurancePolicyNumber || 'Not provided'}</dd>
        </dl>
      </section>

      <section aria-label="Visit History">
        <h3>Visit History</h3>
        {visits.length === 0 ? (
          <p className="profile-empty">No visits recorded yet.</p>
        ) : (
          <ul>
            {visits.map((visit) => (
              <li key={visit.id}>
                {visit.date} — {visit.reason}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
