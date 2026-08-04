import { useEffect, useState } from 'react';
import PatientSearch from './PatientSearch.jsx';
import InvoiceList from './InvoiceList.jsx';
import { generateInvoice, listInvoices } from '../api/billing.js';
import { calculateInvoiceTotals } from '../utils/invoiceCalculator.js';
import { DEPARTMENTS } from '../constants.js';
import './InvoiceGeneration.css';

const PRESET_ITEMS = [
  { label: '+ Consultation', description: 'Consultation charge', unitPrice: 100 },
  { label: '+ Lab Test', description: 'Lab test charge', unitPrice: 50 },
  { label: '+ Pharmacy', description: 'Pharmacy charge', unitPrice: 25 },
];

const EMPTY_LINE_ITEM = { description: '', quantity: 1, unitPrice: 0 };

function newIdempotencyKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `inv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function InvoiceGeneration() {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [department, setDepartment] = useState('');
  const [lineItems, setLineItems] = useState([{ ...EMPTY_LINE_ITEM }]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedInvoice, setGeneratedInvoice] = useState(null);
  const [pastInvoices, setPastInvoices] = useState([]);

  useEffect(() => {
    if (!selectedPatient) {
      setPastInvoices([]);
      return;
    }
    listInvoices({ patient: selectedPatient.id })
      .then(setPastInvoices)
      .catch(() => setPastInvoices([]));
  }, [selectedPatient, generatedInvoice]);

  const totals = calculateInvoiceTotals(lineItems, { discountPercent: Number(discountPercent) || 0, taxPercent: Number(taxPercent) || 0 });

  function updateLineItem(index, field, value) {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addLineItem(preset) {
    setLineItems((prev) => [...prev, preset ? { description: preset.description, quantity: 1, unitPrice: preset.unitPrice } : { ...EMPTY_LINE_ITEM }]);
  }

  function removeLineItem(index) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForNewInvoice() {
    setSelectedPatient(null);
    setDepartment('');
    setLineItems([{ ...EMPTY_LINE_ITEM }]);
    setDiscountPercent(0);
    setTaxPercent(0);
    setIdempotencyKey(newIdempotencyKey());
    setStatus('idle');
    setErrorMessage('');
    setGeneratedInvoice(null);
  }

  async function handleGenerate() {
    if (!selectedPatient) {
      setStatus('error');
      setErrorMessage('Select a patient before generating an invoice.');
      return;
    }

    const cleanedItems = lineItems
      .map((item) => ({ description: item.description.trim(), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) }))
      .filter((item) => item.description && item.quantity > 0 && item.unitPrice >= 0);

    if (cleanedItems.length === 0) {
      setStatus('error');
      setErrorMessage('Add at least one valid line item.');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const invoice = await generateInvoice({
        patientId: selectedPatient.id,
        department: department || undefined,
        lineItems: cleanedItems,
        discountPercent: Number(discountPercent) || 0,
        taxPercent: Number(taxPercent) || 0,
        idempotencyKey,
      });
      setGeneratedInvoice(invoice);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'Unable to generate this invoice. Please try again.');
    }
  }

  return (
    <div className="invoice-generation">
      <h2>Generate Invoice</h2>

      <section aria-label="Patient">
        {selectedPatient ? (
          <p>
            Billing patient: <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>{' '}
            <button type="button" onClick={() => setSelectedPatient(null)}>
              Change
            </button>
          </p>
        ) : (
          <PatientSearch onSelectPatient={setSelectedPatient} />
        )}
      </section>

      <div className="form-row">
        <label htmlFor="invoice-department">Department</label>
        <select id="invoice-department" value={department} onChange={(event) => setDepartment(event.target.value)}>
          <option value="">Select…</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
      </div>

      <table className="line-items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Amount</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => (
            <tr key={index}>
              <td>
                <input
                  aria-label={`Line item ${index + 1} description`}
                  value={item.description}
                  onChange={(event) => updateLineItem(index, 'description', event.target.value)}
                />
              </td>
              <td>
                <input
                  aria-label={`Line item ${index + 1} quantity`}
                  type="number"
                  min="0"
                  value={item.quantity}
                  onChange={(event) => updateLineItem(index, 'quantity', event.target.value)}
                />
              </td>
              <td>
                <input
                  aria-label={`Line item ${index + 1} unit price`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(event) => updateLineItem(index, 'unitPrice', event.target.value)}
                />
              </td>
              <td>${((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toFixed(2)}</td>
              <td>
                <button type="button" onClick={() => removeLineItem(index)} aria-label={`Remove line item ${index + 1}`}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="line-item-presets">
        <button type="button" onClick={() => addLineItem()}>
          + Manual line item
        </button>
        {PRESET_ITEMS.map((preset) => (
          <button type="button" key={preset.label} onClick={() => addLineItem(preset)}>
            {preset.label}
          </button>
        ))}
      </div>

      <div className="form-row">
        <label htmlFor="invoice-discount">Discount %</label>
        <input
          id="invoice-discount"
          type="number"
          min="0"
          max="100"
          value={discountPercent}
          onChange={(event) => setDiscountPercent(event.target.value)}
        />
      </div>

      <div className="form-row">
        <label htmlFor="invoice-tax">Tax %</label>
        <input
          id="invoice-tax"
          type="number"
          min="0"
          value={taxPercent}
          onChange={(event) => setTaxPercent(event.target.value)}
        />
      </div>

      <dl className="invoice-totals">
        <dt>Subtotal</dt>
        <dd>${totals.subtotal.toFixed(2)}</dd>
        <dt>Discount</dt>
        <dd>-${totals.discountAmount.toFixed(2)}</dd>
        <dt>Tax</dt>
        <dd>+${totals.taxAmount.toFixed(2)}</dd>
        <dt>Total Due</dt>
        <dd className="invoice-total-due">${totals.total.toFixed(2)}</dd>
      </dl>

      {status === 'error' && (
        <p role="alert" className="invoice-error">
          {errorMessage}
        </p>
      )}

      <button type="button" onClick={handleGenerate} disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Generating…' : 'Generate Invoice'}
      </button>

      {status === 'success' && generatedInvoice && (
        <div className="printable-invoice" role="status">
          <h3>Invoice INV-{generatedInvoice.id}</h3>
          <p>
            Patient: {selectedPatient.firstName} {selectedPatient.lastName}
          </p>
          {department && <p>Department: {department}</p>}
          <table>
            <tbody>
              {generatedInvoice.lineItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>
                    {item.quantity} × ${item.unitPrice.toFixed(2)}
                  </td>
                  <td>${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Subtotal: ${generatedInvoice.subtotal.toFixed(2)}</p>
          <p>Discount: -${generatedInvoice.discountAmount.toFixed(2)}</p>
          <p>Tax: +${generatedInvoice.taxAmount.toFixed(2)}</p>
          <p className="invoice-total-due">Total Due: ${generatedInvoice.total.toFixed(2)}</p>

          <div className="invoice-actions">
            <button type="button" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
            <button type="button" onClick={resetForNewInvoice}>
              New Invoice
            </button>
          </div>
        </div>
      )}

      {selectedPatient && (
        <section aria-label="Billing summary">
          <h3>Past Invoices</h3>
          <InvoiceList invoices={pastInvoices} />
        </section>
      )}
    </div>
  );
}
