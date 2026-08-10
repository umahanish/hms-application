const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? '/api';

// The backend gates appointment-write endpoints by role via this header. There's no
// login screen yet, so this stands in for "the current front-desk user" -- see
// TASKS.md for the real-auth follow-up. (The doctors/availability endpoints ignore
// this header -- they carry no patient PII.)
async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', 'x-user-role': 'front-desk' },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export function listDoctors(department) {
  const params = department ? `?${new URLSearchParams({ department }).toString()}` : '';
  return request(`/doctors${params}`, { method: 'GET' });
}

export function getDoctorAvailability(doctorId, date) {
  const params = new URLSearchParams({ date });
  return request(`/doctors/${doctorId}/availability?${params.toString()}`, { method: 'GET' });
}

export function bookAppointment(appointment) {
  return request('/appointments', {
    method: 'POST',
    body: JSON.stringify(appointment),
  });
}

export function listAppointments(filters = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')),
  );
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/appointments${query}`, { method: 'GET' });
}

export function rescheduleAppointment(appointmentId, changes) {
  return request(`/appointments/${appointmentId}`, {
    method: 'PUT',
    body: JSON.stringify(changes),
  });
}

export function cancelAppointment(appointmentId) {
  return request(`/appointments/${appointmentId}`, {
    method: 'DELETE',
  });
}
