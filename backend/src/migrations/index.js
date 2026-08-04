import * as createPatients from './001_create_patients.js';
import * as createScheduling from './002_create_scheduling.js';

export const migrations = [createPatients, createScheduling];
