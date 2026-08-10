const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? '/api';

// The backend gates patient endpoints by role via this header. There's no login
// screen yet, so this stands in for "the current front-desk user" -- see TASKS.md
// for the real-auth follow-up.
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

export function registerPatient(patient) {
  return request('/patients', {
    method: 'POST',
    body: JSON.stringify(patient),
  });
}

export function updatePatient(patientId, patient) {
  return request(`/patients/${patientId}`, {
    method: 'PUT',
    body: JSON.stringify(patient),
  });
}

export function searchPatients(term) {
  const params = new URLSearchParams({ search: term });
  return request(`/patients?${params.toString()}`, {
    method: 'GET',
  });
}

export function getPatient(patientId) {
  return request(`/patients/${patientId}`, {
    method: 'GET',
  });
}
