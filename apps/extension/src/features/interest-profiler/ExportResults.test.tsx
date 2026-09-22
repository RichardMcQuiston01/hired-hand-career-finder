import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CareerMatch, InterestProfilerResults } from '@hired-hand/shared';
import { ExportResults } from './ExportResults';

expect.extend(toHaveNoViolations);

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExportResults', () => {
  it('shows the export actions immediately, with no paywall', () => {
    render(<ExportResults results={makeResults()} careers={makeCareers()} />);

    expect(screen.getByRole('button', { name: /export as csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /print.*pdf/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument();
  });

  it('builds a correct CSV and triggers a client-side download', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    const user = userEvent.setup();
    render(<ExportResults results={makeResults()} careers={makeCareers()} />);

    const exportButton = screen.getByRole('button', { name: /export as csv/i });
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
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    const user = userEvent.setup();
    render(<ExportResults results={makeResults()} careers={makeCareers()} />);

    const printButton = screen.getByRole('button', { name: /print.*pdf/i });
    await user.click(printButton);

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('does not throw when window.print is unavailable', async () => {
    const originalPrint = window.print;
    // @ts-expect-error -- simulating an environment without window.print
    delete window.print;

    const user = userEvent.setup();
    render(<ExportResults results={makeResults()} careers={makeCareers()} />);

    const printButton = screen.getByRole('button', { name: /print.*pdf/i });
    await expect(user.click(printButton)).resolves.not.toThrow();

    window.print = originalPrint;
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = render(<ExportResults results={makeResults()} careers={makeCareers()} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
