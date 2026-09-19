/**
 * Zod schemas validating the JSON this client receives from the proxy at
 * runtime. These are a client-only concern (unlike the plain TypeScript
 * types in `@hired-hand/shared`, which Stage 2's UI also imports) because
 * they encode exactly how strict we are about an untrusted network
 * response, not the logical shape of the data.
 */
import { z } from 'zod';

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
  occupation: z.array(careerReferenceSchema),
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

export const riasecScoresSchema = z.object({
  realistic: z.number(),
  investigative: z.number(),
  artistic: z.number(),
  social: z.number(),
  enterprising: z.number(),
  conventional: z.number(),
});

export const interestProfilerResultsSchema = riasecScoresSchema.extend({
  job_zone: z.number().optional(),
});

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

export const jobZonesResultSchema = z.object({
  job_zone: z.array(jobZoneSchema),
});
