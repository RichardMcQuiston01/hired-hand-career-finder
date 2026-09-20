import type { Page } from '@playwright/test';
import { ONET_MNM_CAREER_SECTIONS } from '@hired-hand/shared';
import {
  BROWSE_LIST,
  CAREER_DETAIL_KNOWLEDGE,
  CAREER_DETAIL_OVERVIEW,
  CAREER_DETAIL_SKILLS,
  INTEREST_PROFILER_CAREERS,
  INTEREST_PROFILER_QUESTIONS_SHORT,
  INTEREST_PROFILER_RESULTS,
  SEARCH_RESULTS,
} from './mockData';

/**
 * Intercepts every `onetClient` call — they all go directly to O*NET's real
 * API host (there is no backend proxy in this architecture; see
 * docs/DEVELOPMENT_PLAN.md's "Key decisions" section), which this sandbox
 * has no live network access to — and returns canned, schema-shaped JSON so
 * the pages render real populated states for the a11y scans.
 */
export async function installOnetMocks(page: Page): Promise<void> {
  await page.route('https://api-v2.onetcenter.org/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (path.endsWith('/mnm/search')) {
      return json(SEARCH_RESULTS);
    }
    if (path.endsWith('/mnm/careers/')) {
      // Bare list endpoint (`listCareers`) — checked before the generic
      // `/mnm/careers/{code}/...` branch below, which this also matches.
      return json(BROWSE_LIST);
    }
    if (path.includes('/mnm/careers/')) {
      const section = ONET_MNM_CAREER_SECTIONS.find((candidate) => path.endsWith(`/${candidate}`));
      if (section === 'skills') return json(CAREER_DETAIL_SKILLS);
      if (section === 'knowledge') return json(CAREER_DETAIL_KNOWLEDGE);
      if (section)
        return json({ code: CAREER_DETAIL_OVERVIEW.code, title: CAREER_DETAIL_OVERVIEW.title });
      return json(CAREER_DETAIL_OVERVIEW); // `getCareerDetail(code)` overview, no section.
    }
    if (
      path.endsWith('/mnm/interestprofiler/questions') ||
      path.endsWith('/mnm/interestprofiler/questions_30')
    ) {
      return json(INTEREST_PROFILER_QUESTIONS_SHORT);
    }
    if (path.endsWith('/mnm/interestprofiler/results')) {
      return json(INTEREST_PROFILER_RESULTS);
    }
    if (path.endsWith('/mnm/interestprofiler/careers')) {
      return json(INTEREST_PROFILER_CAREERS);
    }

    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}
