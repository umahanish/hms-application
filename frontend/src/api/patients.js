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

export function searchPatients(query) {
  const params = new URLSearchParams(query);
  return request(`/patients/search?${params.toString()}`, {
    method: 'GET',
  });
}

export function getPatient(patientId) {
  return request(`/patients/${patientId}`, {
    method: 'GET',
  });
}
