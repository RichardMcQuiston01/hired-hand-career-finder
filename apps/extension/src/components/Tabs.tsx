import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  panel: ReactNode;
}

interface TabsProps {
  /** Accessible name for the tablist (not rendered visually). */
  label: string;
  tabs: TabItem[];
}

/**
 * Accessible tabs following the WAI-ARIA APG tabs pattern: a single
 * `role="tablist"` of `role="tab"` buttons (roving tabindex, arrow-key
 * navigation, automatic activation) controlling `role="tabpanel"` regions.
 * See https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 */
export function Tabs({ label, tabs }: TabsProps) {
  const [activeId, setActiveId] = useState<string | undefined>(tabs[0]?.id);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const activeIndex = tabs.findIndex((tab) => tab.id === activeId);

  function activate(index: number, focus: boolean) {
    const tab = tabs[index];
    if (!tab) return;
    setActiveId(tab.id);
    if (focus) {
      tabRefs.current.get(tab.id)?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const lastIndex = tabs.length - 1;
    if (lastIndex < 0) return;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        activate(activeIndex === lastIndex ? 0 : activeIndex + 1, true);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        activate(activeIndex <= 0 ? lastIndex : activeIndex - 1, true);
        break;
      case 'Home':
        event.preventDefault();
        activate(0, true);
        break;
      case 'End':
        event.preventDefault();
        activate(lastIndex, true);
        break;
      default:
        break;
    }
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="border-border-subtle flex gap-1 border-b">
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) {
                  tabRefs.current.set(tab.id, el);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              type="button"
              role="tab"
              id={`${tab.id}-tab`}
              aria-selected={selected}
              aria-controls={`${tab.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={handleKeyDown}
              className={`focus-visible:ring-accent-700 -mb-px border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 ${
                selected
                  ? 'border-accent-700 text-ink-900'
                  : 'text-ink-600 hover:text-ink-900 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${tab.id}-panel`}
          aria-labelledby={`${tab.id}-tab`}
          hidden={tab.id !== activeId}
          tabIndex={0}
          className="py-4"
        >
          {tab.id === activeId ? tab.panel : null}
        </div>
      ))}
    </div>
  );
}
