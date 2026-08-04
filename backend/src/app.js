import express from 'express';
import { createPatientsRouter } from './routes/patients.js';

export function createApp(db) {
  const app = express();
  app.use(express.json());

  // Allows the Vite dev server (a different origin) to call this API directly.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

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
