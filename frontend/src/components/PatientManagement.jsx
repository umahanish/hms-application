import { useState } from 'react';
import { getPatient } from '../api/patients.js';
import PatientSearch from './PatientSearch.jsx';
import PatientProfile from './PatientProfile.jsx';
import PatientRegistrationForm from './PatientRegistrationForm.jsx';

export default function PatientManagement() {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [mode, setMode] = useState('search'); // search | profile | edit

  async function handleSelectPatient(patient) {
    setProfileError('');
    try {
      const fullPatient = await getPatient(patient.id);
      setSelectedPatient(fullPatient);
      setMode('profile');
    } catch (error) {
      setProfileError(error.message || 'Unable to load patient profile.');
      setMode('profile');
    }
  }

  function handleEdit(patient) {
    setSelectedPatient(patient);
    setMode('edit');
  }

  function handleUpdateSuccess(updatedPatient) {
    setSelectedPatient(updatedPatient);
    setMode('profile');
  }

  return (
    <div className="patient-management">
      <PatientSearch onSelectPatient={handleSelectPatient} />

      {mode === 'profile' && (
        <PatientProfile patient={selectedPatient} error={profileError} onEdit={handleEdit} />
      )}

      {mode === 'edit' && selectedPatient && (
        <PatientRegistrationForm
          patientId={selectedPatient.id}
          initialValues={selectedPatient}
          onSuccess={handleUpdateSuccess}
        />
      )}
    </div>
  );
}
