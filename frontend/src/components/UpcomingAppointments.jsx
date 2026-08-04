import { useEffect, useState } from 'react';
import { listAppointments, rescheduleAppointment, cancelAppointment, listDoctors, getDoctorAvailability } from '../api/appointments.js';
import { getPatient } from '../api/patients.js';
import './UpcomingAppointments.css';

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isWithinReminderWindow(date, startTime) {
  const apptTime = new Date(`${date}T${startTime}:00`);
  const diff = apptTime.getTime() - Date.now();
  return diff >= 0 && diff <= REMINDER_WINDOW_MS;
}

export default function UpcomingAppointments({ patientId } = {}) {
  const [appointments, setAppointments] = useState([]);
  const [doctorsById, setDoctorsById] = useState({});
  const [patientsById, setPatientsById] = useState({});
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('');
  const [reschedulingId, setReschedulingId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleAvailability, setRescheduleAvailability] = useState(null);
  const [rescheduleError, setRescheduleError] = useState('');

  async function loadAppointments() {
    setStatus('loading');
    setErrorMessage('');
    try {
      const [allAppointments, doctors] = await Promise.all([
        listAppointments({ patientId, dateFrom: todayIsoDate() }),
        listDoctors(),
      ]);

      const upcoming = allAppointments
        .filter((appointment) => appointment.status === 'booked')
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

      const doctorMap = Object.fromEntries(doctors.map((doctor) => [doctor.id, doctor]));

      const uniquePatientIds = [...new Set(upcoming.map((a) => a.patientId))];
      const patients = await Promise.all(uniquePatientIds.map((id) => getPatient(id).catch(() => null)));
      const patientMap = Object.fromEntries(
        uniquePatientIds.map((id, index) => [id, patients[index]]).filter(([, patient]) => patient),
      );

      setAppointments(upcoming);
      setDoctorsById(doctorMap);
      setPatientsById(patientMap);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'Unable to load upcoming appointments.');
    }
  }

  useEffect(() => {
    loadAppointments();
  }, [patientId]);

  async function handleCancel(id) {
    try {
      await cancelAppointment(id);
      setAppointments((prev) => prev.filter((appointment) => appointment.id !== id));
    } catch (error) {
      setErrorMessage(error.message || 'Unable to cancel this appointment.');
    }
  }

  function startReschedule(appointment) {
    setReschedulingId(appointment.id);
    setRescheduleDate(appointment.date);
    setRescheduleAvailability(null);
    setRescheduleError('');
    loadRescheduleAvailability(appointment.doctorId, appointment.date);
  }

  function cancelReschedule() {
    setReschedulingId(null);
    setRescheduleAvailability(null);
    setRescheduleError('');
  }

  async function loadRescheduleAvailability(doctorId, date) {
    try {
      const availability = await getDoctorAvailability(doctorId, date);
      setRescheduleAvailability(availability);
    } catch (error) {
      setRescheduleError(error.message || 'Unable to load availability.');
    }
  }

  async function confirmReschedule(id, slot) {
    try {
      const updated = await rescheduleAppointment(id, {
        date: rescheduleDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });
      setAppointments((prev) => prev.map((appointment) => (appointment.id === id ? updated : appointment)));
      cancelReschedule();
    } catch (error) {
      setRescheduleError(error.message || 'Unable to reschedule this appointment.');
    }
  }

  if (status === 'loading') {
    return <p>Loading upcoming appointments…</p>;
  }

  if (status === 'error') {
    return (
      <p role="alert" className="appointments-error">
        {errorMessage}
      </p>
    );
  }

  return (
    <div className="upcoming-appointments">
      <h2>Upcoming Appointments</h2>

      {appointments.length === 0 && <p className="appointments-empty">No upcoming appointments.</p>}

      <ul className="appointment-list">
        {appointments.map((appointment) => {
          const doctor = doctorsById[appointment.doctorId];
          const patient = patientsById[appointment.patientId];
          const isReschedulingThis = reschedulingId === appointment.id;

          return (
            <li key={appointment.id} className="appointment-card">
              {isWithinReminderWindow(appointment.date, appointment.startTime) && (
                <span className="reminder-badge">Reminder: within 24 hours</span>
              )}

              <p className="appointment-summary">
                {patient ? `${patient.firstName} ${patient.lastName}` : `Patient #${appointment.patientId}`} with{' '}
                {doctor?.name ?? `Doctor #${appointment.doctorId}`}
              </p>
              <p>
                {appointment.date} · {appointment.startTime} – {appointment.endTime}
              </p>
              <p>Location: {doctor?.location ?? 'To be confirmed'}</p>
              {appointment.reason && <p>Reason: {appointment.reason}</p>}

              <div className="appointment-actions">
                <button type="button" onClick={() => handleCancel(appointment.id)}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    isReschedulingThis ? cancelReschedule() : startReschedule(appointment)
                  }
                >
                  {isReschedulingThis ? 'Close' : 'Reschedule'}
                </button>
              </div>

              {isReschedulingThis && (
                <div className="reschedule-panel">
                  <label htmlFor={`reschedule-date-${appointment.id}`}>New date</label>
                  <input
                    id={`reschedule-date-${appointment.id}`}
                    type="date"
                    value={rescheduleDate}
                    onChange={(event) => {
                      setRescheduleDate(event.target.value);
                      loadRescheduleAvailability(appointment.doctorId, event.target.value);
                    }}
                  />

                  {rescheduleError && (
                    <p role="alert" className="appointments-error">
                      {rescheduleError}
                    </p>
                  )}

                  {rescheduleAvailability && (
                    <ul className="reschedule-slots">
                      {rescheduleAvailability.slots.map((slot) => (
                        <li key={slot.startTime}>
                          <button type="button" onClick={() => confirmReschedule(appointment.id, slot)}>
                            {slot.startTime} – {slot.endTime}
                          </button>
                        </li>
                      ))}
                      {rescheduleAvailability.slots.length === 0 && <li>No open slots on this date.</li>}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
