import { round2 } from './invoiceCalculator.js';

const OVERDUE_DAYS = 30;

/**
 * Rolls up a list of invoices into outstanding/paid/overdue totals for the
 * dashboard. There's no explicit due-date field on an invoice, so "overdue"
 * uses a net-30 heuristic: unpaid/partial balance still open 30+ days after
 * the invoice was created.
 */
export function summarizeInvoices(invoices, referenceDate = new Date()) {
  let outstanding = 0;
  let paid = 0;
  let overdue = 0;

  for (const invoice of invoices) {
    const balance = invoice.total - invoice.amountPaid;
    outstanding += balance;
    paid += invoice.amountPaid;

    if (invoice.status !== 'paid' && balance > 0) {
      const ageDays = (referenceDate.getTime() - new Date(invoice.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > OVERDUE_DAYS) {
        overdue += balance;
      }
    }
  }

  return { outstanding: round2(outstanding), paid: round2(paid), overdue: round2(overdue) };
}
