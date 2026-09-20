/**
 * Typed client for the O*NET `/mnm` endpoints (search, careers, Interest
 * Profiler), calling this project's API proxy rather than O*NET directly so
 * the API key never ships to the browser. Implemented in Stage 1
 * (feature/onet-client-package) — see docs/DEVELOPMENT_PLAN.md.
 */
export { createOnetMnmClient } from './client';
export type {
  OnetMnmClient,
  OnetMnmClientOptions,
  PaginationParams,
  SearchCareersParams,
  InterestProfilerQuestionsParams,
  InterestProfilerCareersParams,
} from './client';
export { OnetClientError } from './errors';
export * from './schemas';
