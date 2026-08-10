import { Router } from 'express';
import { findPatientById } from '../repositories/patientsRepository.js';
import {
  createInvoice,
  findInvoiceById,
  findInvoices,
  updateInvoiceStatus,
} from '../repositories/invoicesRepository.js';
import { requireRole, ROLES } from '../middleware/rbac.js';
import { asyncHandler } from './asyncHandler.js';

const VALID_STATUSES = ['unpaid', 'partial', 'paid'];

const canAccessInvoices = requireRole(ROLES.BILLING_STAFF, ROLES.ADMIN);

function validateLineItems(lineItems) {
  const errors = {};
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    errors.lineItems = 'At least one line item is required';
    return errors;
  }

  lineItems.forEach((item, index) => {
    if (!item.description || !String(item.description).trim()) {
      errors[`lineItems[${index}].description`] = 'description is required';
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      errors[`lineItems[${index}].quantity`] = 'quantity must be a positive number';
    }
    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
      errors[`lineItems[${index}].unitPrice`] = 'unitPrice must be a non-negative number';
    }
  });

  return errors;
}

export function createInvoicesRouter(pool) {
  const router = Router();
  router.use(canAccessInvoices);

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { patientId, lineItems, discountPercent, taxPercent, idempotencyKey, department } = req.body;

      const errors = validateLineItems(lineItems);
      if (!patientId) {
        errors.patientId = 'patientId is required';
      }
      if (Object.keys(errors).length > 0) {
        return res.status(400).json({ message: 'Validation failed', errors });
      }

      if (!(await findPatientById(pool, patientId))) {
        return res.status(400).json({ message: 'Validation failed', errors: { patientId: 'Patient not found' } });
      }

      const { invoice, wasExisting } = await createInvoice(pool, {
        patientId,
        lineItems,
        discountPercent,
        taxPercent,
        idempotencyKey,
        department,
      });

      return res.status(wasExisting ? 200 : 201).json(invoice);
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { patient, status, dateFrom, dateTo, department } = req.query;

      if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: { status: `status must be one of ${VALID_STATUSES.join(', ')}` },
        });
      }

      return res.status(200).json(
        await findInvoices(pool, {
          patientId: patient != null ? Number(patient) : undefined,
          status,
          dateFrom,
          dateTo,
          department,
        }),
      );
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Invalid invoice id' });
      }

      const invoice = await findInvoiceById(pool, id);
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      return res.status(200).json(invoice);
    }),
  );

  router.put(
    '/:id/status',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Invalid invoice id' });
      }

      const { status } = req.body;
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: { status: `status must be one of ${VALID_STATUSES.join(', ')}` },
        });
      }

      const invoice = await updateInvoiceStatus(pool, id, status);
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      return res.status(200).json(invoice);
    }),
  );

  return router;
}
