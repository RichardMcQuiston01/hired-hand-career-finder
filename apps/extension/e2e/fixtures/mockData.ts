/**
 * Canned O*NET `/mnm` responses, shaped to satisfy the Zod schemas in
 * `@hired-hand/onet-mnm-client` (and the plain types in `@hired-hand/shared`)
 * so the assembled pages render real populated states for the e2e a11y and
 * keyboard-nav scans instead of just empty/error states.
 */
import type {
  CareerDetail,
  CareerListResult,
  CareerSearchResult,
  InterestProfilerCareersResult,
  InterestProfilerQuestionSet,
  InterestProfilerResults,
} from '@hired-hand/shared';

export const SEARCH_RESULTS: CareerSearchResult = {
  start: 1,
  end: 3,
  total: 3,
  occupation: [
    {
      href: 'https://www.onetonline.org/link/summary/29-1141.00',
      code: '29-1141.00',
      title: 'Registered Nurses',
      tags: { bright_outlook: true },
    },
    {
      href: 'https://www.onetonline.org/link/summary/29-2061.00',
      code: '29-2061.00',
      title: 'Licensed Practical and Licensed Vocational Nurses',
    },
    {
      href: 'https://www.onetonline.org/link/summary/29-1171.00',
      code: '29-1171.00',
      title: 'Nurse Practitioners',
    },
  ],
};

export const BROWSE_CAREER_CODE = '15-1252.00';
export const BROWSE_CAREER_TITLE = 'Software Developers';

export const BROWSE_LIST: CareerListResult = {
  start: 1,
  end: 5,
  total: 5,
  occupation: [
    {
      href: 'https://www.onetonline.org/link/summary/15-1252.00',
      code: BROWSE_CAREER_CODE,
      title: BROWSE_CAREER_TITLE,
      tags: { bright_outlook: true },
    },
    {
      href: 'https://www.onetonline.org/link/summary/13-2011.00',
      code: '13-2011.00',
      title: 'Accountants and Auditors',
    },
    {
      href: 'https://www.onetonline.org/link/summary/25-2021.00',
      code: '25-2021.00',
      title: 'Elementary School Teachers, Except Special Education',
    },
    {
      href: 'https://www.onetonline.org/link/summary/29-1141.00',
      code: '29-1141.00',
      title: 'Registered Nurses',
    },
    {
      href: 'https://www.onetonline.org/link/summary/11-1021.00',
      code: '11-1021.00',
      title: 'General and Operations Managers',
    },
  ],
};

export const CAREER_DETAIL_OVERVIEW: CareerDetail = {
  code: BROWSE_CAREER_CODE,
  title: BROWSE_CAREER_TITLE,
  description:
    'Research and develop computer and network software or specialized utility programs, and design and develop applications.',
};

/** `skills` section — an array-of-`{name, description}` shape. */
export const CAREER_DETAIL_SKILLS: CareerDetail = {
  code: BROWSE_CAREER_CODE,
  title: BROWSE_CAREER_TITLE,
  element: [
    {
      name: 'Critical Thinking',
      description:
        'Using logic and reasoning to identify the strengths and weaknesses of alternative solutions.',
    },
    {
      name: 'Reading Comprehension',
      description: 'Understanding written sentences and paragraphs in work-related documents.',
    },
  ],
};

/** `knowledge` section — a second, smaller list-shaped section. */
export const CAREER_DETAIL_KNOWLEDGE: CareerDetail = {
  code: BROWSE_CAREER_CODE,
  title: BROWSE_CAREER_TITLE,
  element: [
    {
      name: 'Computers and Electronics',
      description:
        'Knowledge of circuit boards, processors, chips, electronic equipment, and computer hardware and software.',
    },
  ],
};

/**
 * Both the 30-question short form and `handleSubmit`'s answer-string
 * validation (`/^[1-5]{30}$/`) require exactly 30 answers, so this fixture
 * returns a full 30-question set rather than a token handful.
 */
const SHORT_QUESTION_COUNT = 30;
const RIASEC_AREAS = [
  'Realistic',
  'Investigative',
  'Artistic',
  'Social',
  'Enterprising',
  'Conventional',
] as const;

export const INTEREST_PROFILER_QUESTIONS_SHORT: InterestProfilerQuestionSet = {
  start: 1,
  end: SHORT_QUESTION_COUNT,
  total: SHORT_QUESTION_COUNT,
  question: Array.from({ length: SHORT_QUESTION_COUNT }, (_, i) => ({
    index: i + 1,
    area: RIASEC_AREAS[i % RIASEC_AREAS.length]!,
    text: `Sample interest profiler question ${i + 1} of ${SHORT_QUESTION_COUNT}.`,
  })),
};

export const INTEREST_PROFILER_RESULTS: InterestProfilerResults = {
  realistic: 8,
  investigative: 15,
  artistic: 6,
  social: 20,
  enterprising: 10,
  conventional: 12,
  job_zone: 4,
};

export const INTEREST_PROFILER_CAREERS: InterestProfilerCareersResult = {
  start: 1,
  end: 2,
  total: 2,
  career: [
    {
      href: 'https://www.onetonline.org/link/summary/29-1141.00',
      code: '29-1141.00',
      title: 'Registered Nurses',
      fit: 'Best',
    },
    {
      href: 'https://www.onetonline.org/link/summary/21-1021.00',
      code: '21-1021.00',
      title: 'Child, Family, and School Social Workers',
      fit: 'Great',
    },
  ],
};
