import { useState } from 'react';
import { registerPatient, updatePatient } from '../api/patients.js';
import { validatePatientForm } from '../utils/validation.js';
import './PatientRegistrationForm.css';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  dob: '',
  gender: '',
  phone: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zip: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  insuranceProvider: '',
  insurancePolicyNumber: '',
};

export default function PatientRegistrationForm({ initialValues, patientId, onSuccess }) {
  const [values, setValues] = useState({ ...EMPTY_FORM, ...initialValues });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isEditMode = Boolean(patientId);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validatePatientForm(values);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setStatus('idle');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const patient = isEditMode
        ? await updatePatient(patientId, values)
        : await registerPatient(values);
      setStatus('success');
      onSuccess?.(patient);
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'Something went wrong. Please try again.');
    }
  }

  return (
    <form className="patient-registration-form" onSubmit={handleSubmit} noValidate>
      <h2>{isEditMode ? 'Update Patient' : 'Patient Registration'}</h2>

      <fieldset>
        <legend>Personal Details</legend>

        <div className="form-row">
          <label htmlFor="firstName">First Name</label>
          <input id="firstName" name="firstName" value={values.firstName} onChange={handleChange} />
          {errors.firstName && <span className="field-error">{errors.firstName}</span>}
        </div>

        <div className="form-row">
          <label htmlFor="lastName">Last Name</label>
          <input id="lastName" name="lastName" value={values.lastName} onChange={handleChange} />
          {errors.lastName && <span className="field-error">{errors.lastName}</span>}
        </div>

        <div className="form-row">
          <label htmlFor="dob">Date of Birth</label>
          <input id="dob" name="dob" type="date" value={values.dob} onChange={handleChange} />
          {errors.dob && <span className="field-error">{errors.dob}</span>}
        </div>

        <div className="form-row">
          <label htmlFor="gender">Gender</label>
          <select id="gender" name="gender" value={values.gender} onChange={handleChange}>
            <option value="">Select…</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
          {errors.gender && <span className="field-error">{errors.gender}</span>}
        </div>
      </fieldset>

      <fieldset>
        <legend>Contact Info</legend>

        <div className="form-row">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" value={values.phone} onChange={handleChange} />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </div>

        <div className="form-row">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={values.email} onChange={handleChange} />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>
      </fieldset>

      <fieldset>
        <legend>Address</legend>

        <div className="form-row">
          <label htmlFor="addressLine1">Address Line 1</label>
          <input id="addressLine1" name="addressLine1" value={values.addressLine1} onChange={handleChange} />
          {errors.addressLine1 && <span className="field-error">{errors.addressLine1}</span>}
        </div>

        <div className="form-row">
          <label htmlFor="addressLine2">Address Line 2</label>
          <input id="addressLine2" name="addressLine2" value={values.addressLine2} onChange={handleChange} />
        </div>

        <div className="form-row">
          <label htmlFor="city">City</label>
          <input id="city" name="city" value={values.city} onChange={handleChange} />
          {errors.city && <span className="field-error">{errors.city}</span>}
        </div>

        <div className="form-row">
          <label htmlFor="state">State</label>
          <input id="state" name="state" value={values.state} onChange={handleChange} />
        </div>

        <div className="form-row">
          <label htmlFor="zip">ZIP</label>
          <input id="zip" name="zip" value={values.zip} onChange={handleChange} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Emergency Contact</legend>

        <div className="form-row">
          <label htmlFor="emergencyContactName">Emergency Contact Name</label>
          <input
            id="emergencyContactName"
            name="emergencyContactName"
            value={values.emergencyContactName}
            onChange={handleChange}
          />
          {errors.emergencyContactName && <span className="field-error">{errors.emergencyContactName}</span>}
        </div>

        <div className="form-row">
          <label htmlFor="emergencyContactPhone">Emergency Contact Phone</label>
          <input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            value={values.emergencyContactPhone}
            onChange={handleChange}
          />
          {errors.emergencyContactPhone && <span className="field-error">{errors.emergencyContactPhone}</span>}
        </div>
      </fieldset>

      <fieldset>
        <legend>Insurance Details</legend>

        <div className="form-row">
          <label htmlFor="insuranceProvider">Insurance Provider</label>
          <input
            id="insuranceProvider"
            name="insuranceProvider"
            value={values.insuranceProvider}
            onChange={handleChange}
          />
          {errors.insuranceProvider && <span className="field-error">{errors.insuranceProvider}</span>}
        </div>

        <div className="form-row">
          <label htmlFor="insurancePolicyNumber">Policy Number</label>
          <input
            id="insurancePolicyNumber"
            name="insurancePolicyNumber"
            value={values.insurancePolicyNumber}
            onChange={handleChange}
          />
          {errors.insurancePolicyNumber && <span className="field-error">{errors.insurancePolicyNumber}</span>}
        </div>
      </fieldset>

      <button type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Saving…' : isEditMode ? 'Update Patient' : 'Register Patient'}
      </button>

      {status === 'success' && (
        <p role="status" className="form-success">
          Patient {isEditMode ? 'updated' : 'registered'} successfully.
        </p>
      )}

      {status === 'error' && (
        <p role="alert" className="form-error">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
