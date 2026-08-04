import { useEffect, useRef, useState } from 'react';
import { searchPatients } from '../api/patients.js';
import './PatientSearch.css';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export default function PatientSearch({ onSelectPatient }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus('idle');
      return undefined;
    }

    debounceRef.current = setTimeout(async () => {
      setStatus('loading');
      setErrorMessage('');
      try {
        const patients = await searchPatients(trimmed);
        setResults(patients);
        setStatus('success');
      } catch (error) {
        setStatus('error');
        setErrorMessage(error.message || 'Unable to search patients right now.');
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="patient-search">
      <label htmlFor="patient-search-input">Search patients</label>
      <input
        id="patient-search-input"
        type="search"
        placeholder="Search by name, patient ID, phone, or DOB"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {status === 'loading' && <p className="search-status">Searching…</p>}

      {status === 'error' && (
        <p role="alert" className="search-error">
          {errorMessage}
        </p>
      )}

      {status === 'success' && results.length === 0 && (
        <p className="search-empty">No patients found for "{query.trim()}".</p>
      )}

      {status === 'success' && results.length > 0 && (
        <ul className="search-results">
          {results.map((patient) => (
            <li key={patient.id}>
              <button type="button" onClick={() => onSelectPatient?.(patient)}>
                {patient.firstName} {patient.lastName} — {patient.id}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
