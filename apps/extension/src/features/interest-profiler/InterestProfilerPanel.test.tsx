import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnetClientError } from '@hired-hand/onet-mnm-client';
import type {
  CareerMatch,
  InterestProfilerCareersResult,
  InterestProfilerQuestionSet,
  InterestProfilerResults,
} from '@hired-hand/shared';
import { InterestProfilerPanel } from './InterestProfilerPanel';
import { onetClient } from '../../lib/onetClient';

expect.extend(toHaveNoViolations);

vi.mock('../../lib/onetClient', () => ({
  onetClient: {
    getInterestProfilerQuestions: vi.fn(),
    getInterestProfilerResults: vi.fn(),
    getInterestProfilerCareers: vi.fn(),
    getJobZones: vi.fn(),
  },
}));

// The results view renders <ExportResults>, which creates its own ExtPay
// client — mocked here (never hitting extensionpay.com) purely so this
// panel's own tests can render the results view. See ExportResults.test.tsx
// for coverage of the export/paywall behavior itself.
vi.mock('../../lib/extpay', () => ({
  createExtPayClient: vi.fn(() => ({
    getUser: vi.fn(() => new Promise(() => {})), // never resolves; stays in "checking" state
    openPaymentPage: vi.fn(),
  })),
}));

const mockedClient = vi.mocked(onetClient, true);

const LIKERT_LABELS = ['Strongly Dislike', 'Dislike', 'Unsure', 'Like', 'Strongly Like'];

function makeQuestionSet(total: number): InterestProfilerQuestionSet {
  return {
    start: 0,
    end: total,
    total,
    question: Array.from({ length: total }, (_, i) => ({
      index: i + 1,
      area: 'realistic',
      text: `Sample question number ${i + 1}`,
    })),
  };
}

function makeResults(): InterestProfilerResults {
  return {
    realistic: 12,
    investigative: 8,
    artistic: 3,
    social: 15,
    enterprising: 7,
    conventional: 5,
    job_zone: 3,
  };
}

function makeCareers(): CareerMatch[] {
  return [
    { href: 'https://example.com/a', code: '11-1011.00', title: 'Chief Executives', fit: 'Best' },
    { href: 'https://example.com/b', code: '13-2011.00', title: 'Accountants' },
  ];
}

function makeCareersResult(): InterestProfilerCareersResult {
  return { start: 0, end: 2, total: 2, career: makeCareers() };
}

/** Minimal in-memory stand-in for `chrome.storage.session`, keyed like the real API. */
function installFakeChromeStorage() {
  const store: Record<string, unknown> = {};
  const session = {
    get: vi.fn((key: string) => Promise.resolve({ [key]: store[key] })),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    }),
    remove: vi.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
  };
  (globalThis as { chrome?: unknown }).chrome = { storage: { session } };
  return { store, session };
}

function removeFakeChrome() {
  delete (globalThis as { chrome?: unknown }).chrome;
}

async function startShortForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /short form/i }));
  return screen.findByText('Question 1 of 30');
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  removeFakeChrome();
});

describe('InterestProfilerPanel', () => {
  it('shows an intro with a choice between the short and full forms', () => {
    render(<InterestProfilerPanel />);

    expect(screen.getByRole('button', { name: /short form/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /full form/i })).toBeInTheDocument();
  });

  it('disables Next until the current question is answered', async () => {
    const user = userEvent.setup();
    mockedClient.getInterestProfilerQuestions.mockResolvedValue(makeQuestionSet(30));
    render(<InterestProfilerPanel />);

    await startShortForm(user);

    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();

    await user.click(screen.getByLabelText('1. Strongly Dislike'));
    expect(next).toBeEnabled();
  });

  it('goes back a question without losing an already-given answer', async () => {
    const user = userEvent.setup();
    mockedClient.getInterestProfilerQuestions.mockResolvedValue(makeQuestionSet(30));
    render(<InterestProfilerPanel />);

    await startShortForm(user);
    await user.click(screen.getByLabelText('3. Unsure'));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByText('Question 2 of 30');
    await user.click(screen.getByRole('button', { name: 'Back' }));

    await screen.findByText('Question 1 of 30');
    expect(screen.getByLabelText('3. Unsure')).toBeChecked();
  });

  it('returns to the intro when Back is pressed on question 1', async () => {
    const user = userEvent.setup();
    mockedClient.getInterestProfilerQuestions.mockResolvedValue(makeQuestionSet(30));
    render(<InterestProfilerPanel />);

    await startShortForm(user);
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('button', { name: /short form/i })).toBeInTheDocument();
  });

  it('answers every question in the short form and submits a correct 30-digit answers string', async () => {
    const user = userEvent.setup();
    const total = 30;
    mockedClient.getInterestProfilerQuestions.mockResolvedValue(makeQuestionSet(total));
    mockedClient.getInterestProfilerResults.mockResolvedValue(makeResults());
    mockedClient.getInterestProfilerCareers.mockResolvedValue(makeCareersResult());

    render(<InterestProfilerPanel />);
    await startShortForm(user);

    let expected = '';
    for (let i = 0; i < total; i++) {
      const value = (i % 5) + 1;
      expected += String(value);
      await user.click(screen.getByLabelText(`${value}. ${LIKERT_LABELS[value - 1]}`));
      const isLast = i === total - 1;
      await user.click(screen.getByRole('button', { name: isLast ? 'Submit' : 'Next' }));
    }

    await screen.findByRole('heading', { name: 'Your results' });

    expect(expected).toHaveLength(30);
    expect(expected).toMatch(/^[1-5]{30}$/);
    expect(mockedClient.getInterestProfilerResults).toHaveBeenCalledWith(expected);
    expect(mockedClient.getInterestProfilerCareers).toHaveBeenCalledWith({ answers: expected });

    expect(screen.getByText('Chief Executives')).toBeInTheDocument();
    expect(screen.getByText('(11-1011.00)')).toBeInTheDocument();
    expect(screen.getByText('Fit: Best')).toBeInTheDocument();
    expect(screen.getByText('Accountants')).toBeInTheDocument();
    expect(screen.getByText('(13-2011.00)')).toBeInTheDocument();
  });

  it('persists in-progress answers to chrome.storage.session and restores them on remount', async () => {
    const user = userEvent.setup();
    const { session } = installFakeChromeStorage();
    mockedClient.getInterestProfilerQuestions.mockResolvedValue(makeQuestionSet(30));

    const first = render(<InterestProfilerPanel />);
    await startShortForm(user);
    await user.click(screen.getByLabelText('2. Dislike'));

    expect(session.set).toHaveBeenCalled();

    first.unmount();

    render(<InterestProfilerPanel />);
    await screen.findByText('Question 1 of 30');

    expect(session.get).toHaveBeenCalled();
    expect(screen.getByLabelText('2. Dislike')).toBeChecked();
  });

  it('renders an error message when fetching questions fails', async () => {
    const user = userEvent.setup();
    mockedClient.getInterestProfilerQuestions.mockRejectedValue(
      new OnetClientError(502, 'The O*NET proxy is unavailable.'),
    );

    render(<InterestProfilerPanel />);
    await user.click(screen.getByRole('button', { name: /short form/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The O*NET proxy is unavailable.');
  });

  it('has no obvious accessibility violations on a question step', async () => {
    const user = userEvent.setup();
    mockedClient.getInterestProfilerQuestions.mockResolvedValue(makeQuestionSet(30));

    const { container } = render(<InterestProfilerPanel />);
    await startShortForm(user);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no obvious accessibility violations on the results view', async () => {
    const user = userEvent.setup();
    const total = 30;
    mockedClient.getInterestProfilerQuestions.mockResolvedValue(makeQuestionSet(total));
    mockedClient.getInterestProfilerResults.mockResolvedValue(makeResults());
    mockedClient.getInterestProfilerCareers.mockResolvedValue(makeCareersResult());

    const { container } = render(<InterestProfilerPanel />);
    await startShortForm(user);

    for (let i = 0; i < total; i++) {
      const value = (i % 5) + 1;
      await user.click(screen.getByLabelText(`${value}. ${LIKERT_LABELS[value - 1]}`));
      const isLast = i === total - 1;
      await user.click(screen.getByRole('button', { name: isLast ? 'Submit' : 'Next' }));
    }

    await screen.findByRole('heading', { name: 'Your results' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
