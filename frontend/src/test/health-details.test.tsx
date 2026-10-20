import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HealthDetails } from '../pages/HealthDetails';
import { healthApi } from '../services/api';
import type { HealthCondition, Medicine, HealthArticle } from '../types';

vi.mock('../services/api', () => ({
  authApi: {
    getCurrentUser: vi.fn().mockResolvedValue({ user: null }),
  },
  healthApi: {
    getConditionBySlug: vi.fn(),
    getMedicineBySlug: vi.fn(),
    getArticleBySlug: vi.fn(),
    toggleConditionBookmark: vi.fn(),
    toggleMedicineBookmark: vi.fn(),
    toggleArticleBookmark: vi.fn(),
  },
  notificationApi: {
    getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
  },
}));

const mockUser = {
  id: 'u1',
  name: 'Jane Patient',
  email: 'jane@example.com',
  role: 'patient',
  isActive: true,
  bookmarkedConditions: ['hypertension'],
  bookmarkedMedicines: [],
  bookmarkedArticles: [],
};

const refreshUserMock = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: refreshUserMock,
    updateProfile: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('HealthDetails Page — Bookmarks & Source Attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders condition detail with clinical attribution and medical disclaimer', async () => {
    vi.mocked(healthApi.getConditionBySlug).mockResolvedValue({
      id: 'c1',
      slug: 'hypertension',
      name: 'High Blood Pressure',
      category: 'Cardiovascular',
      shortDescription: 'Elevated arterial pressure.',
      overview: 'Overview of hypertension',
      symptoms: ['Headaches', 'Shortness of breath'],
      causes: ['Genetics', 'High sodium intake'],
      prevention: ['Exercise regularly', 'Reduce salt'],
      lastReviewedAt: '2026-10-15',
      severity: 'moderate',
    } as unknown as HealthCondition);

    render(
      <MemoryRouter initialEntries={['/health/hypertension']}>
        <Routes>
          <Route path="/health/:id" element={<HealthDetails />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'High Blood Pressure' })).toBeInTheDocument();
      expect(screen.getByText(/Source: CareConnect Clinical Knowledge Base/i)).toBeInTheDocument();
      expect(screen.getByText(/2026-10-15/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Medical disclaimer/i)).toBeInTheDocument();
    });
  });

  it('toggles bookmark when bookmark button is clicked on condition detail', async () => {
    const user = userEvent.setup();
    vi.mocked(healthApi.getConditionBySlug).mockResolvedValue({
      id: 'c1',
      slug: 'hypertension',
      name: 'High Blood Pressure',
      category: 'Cardiovascular',
      shortDescription: 'Elevated arterial pressure.',
      overview: 'Overview of hypertension',
      symptoms: [],
      causes: [],
      prevention: [],
      lastReviewedAt: '2026-10-15',
    } as unknown as HealthCondition);

    vi.mocked(healthApi.toggleConditionBookmark).mockResolvedValue({
      slug: 'hypertension',
      bookmarked: false,
    });

    render(
      <MemoryRouter initialEntries={['/health/hypertension']}>
        <Routes>
          <Route path="/health/:id" element={<HealthDetails />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'High Blood Pressure' })).toBeInTheDocument();
    });

    const bookmarkBtn = screen.getByRole('button', { name: /Remove condition from saved/i });
    expect(bookmarkBtn).toBeInTheDocument();

    await user.click(bookmarkBtn);

    expect(healthApi.toggleConditionBookmark).toHaveBeenCalledWith('hypertension');
    expect(refreshUserMock).toHaveBeenCalled();
  });

  it('renders article detail with author attribution and editorial review credentials', async () => {
    vi.mocked(healthApi.getConditionBySlug).mockRejectedValue(new Error('Not found'));
    vi.mocked(healthApi.getMedicineBySlug).mockRejectedValue(new Error('Not found'));
    vi.mocked(healthApi.getArticleBySlug).mockResolvedValue({
      id: 'a1',
      slug: 'managing-hypertension',
      title: 'Managing Hypertension Effectively',
      category: 'Cardiovascular',
      summary: 'Practical dietary and lifestyle steps to reduce blood pressure.',
      content: 'Detailed article content here...',
      author: {
        name: 'Dr. Emily Watson, MD',
        role: 'Chief Medical Editor',
      },
      lastReviewedAt: '2026-10-18',
      publishedAt: '2026-09-01',
    } as unknown as HealthArticle);

    render(
      <MemoryRouter initialEntries={['/health/managing-hypertension']}>
        <Routes>
          <Route path="/health/:id" element={<HealthDetails />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Managing Hypertension Effectively' })).toBeInTheDocument();
      expect(screen.getByText('Dr. Emily Watson, MD')).toBeInTheDocument();
      expect(screen.getByText(/Chief Medical Editor/i)).toBeInTheDocument();
    });
  });

  it('renders medicine detail with pharmacological compendium attribution', async () => {
    vi.mocked(healthApi.getConditionBySlug).mockRejectedValue(new Error('Not found'));
    vi.mocked(healthApi.getMedicineBySlug).mockResolvedValue({
      id: 'm1',
      slug: 'lisinopril',
      name: 'Lisinopril',
      genericName: 'Lisinopril USP',
      category: 'Cardiovascular',
      description: 'An ACE inhibitor used to treat hypertension.',
      shortDescription: 'Blood pressure medication.',
      commonUses: ['High blood pressure', 'Heart failure'],
      commonSideEffects: ['Dry cough', 'Dizziness'],
      warnings: ['Do not use while pregnant'],
      requiresPrescription: true,
      lastReviewedAt: '2026-10-12',
    } as unknown as Medicine);

    render(
      <MemoryRouter initialEntries={['/health/lisinopril']}>
        <Routes>
          <Route path="/health/:id" element={<HealthDetails />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Lisinopril' })).toBeInTheDocument();
      expect(screen.getByText('Lisinopril USP')).toBeInTheDocument();
      expect(screen.getByText(/CareConnect Pharmacological Compendium/i)).toBeInTheDocument();
      expect(screen.getByText('Prescription Required')).toBeInTheDocument();
    });
  });
});

