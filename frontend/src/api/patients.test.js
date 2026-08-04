import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerPatient, updatePatient, getPatient, searchPatients } from './patients.js';

function mockFetchOnce(body, { ok = true, status = 200 } = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('patients API client (contract with HMS-6 backend)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registerPatient POSTs to /patients with a JSON body', async () => {
    mockFetchOnce({ id: 1, firstName: 'Jane' }, { status: 201 });

    const patient = { firstName: 'Jane', lastName: 'Doe' };
    const result = await registerPatient(patient);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/patients$/);
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(patient);
    expect(result).toEqual({ id: 1, firstName: 'Jane' });
  });

  it('updatePatient PUTs to /patients/:id with a JSON body', async () => {
    mockFetchOnce({ id: 1, firstName: 'Janet' });

    await updatePatient(1, { firstName: 'Janet' });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/patients\/1$/);
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ firstName: 'Janet' });
  });

  it('getPatient GETs /patients/:id', async () => {
    mockFetchOnce({ id: 1, firstName: 'Jane' });

    await getPatient(1);

    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/patients\/1$/);
    expect(options.method).toBe('GET');
  });

  it('searchPatients GETs /patients?search= per the HMS-6 contract', async () => {
    mockFetchOnce([{ id: 1, firstName: 'Jane' }]);

    await searchPatients('Jane');

    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/patients\?search=Jane$/);
    expect(url).not.toMatch(/\/patients\/search/);
    expect(options.method).toBe('GET');
  });

  it('throws the backend error message when a request fails', async () => {
    mockFetchOnce({ message: 'Validation failed', errors: { email: 'Enter a valid email address' } }, { ok: false, status: 400 });

    await expect(registerPatient({})).rejects.toThrow('Validation failed');
  });
});
