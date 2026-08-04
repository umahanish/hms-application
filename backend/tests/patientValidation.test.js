import { describe, expect, it } from 'vitest';
import { validatePatient, isPatientValid } from '../src/services/patientValidation.js';

const VALID_PATIENT = {
  firstName: 'Jane',
  lastName: 'Doe',
  dob: '1990-01-01',
  gender: 'female',
  phone: '+1 555-123-4567',
  email: 'jane.doe@example.com',
  addressLine1: '123 Main St',
  city: 'Springfield',
  emergencyContactName: 'John Doe',
  emergencyContactPhone: '555-987-6543',
  insuranceProvider: 'Acme Health',
  insurancePolicyNumber: 'POL-12345',
};

describe('validatePatient', () => {
  it('returns no errors for a fully valid patient', () => {
    expect(validatePatient(VALID_PATIENT)).toEqual({});
    expect(isPatientValid(VALID_PATIENT)).toBe(true);
  });

  it('flags all missing required fields', () => {
    const errors = validatePatient({});
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining([
        'firstName',
        'lastName',
        'dob',
        'gender',
        'phone',
        'email',
        'addressLine1',
        'city',
        'emergencyContactName',
        'emergencyContactPhone',
        'insuranceProvider',
        'insurancePolicyNumber',
      ]),
    );
  });

  it('rejects an invalid email format', () => {
    expect(validatePatient({ ...VALID_PATIENT, email: 'not-an-email' }).email).toBe(
      'Enter a valid email address',
    );
  });

  it('rejects an invalid phone format', () => {
    expect(validatePatient({ ...VALID_PATIENT, phone: 'abc' }).phone).toBe('Enter a valid phone number');
  });

  it('rejects a date of birth in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10);
    expect(validatePatient({ ...VALID_PATIENT, dob: future }).dob).toBeTruthy();
  });

  it('rejects an unparseable date of birth', () => {
    expect(validatePatient({ ...VALID_PATIENT, dob: 'not-a-date' }).dob).toBeTruthy();
  });
});
