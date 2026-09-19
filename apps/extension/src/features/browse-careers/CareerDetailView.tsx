import { useEffect, useRef, useState } from 'react';
import { OnetClientError } from '@hired-hand/onet-mnm-client';
import {
  ONET_MNM_CAREER_SECTIONS,
  type CareerDetail,
  type CareerReference,
  type OnetMnmCareerSection,
} from '@hired-hand/shared';
import { onetClient } from '../../lib/onetClient';

interface CareerDetailViewProps {
  career: CareerReference;
  onBack: () => void;
}

type AsyncState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: CareerDetail };

function errorMessage(error: unknown): string {
  return error instanceof OnetClientError
    ? error.message
    : 'Something went wrong loading this section.';
}

function humanizeKey(key: string): string {
  return key
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

interface NamedItem {
  name?: unknown;
  title?: unknown;
  description?: unknown;
}

function isNamedItem(value: unknown): value is NamedItem {
  return typeof value === 'object' && value !== null;
}

function namedItemLabel(item: NamedItem): string | undefined {
  const label = item.name ?? item.title;
  return typeof label === 'string' ? label : undefined;
}

function namedItemDescription(item: NamedItem): string | undefined {
  return typeof item.description === 'string' ? item.description : undefined;
}

/**
 * Renders a `CareerDetail` payload defensively. `CareerDetail` is
 * intentionally an open record (see `packages/shared`) — the exact
 * per-section field shapes from O*NET's `/mnm/careers/{code}/{section}`
 * were reconstructed from general O*NET knowledge, not verified against the
 * live API, in Stage 1. This looks for recognizable array-ish fields (e.g.
 * an `element`/`task`/`technology`-style array of `{ name, description }`
 * items, or a plain array of strings) and renders those as bulleted lists;
 * anything else falls back to a plain key/value list so the UI degrades
 * gracefully instead of crashing or showing nothing once the real shape is
 * confirmed.
 */
function CareerDetailFields({
  detail,
  exclude,
}: {
  detail: CareerDetail;
  exclude: readonly string[];
}) {
  const entries = Object.entries(detail).filter(([key]) => !exclude.includes(key));
  const listFields = entries.filter(
    (entry): entry is [string, unknown[]] => Array.isArray(entry[1]) && entry[1].length > 0,
  );
  const plainFields = entries.filter(([, value]) => !Array.isArray(value) && value !== undefined);

  if (listFields.length === 0 && plainFields.length === 0) {
    return (
      <p className="text-ink-600 text-sm">No additional details are available for this section.</p>
    );
  }

  return (
    <div className="space-y-4">
      {listFields.map(([key, items]) => (
        <div key={key}>
          <h4 className="text-ink-900 text-sm font-semibold">{humanizeKey(key)}</h4>
          <ul className="text-ink-600 mt-1 list-disc space-y-1 pl-5 text-sm">
            {items.map((item, index) => {
              if (typeof item === 'string') {
                return <li key={index}>{item}</li>;
              }
              if (isNamedItem(item)) {
                const label = namedItemLabel(item);
                const description = namedItemDescription(item);
                if (label) {
                  return (
                    <li key={index}>
                      <span className="text-ink-900 font-medium">{label}</span>
                      {description ? `: ${description}` : null}
                    </li>
                  );
                }
              }
              return <li key={index}>{formatValue(item)}</li>;
            })}
          </ul>
        </div>
      ))}

      {plainFields.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm">
          {plainFields.map(([key, value]) => (
            <div key={key}>
              <dt className="text-ink-900 font-semibold">{humanizeKey(key)}</dt>
              <dd className="text-ink-600">{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * Shown when a career is selected from `BrowseCareersPanel`'s list. Fetches
 * the overview once on mount, then lazily fetches each `ONET_MNM_CAREER_SECTIONS`
 * entry only when the person picks it (never all eight upfront), caching
 * each section's result for the lifetime of this view.
 */
export function CareerDetailView({ career, onBack }: CareerDetailViewProps) {
  const [overview, setOverview] = useState<AsyncState>({ status: 'loading' });
  const [selectedSection, setSelectedSection] = useState<OnetMnmCareerSection | null>(null);
  const [sections, setSections] = useState<Partial<Record<OnetMnmCareerSection, AsyncState>>>({});
  const requestedSections = useRef(new Set<OnetMnmCareerSection>());

  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to this view's heading when it first appears, so keyboard
  // and screen reader users land somewhere sensible instead of focus
  // silently vanishing when the list is swapped out for this view.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setOverview({ status: 'loading' });

    onetClient
      .getCareerDetail(career.code)
      .then((detail) => {
        if (!cancelled) setOverview({ status: 'ready', detail });
      })
      .catch((error: unknown) => {
        if (!cancelled) setOverview({ status: 'error', message: errorMessage(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [career.code]);

  function selectSection(section: OnetMnmCareerSection) {
    setSelectedSection(section);
    if (requestedSections.current.has(section)) return;
    requestedSections.current.add(section);

    setSections((current) => ({ ...current, [section]: { status: 'loading' } }));

    onetClient
      .getCareerDetail(career.code, section)
      .then((detail) => {
        setSections((current) => ({ ...current, [section]: { status: 'ready', detail } }));
      })
      .catch((error: unknown) => {
        setSections((current) => ({
          ...current,
          [section]: { status: 'error', message: errorMessage(error) },
        }));
      });
  }

  const activeSectionState = selectedSection ? sections[selectedSection] : undefined;

  return (
    <section aria-labelledby="career-detail-heading">
      <button
        type="button"
        onClick={onBack}
        className="text-ink-600 hover:text-ink-900 focus-visible:ring-accent-600 mb-3 inline-flex items-center gap-1 text-sm font-medium focus:outline-none focus-visible:ring-2"
      >
        <span aria-hidden="true">←</span> Back to results
      </button>

      <h2
        id="career-detail-heading"
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-ink-900 text-base font-semibold focus:outline-none"
      >
        {career.title}
      </h2>
      <p className="text-ink-600 text-xs">{career.code}</p>

      <div
        role={overview.status === 'loading' ? 'status' : undefined}
        aria-live="polite"
        className="mt-2"
      >
        {overview.status === 'loading' && <p className="text-ink-600 text-sm">Loading overview…</p>}
        {overview.status === 'error' && <p className="text-ink-600 text-sm">{overview.message}</p>}
        {overview.status === 'ready' &&
          (typeof overview.detail.description === 'string' ? (
            <p className="text-ink-600 text-sm">{overview.detail.description}</p>
          ) : (
            <CareerDetailFields detail={overview.detail} exclude={['code', 'title']} />
          ))}
      </div>

      <div className="mt-4">
        <h3 id="career-detail-sections-heading" className="text-ink-900 text-sm font-semibold">
          Explore details
        </h3>
        <div
          role="group"
          aria-labelledby="career-detail-sections-heading"
          className="mt-2 flex flex-wrap gap-2"
        >
          {ONET_MNM_CAREER_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              aria-pressed={selectedSection === section}
              onClick={() => selectSection(section)}
              className={`focus-visible:ring-accent-600 rounded border px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 ${
                selectedSection === section
                  ? 'border-accent-600 bg-accent-600 text-on-accent'
                  : 'border-border-subtle text-ink-900 hover:bg-surface-100'
              }`}
            >
              {humanizeKey(section)}
            </button>
          ))}
        </div>

        {selectedSection && (
          <div
            role={activeSectionState?.status === 'loading' ? 'status' : undefined}
            aria-live="polite"
            className="mt-3"
          >
            {activeSectionState?.status === 'loading' && (
              <p className="text-ink-600 text-sm">Loading {humanizeKey(selectedSection)}…</p>
            )}
            {activeSectionState?.status === 'error' && (
              <p className="text-ink-600 text-sm">{activeSectionState.message}</p>
            )}
            {activeSectionState?.status === 'ready' && (
              <CareerDetailFields detail={activeSectionState.detail} exclude={['code', 'title']} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
