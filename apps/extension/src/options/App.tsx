import { AppShell, DONATE_URL } from '../components/AppShell';

interface ExtensionInfo {
  name: string;
  version: string;
}

const FALLBACK_INFO: ExtensionInfo = {
  name: 'Hired Hand: Career Finder',
  version: '0.1.0',
};

/**
 * Reads name/version from the installed manifest when running as an actual
 * extension; falls back to hardcoded values elsewhere (e.g. Vitest/jsdom,
 * where the `chrome` extension APIs don't exist).
 */
function getExtensionInfo(): ExtensionInfo {
  if (typeof chrome === 'undefined' || typeof chrome.runtime?.getManifest !== 'function') {
    return FALLBACK_INFO;
  }
  try {
    const manifest = chrome.runtime.getManifest();
    return {
      name: manifest.name ?? FALLBACK_INFO.name,
      version: manifest.version ?? FALLBACK_INFO.version,
    };
  } catch {
    return FALLBACK_INFO;
  }
}

export function App() {
  const { name, version } = getExtensionInfo();

  return (
    <AppShell title="Career Finder — Options">
      <section aria-labelledby="about-heading" className="mb-6">
        <h2 id="about-heading" className="font-display text-base font-semibold">
          About
        </h2>
        <dl className="text-ink-600 mt-2 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium">Extension</dt>
            <dd>{name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Version</dt>
            <dd>{version}</dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="support-heading">
        <h2 id="support-heading" className="font-display text-base font-semibold">
          Support
        </h2>
        <p className="text-ink-600 mt-2 max-w-prose text-sm">
          If this helped you find a career, consider chipping in to offset the cost of development
          and API access. No pressure — the extension works the same either way.
        </p>
        <a
          href={DONATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-accent-600 text-on-accent border-accent-700 mt-3 inline-block rounded border px-3 py-1.5 text-sm font-medium no-underline"
        >
          Donate via Stripe
          <span className="sr-only"> (opens in new tab)</span>
        </a>
        <p className="mt-3">
          <img
            src="/donate-qr.svg"
            alt="QR code to donate via Stripe"
            width={160}
            height={160}
            className="rounded"
          />
        </p>
      </section>
    </AppShell>
  );
}
