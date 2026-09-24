/**
 * Zod schemas validating the JSON this client receives from the proxy at
 * runtime. These are a client-only concern (unlike the plain TypeScript
 * types in `@hired-hand/shared`, which Stage 2's UI also imports) because
 * they encode exactly how strict we are about an untrusted network
 * response, not the logical shape of the data.
 */
import { z } from 'zod';
import {
  RIASEC_KEYS,
  type InterestProfilerResults,
  type RawInterestProfilerResultEntry,
  type RiasecScores,
} from '@hired-hand/shared';

export const careerReferenceTagsSchema = z
  .object({
    bright_outlook: z.boolean().optional(),
  })
  .catchall(z.boolean().optional());

export const careerReferenceSchema = z.object({
  href: z.string(),
  code: z.string(),
  title: z.string(),
  tags: careerReferenceTagsSchema.optional(),
});

export const mnmPaginatedResponseSchema = z.object({
  start: z.number(),
  end: z.number(),
  total: z.number(),
});

export const careerSearchResultSchema = mnmPaginatedResponseSchema.extend({
  career: z.array(careerReferenceSchema),
});

/**
 * `/mnm/careers/{code}/` and `/mnm/careers/{code}/{section}` responses vary
 * a lot by section, so this only enforces the two fields every response is
 * known to carry and otherwise leaves the rest as an open record.
 */
export const careerDetailSchema = z
  .object({
    code: z.string(),
    title: z.string(),
  })
  .catchall(z.unknown());

export const interestProfilerQuestionSchema = z.object({
  index: z.number(),
  area: z.string(),
  text: z.string(),
});

export const interestProfilerQuestionSetSchema = mnmPaginatedResponseSchema.extend({
  question: z.array(interestProfilerQuestionSchema),
});

const interestProfilerResultEntrySchema: z.ZodType<RawInterestProfilerResultEntry> = z.object({
  href: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  score: z.number(),
});

/**
 * O*NET's actual `/mnm/interestprofiler/results` response nests each RIASEC
 * score inside a `result` array of `{code, score}` entries (plus a
 * `careers` follow-up URL we don't need) rather than returning flat fields —
 * this validates that raw shape, then flattens it below into the
 * `RiasecScores` shape the rest of the app expects.
 */
const rawInterestProfilerResultsSchema = z
  .object({
    careers: z.string(),
    result: z.array(interestProfilerResultEntrySchema),
  })
  .refine((raw) => RIASEC_KEYS.every((key) => raw.result.some((entry) => entry.code === key)), {
    message: 'Missing one or more RIASEC scores in the "result" array',
  });

export const interestProfilerResultsSchema = rawInterestProfilerResultsSchema.transform(
  (raw): InterestProfilerResults => {
    const scores = {} as RiasecScores;
    for (const entry of raw.result) {
      if ((RIASEC_KEYS as readonly string[]).includes(entry.code)) {
        scores[entry.code as (typeof RIASEC_KEYS)[number]] = entry.score;
      }
    }
    return scores;
  },
);

export const careerMatchSchema = careerReferenceSchema.extend({
  fit: z.string().optional(),
});

export const interestProfilerCareersResultSchema = mnmPaginatedResponseSchema.extend({
  career: z.array(careerMatchSchema),
});

export const jobZoneSchema = z.object({
  value: z.number(),
  title: z.string(),
  experience: z.string().optional(),
  education: z.string().optional(),
  job_training: z.string().optional(),
  examples: z.string().optional(),
  svp_range: z.string().optional(),
});

export const jobZonesResultSchema = z.array(jobZoneSchema);
