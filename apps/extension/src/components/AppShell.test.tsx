import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { AppShell, DONATE_URL } from './AppShell';

expect.extend(toHaveNoViolations);

describe('AppShell', () => {
  it('renders the title and children', () => {
    const { getByRole, getByText } = render(
      <AppShell title="Test title">
        <p>Test content</p>
      </AppShell>,
    );
    expect(getByRole('heading', { name: 'Test title' })).toBeInTheDocument();
    expect(getByText('Test content')).toBeInTheDocument();
  });

  it('renders a donate link in the footer that opens in a new tab', () => {
    const { getByRole } = render(
      <AppShell title="Test title">
        <p>Test content</p>
      </AppShell>,
    );
    const link = getByRole('link', { name: /support this project/i });
    expect(link).toHaveAttribute('href', DONATE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    expect(link).toHaveTextContent(/opens in new tab/i);
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = render(
      <AppShell title="Test title">
        <p>Test content</p>
      </AppShell>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
