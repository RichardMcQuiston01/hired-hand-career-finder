import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hired Hand: Career Finder — API proxy',
  description: 'O*NET Web Services proxy for the Hired Hand: Career Finder Chrome extension.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
