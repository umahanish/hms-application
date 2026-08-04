import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PatientProfile from './PatientProfile.jsx';

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
  insuranceProvider: 'Acme Health',
  insurancePolicyNumber: 'POL-12345',
  visitHistory: [{ id: 'V-1', date: '2026-01-05', reason: 'Annual checkup' }],
};

describe('PatientProfile', () => {
  it('shows a prompt when no patient is selected', () => {
    render(<PatientProfile patient={null} />);
    expect(screen.getByText('Select a patient to view their profile.')).toBeInTheDocument();
  });

  it('shows a graceful error state', () => {
    render(<PatientProfile patient={null} error="Unable to load patient profile." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load patient profile.');
  });

  it('renders demographics, insurance, and visit history', () => {
    render(<PatientProfile patient={PATIENT} />);

    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    expect(screen.getByText('1990-01-01')).toBeInTheDocument();
    expect(screen.getByText('Acme Health')).toBeInTheDocument();
    expect(screen.getByText('POL-12345')).toBeInTheDocument();
    expect(screen.getByText('2026-01-05 — Annual checkup')).toBeInTheDocument();
  });

  it('shows an empty state when there is no visit history', () => {
    render(<PatientProfile patient={{ ...PATIENT, visitHistory: [] }} />);
    expect(screen.getByText('No visits recorded yet.')).toBeInTheDocument();
  });

  it('calls onEdit with the patient when the Edit button is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<PatientProfile patient={PATIENT} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledWith(PATIENT);
  });
});
