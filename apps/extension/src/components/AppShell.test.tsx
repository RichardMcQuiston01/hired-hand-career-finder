import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

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

  it('has no obvious accessibility violations', async () => {
    const { container } = render(
      <AppShell title="Test title">
        <p>Test content</p>
      </AppShell>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
