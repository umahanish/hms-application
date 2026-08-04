import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PatientSearch from './PatientSearch.jsx';
import { searchPatients } from '../api/patients.js';

vi.mock('../api/patients.js', () => ({
  searchPatients: vi.fn(),
}));

describe('PatientSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not search until the query has at least 2 characters', async () => {
    const user = userEvent.setup();
    render(<PatientSearch />);

    await user.type(screen.getByLabelText('Search patients'), 'J');

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(searchPatients).not.toHaveBeenCalled();
  });

  it('shows live results as the user types', async () => {
    searchPatients.mockResolvedValueOnce([
      { id: 'P-1', firstName: 'Jane', lastName: 'Doe' },
      { id: 'P-2', firstName: 'Janet', lastName: 'Smith' },
    ]);
    const user = userEvent.setup();
    render(<PatientSearch />);

    await user.type(screen.getByLabelText('Search patients'), 'Jan');

    await waitFor(() => expect(searchPatients).toHaveBeenCalledWith('Jan'), { timeout: 2000 });
    expect(await screen.findByText('Jane Doe — P-1')).toBeInTheDocument();
    expect(screen.getByText('Janet Smith — P-2')).toBeInTheDocument();
  });

  it('shows an empty state when no patients match', async () => {
    searchPatients.mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<PatientSearch />);

    await user.type(screen.getByLabelText('Search patients'), 'zzz');

    expect(await screen.findByText('No patients found for "zzz".', undefined, { timeout: 2000 })).toBeInTheDocument();
  });

  it('shows a graceful error state when the search API fails', async () => {
    searchPatients.mockRejectedValueOnce(new Error('Search service unavailable'));
    const user = userEvent.setup();
    render(<PatientSearch />);

    await user.type(screen.getByLabelText('Search patients'), 'Jan');

    expect(await screen.findByRole('alert', {}, { timeout: 2000 })).toHaveTextContent('Search service unavailable');
  });

  it('calls onSelectPatient when a result is clicked', async () => {
    searchPatients.mockResolvedValueOnce([{ id: 'P-1', firstName: 'Jane', lastName: 'Doe' }]);
    const user = userEvent.setup();
    const onSelectPatient = vi.fn();
    render(<PatientSearch onSelectPatient={onSelectPatient} />);

    await user.type(screen.getByLabelText('Search patients'), 'Jan');
    const resultButton = await screen.findByText('Jane Doe — P-1', {}, { timeout: 2000 });
    await user.click(resultButton);

    expect(onSelectPatient).toHaveBeenCalledWith({ id: 'P-1', firstName: 'Jane', lastName: 'Doe' });
  });
});
