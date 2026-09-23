import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { App } from './App';

expect.extend(toHaveNoViolations);

describe('Side panel App', () => {
  it('renders the three navigation tabs', () => {
    render(<App />);

    expect(screen.getByRole('tab', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Browse' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Interest Profiler' })).toBeInTheDocument();
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = render(<App />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
