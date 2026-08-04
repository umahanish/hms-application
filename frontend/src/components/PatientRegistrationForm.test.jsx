import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PatientRegistrationForm from './PatientRegistrationForm.jsx';
import { registerPatient, updatePatient } from '../api/patients.js';

vi.mock('../api/patients.js', () => ({
  registerPatient: vi.fn(),
  updatePatient: vi.fn(),
}));

async function fillValidForm(user) {
  await user.type(screen.getByLabelText('First Name'), 'Jane');
  await user.type(screen.getByLabelText('Last Name'), 'Doe');
  await user.type(screen.getByLabelText('Date of Birth'), '1990-01-01');
  await user.selectOptions(screen.getByLabelText('Gender'), 'female');
  await user.type(screen.getByLabelText('Phone'), '555-123-4567');
  await user.type(screen.getByLabelText('Email'), 'jane.doe@example.com');
  await user.type(screen.getByLabelText('Address Line 1'), '123 Main St');
  await user.type(screen.getByLabelText('City'), 'Springfield');
  await user.type(screen.getByLabelText('Emergency Contact Name'), 'John Doe');
  await user.type(screen.getByLabelText('Emergency Contact Phone'), '555-987-6543');
  await user.type(screen.getByLabelText('Insurance Provider'), 'Acme Health');
  await user.type(screen.getByLabelText('Policy Number'), 'POL-12345');
}

describe('PatientRegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders fields for all acceptance-criteria data points', () => {
    render(<PatientRegistrationForm />);

    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Date of Birth')).toBeInTheDocument();
    expect(screen.getByLabelText('Gender')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Address Line 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Emergency Contact Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Insurance Provider')).toBeInTheDocument();
  });

  it('shows validation errors and does not call the API when required fields are missing', async () => {
    const user = userEvent.setup();
    render(<PatientRegistrationForm />);

    await user.click(screen.getByRole('button', { name: 'Register Patient' }));

    expect(await screen.findByText('First name is required')).toBeInTheDocument();
    expect(registerPatient).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format', async () => {
    const user = userEvent.setup();
    render(<PatientRegistrationForm />);

    await fillValidForm(user);
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Register Patient' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(registerPatient).not.toHaveBeenCalled();
  });

  it('submits a valid form, calls the Patient Registration API, and shows a success state', async () => {
    registerPatient.mockResolvedValueOnce({ id: 'P-1', firstName: 'Jane', lastName: 'Doe' });
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<PatientRegistrationForm onSuccess={onSuccess} />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Register Patient' }));

    await waitFor(() => expect(registerPatient).toHaveBeenCalledTimes(1));
    expect(registerPatient).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Jane', lastName: 'Doe' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Patient registered successfully.');
    expect(onSuccess).toHaveBeenCalledWith({ id: 'P-1', firstName: 'Jane', lastName: 'Doe' });
  });

  it('shows an error state when the Patient Registration API call fails', async () => {
    registerPatient.mockRejectedValueOnce(new Error('Email already registered'));
    const user = userEvent.setup();
    render(<PatientRegistrationForm />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Register Patient' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered');
  });

  it('pre-fills the form and calls updatePatient when editing an existing patient', async () => {
    updatePatient.mockResolvedValueOnce({ id: 'P-1', firstName: 'Janet', lastName: 'Doe' });
    const user = userEvent.setup();

    render(
      <PatientRegistrationForm
        patientId="P-1"
        initialValues={{
          firstName: 'Jane',
          lastName: 'Doe',
          dob: '1990-01-01',
          gender: 'female',
          phone: '555-123-4567',
          email: 'jane.doe@example.com',
          addressLine1: '123 Main St',
          city: 'Springfield',
          emergencyContactName: 'John Doe',
          emergencyContactPhone: '555-987-6543',
          insuranceProvider: 'Acme Health',
          insurancePolicyNumber: 'POL-12345',
        }}
      />,
    );

    expect(screen.getByLabelText('First Name')).toHaveValue('Jane');
    expect(screen.getByRole('button', { name: 'Update Patient' })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('First Name'));
    await user.type(screen.getByLabelText('First Name'), 'Janet');
    await user.click(screen.getByRole('button', { name: 'Update Patient' }));

    await waitFor(() => expect(updatePatient).toHaveBeenCalledTimes(1));
    expect(updatePatient).toHaveBeenCalledWith('P-1', expect.objectContaining({ firstName: 'Janet' }));
    expect(registerPatient).not.toHaveBeenCalled();
  });
});
