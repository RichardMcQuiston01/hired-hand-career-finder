import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

expect.extend(toHaveNoViolations);

// The Interest Profiler tab renders <ExportResults>, which creates an ExtPay
// client — mocked here (never hitting extensionpay.com) purely so this
// smoke test can render the full app shell. See ExportResults.test.tsx for
// coverage of the export/paywall behavior itself.
vi.mock('../lib/extpay', () => ({
  createExtPayClient: vi.fn(() => ({
    getUser: vi.fn(() => new Promise(() => {})), // never resolves; stays in "checking" state
    openPaymentPage: vi.fn(),
  })),
}));

describe('Side panel App', () => {
  it('renders the three navigation tabs', () => {
    render(<App />);

    expect(screen.getByRole('tab', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Browse' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Interest Profiler' })).toBeInTheDocument();
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = render(<App />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
