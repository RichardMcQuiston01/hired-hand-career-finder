import { AppShell } from '../components/AppShell';
import { Tabs } from '../components/Tabs';
import { InterestProfilerPanel } from '../features/interest-profiler/InterestProfilerPanel';
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
            panel: <InterestProfilerPanel />,
          },
        ]}
      />
    </AppShell>
  );
}
