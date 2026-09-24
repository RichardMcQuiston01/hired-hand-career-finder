import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CareerReference } from '@hired-hand/shared';
import { isBrightOutlook } from '@hired-hand/shared';
import { OnetClientError } from '@hired-hand/onet-mnm-client';
import { onetClient } from '../../lib/onetClient';

/** How long to wait after the last keystroke before searching automatically. */
const DEBOUNCE_MS = 350;

type SearchStatus = 'idle' | 'loading' | 'error' | 'success';

interface SearchState {
  status: SearchStatus;
  keyword: string;
  results: CareerReference[];
  errorMessage: string | undefined;
}

const INITIAL_STATE: SearchState = {
  status: 'idle',
  keyword: '',
  results: [],
  errorMessage: undefined,
};

/**
 * Career Search: a keyword search box against O*NET's `/mnm/search`
 * endpoint (via the proxy-backed `onetClient`). Searches fire both
 * debounced-as-you-type and on explicit submit; whichever request is
 * started last "wins" — a monotonically increasing request id guards
 * against an older, slower request clobbering a newer result.
 */
export function CareerSearchPanel() {
  const [inputValue, setInputValue] = useState('');
  const [state, setState] = useState<SearchState>(INITIAL_STATE);

  const latestRequestId = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function runSearch(keyword: string) {
    const trimmed = keyword.trim();
    const requestId = ++latestRequestId.current;

    if (trimmed.length === 0) {
      setState(INITIAL_STATE);
      return;
    }

    setState((previous) => ({ ...previous, status: 'loading', keyword: trimmed }));

    onetClient
      .searchCareers({ keyword: trimmed, start: 1, end: 20 })
      .then((result) => {
        if (requestId !== latestRequestId.current) return; // A newer search superseded this one.
        setState({
          status: 'success',
          keyword: trimmed,
          results: result.career,
          errorMessage: undefined,
        });
      })
      .catch((error: unknown) => {
        if (requestId !== latestRequestId.current) return;
        const message =
          error instanceof OnetClientError
            ? error.message
            : 'Something went wrong searching careers. Please try again.';
        setState({ status: 'error', keyword: trimmed, results: [], errorMessage: message });
      });
  }

  function handleChange(value: string) {
    setInputValue(value);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      runSearch(value);
    }, DEBOUNCE_MS);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    runSearch(inputValue);
  }

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const liveMessage =
    state.status === 'error'
      ? state.errorMessage
      : state.status === 'success'
        ? `${state.results.length} result${state.results.length === 1 ? '' : 's'} for "${state.keyword}"`
        : undefined;

  return (
    <div className="flex flex-col gap-4">
      <form className="flex items-end gap-2" onSubmit={handleSubmit}>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="career-search-input" className="sr-only">
            Search careers by keyword
          </label>
          <input
            id="career-search-input"
            type="search"
            value={inputValue}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="Search careers, e.g. nurse"
            className="border-border-subtle bg-surface-100 text-ink-900 focus-visible:ring-accent-700 rounded border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
          />
        </div>
        <button
          type="submit"
          className="bg-accent-600 text-on-accent focus-visible:ring-accent-700 border-accent-700 rounded border px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2"
        >
          Search
        </button>
      </form>

      <div role="status" aria-live="polite" className="text-ink-600 min-h-5 text-sm">
        {state.status === 'loading' ? 'Searching…' : liveMessage}
      </div>

      {state.status === 'idle' && (
        <p className="text-ink-600 text-sm">Search for a career to get started.</p>
      )}

      {state.status === 'success' && state.results.length === 0 && (
        <p className="text-ink-600 text-sm">No careers found for &quot;{state.keyword}&quot;.</p>
      )}

      {state.status === 'success' && state.results.length > 0 && (
        <ul className="divide-border-subtle flex flex-col divide-y">
          {state.results.map((career) => (
            <li key={career.code} className="flex items-center justify-between gap-2 py-2">
              <span className="text-ink-900 text-sm font-medium">{career.title}</span>
              <span className="flex items-center gap-2">
                <span className="text-ink-600 font-mono text-xs">{career.code}</span>
                {isBrightOutlook(career) && (
                  <span title="Bright Outlook" className="text-accent-700 text-sm">
                    <span aria-hidden="true">★</span>
                    <span className="sr-only">Bright Outlook</span>
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
