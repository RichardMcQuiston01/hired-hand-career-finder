import { useEffect, useRef, useState } from 'react';
import { OnetClientError } from '@hired-hand/onet-mnm-client';
import { isBrightOutlook, type CareerListResult, type CareerReference } from '@hired-hand/shared';
import { onetClient } from '../../lib/onetClient';
import { CareerDetailView } from './CareerDetailView';

const PAGE_SIZE = 20;

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; result: CareerListResult };

/**
 * Browse Careers: a paginated list of O*NET occupations with a master-detail
 * pattern — selecting a career swaps the list for `CareerDetailView` within
 * this same tab (the side panel is too narrow for side-by-side layout).
 */
export function BrowseCareersPanel() {
  const [start, setStart] = useState(1);
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [selectedCareer, setSelectedCareer] = useState<CareerReference | null>(null);

  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const restoreFocusCode = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    onetClient
      .listCareers({ start, end: start + PAGE_SIZE - 1 })
      .then((result) => {
        if (cancelled) return;
        setState({ status: 'ready', result });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof OnetClientError
            ? error.message
            : 'Something went wrong loading careers.';
        setState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [start]);

  // When returning from the detail view, move focus back to the list item
  // that was selected (falling back to the list heading if it's no longer
  // rendered, e.g. the page changed underneath it).
  useEffect(() => {
    if (selectedCareer !== null || restoreFocusCode.current === null) return;
    const code = restoreFocusCode.current;
    restoreFocusCode.current = null;
    const button = itemRefs.current.get(code);
    if (button) {
      button.focus();
    } else {
      listHeadingRef.current?.focus();
    }
  }, [selectedCareer]);

  if (selectedCareer) {
    return (
      <CareerDetailView
        career={selectedCareer}
        onBack={() => {
          restoreFocusCode.current = selectedCareer.code;
          setSelectedCareer(null);
        }}
      />
    );
  }

  const result = state.status === 'ready' ? state.result : undefined;
  const hasPrevious = start > 1;
  const hasNext = result ? result.end < result.total : false;

  let statusMessage: string;
  if (state.status === 'loading') {
    statusMessage = 'Loading careers…';
  } else if (state.status === 'error') {
    statusMessage = state.message;
  } else if (state.result.total === 0) {
    statusMessage = 'No careers found.';
  } else {
    statusMessage = `Showing careers ${state.result.start}–${state.result.end} of ${state.result.total}.`;
  }

  return (
    <section aria-labelledby="browse-careers-heading">
      <h2
        id="browse-careers-heading"
        ref={listHeadingRef}
        tabIndex={-1}
        className="font-display text-ink-900 text-base font-semibold focus:outline-none"
      >
        Browse careers
      </h2>

      <div
        role={state.status === 'loading' ? 'status' : undefined}
        aria-live="polite"
        className="text-ink-600 mt-1 text-sm"
      >
        {statusMessage}
      </div>

      {state.status === 'ready' && (
        <ul className="divide-border-subtle mt-3 divide-y">
          {state.result.occupation.map((career) => (
            <li key={career.code}>
              <button
                type="button"
                ref={(el) => {
                  if (el) {
                    itemRefs.current.set(career.code, el);
                  } else {
                    itemRefs.current.delete(career.code);
                  }
                }}
                onClick={() => setSelectedCareer(career)}
                className="hover:bg-surface-100 focus-visible:ring-accent-700 flex w-full items-center justify-between gap-2 py-2 text-left focus:outline-none focus-visible:ring-2"
              >
                <span>
                  <span className="text-ink-900 block text-sm font-medium">{career.title}</span>
                  <span className="text-ink-600 block text-xs">{career.code}</span>
                </span>
                {isBrightOutlook(career) && (
                  <span
                    aria-label="Bright Outlook career"
                    title="Bright Outlook career"
                    className="text-accent-700"
                  >
                    ★
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStart((current) => Math.max(1, current - PAGE_SIZE))}
          disabled={!hasPrevious}
          className="border-border-subtle text-ink-900 focus-visible:ring-accent-700 rounded border px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => setStart((current) => current + PAGE_SIZE)}
          disabled={!hasNext}
          className="border-border-subtle text-ink-900 focus-visible:ring-accent-700 rounded border px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </section>
  );
}
