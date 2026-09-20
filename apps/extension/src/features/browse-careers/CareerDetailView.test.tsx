import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnetClientError } from '@hired-hand/onet-mnm-client';
import type { CareerDetail, CareerReference } from '@hired-hand/shared';
import { CareerDetailView } from './CareerDetailView';
import { onetClient } from '../../lib/onetClient';

expect.extend(toHaveNoViolations);

vi.mock('../../lib/onetClient', () => ({
  onetClient: {
    listCareers: vi.fn(),
    getCareerDetail: vi.fn(),
  },
}));

const mockedOnetClient = vi.mocked(onetClient, true);

const testCareer: CareerReference = {
  href: 'https://example.com/careers/17-2051.00',
  code: '17-2051.00',
  title: 'Civil Engineers',
};

function overview(): CareerDetail {
  return {
    code: testCareer.code,
    title: testCareer.title,
    description: 'Perform engineering duties in planning and supervising construction.',
  };
}

function skillsSection(): CareerDetail {
  return {
    code: testCareer.code,
    title: testCareer.title,
    element: [
      { name: 'Active Listening', description: 'Giving full attention to what other people say.' },
      { name: 'Mathematics', description: 'Using mathematics to solve problems.' },
    ],
  };
}

function shapelessSection(): CareerDetail {
  return {
    code: testCareer.code,
    title: testCareer.title,
    weird_field: 'some scalar value',
    another_field: 42,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('CareerDetailView', () => {
  it('fetches and renders the overview, moving focus to the heading', async () => {
    mockedOnetClient.getCareerDetail.mockResolvedValue(overview());

    render(<CareerDetailView career={testCareer} onBack={vi.fn()} />);

    const heading = await screen.findByRole('heading', { name: 'Civil Engineers' });
    await waitFor(() => expect(heading).toHaveFocus());

    expect(mockedOnetClient.getCareerDetail).toHaveBeenCalledWith('17-2051.00');
    expect(mockedOnetClient.getCareerDetail).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        'Perform engineering duties in planning and supervising construction.',
      ),
    ).toBeInTheDocument();
  });

  it('lazily loads a section only when it is selected, not all sections upfront', async () => {
    mockedOnetClient.getCareerDetail.mockImplementation((code, section) => {
      if (!section) return Promise.resolve(overview());
      if (section === 'skills') return Promise.resolve(skillsSection());
      return Promise.resolve({ code, title: testCareer.title });
    });

    render(<CareerDetailView career={testCareer} onBack={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Civil Engineers' });

    // Only the overview call so far — none of the 8 sections fetched yet.
    expect(mockedOnetClient.getCareerDetail).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Skills' }));

    expect(await screen.findByText('Active Listening')).toBeInTheDocument();
    expect(mockedOnetClient.getCareerDetail).toHaveBeenCalledWith('17-2051.00', 'skills');
    // Overview + exactly the one section clicked — the other seven were never requested.
    expect(mockedOnetClient.getCareerDetail).toHaveBeenCalledTimes(2);

    // Selecting a different section fetches that one too, still nothing extra.
    await userEvent.click(screen.getByRole('button', { name: 'Knowledge' }));
    await waitFor(() => expect(mockedOnetClient.getCareerDetail).toHaveBeenCalledTimes(3));
    expect(mockedOnetClient.getCareerDetail).toHaveBeenCalledWith('17-2051.00', 'knowledge');

    // Re-selecting "Skills" does not re-fetch it — the result is cached.
    await userEvent.click(screen.getByRole('button', { name: 'Skills' }));
    expect(mockedOnetClient.getCareerDetail).toHaveBeenCalledTimes(3);
    expect(screen.getByText('Active Listening')).toBeInTheDocument();
  });

  it('falls back to a plain key/value rendering for an unrecognized section shape', async () => {
    mockedOnetClient.getCareerDetail.mockImplementation((_code, section) =>
      Promise.resolve(section ? shapelessSection() : overview()),
    );

    render(<CareerDetailView career={testCareer} onBack={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Civil Engineers' });

    await userEvent.click(screen.getByRole('button', { name: 'Technology' }));

    expect(await screen.findByText('Weird Field')).toBeInTheDocument();
    expect(screen.getByText('some scalar value')).toBeInTheDocument();
    expect(screen.getByText('Another Field')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders an error state when a section fails to load', async () => {
    mockedOnetClient.getCareerDetail.mockImplementation((_code, section) => {
      if (!section) return Promise.resolve(overview());
      return Promise.reject(new OnetClientError(503, 'Section temporarily unavailable'));
    });

    render(<CareerDetailView career={testCareer} onBack={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Civil Engineers' });

    await userEvent.click(screen.getByRole('button', { name: 'Education' }));

    expect(await screen.findByText('Section temporarily unavailable')).toBeInTheDocument();
  });

  it('calls onBack when "Back to results" is activated', async () => {
    mockedOnetClient.getCareerDetail.mockResolvedValue(overview());
    const onBack = vi.fn();

    render(<CareerDetailView career={testCareer} onBack={onBack} />);
    await screen.findByRole('heading', { name: 'Civil Engineers' });

    await userEvent.click(screen.getByRole('button', { name: /Back to results/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('has no obvious accessibility violations once the overview and a section are populated', async () => {
    mockedOnetClient.getCareerDetail.mockImplementation((_code, section) =>
      Promise.resolve(section ? skillsSection() : overview()),
    );

    const { container } = render(<CareerDetailView career={testCareer} onBack={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Civil Engineers' });

    await userEvent.click(screen.getByRole('button', { name: 'Skills' }));
    await screen.findByText('Active Listening');

    expect(await axe(container)).toHaveNoViolations();
  });
});
