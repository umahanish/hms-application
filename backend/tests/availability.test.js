import { describe, expect, it } from 'vitest';
import { computeAvailableSlots } from '../src/services/availability.js';

const MORNING_CLINIC = [{ startTime: '09:00', endTime: '10:30' }];

describe('computeAvailableSlots', () => {
  it('returns no slots when the doctor has no working hours that day', () => {
    const slots = computeAvailableSlots({
      workingHours: [],
      onLeave: false,
      isHoliday: false,
      bookings: [],
      slotDurationMinutes: 30,
      bufferMinutes: 0,
    });
    expect(slots).toEqual([]);
  });

  it('returns no slots when the doctor is on leave', () => {
    const slots = computeAvailableSlots({
      workingHours: MORNING_CLINIC,
      onLeave: true,
      isHoliday: false,
      bookings: [],
      slotDurationMinutes: 30,
      bufferMinutes: 0,
    });
    expect(slots).toEqual([]);
  });

  it('returns no slots on a hospital holiday, even with working hours', () => {
    const slots = computeAvailableSlots({
      workingHours: MORNING_CLINIC,
      onLeave: false,
      isHoliday: true,
      bookings: [],
      slotDurationMinutes: 30,
      bufferMinutes: 0,
    });
    expect(slots).toEqual([]);
  });

  it('fills the working window with back-to-back slots when there are no bookings', () => {
    const slots = computeAvailableSlots({
      workingHours: MORNING_CLINIC, // 90 minutes
      onLeave: false,
      isHoliday: false,
      bookings: [],
      slotDurationMinutes: 30,
      bufferMinutes: 0,
    });
    expect(slots).toEqual([
      { startTime: '09:00', endTime: '09:30' },
      { startTime: '09:30', endTime: '10:00' },
      { startTime: '10:00', endTime: '10:30' },
    ]);
  });

  it('excludes a slot that exactly overlaps an existing booking', () => {
    const slots = computeAvailableSlots({
      workingHours: MORNING_CLINIC,
      onLeave: false,
      isHoliday: false,
      bookings: [{ startTime: '09:30', endTime: '10:00' }],
      slotDurationMinutes: 30,
      bufferMinutes: 0,
    });
    expect(slots).toEqual([
      { startTime: '09:00', endTime: '09:30' },
      { startTime: '10:00', endTime: '10:30' },
    ]);
  });

  it('excludes adjacent slots that fall within the buffer time around a booking', () => {
    const slots = computeAvailableSlots({
      workingHours: MORNING_CLINIC,
      onLeave: false,
      isHoliday: false,
      bookings: [{ startTime: '09:30', endTime: '10:00' }],
      slotDurationMinutes: 30,
      bufferMinutes: 15,
    });
    // Buffer extends the booking to 09:15-10:15, so both neighboring slots are blocked too.
    expect(slots).toEqual([]);
  });

  it('handles multiple working-hour windows in the same day (e.g. morning + afternoon clinic with a lunch gap)', () => {
    const slots = computeAvailableSlots({
      workingHours: [
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '14:00', endTime: '15:00' },
      ],
      onLeave: false,
      isHoliday: false,
      bookings: [],
      slotDurationMinutes: 30,
      bufferMinutes: 0,
    });
    expect(slots).toEqual([
      { startTime: '09:00', endTime: '09:30' },
      { startTime: '09:30', endTime: '10:00' },
      { startTime: '14:00', endTime: '14:30' },
      { startTime: '14:30', endTime: '15:00' },
    ]);
  });

  it('supports department-specific slot durations (e.g. 15-minute OPD vs 45-minute specialist slots)', () => {
    const opdSlots = computeAvailableSlots({
      workingHours: MORNING_CLINIC,
      onLeave: false,
      isHoliday: false,
      bookings: [],
      slotDurationMinutes: 15,
      bufferMinutes: 0,
    });
    const specialistSlots = computeAvailableSlots({
      workingHours: MORNING_CLINIC,
      onLeave: false,
      isHoliday: false,
      bookings: [],
      slotDurationMinutes: 45,
      bufferMinutes: 0,
    });

    expect(opdSlots).toHaveLength(6);
    expect(specialistSlots).toHaveLength(2);
  });
});
