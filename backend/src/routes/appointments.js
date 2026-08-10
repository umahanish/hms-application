import { Router } from 'express';
import { findPatientById } from '../repositories/patientsRepository.js';
import { findDoctorById } from '../repositories/doctorsRepository.js';
import {
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  findAppointments,
  SlotConflictError,
  CancelledAppointmentError,
} from '../repositories/appointmentsRepository.js';
import { requireRole, ROLES } from '../middleware/rbac.js';
import { asyncHandler } from './asyncHandler.js';

const REQUIRED_BOOKING_FIELDS = ['patientId', 'doctorId', 'date', 'startTime', 'endTime'];
const REQUIRED_RESCHEDULE_FIELDS = ['date', 'startTime', 'endTime'];

const canAccessAppointments = requireRole(ROLES.FRONT_DESK, ROLES.ADMIN);

function missingFieldErrors(body, fields) {
  const errors = {};
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors[field] = `${field} is required`;
    }
  }
  return errors;
}

export function createAppointmentsRouter(pool) {
  const router = Router();
  router.use(canAccessAppointments);

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const errors = missingFieldErrors(req.body, REQUIRED_BOOKING_FIELDS);
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({ message: 'Validation failed', errors });
      }

      const { patientId, doctorId, date, startTime, endTime, reason } = req.body;

      if (!(await findPatientById(pool, patientId))) {
        return res.status(400).json({ message: 'Validation failed', errors: { patientId: 'Patient not found' } });
      }
      if (!(await findDoctorById(pool, doctorId))) {
        return res.status(400).json({ message: 'Validation failed', errors: { doctorId: 'Doctor not found' } });
      }

      try {
        const appointment = await createAppointment(pool, { patientId, doctorId, date, startTime, endTime, reason });
        return res.status(201).json(appointment);
      } catch (error) {
        if (error instanceof SlotConflictError) {
          return res.status(409).json({ message: error.message });
        }
        throw error;
      }
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { patientId, doctorId, dateFrom, dateTo } = req.query;

      const appointments = await findAppointments(pool, {
        patientId: patientId != null ? Number(patientId) : undefined,
        doctorId: doctorId != null ? Number(doctorId) : undefined,
        dateFrom,
        dateTo,
      });

      return res.status(200).json(appointments);
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Invalid appointment id' });
      }

      const errors = missingFieldErrors(req.body, REQUIRED_RESCHEDULE_FIELDS);
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({ message: 'Validation failed', errors });
      }

      try {
        const appointment = await rescheduleAppointment(pool, id, req.body);
        if (!appointment) {
          return res.status(404).json({ message: 'Appointment not found' });
        }
        return res.status(200).json(appointment);
      } catch (error) {
        if (error instanceof SlotConflictError) {
          return res.status(409).json({ message: error.message });
        }
        if (error instanceof CancelledAppointmentError) {
          return res.status(409).json({ message: error.message });
        }
        throw error;
      }
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Invalid appointment id' });
      }

      const appointment = await cancelAppointment(pool, id);
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }

      return res.status(200).json(appointment);
    }),
  );

  return router;
}
