#!/usr/bin/env node
/**
 * Stands in for the real O*NET `/mnm` API (`https://api-v2.onetcenter.org`),
 * which this sandbox cannot reach (org policy blocks egress to it — see
 * apps/proxy/README.md's own "Live verification" note). `apps/proxy` is
 * pointed at this server via `ONET_BASE_URL` for the Stage 6 integration
 * suite, so the *real* proxy code (key injection, allow-list, CORS, error
 * normalization) runs unmodified against this instead of a mocked `fetch` —
 * only the final hop to the real O*NET API itself is out of reach here.
 *
 * Requires the exact `X-API-Key` this suite configured the proxy with
 * (`EXPECTED_API_KEY` env) on every request, and responds 401 otherwise —
 * this is what proves the proxy injects the key server-side rather than the
 * extension supplying it. Fixture shapes are kept in sync by hand with
 * `apps/extension/e2e/fixtures/mockData.ts` (same O*NET `/mnm` response
 * shapes, reused there for the Stage 4 whole-page a11y suite via
 * `page.route` instead of a real server).
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_ONET_PORT ?? 4790);
const EXPECTED_API_KEY = process.env.EXPECTED_API_KEY ?? '';

const BROWSE_CAREER_CODE = '15-1252.00';
const BROWSE_CAREER_TITLE = 'Software Developers';

const SEARCH_RESULTS = {
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

const BROWSE_LIST = {
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

const CAREER_DETAIL_OVERVIEW = {
  code: BROWSE_CAREER_CODE,
  title: BROWSE_CAREER_TITLE,
  description:
    'Research and develop computer and network software or specialized utility programs, and design and develop applications.',
};

const CAREER_DETAIL_SKILLS = {
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

const CAREER_DETAIL_KNOWLEDGE = {
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

const CAREER_SECTIONS = [
  'skills',
  'knowledge',
  'abilities',
  'personality',
  'education',
  'job_outlook',
  'technology',
  'explore_more',
  'check_out_my_state',
];

const SHORT_QUESTION_COUNT = 30;
const RIASEC_AREAS = [
  'Realistic',
  'Investigative',
  'Artistic',
  'Social',
  'Enterprising',
  'Conventional',
];

const INTEREST_PROFILER_QUESTIONS_SHORT = {
  start: 1,
  end: SHORT_QUESTION_COUNT,
  total: SHORT_QUESTION_COUNT,
  question: Array.from({ length: SHORT_QUESTION_COUNT }, (_, i) => ({
    index: i + 1,
    area: RIASEC_AREAS[i % RIASEC_AREAS.length],
    text: `Sample interest profiler question ${i + 1} of ${SHORT_QUESTION_COUNT}.`,
  })),
};

const INTEREST_PROFILER_RESULTS = {
  realistic: 8,
  investigative: 15,
  artistic: 6,
  social: 20,
  enterprising: 10,
  conventional: 12,
  job_zone: 4,
};

const INTEREST_PROFILER_CAREERS = {
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

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  if (path === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  const apiKey = req.headers['x-api-key'];
  if (!EXPECTED_API_KEY || apiKey !== EXPECTED_API_KEY) {
    sendJson(res, 401, {
      error: 'Missing or wrong X-API-Key — the proxy should always inject this server-side.',
    });
    return;
  }

  if (path === '/mnm/search') {
    sendJson(res, 200, SEARCH_RESULTS);
    return;
  }
  if (path === '/mnm/careers/') {
    sendJson(res, 200, BROWSE_LIST);
    return;
  }
  if (path.startsWith('/mnm/careers/')) {
    const section = CAREER_SECTIONS.find((candidate) => path.endsWith(`/${candidate}`));
    if (section === 'skills') return sendJson(res, 200, CAREER_DETAIL_SKILLS);
    if (section === 'knowledge') return sendJson(res, 200, CAREER_DETAIL_KNOWLEDGE);
    if (section)
      return sendJson(res, 200, { code: BROWSE_CAREER_CODE, title: BROWSE_CAREER_TITLE });
    return sendJson(res, 200, CAREER_DETAIL_OVERVIEW);
  }
  if (path === '/mnm/interestprofiler/questions_30' || path === '/mnm/interestprofiler/questions') {
    sendJson(res, 200, INTEREST_PROFILER_QUESTIONS_SHORT);
    return;
  }
  if (path === '/mnm/interestprofiler/results') {
    sendJson(res, 200, INTEREST_PROFILER_RESULTS);
    return;
  }
  if (path === '/mnm/interestprofiler/careers') {
    sendJson(res, 200, INTEREST_PROFILER_CAREERS);
    return;
  }

  sendJson(res, 404, { error: `mock-onet-server: no fixture for ${path}` });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock-onet-server listening on http://127.0.0.1:${PORT}`);
});
