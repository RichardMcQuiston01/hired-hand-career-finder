import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it } from 'vitest';
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

  it('has no obvious accessibility violations', async () => {
    const { container } = render(<App />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
