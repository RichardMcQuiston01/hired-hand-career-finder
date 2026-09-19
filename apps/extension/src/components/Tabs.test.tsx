import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Tabs } from './Tabs';

expect.extend(toHaveNoViolations);

function renderTabs() {
  return render(
    <Tabs
      label="Test sections"
      tabs={[
        { id: 'one', label: 'One', panel: <p>Panel one content</p> },
        { id: 'two', label: 'Two', panel: <p>Panel two content</p> },
        { id: 'three', label: 'Three', panel: <p>Panel three content</p> },
      ]}
    />,
  );
}

describe('Tabs', () => {
  it('renders a tablist with the first tab selected and its panel visible', () => {
    renderTabs();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');

    expect(screen.getByRole('tabpanel', { name: 'One' })).toHaveTextContent('Panel one content');
  });

  it('has no obvious accessibility violations', async () => {
    const { container } = renderTabs();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('switches the active tab and panel on click', async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole('tab', { name: 'Two' }));

    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Two' })).toHaveTextContent('Panel two content');
  });

  it('uses a roving tabindex: only the selected tab is tabbable', () => {
    renderTabs();

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    expect(tabs[2]).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus and selection with ArrowRight/ArrowLeft, wrapping at the ends', async () => {
    const user = userEvent.setup();
    renderTabs();

    const [first, second, third] = screen.getAllByRole('tab');
    first?.focus();
    expect(first).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(third).toHaveFocus();
    expect(third).toHaveAttribute('aria-selected', 'true');

    // Wraps around from the last tab back to the first.
    await user.keyboard('{ArrowRight}');
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-selected', 'true');

    // Wraps around backward from the first tab to the last.
    await user.keyboard('{ArrowLeft}');
    expect(third).toHaveFocus();
    expect(third).toHaveAttribute('aria-selected', 'true');
  });

  it('moves focus to the first/last tab with Home/End', async () => {
    const user = userEvent.setup();
    renderTabs();

    const [first, , third] = screen.getAllByRole('tab');
    third?.focus();

    await user.keyboard('{Home}');
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{End}');
    expect(third).toHaveFocus();
    expect(third).toHaveAttribute('aria-selected', 'true');
  });
});
