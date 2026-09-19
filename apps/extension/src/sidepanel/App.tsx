import { AppShell } from '../components/AppShell';
import { Tabs } from '../components/Tabs';
import { InterestProfilerPanel } from '../features/interest-profiler/InterestProfilerPanel';
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
            panel: (
              <p>
                Browse Careers placeholder — the paginated/filterable list and career detail view
                land in Stage 2 on <code>feature/browse-careers</code>. See{' '}
                <code>docs/DEVELOPMENT_PLAN.md</code>.
              </p>
            ),
          },
          {
            id: 'interest-profiler',
            label: 'Interest Profiler',
            panel: <InterestProfilerPanel />,
          },
        ]}
      />
    </AppShell>
  );
}
