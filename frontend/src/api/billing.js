const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? '/api';

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export function generateInvoice(invoice) {
  return request('/invoices', {
    method: 'POST',
    body: JSON.stringify(invoice),
  });
}

export function getInvoice(invoiceId) {
  return request(`/invoices/${invoiceId}`, { method: 'GET' });
}

export function listInvoices(filters = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')),
  );
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/invoices${query}`, { method: 'GET' });
}

export function updateInvoiceStatus(invoiceId, status) {
  return request(`/invoices/${invoiceId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export function recordPayment(payment) {
  return request('/payments', {
    method: 'POST',
    body: JSON.stringify(payment),
  });
}

export function listPayments(invoiceId) {
  const params = new URLSearchParams({ invoiceId });
  return request(`/payments?${params.toString()}`, { method: 'GET' });
}
