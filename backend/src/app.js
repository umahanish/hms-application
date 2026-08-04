import express from 'express';
import { createPatientsRouter } from './routes/patients.js';

export function createApp(db) {
  const app = express();
  app.use(express.json());

  app.use('/api/patients', createPatientsRouter(db));

  // Malformed JSON bodies raise a SyntaxError from express.json() before any route runs.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'Malformed JSON in request body' });
    }
    return next(err);
  });

  app.use((req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  return app;
}
