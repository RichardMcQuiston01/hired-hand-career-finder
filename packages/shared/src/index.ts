/**
 * Shared TypeScript types used by the extension, the API proxy, and the
 * O*NET client package.
 *
 * These describe the JSON shapes returned by the O*NET `/mnm` ("My Next
 * Move") endpoints, mirrored 1:1 by this project's own `/api/onet/mnm/...`
 * proxy (see docs/DEVELOPMENT_PLAN.md — the extension never calls O*NET
 * directly). Fields that come straight off the wire keep the API's own
 * `snake_case` naming; only the small set of runtime constants below (and
 * every function/variable in this codebase) use camelCase.
 */

/** Arbitrary boolean tags O*NET attaches to an occupation, e.g. Bright Outlook. */
export interface CareerReferenceTags {
  bright_outlook?: boolean | undefined;
  [tag: string]: boolean | undefined;
}

/** The compact occupation reference shape used by search results, career
 * listings, and (extended with `fit`) Interest Profiler matches. */
export interface CareerReference {
  href: string;
  code: string;
  title: string;
  tags?: CareerReferenceTags | undefined;
}

/** Common pagination envelope shared by every paginated `/mnm` list endpoint. */
export interface MnmPaginatedResponse {
  start: number;
  end: number;
  total: number;
}

/** Response of `GET /mnm/search` and `GET /mnm/careers/` (same shape). */
export interface CareerSearchResult extends MnmPaginatedResponse {
  career: CareerReference[];
}

/** Alias kept distinct so call sites can name intent (`listCareers` vs. `searchCareers`). */
export type CareerListResult = CareerSearchResult;

/** The detail sections available under `GET /mnm/careers/{code}/{section}`. */
export const ONET_MNM_CAREER_SECTIONS = [
  'skills',
  'knowledge',
  'abilities',
  'personality',
  'education',
  'job_outlook',
  'technology',
  'explore_more',
] as const;

export type OnetMnmCareerSection = (typeof ONET_MNM_CAREER_SECTIONS)[number];

/**
 * Response of `GET /mnm/careers/{code}/` (full detail) or
 * `GET /mnm/careers/{code}/{section}` (one section). The exact fields vary
 * by section, so beyond the two fields every response is known to carry,
 * this is intentionally an open record — callers narrow it themselves.
 */
export interface CareerDetail {
  code: string;
  title: string;
  [field: string]: unknown;
}

/** A single Interest Profiler question, answered on a 1-5 Likert scale. */
export interface InterestProfilerQuestion {
  index: number;
  area: string;
  text: string;
}

/** Response of `GET /mnm/interestprofiler/questions` or `questions_30`. */
export interface InterestProfilerQuestionSet extends MnmPaginatedResponse {
  question: InterestProfilerQuestion[];
}

/** The six RIASEC interest areas, in the order O*NET presents them. */
export const RIASEC_KEYS = [
  'realistic',
  'investigative',
  'artistic',
  'social',
  'enterprising',
  'conventional',
] as const;

export type RiasecKey = (typeof RIASEC_KEYS)[number];

/** RIASEC scores, one number per interest area. */
export type RiasecScores = Record<RiasecKey, number>;

/**
 * Response of `GET /mnm/interestprofiler/results`, as the client hands it
 * back after parsing — O*NET's actual wire format nests each score inside a
 * `result` array of `{code, score}` entries rather than returning these
 * fields flat; the client flattens it into this shape.
 */
export interface InterestProfilerResults extends RiasecScores {
  job_zone?: number | undefined;
}

/** One RIASEC interest area entry as O*NET's `/mnm/interestprofiler/results` actually returns it. */
export interface RawInterestProfilerResultEntry {
  href: string;
  code: string;
  title: string;
  description: string;
  score: number;
}

/**
 * The raw wire shape of `GET /mnm/interestprofiler/results`, before the
 * client flattens it into `InterestProfilerResults`.
 */
export interface RawInterestProfilerResults {
  careers: string;
  result: RawInterestProfilerResultEntry[];
}

/** An occupation reference as returned by the Interest Profiler career matcher. */
export interface CareerMatch extends CareerReference {
  fit?: string | undefined;
}

/** Response of `GET /mnm/interestprofiler/careers`. */
export interface InterestProfilerCareersResult extends MnmPaginatedResponse {
  career: CareerMatch[];
}

/** One O*NET job zone description. */
export interface JobZone {
  value: number;
  title: string;
  experience?: string | undefined;
  education?: string | undefined;
  job_training?: string | undefined;
  examples?: string | undefined;
  svp_range?: string | undefined;
}

/** Response of `GET /mnm/interestprofiler/job_zones` — a bare array, not wrapped in an envelope. */
export type JobZonesResult = JobZone[];

/** Whether a career reference carries O*NET's Bright Outlook tag. */
export function isBrightOutlook(career: CareerReference): boolean {
  return career.tags?.bright_outlook === true;
}
