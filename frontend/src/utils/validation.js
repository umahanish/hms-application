const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9()\-\s]{7,20}$/;

const REQUIRED_FIELDS = [
  ['firstName', 'First name is required'],
  ['lastName', 'Last name is required'],
  ['dob', 'Date of birth is required'],
  ['gender', 'Gender is required'],
  ['phone', 'Phone number is required'],
  ['email', 'Email is required'],
  ['addressLine1', 'Address is required'],
  ['city', 'City is required'],
  ['emergencyContactName', 'Emergency contact name is required'],
  ['emergencyContactPhone', 'Emergency contact phone is required'],
  ['insuranceProvider', 'Insurance provider is required'],
  ['insurancePolicyNumber', 'Insurance policy number is required'],
];

function isValidDob(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
}

export function validatePatientForm(values) {
  const errors = {};

  for (const [field, message] of REQUIRED_FIELDS) {
    if (!values[field] || !String(values[field]).trim()) {
      errors[field] = message;
    }
  }

  if (values.dob && !isValidDob(values.dob)) {
    errors.dob = 'Date of birth must be a valid date not in the future';
  }

  if (values.email && !EMAIL_RE.test(values.email)) {
    errors.email = 'Enter a valid email address';
  }

  if (values.phone && !PHONE_RE.test(values.phone)) {
    errors.phone = 'Enter a valid phone number';
  }

  if (values.emergencyContactPhone && !PHONE_RE.test(values.emergencyContactPhone)) {
    errors.emergencyContactPhone = 'Enter a valid phone number';
  }

  return errors;
}

export function isFormValid(values) {
  return Object.keys(validatePatientForm(values)).length === 0;
}
