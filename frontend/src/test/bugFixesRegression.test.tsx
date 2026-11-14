import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import { Conditions } from '../pages/Conditions';
import { Medicines } from '../pages/Medicines';
import { Articles } from '../pages/Articles';
import { AppointmentDetails } from '../pages/AppointmentDetails';
import { HealthDetails } from '../pages/HealthDetails';
import { AuthProvider } from '../context/AuthContext';
import { popularTopics } from '../data/mockHealthData';
import { healthApi, appointmentApi, authApi } from '../services/api';
import { ConditionCard } from '../components/health/HealthCards';

vi.mock('../services/api', () => ({
  authApi: {
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
  },
  healthApi: {
    getConditions: vi.fn(),
    getMedicines: vi.fn(),
    getArticles: vi.fn(),
    getConditionBySlug: vi.fn(),
    getMedicineBySlug: vi.fn(),
    getArticleBySlug: vi.fn(),
    toggleConditionBookmark: vi.fn(),
    toggleMedicineBookmark: vi.fn(),
    toggleArticleBookmark: vi.fn(),
    checkDbHealth: vi.fn().mockResolvedValue({ status: 'connected', connected: true }),
  },
  appointmentApi: {
    getUpcoming: vi.fn().mockResolvedValue([]),
    getAppointmentById: vi.fn(),
    cancelAppointment: vi.fn(),
  },
  userApi: {
    getProfile: vi.fn(),
  },
  medicationApi: {
    getAll: vi.fn().mockResolvedValue([]),
  },
  doseApi: {
    getTodayDoses: vi.fn().mockResolvedValue([]),
    updateDoseStatus: vi.fn(),
  },
  notificationApi: {
    getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

describe('Frontend Bug Fixes Regression Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Bug 1: Dashboard Find Doctors Navigation ──────────────────────────────
  it('Bug 1: Find Doctors quick action navigates to /appointments/doctors', async () => {
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      status: 'success',
      user: {
        id: 'u1',
        name: 'Tester',
        email: 'tester@test.com',
        role: 'patient',
        isActive: true,
      },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/appointments/doctors" element={<div>Doctor Directory Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    const findDoctorsButton = await screen.findByRole('button', { name: /find doctors/i });
    expect(findDoctorsButton).toBeInTheDocument();
    fireEvent.click(findDoctorsButton);

    await waitFor(() => {
      expect(screen.getByText('Doctor Directory Page')).toBeInTheDocument();
    });
  });

  // ─── Bug 2 & 3: Health Bookmarks Filtering & Bookmark Icon State ───────────
  it('Bug 2 & 3: Conditions page handles ?bookmarked=true and triggers bookmark toggle', async () => {
    vi.mocked(healthApi.getConditions).mockResolvedValue({
      data: [
        {
          id: 'c-1',
          slug: 'common-cold',
          name: 'Common Cold',
          category: 'Respiratory',
          shortDescription: 'Viral upper respiratory tract infection.',
          description: 'Full description',
          symptoms: ['Sore throat'],
          bookmarked: true,
        },
      ],
      pagination: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    vi.mocked(healthApi.toggleConditionBookmark).mockResolvedValue({
      slug: 'common-cold',
      bookmarked: false,
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/health/conditions?bookmarked=true']}>
          <Conditions />
        </MemoryRouter>
      </AuthProvider>
    );

    // Verify title reflects "Saved Conditions"
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Saved Conditions/i })).toBeInTheDocument();
    });

    // Verify healthApi.getConditions called with bookmarked: true after debounce
    await waitFor(() => {
      expect(healthApi.getConditions).toHaveBeenCalledWith(
        expect.objectContaining({ bookmarked: true })
      );
    });

    // Verify condition card displays filled bookmark (Remove from saved aria-label)
    const removeBookmarkBtn = await screen.findByRole('button', { name: /remove from saved/i });
    expect(removeBookmarkBtn).toBeInTheDocument();

    // Click to toggle/remove bookmark
    fireEvent.click(removeBookmarkBtn);

    await waitFor(() => {
      expect(healthApi.toggleConditionBookmark).toHaveBeenCalledWith('common-cold');
    });

    // In bookmarked-only mode, item should be removed from view
    await waitFor(() => {
      expect(screen.getByText(/No saved conditions/i)).toBeInTheDocument();
    });
  });

  it('Bug 2: Medicines page handles ?bookmarked=true correctly', async () => {
    vi.mocked(healthApi.getMedicines).mockResolvedValue({
      data: [
        {
          id: 'm-1',
          slug: 'amoxicillin',
          name: 'Amoxicillin',
          genericName: 'Amoxicillin',
          category: 'Antibiotics',
          shortDescription: 'Common antibiotic.',
          bookmarked: true,
        },
      ],
      pagination: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/health/medicines?bookmarked=true']}>
          <Medicines />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Saved Medicines/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(healthApi.getMedicines).toHaveBeenCalledWith(
        expect.objectContaining({ bookmarked: true })
      );
    });
  });

  it('Bug 2: Articles page handles ?bookmarked=true correctly', async () => {
    vi.mocked(healthApi.getArticles).mockResolvedValue({
      data: [
        {
          id: 'a-1',
          slug: 'evidence-based-sleep-hygiene',
          title: 'Evidence-Based Sleep Hygiene',
          category: 'Wellness',
          shortDescription: 'Habits for restful sleep.',
          content: 'Full content',
          publishedAt: '2026-01-01',
          bookmarked: true,
        },
      ],
      pagination: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/health/articles?bookmarked=true']}>
          <Articles />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Saved Articles/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(healthApi.getArticles).toHaveBeenCalledWith(
        expect.objectContaining({ bookmarked: true })
      );
    });
  });

  it('Bug 3: ConditionCard evaluates bookmarked property for active bookmark styling', () => {
    render(
      <MemoryRouter>
        <ConditionCard
          condition={{
            id: 'c-1',
            slug: 'headache',
            name: 'Tension Headache',
            category: 'Neurological',
            shortDescription: 'Dull ache across forehead',
            description: 'Full description',
            symptoms: ['Ache'],
            bookmarked: true,
          }}
        />
      </MemoryRouter>
    );

    const bookmarkBtn = screen.getByRole('button', { name: /remove from saved/i });
    expect(bookmarkBtn).toBeInTheDocument();
    expect(bookmarkBtn).toHaveClass('text-primary-600');
  });

  // ─── Bug 4: Appointment Date Display No Day Shift ─────────────────────────
  it('Bug 4: AppointmentDetails displays date without negative timezone day-shift', async () => {
    vi.mocked(appointmentApi.getAppointmentById).mockResolvedValue({
      id: 'appt-123',
      doctorId: 'doc-1',
      doctorName: 'Dr. Sarah Connor',
      doctorSpecialty: 'Cardiologist',
      date: '2026-11-20',
      timeSlot: '10:00',
      type: 'in_person',
      status: 'upcoming',
      notes: 'Routine checkup',
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/appointments/appt-123']}>
          <Routes>
            <Route path="/appointments/:id" element={<AppointmentDetails />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Dr\. Sarah Connor/i)).toBeInTheDocument();
    });

    // Date must include Nov 20, never rolling back to Nov 19
    expect(screen.getByText(/Nov 20/i)).toBeInTheDocument();
  });

  // ─── Bug 5: Health Popular Topics Slugs & HealthDetails Fallback ────────────
  it('Bug 5: Popular topics use valid slugs and not non-existent IDs', () => {
    const coldTopic = popularTopics.find((t) => t.label === 'Common Cold');
    expect(coldTopic?.conditionId).toBe('common-cold');

    const headacheTopic = popularTopics.find((t) => t.label === 'Headache');
    expect(headacheTopic?.conditionId).toBe('headache');

    const sleepTopic = popularTopics.find((t) => t.label === 'Healthy Sleep');
    expect(sleepTopic?.articleId).toBe('evidence-based-sleep-hygiene');
  });

  it('Bug 5: HealthDetails resolves fallback mock content when API returns 404', async () => {
    vi.mocked(healthApi.getConditionBySlug).mockRejectedValue(new Error('Not found'));
    vi.mocked(healthApi.getMedicineBySlug).mockRejectedValue(new Error('Not found'));
    vi.mocked(healthApi.getArticleBySlug).mockRejectedValue(new Error('Not found'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/health/common-cold']}>
          <Routes>
            <Route path="/health/:id" element={<HealthDetails />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Expect fallback condition to be found and rendered
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Common Cold/i })).toBeInTheDocument();
    });
  });
});
