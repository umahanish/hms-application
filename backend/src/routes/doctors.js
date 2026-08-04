import { Router } from 'express';
import { listDoctors, findDoctorById } from '../repositories/doctorsRepository.js';
import { getDoctorAvailability } from '../services/availability.js';

export function createDoctorsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const { department } = req.query;
    return res.status(200).json(listDoctors(db, { department }));
  });

  router.get('/:id/availability', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'Invalid doctor id' });
    }

    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'date query parameter is required' });
    }

    if (!findDoctorById(db, id)) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    return res.status(200).json(getDoctorAvailability(db, id, date));
  });

  return router;
}
