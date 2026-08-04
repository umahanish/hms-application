import { Router } from 'express';
import { findPaymentsByInvoice } from '../repositories/paymentsRepository.js';
import {
  processPayment,
  reconcileWebhookPayment,
  InvoiceNotFoundError,
  PaymentNotFoundError,
  PaymentDeclinedError,
} from '../services/paymentsService.js';

const VALID_METHODS = ['card', 'upi', 'cash'];

export function createPaymentsRouter(db) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    const { invoiceId, amount, method, simulate } = req.body;

    const errors = {};
    if (!invoiceId) errors.invoiceId = 'invoiceId is required';
    if (typeof amount !== 'number' || amount <= 0) errors.amount = 'amount must be a positive number';
    if (!VALID_METHODS.includes(method)) errors.method = `method must be one of ${VALID_METHODS.join(', ')}`;
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    try {
      const result = await processPayment(db, { invoiceId, amount, method, simulate });
      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof InvoiceNotFoundError) {
        return res.status(400).json({ message: 'Validation failed', errors: { invoiceId: 'Invoice not found' } });
      }
      if (error instanceof PaymentDeclinedError) {
        return res.status(402).json({ message: error.message, retryable: error.retryable });
      }
      return next(error);
    }
  });

  router.post('/webhook', (req, res, next) => {
    const { gatewayReference, status, failureReason } = req.body;

    if (!gatewayReference || !['succeeded', 'failed'].includes(status)) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: { status: 'status must be "succeeded" or "failed", with a gatewayReference' },
      });
    }

    try {
      const result = reconcileWebhookPayment(db, { gatewayReference, status, failureReason });
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof PaymentNotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      return next(error);
    }
  });

  router.get('/', (req, res) => {
    const { invoiceId } = req.query;
    if (!invoiceId) {
      return res.status(400).json({ message: 'invoiceId query parameter is required' });
    }
    return res.status(200).json(findPaymentsByInvoice(db, Number(invoiceId)));
  });

  return router;
}
