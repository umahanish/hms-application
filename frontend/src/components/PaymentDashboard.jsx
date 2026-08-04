import { useEffect, useState } from 'react';
import InvoiceList from './InvoiceList.jsx';
import { listInvoices, listPayments, recordPayment } from '../api/billing.js';
import { summarizeInvoices } from '../utils/billingSummary.js';
import { DEPARTMENTS } from '../constants.js';
import './PaymentDashboard.css';

const STATUSES = ['unpaid', 'partial', 'paid'];
const PAYMENT_METHODS = ['card', 'upi', 'cash'];

export default function PaymentDashboard() {
  const [filters, setFilters] = useState({ status: '', dateFrom: '', dateTo: '', department: '' });
  const [invoices, setInvoices] = useState([]);
  const [listStatus, setListStatus] = useState('loading'); // loading | ready | error
  const [listError, setListError] = useState('');

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle | submitting | error
  const [paymentError, setPaymentError] = useState('');

  async function loadInvoices() {
    setListStatus('loading');
    setListError('');
    try {
      const results = await listInvoices(filters);
      setInvoices(results);
      setListStatus('ready');
    } catch (error) {
      setListStatus('error');
      setListError(error.message || 'Unable to load invoices.');
    }
  }

  useEffect(() => {
    loadInvoices();
  }, [filters.status, filters.dateFrom, filters.dateTo, filters.department]);

  async function openInvoice(invoice) {
    setSelectedInvoice(invoice);
    setPaymentAmount('');
    setPaymentStatus('idle');
    setPaymentError('');
    try {
      setPaymentHistory(await listPayments(invoice.id));
    } catch {
      setPaymentHistory([]);
    }
  }

  function closeInvoice() {
    setSelectedInvoice(null);
    setPaymentHistory([]);
  }

  async function handleRecordPayment() {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      setPaymentStatus('error');
      setPaymentError('Enter a payment amount greater than zero.');
      return;
    }

    setPaymentStatus('submitting');
    setPaymentError('');

    try {
      const result = await recordPayment({ invoiceId: selectedInvoice.id, amount, method: paymentMethod });
      setSelectedInvoice(result.invoice);
      setPaymentHistory((prev) => [...prev, result.payment]);
      setPaymentAmount('');
      setPaymentStatus('idle');
      await loadInvoices();
    } catch (error) {
      setPaymentStatus('error');
      setPaymentError(error.message || 'Unable to record this payment.');
    }
  }

  const totals = summarizeInvoices(invoices);

  return (
    <div className="payment-dashboard">
      <h2>Payment Status Dashboard</h2>

      <div className="dashboard-filters">
        <div className="form-row">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="">All</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="filter-department">Department</label>
          <select
            id="filter-department"
            value={filters.department}
            onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value }))}
          >
            <option value="">All</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="filter-date-from">From</label>
          <input
            id="filter-date-from"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
          />
        </div>

        <div className="form-row">
          <label htmlFor="filter-date-to">To</label>
          <input
            id="filter-date-to"
            type="date"
            value={filters.dateTo}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
          />
        </div>
      </div>

      <dl className="dashboard-totals">
        <dt>Outstanding</dt>
        <dd>${totals.outstanding.toFixed(2)}</dd>
        <dt>Paid</dt>
        <dd>${totals.paid.toFixed(2)}</dd>
        <dt>Overdue (30+ days)</dt>
        <dd>${totals.overdue.toFixed(2)}</dd>
      </dl>

      {listStatus === 'error' && (
        <p role="alert" className="dashboard-error">
          {listError}
        </p>
      )}

      {listStatus === 'ready' && !selectedInvoice && (
        <InvoiceList invoices={invoices} onSelectInvoice={openInvoice} emptyMessage="No invoices match these filters." />
      )}

      {selectedInvoice && (
        <div className="invoice-detail">
          <button type="button" onClick={closeInvoice}>
            ← Back to list
          </button>
          <h3>Invoice INV-{selectedInvoice.id}</h3>
          <p>
            Status: <span className={`status-badge status-${selectedInvoice.status}`}>{selectedInvoice.status}</span>
          </p>
          <p>Total: ${selectedInvoice.total.toFixed(2)}</p>
          <p>Paid so far: ${selectedInvoice.amountPaid.toFixed(2)}</p>
          <p>Balance: ${(selectedInvoice.total - selectedInvoice.amountPaid).toFixed(2)}</p>

          <h4>Payment History</h4>
          {paymentHistory.length === 0 ? (
            <p>No payments recorded yet.</p>
          ) : (
            <ul className="payment-history">
              {paymentHistory.map((payment) => (
                <li key={payment.id}>
                  ${payment.amount.toFixed(2)} via {payment.method} — {payment.status}
                  {payment.failureReason && ` (${payment.failureReason})`}
                </li>
              ))}
            </ul>
          )}

          <h4>Record Payment</h4>
          <div className="record-payment-form">
            <label htmlFor="payment-amount">Amount</label>
            <input
              id="payment-amount"
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
            />

            <label htmlFor="payment-method">Method</label>
            <select id="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>

            <button type="button" onClick={handleRecordPayment} disabled={paymentStatus === 'submitting'}>
              {paymentStatus === 'submitting' ? 'Recording…' : 'Record Payment'}
            </button>
          </div>

          {paymentStatus === 'error' && (
            <p role="alert" className="dashboard-error">
              {paymentError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
