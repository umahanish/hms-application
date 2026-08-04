import { Router } from 'express';
import { validatePatient } from '../services/patientValidation.js';
import { findDuplicates } from '../services/duplicateCheck.js';
import {
  createPatient,
  updatePatient as updatePatientRecord,
  findPatientById,
  searchPatients,
} from '../repositories/patientsRepository.js';

export function createPatientsRouter(db) {
  const router = Router();

  router.post('/', (req, res) => {
    const errors = validatePatient(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const duplicates = findDuplicates(db, req.body);
    const patient = createPatient(db, req.body);

    return res.status(201).json({
      ...patient,
      duplicateWarning: duplicates.length > 0,
    });
  });

  router.get('/', (req, res) => {
    const { search } = req.query;
    if (typeof search !== 'string' || search.trim().length === 0) {
      return res.status(400).json({ message: 'search query parameter is required' });
    }

    const patients = searchPatients(db, search.trim());
    return res.status(200).json(patients);
  });

  router.get('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Invalid patient id' });
    }

    const patient = findPatientById(db, id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    return res.status(200).json(patient);
  });

  router.put('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Invalid patient id' });
    }

    const errors = validatePatient(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const duplicates = findDuplicates(db, req.body, { excludeId: id });
    const patient = updatePatientRecord(db, id, req.body);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    return res.status(200).json({
      ...patient,
      duplicateWarning: duplicates.length > 0,
    });
  });

  return router;
}
