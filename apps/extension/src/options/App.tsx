import { AppShell } from '../components/AppShell';

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
        <p className="text-ink-600 mt-2 text-sm">
          Donate/support content lands in Stage 3 on <code>feature/donate-block</code>. See{' '}
          <code>docs/DEVELOPMENT_PLAN.md</code>.
        </p>
      </section>
    </AppShell>
  );
}
