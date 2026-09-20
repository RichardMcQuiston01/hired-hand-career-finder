import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnetClientError } from '@hired-hand/onet-mnm-client';
import type { CareerDetail, CareerListResult, CareerReference } from '@hired-hand/shared';
import { BrowseCareersPanel } from './BrowseCareersPanel';
import { onetClient } from '../../lib/onetClient';

expect.extend(toHaveNoViolations);

vi.mock('../../lib/onetClient', () => ({
  onetClient: {
    listCareers: vi.fn(),
    getCareerDetail: vi.fn(),
  },
}));

const mockedOnetClient = vi.mocked(onetClient, true);

function career(overrides: Partial<CareerReference> = {}): CareerReference {
  return {
    href: 'https://example.com/careers/17-2051.00',
    code: '17-2051.00',
    title: 'Civil Engineers',
    ...overrides,
  };
}

function listResult(overrides: Partial<CareerListResult> = {}): CareerListResult {
  return {
    start: 1,
    end: 2,
    total: 2,
    occupation: [
      career(),
      career({
        code: '15-1252.00',
        title: 'Software Developers',
        tags: { bright_outlook: true },
      }),
    ],
    ...overrides,
  };
}

function overviewDetail(): CareerDetail {
  return {
    code: '17-2051.00',
    title: 'Civil Engineers',
    description: 'Perform engineering duties in planning and supervising construction.',
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('BrowseCareersPanel', () => {
  it('renders the list with pagination controls disabled at the start boundary', async () => {
    mockedOnetClient.listCareers.mockResolvedValue(listResult({ start: 1, end: 2, total: 2 }));

    render(<BrowseCareersPanel />);

    expect(await screen.findByRole('button', { name: /Civil Engineers/ })).toBeInTheDocument();
    expect(mockedOnetClient.listCareers).toHaveBeenCalledWith({ start: 1, end: 20 });

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    const softwareDevRow = screen.getByRole('button', { name: /Software Developers/ });
    expect(within(softwareDevRow).getByLabelText('Bright Outlook career')).toBeInTheDocument();
  });

  it('enables Next when more results remain and Previous once paged forward', async () => {
    mockedOnetClient.listCareers.mockResolvedValueOnce(
      listResult({ start: 1, end: 20, total: 40 }),
    );

    render(<BrowseCareersPanel />);
    await screen.findByRole('button', { name: /Civil Engineers/ });

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeEnabled();

    mockedOnetClient.listCareers.mockResolvedValueOnce(
      listResult({ start: 21, end: 40, total: 40 }),
    );

    await userEvent.click(nextButton);

    await waitFor(() =>
      expect(mockedOnetClient.listCareers).toHaveBeenLastCalledWith({ start: 21, end: 40 }),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  it('renders an error state when the list fails to load', async () => {
    mockedOnetClient.listCareers.mockRejectedValue(
      new OnetClientError(500, 'Proxy is unreachable'),
    );

    render(<BrowseCareersPanel />);

    expect(await screen.findByText('Proxy is unreachable')).toBeInTheDocument();
  });

  it('selecting a career shows the detail view with focus moved to its heading', async () => {
    mockedOnetClient.listCareers.mockResolvedValue(listResult());
    mockedOnetClient.getCareerDetail.mockResolvedValue(overviewDetail());

    render(<BrowseCareersPanel />);

    await userEvent.click(await screen.findByRole('button', { name: /Civil Engineers/ }));

    const heading = await screen.findByRole('heading', { name: 'Civil Engineers' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(mockedOnetClient.getCareerDetail).toHaveBeenCalledWith('17-2051.00');
  });

  it('"Back to results" returns to the list with focus restored to the selected item', async () => {
    mockedOnetClient.listCareers.mockResolvedValue(listResult());
    mockedOnetClient.getCareerDetail.mockResolvedValue(overviewDetail());

    render(<BrowseCareersPanel />);

    const item = await screen.findByRole('button', { name: /Civil Engineers/ });
    await userEvent.click(item);

    await screen.findByRole('heading', { name: 'Civil Engineers' });
    await userEvent.click(screen.getByRole('button', { name: /Back to results/ }));

    const restoredItem = await screen.findByRole('button', { name: /Civil Engineers/ });
    await waitFor(() => expect(restoredItem).toHaveFocus());
  });

  it('has no obvious accessibility violations in the list view', async () => {
    mockedOnetClient.listCareers.mockResolvedValue(listResult());

    const { container } = render(<BrowseCareersPanel />);
    await screen.findByRole('button', { name: /Civil Engineers/ });

    expect(await axe(container)).toHaveNoViolations();
  });
});
