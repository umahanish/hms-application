import * as createPatients from './001_create_patients.js';
import * as createScheduling from './002_create_scheduling.js';
import * as addDoctorLocation from './003_add_doctor_location.js';
import * as createBilling from './004_create_billing.js';
import * as createPayments from './005_create_payments.js';
import * as addInvoiceDepartment from './006_add_invoice_department.js';
import * as createDoctorDayLocks from './007_create_doctor_day_locks.js';

export const migrations = [
  createPatients,
  createScheduling,
  addDoctorLocation,
  createBilling,
  createPayments,
  addInvoiceDepartment,
  createDoctorDayLocks,
];
