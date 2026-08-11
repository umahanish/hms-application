import { useState } from 'react';
import { getPatient } from '../api/patients.js';
import PatientSearch from './PatientSearch.jsx';
import PatientProfile from './PatientProfile.jsx';
import PatientRegistrationForm from './PatientRegistrationForm.jsx';

export default function PatientManagement() {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [mode, setMode] = useState('search'); // search | profile | edit | create

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

  function handleAddNew() {
    setProfileError('');
    setSelectedPatient(null);
    setMode('create');
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
      <div className="patient-management-toolbar">
        <PatientSearch onSelectPatient={handleSelectPatient} />
        <button type="button" onClick={handleAddNew}>
          Add New Patient
        </button>
      </div>

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

      {mode === 'create' && <PatientRegistrationForm onSuccess={handleUpdateSuccess} />}
    </div>
  );
}
