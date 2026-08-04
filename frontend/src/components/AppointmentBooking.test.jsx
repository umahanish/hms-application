import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AppointmentBooking from './AppointmentBooking.jsx';
import { listDoctors, getDoctorAvailability, bookAppointment } from '../api/appointments.js';
import { searchPatients } from '../api/patients.js';

vi.mock('../api/appointments.js', () => ({
  listDoctors: vi.fn(),
  getDoctorAvailability: vi.fn(),
  bookAppointment: vi.fn(),
}));

vi.mock('../api/patients.js', () => ({
  searchPatients: vi.fn(),
}));

const DOCTORS = [
  { id: 1, name: 'Dr. Smith', department: 'OPD', slotDurationMinutes: 30, bufferMinutes: 0 },
  { id: 2, name: 'Dr. Lee', department: 'Cardiology', slotDurationMinutes: 45, bufferMinutes: 0 },
];

const AVAILABILITY = {
  doctorId: 1,
  date: '2026-08-05',
  department: 'OPD',
  onLeave: false,
  isHoliday: false,
  slots: [{ startTime: '09:00', endTime: '09:30' }],
  bookedSlots: [{ startTime: '09:30', endTime: '10:00' }],
};

async function selectPatient(user) {
  searchPatients.mockResolvedValueOnce([{ id: 5, firstName: 'Jane', lastName: 'Doe' }]);
  await user.type(screen.getByLabelText('Search patients'), 'Jan');
  const resultButton = await screen.findByText('Jane Doe — 5', {}, { timeout: 2000 });
  await user.click(resultButton);
}

async function selectDoctorAndDate(user) {
  await user.selectOptions(screen.getByLabelText('Doctor'), '1');
  const dateInput = screen.getByLabelText('Date');
  fireEvent.change(dateInput, { target: { value: '2026-08-05' } });
}

describe('AppointmentBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listDoctors.mockResolvedValue(DOCTORS);
    getDoctorAvailability.mockResolvedValue(AVAILABILITY);
  });

  it('loads doctors and lets the user filter by department', async () => {
    const user = userEvent.setup();
    render(<AppointmentBooking />);

    await screen.findByRole('option', { name: 'Dr. Smith (OPD)' });
    await user.selectOptions(screen.getByLabelText('Department'), 'Cardiology');

    expect(screen.queryByRole('option', { name: 'Dr. Smith (OPD)' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dr. Lee (Cardiology)' })).toBeInTheDocument();
  });

  it('shows available and booked slots once a doctor and date are selected', async () => {
    const user = userEvent.setup();
    render(<AppointmentBooking />);

    await screen.findByRole('option', { name: 'Dr. Smith (OPD)' });
    await selectDoctorAndDate(user);

    expect(await screen.findByRole('button', { name: '09:00 – 09:30' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '09:30 – 10:00 (Booked)' })).toBeDisabled();
  });

  it('books an appointment and shows a confirmation with a reference number', async () => {
    bookAppointment.mockResolvedValueOnce({
      id: 42,
      patientId: 5,
      doctorId: 1,
      date: '2026-08-05',
      startTime: '09:00',
      endTime: '09:30',
      status: 'booked',
    });
    const user = userEvent.setup();
    render(<AppointmentBooking />);

    await screen.findByRole('option', { name: 'Dr. Smith (OPD)' });
    await selectPatient(user);
    await selectDoctorAndDate(user);
    await user.click(await screen.findByRole('button', { name: '09:00 – 09:30' }));
    await user.click(screen.getByRole('button', { name: 'Book Appointment' }));

    expect(await screen.findByText('Reference #APT-42')).toBeInTheDocument();
    expect(bookAppointment).toHaveBeenCalledWith({
      patientId: 5,
      doctorId: 1,
      date: '2026-08-05',
      startTime: '09:00',
      endTime: '09:30',
      reason: '',
    });
  });

  it('re-checks availability before submitting and blocks booking if the slot was just taken', async () => {
    const user = userEvent.setup();
    render(<AppointmentBooking />);

    await screen.findByRole('option', { name: 'Dr. Smith (OPD)' });
    await selectPatient(user);
    await selectDoctorAndDate(user);
    await user.click(await screen.findByRole('button', { name: '09:00 – 09:30' }));

    // Simulate someone else booking the slot between selection and submit.
    getDoctorAvailability.mockResolvedValueOnce({ ...AVAILABILITY, slots: [] });
    await user.click(screen.getByRole('button', { name: 'Book Appointment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('just booked by someone else');
    expect(bookAppointment).not.toHaveBeenCalled();
  });

  it('shows a graceful error when the backend rejects a conflicting booking', async () => {
    bookAppointment.mockRejectedValueOnce(new Error('The selected slot is no longer available'));
    const user = userEvent.setup();
    render(<AppointmentBooking />);

    await screen.findByRole('option', { name: 'Dr. Smith (OPD)' });
    await selectPatient(user);
    await selectDoctorAndDate(user);
    await user.click(await screen.findByRole('button', { name: '09:00 – 09:30' }));
    await user.click(screen.getByRole('button', { name: 'Book Appointment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The selected slot is no longer available');
  });
});
