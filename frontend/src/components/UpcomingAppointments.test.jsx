import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import UpcomingAppointments from './UpcomingAppointments.jsx';
import {
  listAppointments,
  listDoctors,
  getDoctorAvailability,
  rescheduleAppointment,
  cancelAppointment,
} from '../api/appointments.js';
import { getPatient } from '../api/patients.js';

vi.mock('../api/appointments.js', () => ({
  listAppointments: vi.fn(),
  listDoctors: vi.fn(),
  getDoctorAvailability: vi.fn(),
  rescheduleAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
}));

vi.mock('../api/patients.js', () => ({
  getPatient: vi.fn(),
}));

const DOCTORS = [{ id: 1, name: 'Dr. Smith', department: 'OPD', location: 'Building A, Room 101' }];
const PATIENT = { id: 5, firstName: 'Jane', lastName: 'Doe' };

const SOON_APPOINTMENT = {
  id: 100,
  patientId: 5,
  doctorId: 1,
  date: '2026-08-05',
  startTime: '09:00',
  endTime: '09:30',
  status: 'booked',
  reason: 'Checkup',
};

const LATER_APPOINTMENT = {
  id: 101,
  patientId: 5,
  doctorId: 1,
  date: '2026-09-20',
  startTime: '09:00',
  endTime: '09:30',
  status: 'booked',
  reason: 'Follow-up',
};

describe('UpcomingAppointments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listDoctors.mockResolvedValue(DOCTORS);
    getPatient.mockResolvedValue(PATIENT);

    // "Now" is 1 hour before SOON_APPOINTMENT's local start time, so it falls
    // inside the 24h reminder window; LATER_APPOINTMENT is well outside it.
    const soonStart = new Date('2026-08-05T09:00:00');
    vi.spyOn(Date, 'now').mockReturnValue(soonStart.getTime() - 60 * 60 * 1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders upcoming appointments with doctor, location, and patient info', async () => {
    listAppointments.mockResolvedValueOnce([SOON_APPOINTMENT]);
    render(<UpcomingAppointments />);

    expect(await screen.findByText('Jane Doe with Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Location: Building A, Room 101')).toBeInTheDocument();
    expect(screen.getByText('2026-08-05 · 09:00 – 09:30')).toBeInTheDocument();
  });

  it('shows a reminder badge only for appointments within 24 hours', async () => {
    listAppointments.mockResolvedValueOnce([SOON_APPOINTMENT, LATER_APPOINTMENT]);
    render(<UpcomingAppointments />);

    await screen.findAllByText('Jane Doe with Dr. Smith');
    const badges = screen.getAllByText('Reminder: within 24 hours');
    expect(badges).toHaveLength(1);
  });

  it('shows an empty state when there are no upcoming appointments', async () => {
    listAppointments.mockResolvedValueOnce([]);
    render(<UpcomingAppointments />);

    expect(await screen.findByText('No upcoming appointments.')).toBeInTheDocument();
  });

  it('shows a graceful error state when loading fails', async () => {
    listAppointments.mockRejectedValueOnce(new Error('Appointments service unavailable'));
    render(<UpcomingAppointments />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Appointments service unavailable');
  });

  it('cancels an appointment and removes it from the list', async () => {
    listAppointments.mockResolvedValueOnce([SOON_APPOINTMENT]);
    cancelAppointment.mockResolvedValueOnce({ ...SOON_APPOINTMENT, status: 'cancelled' });
    const user = userEvent.setup();
    render(<UpcomingAppointments />);

    await screen.findByText('Jane Doe with Dr. Smith');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(cancelAppointment).toHaveBeenCalledWith(100);
    await waitFor(() => expect(screen.queryByText('Jane Doe with Dr. Smith')).not.toBeInTheDocument());
  });

  it('reschedules an appointment to a newly selected slot and updates the list', async () => {
    listAppointments.mockResolvedValueOnce([SOON_APPOINTMENT]);
    getDoctorAvailability.mockResolvedValueOnce({
      slots: [{ startTime: '11:00', endTime: '11:30' }],
      bookedSlots: [],
    });
    rescheduleAppointment.mockResolvedValueOnce({ ...SOON_APPOINTMENT, startTime: '11:00', endTime: '11:30' });
    const user = userEvent.setup();
    render(<UpcomingAppointments />);

    await screen.findByText('Jane Doe with Dr. Smith');
    await user.click(screen.getByRole('button', { name: 'Reschedule' }));

    const slotButton = await screen.findByRole('button', { name: '11:00 – 11:30' });
    await user.click(slotButton);

    expect(rescheduleAppointment).toHaveBeenCalledWith(100, {
      date: '2026-08-05',
      startTime: '11:00',
      endTime: '11:30',
    });
    expect(await screen.findByText('2026-08-05 · 11:00 – 11:30')).toBeInTheDocument();
  });
});
