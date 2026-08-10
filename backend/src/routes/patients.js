import { Router } from 'express';
import { validatePatient } from '../services/patientValidation.js';
import { findDuplicates } from '../services/duplicateCheck.js';
import {
  createPatient,
  updatePatient as updatePatientRecord,
  findPatientById,
  searchPatients,
} from '../repositories/patientsRepository.js';
import { requireRole, ROLES } from '../middleware/rbac.js';
import { asyncHandler } from './asyncHandler.js';

const canAccessPatients = requireRole(ROLES.FRONT_DESK, ROLES.ADMIN);

export function createPatientsRouter(pool) {
  const router = Router();
  router.use(canAccessPatients);

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const errors = validatePatient(req.body);
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({ message: 'Validation failed', errors });
      }

      const duplicates = await findDuplicates(pool, req.body);
      const patient = await createPatient(pool, req.body);

      return res.status(201).json({
        ...patient,
        duplicateWarning: duplicates.length > 0,
      });
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { search } = req.query;
      if (typeof search !== 'string' || search.trim().length === 0) {
        return res.status(400).json({ message: 'search query parameter is required' });
      }

      const patients = await searchPatients(pool, search.trim());
      return res.status(200).json(patients);
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Invalid patient id' });
      }

      const patient = await findPatientById(pool, id);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      return res.status(200).json(patient);
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Invalid patient id' });
      }

      const errors = validatePatient(req.body);
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({ message: 'Validation failed', errors });
      }

      const duplicates = await findDuplicates(pool, req.body, { excludeId: id });
      const patient = await updatePatientRecord(pool, id, req.body);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      return res.status(200).json({
        ...patient,
        duplicateWarning: duplicates.length > 0,
      });
    }),
  );

  return router;
}
