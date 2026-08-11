import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PatientManagement from './PatientManagement.jsx';
import { searchPatients, getPatient, registerPatient, updatePatient } from '../api/patients.js';

vi.mock('../api/patients.js', () => ({
  searchPatients: vi.fn(),
  getPatient: vi.fn(),
  registerPatient: vi.fn(),
  updatePatient: vi.fn(),
}));

const PATIENT = {
  id: 'P-1',
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
  visitHistory: [],
};

describe('PatientManagement (search -> profile -> edit flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets a user search, view a profile, and edit it via a pre-filled registration form', async () => {
    searchPatients.mockResolvedValueOnce([{ id: 'P-1', firstName: 'Jane', lastName: 'Doe' }]);
    getPatient.mockResolvedValueOnce(PATIENT);
    updatePatient.mockResolvedValueOnce({ ...PATIENT, firstName: 'Janet' });

    const user = userEvent.setup();
    render(<PatientManagement />);

    await user.type(screen.getByLabelText('Search patients'), 'Jan');
    const resultButton = await screen.findByText('Jane Doe — P-1', {}, { timeout: 2000 });
    await user.click(resultButton);

    expect(await screen.findByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const editForm = await screen.findByRole('button', { name: 'Update Patient' });
    expect(screen.getByLabelText('First Name')).toHaveValue('Jane');

    await user.clear(screen.getByLabelText('First Name'));
    await user.type(screen.getByLabelText('First Name'), 'Janet');
    await user.click(editForm);

    await waitFor(() => expect(updatePatient).toHaveBeenCalledWith('P-1', expect.objectContaining({ firstName: 'Janet' })));
    expect(await screen.findByRole('heading', { name: 'Janet Doe' })).toBeInTheDocument();
  });

  it('lets a user add a brand-new patient via the "Add New Patient" action', async () => {
    const newPatient = { id: 'P-2', firstName: 'Alex', lastName: 'Kim' };
    registerPatient.mockResolvedValueOnce(newPatient);

    const user = userEvent.setup();
    render(<PatientManagement />);

    await user.click(screen.getByRole('button', { name: 'Add New Patient' }));

    const form = await screen.findByRole('heading', { name: 'Patient Registration' });
    expect(form).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toHaveValue('');

    await user.type(screen.getByLabelText('First Name'), 'Alex');
    await user.type(screen.getByLabelText('Last Name'), 'Kim');
    await user.type(screen.getByLabelText('Date of Birth'), '1995-05-05');
    await user.selectOptions(screen.getByLabelText('Gender'), 'male');
    await user.type(screen.getByLabelText('Phone'), '555-000-1111');
    await user.type(screen.getByLabelText('Email'), 'alex.kim@example.com');
    await user.type(screen.getByLabelText('Address Line 1'), '1 Test Ave');
    await user.type(screen.getByLabelText('City'), 'Springfield');
    await user.type(screen.getByLabelText('Emergency Contact Name'), 'Sam Kim');
    await user.type(screen.getByLabelText('Emergency Contact Phone'), '555-222-3333');
    await user.type(screen.getByLabelText('Insurance Provider'), 'Acme Health');
    await user.type(screen.getByLabelText('Policy Number'), 'POL-9');

    await user.click(screen.getByRole('button', { name: 'Register Patient' }));

    await waitFor(() => expect(registerPatient).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Alex' })));
    expect(await screen.findByRole('heading', { name: 'Alex Kim' })).toBeInTheDocument();
  });

  it('shows a graceful error state when loading a profile fails', async () => {
    searchPatients.mockResolvedValueOnce([{ id: 'P-1', firstName: 'Jane', lastName: 'Doe' }]);
    getPatient.mockRejectedValueOnce(new Error('Patient service unavailable'));

    const user = userEvent.setup();
    render(<PatientManagement />);

    await user.type(screen.getByLabelText('Search patients'), 'Jan');
    const resultButton = await screen.findByText('Jane Doe — P-1', {}, { timeout: 2000 });
    await user.click(resultButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('Patient service unavailable');
  });
});
