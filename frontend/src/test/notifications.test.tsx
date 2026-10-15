import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Notifications } from '../pages/Notifications';
import { notificationApi } from '../services/api';
import type { AppNotification } from '../types';

vi.mock('../services/api', () => ({
  notificationApi: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 'u1',
      name: 'Alice Patient',
      email: 'alice@example.com',
      role: 'patient',
      isActive: true,
    },
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    updateProfile: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('Notification Center Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notifications list with unread badge and relative time', async () => {
    vi.mocked(notificationApi.getNotifications).mockResolvedValue({
      data: [
        {
          id: 'notif1',
          userId: 'u1',
          type: 'medication_reminder',
          title: 'Time for Metformin',
          message: 'Please take your 500mg dose now.',
          read: false,
          createdAt: new Date().toISOString(),
          data: { medicationId: 'm1' },
        } as unknown as AppNotification,
      ],
      pagination: { total: 1, page: 1, limit: 50, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValue({ unreadCount: 1 });

    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Time for Metformin')).toBeInTheDocument();
      expect(screen.getByText('Please take your 500mg dose now.')).toBeInTheDocument();
      expect(screen.getByText('1 unread')).toBeInTheDocument();
      expect(screen.getByText('View Medication')).toBeInTheDocument();
    });
  });

  it('marks a single notification as read when check button is clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(notificationApi.getNotifications).mockResolvedValue({
      data: [
        {
          id: 'notif1',
          userId: 'u1',
          type: 'appointment_reminder',
          title: 'Upcoming Appointment',
          message: 'Dr. Sarah Mitchell tomorrow at 10:00.',
          read: false,
          createdAt: new Date().toISOString(),
          data: { appointmentId: 'a1' },
        } as unknown as AppNotification,
      ],
      pagination: { total: 1, page: 1, limit: 50, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValue({ unreadCount: 1 });
    vi.mocked(notificationApi.markAsRead).mockResolvedValue({ message: 'Read', notification: {} as unknown as AppNotification });

    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Upcoming Appointment')).toBeInTheDocument();
    });

    const markReadBtn = screen.getByRole('button', { name: /Mark "Upcoming Appointment" as read/i });
    await user.click(markReadBtn);

    await waitFor(() => {
      expect(notificationApi.markAsRead).toHaveBeenCalledWith('notif1');
    });
  });

  it('marks all notifications as read when button is clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(notificationApi.getNotifications).mockResolvedValue({
      data: [
        {
          id: 'notif1',
          userId: 'u1',
          type: 'health_tip',
          title: 'Stay Hydrated',
          message: 'Drink at least 8 glasses of water.',
          read: false,
          createdAt: new Date().toISOString(),
        } as unknown as AppNotification,
      ],
      pagination: { total: 1, page: 1, limit: 50, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValue({ unreadCount: 1 });
    vi.mocked(notificationApi.markAllAsRead).mockResolvedValue({ message: 'All read', modifiedCount: 1 });

    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Stay Hydrated')).toBeInTheDocument();
    });

    const markAllBtn = screen.getByRole('button', { name: /Mark all read/i });
    await user.click(markAllBtn);

    await waitFor(() => {
      expect(notificationApi.markAllAsRead).toHaveBeenCalled();
    });
  });

  it('renders empty state when there are no notifications', async () => {
    vi.mocked(notificationApi.getNotifications).mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 50, totalPages: 0, hasNextPage: false, hasPrevPage: false },
    });
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValue({ unreadCount: 0 });

    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('All caught up!')).toBeInTheDocument();
    });
  });
});
