import { Router } from 'express';
import { listDoctors, findDoctorById } from '../repositories/doctorsRepository.js';
import { getDoctorAvailability } from '../services/availability.js';
import { asyncHandler } from './asyncHandler.js';

export function createDoctorsRouter(pool) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { department } = req.query;
      return res.status(200).json(await listDoctors(pool, { department }));
    }),
  );

  router.get(
    '/:id/availability',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Invalid doctor id' });
      }

      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ message: 'date query parameter is required' });
      }

      if (!(await findDoctorById(pool, id))) {
        return res.status(404).json({ message: 'Doctor not found' });
      }

      return res.status(200).json(await getDoctorAvailability(pool, id, date));
    }),
  );

  return router;
}
