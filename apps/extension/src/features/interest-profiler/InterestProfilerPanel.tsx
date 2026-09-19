import { useEffect, useRef, useState } from 'react';
import { RIASEC_KEYS, type CareerMatch, type InterestProfilerResults } from '@hired-hand/shared';
import { OnetClientError } from '@hired-hand/onet-mnm-client';
import { onetClient } from '../../lib/onetClient';

type Step = 'intro' | 'loading' | 'question' | 'submitting' | 'results';

interface QuestionRecord {
  index: number;
  area: string;
  text: string;
}

const LIKERT_OPTIONS = [
  { value: 1, label: 'Strongly Dislike' },
  { value: 2, label: 'Dislike' },
  { value: 3, label: 'Unsure' },
  { value: 4, label: 'Like' },
  { value: 5, label: 'Strongly Like' },
] as const;

const STORAGE_KEY = 'interestProfiler.progress';

interface StoredProgress {
  short: boolean;
  answers: Array<number | null>;
  currentIndex: number;
}

function isStoredProgress(value: unknown): value is StoredProgress {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.short === 'boolean' &&
    typeof record.currentIndex === 'number' &&
    Array.isArray(record.answers) &&
    record.answers.every((answer) => answer === null || typeof answer === 'number')
  );
}

/**
 * `chrome.storage.session` doesn't exist under Vitest/jsdom (no `chrome`
 * global in tests) — guarded the same way `chrome.runtime.getManifest()` is
 * guarded in `apps/extension/src/options/App.tsx`.
 */
function hasSessionStorage(): boolean {
  return typeof chrome !== 'undefined' && typeof chrome.storage?.session !== 'undefined';
}

async function loadProgress(): Promise<StoredProgress | null> {
  if (!hasSessionStorage()) return null;
  try {
    const result = await chrome.storage.session.get(STORAGE_KEY);
    const stored: unknown = result[STORAGE_KEY];
    return isStoredProgress(stored) ? stored : null;
  } catch {
    return null;
  }
}

async function saveProgress(progress: StoredProgress): Promise<void> {
  if (!hasSessionStorage()) return;
  try {
    await chrome.storage.session.set({ [STORAGE_KEY]: progress });
  } catch {
    // Best-effort persistence only — never block the assessment on it.
  }
}

async function clearProgress(): Promise<void> {
  if (!hasSessionStorage()) return;
  try {
    await chrome.storage.session.remove(STORAGE_KEY);
  } catch {
    // Best-effort persistence only — never block the assessment on it.
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof OnetClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0]!.toUpperCase() + value.slice(1) : value;
}

export function InterestProfilerPanel() {
  const [step, setStep] = useState<Step>('intro');
  const [short, setShort] = useState<boolean | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<InterestProfilerResults | null>(null);
  const [careers, setCareers] = useState<CareerMatch[]>([]);

  const legendRef = useRef<HTMLLegendElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  // Restore in-progress answers on mount, if any were persisted.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await loadProgress();
      if (cancelled || !stored) return;

      setStep('loading');
      try {
        const questionSet = await onetClient.getInterestProfilerQuestions({ short: stored.short });
        if (cancelled) return;
        const total = questionSet.question.length;
        const restoredAnswers = Array.from({ length: total }, (_, i) => stored.answers[i] ?? null);
        setQuestions(questionSet.question);
        setShort(stored.short);
        setAnswers(restoredAnswers);
        setCurrentIndex(Math.min(Math.max(stored.currentIndex, 0), Math.max(total - 1, 0)));
        setStep('question');
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err));
        setStep('intro');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step === 'question') {
      legendRef.current?.focus();
    }
    if (step === 'results') {
      resultsHeadingRef.current?.focus();
    }
  }, [step, currentIndex]);

  async function startAssessment(useShortForm: boolean) {
    setError(null);
    setStep('loading');
    try {
      const questionSet = await onetClient.getInterestProfilerQuestions({ short: useShortForm });
      const total = questionSet.question.length;
      const blankAnswers = new Array<number | null>(total).fill(null);
      setQuestions(questionSet.question);
      setShort(useShortForm);
      setAnswers(blankAnswers);
      setCurrentIndex(0);
      setResults(null);
      setCareers([]);
      setStep('question');
      void saveProgress({ short: useShortForm, answers: blankAnswers, currentIndex: 0 });
    } catch (err) {
      setError(getErrorMessage(err));
      setStep('intro');
    }
  }

  function handleSelectAnswer(value: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = value;
      if (short !== null) {
        void saveProgress({ short, answers: next, currentIndex });
      }
      return next;
    });
  }

  function handleNext() {
    if (answers[currentIndex] == null) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) return;
    setCurrentIndex(nextIndex);
    if (short !== null) {
      void saveProgress({ short, answers, currentIndex: nextIndex });
    }
  }

  function handleBack() {
    if (currentIndex === 0) {
      setStep('intro');
      return;
    }
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    if (short !== null) {
      void saveProgress({ short, answers, currentIndex: prevIndex });
    }
  }

  async function handleSubmit() {
    if (short === null) return;
    if (answers.some((answer) => answer == null) || answers.length === 0) {
      setError('Please answer every question before submitting.');
      return;
    }

    const answerString = answers.join('');
    const pattern = short ? /^[1-5]{30}$/ : /^[1-5]{60}$/;
    if (!pattern.test(answerString)) {
      setError('Something went wrong building your answers. Please try again.');
      return;
    }

    setError(null);
    setStep('submitting');
    try {
      const [resultsData, careersData] = await Promise.all([
        onetClient.getInterestProfilerResults(answerString),
        onetClient.getInterestProfilerCareers({ answers: answerString }),
      ]);
      setResults(resultsData);
      setCareers(careersData.career ?? []);
      setStep('results');
      await clearProgress();
    } catch (err) {
      setError(getErrorMessage(err));
      setStep('question');
    }
  }

  async function handleStartOver() {
    await clearProgress();
    setStep('intro');
    setShort(null);
    setQuestions([]);
    setAnswers([]);
    setCurrentIndex(0);
    setResults(null);
    setCareers([]);
    setError(null);
  }

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const currentAnswer = answers[currentIndex] ?? null;

  return (
    <div>
      {error && (
        <p
          role="alert"
          className="border-border-subtle bg-surface-100 text-ink-900 mb-4 rounded border px-3 py-2 text-sm font-medium"
        >
          {error}
        </p>
      )}

      {step === 'intro' && (
        <section aria-labelledby="ip-intro-heading">
          <h2 id="ip-intro-heading" className="font-display text-base font-semibold">
            Find careers that fit your interests
          </h2>
          <p className="text-ink-600 mt-2 text-sm">
            Answer a short series of questions about the kinds of work you like and dislike. We
            score your answers against the RIASEC interest model and match them to real O*NET
            careers.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void startAssessment(true)}
              className="bg-accent-600 text-on-accent focus-visible:ring-accent-600 rounded px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2"
            >
              Short form — 30 questions
            </button>
            <button
              type="button"
              onClick={() => void startAssessment(false)}
              className="border-border-subtle text-ink-900 focus-visible:ring-accent-600 rounded border px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2"
            >
              Full form — 60 questions
            </button>
          </div>
        </section>
      )}

      {step === 'loading' && <p role="status">Loading questions…</p>}

      {step === 'submitting' && <p role="status">Scoring your answers…</p>}

      {step === 'question' && currentQuestion && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isLastQuestion) {
              void handleSubmit();
            } else {
              handleNext();
            }
          }}
        >
          <fieldset>
            <legend ref={legendRef} tabIndex={-1} className="focus:outline-none">
              <span className="text-ink-600 block text-sm">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="font-display mt-1 block text-base font-semibold">
                {currentQuestion.text}
              </span>
            </legend>
            <div className="mt-4 flex flex-col gap-2">
              {LIKERT_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`ip-q${currentIndex}-opt${option.value}`}
                    name={`ip-question-${currentIndex}`}
                    value={option.value}
                    checked={currentAnswer === option.value}
                    onChange={() => handleSelectAnswer(option.value)}
                    className="h-4 w-4"
                  />
                  <label htmlFor={`ip-q${currentIndex}-opt${option.value}`} className="text-sm">
                    {option.value}. {option.label}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          {currentAnswer == null && (
            <p id="ip-answer-hint" className="text-ink-600 mt-2 text-sm">
              Choose an option to continue.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="border-border-subtle text-ink-900 focus-visible:ring-accent-600 rounded border px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={currentAnswer == null}
              aria-describedby={currentAnswer == null ? 'ip-answer-hint' : undefined}
              className="bg-accent-600 text-on-accent focus-visible:ring-accent-600 rounded px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLastQuestion ? 'Submit' : 'Next'}
            </button>
          </div>
        </form>
      )}

      {step === 'results' && results && (
        <section aria-labelledby="ip-results-heading">
          <h2
            id="ip-results-heading"
            ref={resultsHeadingRef}
            tabIndex={-1}
            className="font-display text-base font-semibold focus:outline-none"
          >
            Your results
          </h2>

          <h3 className="mt-4 text-sm font-semibold">Your RIASEC interest scores</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {RIASEC_KEYS.map((key) => (
              <li key={key} className="flex justify-between gap-2">
                <span>{capitalize(key)}</span>
                <span className="text-ink-600">{results[key]}</span>
              </li>
            ))}
          </ul>
          {typeof results.job_zone === 'number' && (
            <p className="text-ink-600 mt-2 text-sm">Suggested job zone: {results.job_zone}</p>
          )}

          <h3 className="mt-6 text-sm font-semibold">Matched careers</h3>
          {careers.length > 0 ? (
            <ul className="mt-2 space-y-3 text-sm">
              {careers.map((career) => (
                <li key={career.code} className="border-border-subtle border-b pb-2">
                  <p className="font-medium">
                    {career.title} <span className="text-ink-600">({career.code})</span>
                  </p>
                  {career.fit && <p className="text-ink-600 mt-1 text-sm">Fit: {career.fit}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-600 mt-2 text-sm">No matched careers were returned.</p>
          )}

          <button
            type="button"
            onClick={() => void handleStartOver()}
            className="border-border-subtle text-ink-900 focus-visible:ring-accent-600 mt-6 rounded border px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2"
          >
            Start over
          </button>
        </section>
      )}
    </div>
  );
}
