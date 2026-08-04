function timeToMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function overlapsWithBuffer(slotStart, slotEnd, bookingStart, bookingEnd, bufferMinutes) {
  const bufferedStart = bookingStart - bufferMinutes;
  const bufferedEnd = bookingEnd + bufferMinutes;
  return slotStart < bufferedEnd && slotEnd > bufferedStart;
}

/**
 * Pure computation of open slots for one doctor on one day, given their working
 * hours, leave/holiday status, existing bookings, slot size, and buffer time.
 */
export function computeAvailableSlots({
  workingHours,
  onLeave,
  isHoliday,
  bookings,
  slotDurationMinutes,
  bufferMinutes,
}) {
  if (onLeave || isHoliday || !workingHours || workingHours.length === 0) {
    return [];
  }

  const bookedRanges = bookings.map((b) => ({
    start: timeToMinutes(b.startTime),
    end: timeToMinutes(b.endTime),
  }));

  const slots = [];

  for (const window of workingHours) {
    const windowEnd = timeToMinutes(window.endTime);
    let cursor = timeToMinutes(window.startTime);

    while (cursor + slotDurationMinutes <= windowEnd) {
      const slotStart = cursor;
      const slotEnd = cursor + slotDurationMinutes;

      const blocked = bookedRanges.some((b) =>
        overlapsWithBuffer(slotStart, slotEnd, b.start, b.end, bufferMinutes),
      );

      if (!blocked) {
        slots.push({ startTime: minutesToTime(slotStart), endTime: minutesToTime(slotEnd) });
      }

      cursor += slotDurationMinutes;
    }
  }

  return slots;
}

function getDoctor(db, doctorId) {
  return db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
}

function getWorkingHoursForDay(db, doctorId, dayOfWeek) {
  return db
    .prepare(
      'SELECT start_time as startTime, end_time as endTime FROM doctor_working_hours WHERE doctor_id = ? AND day_of_week = ? ORDER BY start_time',
    )
    .all(doctorId, dayOfWeek);
}

function isDoctorOnLeave(db, doctorId, date) {
  return Boolean(db.prepare('SELECT 1 FROM doctor_leave WHERE doctor_id = ? AND leave_date = ?').get(doctorId, date));
}

function isHospitalHoliday(db, date) {
  return Boolean(db.prepare('SELECT 1 FROM holidays WHERE holiday_date = ?').get(date));
}

function getBookings(db, doctorId, date, { excludeAppointmentId } = {}) {
  const rows = db
    .prepare(
      "SELECT id, start_time as startTime, end_time as endTime FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = 'booked'",
    )
    .all(doctorId, date);

  return excludeAppointmentId == null ? rows : rows.filter((row) => row.id !== excludeAppointmentId);
}

function dayOfWeekFor(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Full availability picture for one doctor on one date: their per-department schedule minus leave/holidays/bookings. */
export function getDoctorAvailability(db, doctorId, date, { excludeAppointmentId } = {}) {
  const doctor = getDoctor(db, doctorId);
  if (!doctor) return null;

  const onLeave = isDoctorOnLeave(db, doctorId, date);
  const isHoliday = isHospitalHoliday(db, date);
  const workingHours = getWorkingHoursForDay(db, doctorId, dayOfWeekFor(date));
  const bookings = getBookings(db, doctorId, date, { excludeAppointmentId });

  const slots = computeAvailableSlots({
    workingHours,
    onLeave,
    isHoliday,
    bookings,
    slotDurationMinutes: doctor.slot_duration_minutes,
    bufferMinutes: doctor.buffer_minutes,
  });

  return {
    doctorId,
    date,
    department: doctor.department,
    onLeave,
    isHoliday,
    slots,
  };
}

/** Whether a specific start/end time for a doctor on a date conflicts with an existing booking (buffer-aware). */
export function hasConflict(db, doctorId, date, startTime, endTime, { excludeAppointmentId } = {}) {
  const doctor = getDoctor(db, doctorId);
  if (!doctor) return true;

  const bookings = getBookings(db, doctorId, date, { excludeAppointmentId });
  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);

  return bookings.some((booking) =>
    overlapsWithBuffer(
      newStart,
      newEnd,
      timeToMinutes(booking.startTime),
      timeToMinutes(booking.endTime),
      doctor.buffer_minutes,
    ),
  );
}
