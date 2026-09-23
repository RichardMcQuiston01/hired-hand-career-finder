import { RIASEC_KEYS, type CareerMatch, type InterestProfilerResults } from '@hired-hand/shared';

interface ExportResultsProps {
  results: InterestProfilerResults;
  careers: CareerMatch[];
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0]!.toUpperCase() + value.slice(1) : value;
}

/** Escapes a value for a single CSV field per RFC 4180. */
function csvField(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvRow(fields: Array<string | number>): string {
  return fields.map(csvField).join(',') + '\r\n';
}

function buildCsv(results: InterestProfilerResults, careers: CareerMatch[]): string {
  let csv = '';

  csv += csvRow(['RIASEC interest scores']);
  csv += csvRow(['Area', 'Score']);
  for (const key of RIASEC_KEYS) {
    csv += csvRow([capitalize(key), results[key]]);
  }
  if (typeof results.job_zone === 'number') {
    csv += csvRow(['Suggested job zone', results.job_zone]);
  }

  csv += csvRow([]);
  csv += csvRow(['Matched careers']);
  csv += csvRow(['Code', 'Title', 'Fit', 'URL']);
  for (const career of careers) {
    csv += csvRow([career.code, career.title, career.fit ?? '', career.href]);
  }

  return csv;
}

/** Triggers a client-side download of a text blob — no server round-trip. */
function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * `window.print` doesn't exist under Vitest/jsdom — guarded the same way
 * `chrome.runtime.getManifest()` is guarded in `apps/extension/src/options/App.tsx`.
 */
function printResults(): void {
  if (typeof window === 'undefined' || typeof window.print !== 'function') return;
  window.print();
}

/** Exports Interest Profiler results as a CSV download or browser print-to-PDF. Free, no gating. */
export function ExportResults({ results, careers }: ExportResultsProps) {
  function handleExportCsv() {
    const csv = buildCsv(results, careers);
    downloadCsv('interest-profiler-results.csv', csv);
  }

  return (
    <section
      aria-labelledby="ip-export-heading"
      className="border-border-subtle mt-6 border-t pt-6"
    >
      <h3 id="ip-export-heading" className="text-sm font-semibold">
        Export your results
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExportCsv}
          className="border-border-subtle text-ink-900 focus-visible:ring-accent-700 rounded border px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2"
        >
          Export as CSV
        </button>
        <button
          type="button"
          onClick={printResults}
          className="border-border-subtle text-ink-900 focus-visible:ring-accent-700 rounded border px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2"
        >
          Print / Save as PDF
        </button>
      </div>
    </section>
  );
}
