import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CareerMatch, InterestProfilerResults } from '@hired-hand/shared';
import ExtPay from 'extpay';
import { ExportResults } from './ExportResults';

expect.extend(toHaveNoViolations);

// Never let a test hit extensionpay.com — the whole `extpay` module is
// mocked, and each test configures the fake client's method return values.
vi.mock('extpay', () => ({
  default: vi.fn(() => ({
    getUser: vi.fn(),
    openPaymentPage: vi.fn(),
    startBackground: vi.fn(),
  })),
}));

const mockedExtPay = vi.mocked(ExtPay);

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

interface FakeExtPayClient {
  getUser: ReturnType<typeof vi.fn>;
  openPaymentPage: ReturnType<typeof vi.fn>;
  startBackground: ReturnType<typeof vi.fn>;
}

function installFakeExtPayClient(): FakeExtPayClient {
  const client: FakeExtPayClient = {
    getUser: vi.fn(),
    openPaymentPage: vi.fn().mockResolvedValue(undefined),
    startBackground: vi.fn(),
  };
  // The fake only implements the subset of the ExtPay interface this
  // component actually uses (getUser/openPaymentPage/startBackground).
  mockedExtPay.mockReturnValue(client as unknown as ReturnType<typeof ExtPay>);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExportResults', () => {
  it('shows a paywall for an unpaid user and opens the payment page on Upgrade', async () => {
    const user = userEvent.setup();
    const client = installFakeExtPayClient();
    client.getUser.mockResolvedValue({ paid: false });

    render(<ExportResults results={makeResults()} careers={makeCareers()} />);

    expect(screen.getByRole('status')).toHaveTextContent(/checking/i);

    const upgradeButton = await screen.findByRole('button', { name: /upgrade to export/i });
    expect(
      screen.getByText(/export your results as csv or pdf with a one-time upgrade/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export as csv/i })).not.toBeInTheDocument();

    await user.click(upgradeButton);
    expect(client.openPaymentPage).toHaveBeenCalledTimes(1);
  });

  it('re-checks status when "Refresh status" is clicked on the paywall', async () => {
    const user = userEvent.setup();
    const client = installFakeExtPayClient();
    client.getUser.mockResolvedValue({ paid: false });

    render(<ExportResults results={makeResults()} careers={makeCareers()} />);
    await screen.findByRole('button', { name: /upgrade to export/i });

    client.getUser.mockResolvedValue({ paid: true });
    await user.click(screen.getByRole('button', { name: /refresh status/i }));

    expect(await screen.findByRole('button', { name: /export as csv/i })).toBeInTheDocument();
    expect(client.getUser).toHaveBeenCalledTimes(2);
  });

  it('shows real export actions for a paid user', async () => {
    const client = installFakeExtPayClient();
    client.getUser.mockResolvedValue({ paid: true });

    render(<ExportResults results={makeResults()} careers={makeCareers()} />);

    expect(await screen.findByRole('button', { name: /export as csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print.*pdf/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade to export/i })).not.toBeInTheDocument();
  });

  it('builds a correct CSV and triggers a client-side download', async () => {
    const client = installFakeExtPayClient();
    client.getUser.mockResolvedValue({ paid: true });

    const createObjectURL = vi.fn((_blob: Blob) => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    const user = userEvent.setup();
    render(<ExportResults results={makeResults()} careers={makeCareers()} />);

    const exportButton = await screen.findByRole('button', { name: /export as csv/i });
    await user.click(exportButton);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toContain('text/csv');

    const csvText = await blob.text();
    expect(csvText).toContain('RIASEC interest scores');
    expect(csvText).toContain('Realistic,12');
    expect(csvText).toContain('Matched careers');
    expect(csvText).toContain('Chief Executives');
    expect(csvText).toContain('11-1011.00');

    const anchor = appendSpy.mock.calls
      .map((call) => call[0])
      .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
    expect(anchor).toBeDefined();
    expect(anchor?.download).toBe('interest-profiler-results.csv');
    expect(anchor?.href).toBe('blob:mock-url');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    vi.unstubAllGlobals();
  });

  it('calls window.print() when available', async () => {
    const client = installFakeExtPayClient();
    client.getUser.mockResolvedValue({ paid: true });

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    const user = userEvent.setup();
    render(<ExportResults results={makeResults()} careers={makeCareers()} />);

    const printButton = await screen.findByRole('button', { name: /print.*pdf/i });
    await user.click(printButton);

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('does not throw when window.print is unavailable', async () => {
    const client = installFakeExtPayClient();
    client.getUser.mockResolvedValue({ paid: true });

    const originalPrint = window.print;
    // @ts-expect-error -- simulating an environment without window.print
    delete window.print;

    const user = userEvent.setup();
    render(<ExportResults results={makeResults()} careers={makeCareers()} />);

    const printButton = await screen.findByRole('button', { name: /print.*pdf/i });
    await expect(user.click(printButton)).resolves.not.toThrow();

    window.print = originalPrint;
  });

  it('renders an error state when getUser() rejects', async () => {
    const client = installFakeExtPayClient();
    client.getUser.mockRejectedValue(new Error('Network unavailable.'));

    render(<ExportResults results={makeResults()} careers={makeCareers()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable.');
    expect(screen.getByRole('button', { name: /refresh status/i })).toBeInTheDocument();
  });

  it('has no obvious accessibility violations on the unpaid (paywall) state', async () => {
    const client = installFakeExtPayClient();
    client.getUser.mockResolvedValue({ paid: false });

    const { container } = render(<ExportResults results={makeResults()} careers={makeCareers()} />);
    await waitFor(() => expect(client.getUser).toHaveBeenCalled());
    await screen.findByRole('button', { name: /upgrade to export/i });

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no obvious accessibility violations on the paid state', async () => {
    const client = installFakeExtPayClient();
    client.getUser.mockResolvedValue({ paid: true });

    const { container } = render(<ExportResults results={makeResults()} careers={makeCareers()} />);
    await screen.findByRole('button', { name: /export as csv/i });

    expect(await axe(container)).toHaveNoViolations();
  });
});
