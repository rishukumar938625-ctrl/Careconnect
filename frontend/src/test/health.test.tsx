import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Health } from '../pages/Health';
import { Conditions } from '../pages/Conditions';
import { AuthProvider } from '../context/AuthContext';
import { healthApi } from '../services/api';
import type { HealthCondition } from '../types';

vi.mock('../services/api', () => ({
  authApi: {
    getCurrentUser: vi.fn().mockResolvedValue({ user: null }),
  },
  healthApi: {
    getConditions: vi.fn(),
    getMedicines: vi.fn(),
    getArticles: vi.fn(),
    getConditionBySlug: vi.fn(),
    getMedicineBySlug: vi.fn(),
    getArticleBySlug: vi.fn(),
  },
  notificationApi: {
    getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
  },
}));

describe('Health Information Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders health home with categories and disclaimer', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Health />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole('heading', { name: /Health Information/i })).toBeInTheDocument();
    expect(screen.getByText('Conditions')).toBeInTheDocument();
    expect(screen.getByText('Medicines')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search conditions, medicines/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Medical disclaimer/i)).toBeInTheDocument();
  });

  it('loads and displays conditions from API', async () => {
    vi.mocked(healthApi.getConditions).mockResolvedValue({
      data: [
        {
          id: 'c1',
          name: 'Type 2 Diabetes',
          slug: 'type-2-diabetes',
          category: 'Endocrine',
          shortDescription: 'A chronic condition that affects how the body processes blood sugar.',
          overview: 'Overview here',
          symptoms: ['Fatigue', 'Excessive thirst'],
          treatments: ['Insulin', 'Diet'],
          whenToSeeDoctor: ['High fever'],
          sources: ['CDC'],
          lastReviewed: '2026-01-01',
          readTime: '4 min',
        } as unknown as HealthCondition,
      ],
      pagination: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/health/conditions']}>
          <Conditions />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      expect(screen.getByText(/A chronic condition that affects how the body processes blood sugar/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when search returns no conditions', async () => {
    vi.mocked(healthApi.getConditions).mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 100, totalPages: 0, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/health/conditions?q=nonexistent']}>
          <Conditions />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/No conditions found/i)).toBeInTheDocument();
    });
  });

  it('renders error state on API network failure', async () => {
    vi.mocked(healthApi.getConditions).mockRejectedValue(new Error('Network error'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/health/conditions']}>
          <Conditions />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to load conditions/i)).toBeInTheDocument();
    });
  });
});
