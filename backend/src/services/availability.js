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

async function getDoctor(pool, doctorId) {
  const [rows] = await pool.execute('SELECT * FROM doctors WHERE id = ?', [doctorId]);
  return rows[0];
}

async function getWorkingHoursForDay(pool, doctorId, dayOfWeek) {
  const [rows] = await pool.execute(
    'SELECT start_time as startTime, end_time as endTime FROM doctor_working_hours WHERE doctor_id = ? AND day_of_week = ? ORDER BY start_time',
    [doctorId, dayOfWeek],
  );
  return rows;
}

async function isDoctorOnLeave(pool, doctorId, date) {
  const [rows] = await pool.execute(
    'SELECT 1 FROM doctor_leave WHERE doctor_id = ? AND leave_date = ?',
    [doctorId, date],
  );
  return rows.length > 0;
}

async function isHospitalHoliday(pool, date) {
  const [rows] = await pool.execute('SELECT 1 FROM holidays WHERE holiday_date = ?', [date]);
  return rows.length > 0;
}

async function getBookings(pool, doctorId, date, { excludeAppointmentId } = {}) {
  const [rows] = await pool.execute(
    "SELECT id, start_time as startTime, end_time as endTime FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = 'booked'",
    [doctorId, date],
  );

  return excludeAppointmentId == null ? rows : rows.filter((row) => row.id !== excludeAppointmentId);
}

function dayOfWeekFor(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Full availability picture for one doctor on one date: their per-department schedule minus leave/holidays/bookings. */
export async function getDoctorAvailability(pool, doctorId, date, { excludeAppointmentId } = {}) {
  const doctor = await getDoctor(pool, doctorId);
  if (!doctor) return null;

  const [onLeave, isHoliday, workingHours, bookings] = await Promise.all([
    isDoctorOnLeave(pool, doctorId, date),
    isHospitalHoliday(pool, date),
    getWorkingHoursForDay(pool, doctorId, dayOfWeekFor(date)),
    getBookings(pool, doctorId, date, { excludeAppointmentId }),
  ]);

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
    bookedSlots: bookings.map((b) => ({ startTime: b.startTime, endTime: b.endTime })),
  };
}

/** Whether a specific start/end time for a doctor on a date conflicts with an existing booking (buffer-aware). */
export async function hasConflict(pool, doctorId, date, startTime, endTime, { excludeAppointmentId } = {}) {
  const doctor = await getDoctor(pool, doctorId);
  if (!doctor) return true;

  const bookings = await getBookings(pool, doctorId, date, { excludeAppointmentId });
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
