/**
 * Typed fetch client for the O*NET `/mnm` ("My Next Move") endpoints —
 * Career Search, Browse Careers, and the Interest Profiler. Calls O*NET's
 * real Web Services API directly (`baseUrl`, e.g.
 * `https://api-v2.onetcenter.org`), injecting `apiKey` as `X-API-Key` on
 * every request when provided. There is no backend proxy in this
 * architecture — see docs/DEVELOPMENT_PLAN.md's "Key decisions" section for
 * why (the O*NET key isn't treated as a secret; the only real concern is
 * not exceeding O*NET's own rate limits, which this package doesn't handle
 * itself — see `apps/extension/src/lib/cachingFetch.ts` for the
 * localStorage-backed caching/self-throttling layered on top of this client
 * in the extension).
 */
import type { z } from 'zod';
import type {
  CareerDetail,
  CareerListResult,
  CareerSearchResult,
  InterestProfilerCareersResult,
  InterestProfilerQuestionSet,
  InterestProfilerResults,
  JobZonesResult,
  OnetMnmCareerSection,
} from '@hired-hand/shared';
import { OnetClientError } from './errors';
import {
  careerDetailSchema,
  careerSearchResultSchema,
  interestProfilerCareersResultSchema,
  interestProfilerQuestionSetSchema,
  interestProfilerResultsSchema,
  jobZonesResultSchema,
} from './schemas';

/** A string of 30 (short form) or 60 (full form) digits, each `1`-`5`. */
const ANSWERS_PATTERN = /^[12345]{30}([12345]{30})?$/;

export interface OnetMnmClientOptions {
  /** Base URL of the O*NET Web Services API, e.g. `https://api-v2.onetcenter.org`. */
  baseUrl: string;
  /** Sent as the `X-API-Key` header on every request, if provided. */
  apiKey?: string | undefined;
  /** Override for `fetch`, mainly so tests can mock `global.fetch`. Defaults to the ambient `fetch`. */
  fetchImpl?: typeof fetch;
}

export interface PaginationParams {
  start?: number | undefined;
  end?: number | undefined;
}

export interface SearchCareersParams extends PaginationParams {
  keyword: string;
}

export interface InterestProfilerQuestionsParams extends PaginationParams {
  /** Use the 30-question short form (`questions_30`) instead of the full 60-question set. */
  short?: boolean | undefined;
}

export interface InterestProfilerCareersParams extends PaginationParams {
  /** A combined 30/60-digit answer string, as an alternative to passing individual RIASEC scores below. */
  answers?: string | undefined;
  realistic?: number | undefined;
  investigative?: number | undefined;
  artistic?: number | undefined;
  social?: number | undefined;
  enterprising?: number | undefined;
  conventional?: number | undefined;
  zone?: number | undefined;
}

export interface OnetMnmClient {
  searchCareers(params: SearchCareersParams): Promise<CareerSearchResult>;
  listCareers(params?: PaginationParams): Promise<CareerListResult>;
  getCareerDetail(code: string, section?: OnetMnmCareerSection): Promise<CareerDetail>;
  getInterestProfilerQuestions(
    params?: InterestProfilerQuestionsParams,
  ): Promise<InterestProfilerQuestionSet>;
  getInterestProfilerResults(answers: string): Promise<InterestProfilerResults>;
  getInterestProfilerCareers(
    params: InterestProfilerCareersParams,
  ): Promise<InterestProfilerCareersResult>;
  getJobZones(): Promise<JobZonesResult>;
}

type QueryValue = string | number | boolean | undefined;

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): URL {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = new URL(`${normalizedBase}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > 0
      ? text
      : response.statusText || `Request failed with status ${response.status}`;
  } catch {
    return response.statusText || `Request failed with status ${response.status}`;
  }
}

async function fetchJson<T>(fetchImpl: typeof fetch, url: URL, schema: z.ZodType<T>): Promise<T> {
  const response = await fetchImpl(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new OnetClientError(response.status, await readErrorMessage(response));
  }

  const payload: unknown = await response.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new OnetClientError(
      502,
      `Received an invalid response shape from ${url.pathname}: ${parsed.error.message}`,
    );
  }

  return parsed.data;
}

function assertValidAnswers(answers: string): void {
  if (!ANSWERS_PATTERN.test(answers)) {
    throw new OnetClientError(
      400,
      'Interest Profiler answers must be a string of 30 or 60 digits, each 1-5.',
    );
  }
}

/** Creates a typed client for this project's O*NET `/mnm` proxy. */
export function createOnetMnmClient(options: OnetMnmClientOptions): OnetMnmClient {
  const baseUrl = options.baseUrl;
  const baseFetch = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey;
  const fetchImpl: typeof fetch = apiKey
    ? (input, init) =>
        baseFetch(input, { ...init, headers: { ...init?.headers, 'X-API-Key': apiKey } })
    : baseFetch;

  return {
    async searchCareers({ keyword, start, end }) {
      const url = buildUrl(baseUrl, '/mnm/search', { keyword, start, end });
      return fetchJson(fetchImpl, url, careerSearchResultSchema);
    },

    async listCareers(params = {}) {
      const url = buildUrl(baseUrl, '/mnm/careers/', { start: params.start, end: params.end });
      return fetchJson(fetchImpl, url, careerSearchResultSchema);
    },

    async getCareerDetail(code, section) {
      const path = section ? `/mnm/careers/${code}/${section}` : `/mnm/careers/${code}/`;
      const url = buildUrl(baseUrl, path);
      return fetchJson(fetchImpl, url, careerDetailSchema);
    },

    async getInterestProfilerQuestions(params = {}) {
      const path = params.short
        ? '/mnm/interestprofiler/questions_30'
        : '/mnm/interestprofiler/questions';
      const url = buildUrl(baseUrl, path, { start: params.start, end: params.end });
      return fetchJson(fetchImpl, url, interestProfilerQuestionSetSchema);
    },

    async getInterestProfilerResults(answers) {
      assertValidAnswers(answers);
      const url = buildUrl(baseUrl, '/mnm/interestprofiler/results', { answers });
      return fetchJson(fetchImpl, url, interestProfilerResultsSchema);
    },

    async getInterestProfilerCareers(params) {
      if (params.answers !== undefined) {
        assertValidAnswers(params.answers);
      }
      const url = buildUrl(baseUrl, '/mnm/interestprofiler/careers', {
        answers: params.answers,
        realistic: params.realistic,
        investigative: params.investigative,
        artistic: params.artistic,
        social: params.social,
        enterprising: params.enterprising,
        conventional: params.conventional,
        zone: params.zone,
        start: params.start,
        end: params.end,
      });
      return fetchJson(fetchImpl, url, interestProfilerCareersResultSchema);
    },

    async getJobZones() {
      const url = buildUrl(baseUrl, '/mnm/interestprofiler/job_zones');
      return fetchJson(fetchImpl, url, jobZonesResultSchema);
    },
  };
}
