import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { DONATE_URL } from '../components/AppShell';
import { App } from './App';

expect.extend(toHaveNoViolations);

describe('Options App', () => {
  it('renders About and Support landmarks', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByText('Extension')).toBeInTheDocument();
    // No chrome.runtime in the test environment, so the hardcoded fallback is used.
    expect(screen.getByText('0.1.0')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Support' })).toBeInTheDocument();
  });

  it('renders the donate link and QR code in the Support section', () => {
    render(<App />);

    const links = screen.getAllByRole('link', { name: /donate via stripe/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('href', DONATE_URL);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    }

    const qrImage = screen.getByAltText('QR code to donate via Stripe');
    expect(qrImage).toBeInTheDocument();
    expect(qrImage).toHaveAttribute('src', '/donate-qr.svg');
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = render(<App />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
