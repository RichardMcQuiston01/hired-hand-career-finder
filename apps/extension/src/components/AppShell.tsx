import type { ReactNode } from 'react';

interface AppShellProps {
  title: string;
  children: ReactNode;
}

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
      <footer className="border-border-subtle text-ink-600 border-t px-4 py-2 text-xs">
        Hired Hand: Career Finder
      </footer>
    </div>
  );
}
