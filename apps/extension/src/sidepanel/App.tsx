import { AppShell } from '../components/AppShell';
import { Tabs } from '../components/Tabs';
import { BrowseCareersPanel } from '../features/browse-careers/BrowseCareersPanel';
import { CareerSearchPanel } from '../features/career-search/CareerSearchPanel';

export function App() {
  return (
    <AppShell title="Career Finder">
      <Tabs
        label="Career Finder sections"
        tabs={[
          {
            id: 'search',
            label: 'Search',
            panel: <CareerSearchPanel />,
          },
          {
            id: 'browse',
            label: 'Browse',
            panel: <BrowseCareersPanel />,
          },
          {
            id: 'interest-profiler',
            label: 'Interest Profiler',
            panel: (
              <p>
                Interest Profiler placeholder — the question wizard and RIASEC results land in Stage
                2 on <code>feature/interest-profiler</code>. See{' '}
                <code>docs/DEVELOPMENT_PLAN.md</code>.
              </p>
            ),
          },
        ]}
      />
    </AppShell>
  );
}
