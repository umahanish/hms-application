import './InvoiceList.css';

const STATUS_LABELS = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
};

export default function InvoiceList({ invoices, onSelectInvoice, emptyMessage = 'No invoices yet.' }) {
  if (invoices.length === 0) {
    return <p className="invoice-list-empty">{emptyMessage}</p>;
  }

  return (
    <table className="invoice-list">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Date</th>
          <th>Department</th>
          <th>Total</th>
          <th>Paid</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
          <tr key={invoice.id}>
            <td>
              {onSelectInvoice ? (
                <button type="button" onClick={() => onSelectInvoice(invoice)}>
                  INV-{invoice.id}
                </button>
              ) : (
                `INV-${invoice.id}`
              )}
            </td>
            <td>{invoice.createdAt?.slice(0, 10)}</td>
            <td>{invoice.department || '—'}</td>
            <td>${invoice.total.toFixed(2)}</td>
            <td>${invoice.amountPaid.toFixed(2)}</td>
            <td>
              <span className={`status-badge status-${invoice.status}`}>{STATUS_LABELS[invoice.status]}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
