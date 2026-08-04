import { describe, expect, it } from 'vitest';
import { validatePatientForm, isFormValid } from './validation.js';

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

describe('validatePatientForm', () => {
  it('returns no errors for a fully valid patient', () => {
    expect(validatePatientForm(VALID_PATIENT)).toEqual({});
    expect(isFormValid(VALID_PATIENT)).toBe(true);
  });

  it('flags missing required fields', () => {
    const errors = validatePatientForm({});
    expect(errors.firstName).toBeTruthy();
    expect(errors.lastName).toBeTruthy();
    expect(errors.dob).toBeTruthy();
    expect(errors.gender).toBeTruthy();
    expect(errors.phone).toBeTruthy();
    expect(errors.email).toBeTruthy();
    expect(errors.addressLine1).toBeTruthy();
    expect(errors.city).toBeTruthy();
    expect(errors.emergencyContactName).toBeTruthy();
    expect(errors.emergencyContactPhone).toBeTruthy();
    expect(errors.insuranceProvider).toBeTruthy();
    expect(errors.insurancePolicyNumber).toBeTruthy();
  });

  it('rejects an invalid email format', () => {
    const errors = validatePatientForm({ ...VALID_PATIENT, email: 'not-an-email' });
    expect(errors.email).toBe('Enter a valid email address');
  });

  it('rejects an invalid phone format', () => {
    const errors = validatePatientForm({ ...VALID_PATIENT, phone: 'abc' });
    expect(errors.phone).toBe('Enter a valid phone number');
  });

  it('rejects a date of birth in the future', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    const errors = validatePatientForm({
      ...VALID_PATIENT,
      dob: futureDate.toISOString().slice(0, 10),
    });
    expect(errors.dob).toBeTruthy();
  });

  it('rejects an unparseable date of birth', () => {
    const errors = validatePatientForm({ ...VALID_PATIENT, dob: 'not-a-date' });
    expect(errors.dob).toBeTruthy();
  });
});
