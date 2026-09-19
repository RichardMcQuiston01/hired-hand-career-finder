import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnetClientError } from '@hired-hand/onet-mnm-client';
import type { CareerSearchResult } from '@hired-hand/shared';
import { CareerSearchPanel } from './CareerSearchPanel';
import { onetClient } from '../../lib/onetClient';

expect.extend(toHaveNoViolations);

vi.mock('../../lib/onetClient', () => ({
  onetClient: { searchCareers: vi.fn() },
}));

const searchCareers = vi.mocked(onetClient.searchCareers);

function makeResult(occupation: CareerSearchResult['occupation']): CareerSearchResult {
  return { start: 1, end: 20, total: occupation.length, occupation };
}

describe('CareerSearchPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    searchCareers.mockReset();
  });

  it('shows an idle state before any search', () => {
    render(<CareerSearchPanel />);
    expect(screen.getByText('Search for a career to get started.')).toBeInTheDocument();
  });

  it('debounces as-you-type input and renders results', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    searchCareers.mockResolvedValue(
      makeResult([{ href: 'https://example.com/nurse', code: '29-1141.00', title: 'Nurse' }]),
    );

    render(<CareerSearchPanel />);
    await user.type(screen.getByLabelText('Search careers by keyword'), 'nurse');

    expect(searchCareers).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() =>
      expect(searchCareers).toHaveBeenCalledWith({
        keyword: 'nurse',
        start: 1,
        end: 20,
      }),
    );

    expect(await screen.findByText('Nurse')).toBeInTheDocument();
    expect(screen.getByText('29-1141.00')).toBeInTheDocument();
    expect(screen.getByText('1 result for "nurse"')).toBeInTheDocument();
  });

  it('renders a Bright Outlook star with an accessible label when applicable', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    searchCareers.mockResolvedValue(
      makeResult([
        {
          href: 'https://example.com/nurse',
          code: '29-1141.00',
          title: 'Nurse',
          tags: { bright_outlook: true },
        },
      ]),
    );

    render(<CareerSearchPanel />);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.type(screen.getByLabelText('Search careers by keyword'), 'nurse');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Nurse')).toBeInTheDocument();
    expect(screen.getByText('Bright Outlook')).toBeInTheDocument();
  });

  it('renders and announces an error from a rejected search', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    searchCareers.mockRejectedValue(new OnetClientError(500, 'The proxy is unavailable.'));

    render(<CareerSearchPanel />);
    await user.type(screen.getByLabelText('Search careers by keyword'), 'nurse');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('The proxy is unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('The proxy is unavailable.');
  });

  it('renders an empty-results state', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    searchCareers.mockResolvedValue(makeResult([]));

    render(<CareerSearchPanel />);
    await user.type(screen.getByLabelText('Search careers by keyword'), 'zzzznotacareer');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('No careers found for "zzzznotacareer".')).toBeInTheDocument();
  });

  it('has no obvious accessibility violations with populated results', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    searchCareers.mockResolvedValue(
      makeResult([
        { href: 'https://example.com/nurse', code: '29-1141.00', title: 'Nurse' },
        {
          href: 'https://example.com/dev',
          code: '15-1252.00',
          title: 'Software Developer',
          tags: { bright_outlook: true },
        },
      ]),
    );

    const { container } = render(<CareerSearchPanel />);
    await user.type(screen.getByLabelText('Search careers by keyword'), 'nurse');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByText('Nurse');
    expect(await axe(container)).toHaveNoViolations();
  });
});
