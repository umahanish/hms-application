import { useEffect, useState } from 'react';
import PatientSearch from './PatientSearch.jsx';
import { listDoctors, getDoctorAvailability, bookAppointment } from '../api/appointments.js';
import './AppointmentBooking.css';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function AppointmentBooking() {
  const [doctors, setDoctors] = useState([]);
  const [department, setDepartment] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [reason, setReason] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading-slots | submitting | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    listDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, []);

  const departments = [...new Set(doctors.map((doctor) => doctor.department))];
  const doctorsInDepartment = department ? doctors.filter((doctor) => doctor.department === department) : doctors;

  useEffect(() => {
    setSelectedSlot(null);
    if (!doctorId || !date) {
      setAvailability(null);
      return;
    }

    let cancelled = false;
    setStatus('loading-slots');
    getDoctorAvailability(doctorId, date)
      .then((result) => {
        if (!cancelled) {
          setAvailability(result);
          setStatus('idle');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error.message || 'Unable to load availability.');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [doctorId, date]);

  async function handleBook() {
    if (!selectedPatient || !doctorId || !date || !selectedSlot) return;

    setStatus('submitting');
    setErrorMessage('');

    try {
      // Re-check availability immediately before submitting to prevent double-booking.
      const fresh = await getDoctorAvailability(doctorId, date);
      setAvailability(fresh);
      const stillOpen = fresh.slots.some(
        (slot) => slot.startTime === selectedSlot.startTime && slot.endTime === selectedSlot.endTime,
      );

      if (!stillOpen) {
        setSelectedSlot(null);
        setStatus('error');
        setErrorMessage('That slot was just booked by someone else. Please choose another.');
        return;
      }

      const appointment = await bookAppointment({
        patientId: selectedPatient.id,
        doctorId: Number(doctorId),
        date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        reason,
      });

      setConfirmation(appointment);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'Unable to book this appointment. Please try again.');
    }
  }

  if (status === 'success' && confirmation) {
    const selectedDoctor = doctors.find((doctor) => doctor.id === confirmation.doctorId);
    return (
      <div className="appointment-booking" role="status">
        <h2>Appointment Confirmed</h2>
        <p className="confirmation-reference">Reference #APT-{confirmation.id}</p>
        <dl>
          <dt>Patient</dt>
          <dd>
            {selectedPatient?.firstName} {selectedPatient?.lastName}
          </dd>
          <dt>Doctor</dt>
          <dd>{selectedDoctor?.name ?? `Doctor #${confirmation.doctorId}`}</dd>
          <dt>Location</dt>
          <dd>{selectedDoctor?.location ?? 'To be confirmed'}</dd>
          <dt>Date</dt>
          <dd>{confirmation.date}</dd>
          <dt>Time</dt>
          <dd>
            {confirmation.startTime} – {confirmation.endTime}
          </dd>
        </dl>
        <button
          type="button"
          onClick={() => {
            setConfirmation(null);
            setSelectedSlot(null);
            setSelectedPatient(null);
            setStatus('idle');
          }}
        >
          Book Another Appointment
        </button>
      </div>
    );
  }

  return (
    <div className="appointment-booking">
      <h2>Book Appointment</h2>

      <section aria-label="Patient">
        {selectedPatient ? (
          <p>
            Patient: <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>{' '}
            <button type="button" onClick={() => setSelectedPatient(null)}>
              Change
            </button>
          </p>
        ) : (
          <PatientSearch onSelectPatient={setSelectedPatient} />
        )}
      </section>

      <div className="form-row">
        <label htmlFor="appointment-department">Department</label>
        <select
          id="appointment-department"
          value={department}
          onChange={(event) => {
            setDepartment(event.target.value);
            setDoctorId('');
          }}
        >
          <option value="">All departments</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="appointment-doctor">Doctor</label>
        <select id="appointment-doctor" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
          <option value="">Select a doctor…</option>
          {doctorsInDepartment.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.name} ({doctor.department})
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="appointment-date">Date</label>
        <input
          id="appointment-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <div className="form-row">
        <label htmlFor="appointment-reason">Reason for Visit</label>
        <textarea id="appointment-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>

      {status === 'loading-slots' && <p>Loading availability…</p>}

      {status === 'error' && (
        <p role="alert" className="booking-error">
          {errorMessage}
        </p>
      )}

      {availability && (
        <section aria-label="Available slots" className="slot-calendar">
          {availability.onLeave && <p>This doctor is on leave on the selected date.</p>}
          {availability.isHoliday && <p>The clinic is closed for a holiday on the selected date.</p>}

          {!availability.onLeave && !availability.isHoliday && (
            <ul className="slot-grid">
              {availability.slots.map((slot) => (
                <li key={`available-${slot.startTime}`}>
                  <button
                    type="button"
                    className={
                      selectedSlot?.startTime === slot.startTime ? 'slot-available slot-selected' : 'slot-available'
                    }
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot.startTime} – {slot.endTime}
                  </button>
                </li>
              ))}
              {availability.bookedSlots.map((slot) => (
                <li key={`booked-${slot.startTime}`}>
                  <button type="button" className="slot-booked" disabled>
                    {slot.startTime} – {slot.endTime} (Booked)
                  </button>
                </li>
              ))}
              {availability.slots.length === 0 && availability.bookedSlots.length === 0 && (
                <li className="slot-empty">No slots configured for this doctor on this day.</li>
              )}
            </ul>
          )}
        </section>
      )}

      <button
        type="button"
        disabled={!selectedPatient || !selectedSlot || status === 'submitting'}
        onClick={handleBook}
      >
        {status === 'submitting' ? 'Booking…' : 'Book Appointment'}
      </button>
    </div>
  );
}
