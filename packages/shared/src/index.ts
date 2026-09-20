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
  occupation: CareerReference[];
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

/** Response of `GET /mnm/interestprofiler/results`. */
export interface InterestProfilerResults extends RiasecScores {
  job_zone?: number | undefined;
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

/** Response of `GET /mnm/interestprofiler/job_zones`. */
export interface JobZonesResult {
  job_zone: JobZone[];
}

/** Whether a career reference carries O*NET's Bright Outlook tag. */
export function isBrightOutlook(career: CareerReference): boolean {
  return career.tags?.bright_outlook === true;
}
