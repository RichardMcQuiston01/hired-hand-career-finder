import type { ReactNode } from 'react';

interface AppShellProps {
  title: string;
  children: ReactNode;
}

/** Stripe donate link, reused by the footer here and the Options Support section. */
export const DONATE_URL = 'https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800';

/**
 * Minimal accessible page shell: skip link + landmark regions, styled with
 * the Hired Hand brand tokens (see src/index.css). Stage 1
 * (feature/extension-shell) replaces this with the real navigation.
 */
export function AppShell({ title, children }: AppShellProps) {
  return (
    <div className="bg-surface-50 text-ink-900 flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="border-border-subtle border-b px-4 py-3">
        <h1 className="font-display text-lg font-semibold">{title}</h1>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-4">
        {children}
      </main>
      <footer className="border-border-subtle text-ink-600 flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2 text-xs">
        <span>Hired Hand: Career Finder</span>
        <a
          href={DONATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink-900 underline"
        >
          Support this project
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      </footer>
    </div>
  );
}
