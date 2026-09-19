import type { ReactNode } from 'react';

interface AppShellProps {
  title: string;
  children: ReactNode;
}

/**
 * Minimal accessible page shell: skip link + landmark regions. Stage 1
 * (feature/extension-shell) replaces this with the real navigation/theming.
 */
export function AppShell({ title, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-4">
        {children}
      </main>
      <footer className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Hired Hand: Career Finder
      </footer>
    </div>
  );
}
