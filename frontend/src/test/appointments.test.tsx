import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Doctors } from '../pages/Doctors';
import { Appointments } from '../pages/Appointments';
import { doctorApi, appointmentApi } from '../services/api';
import type { Doctor, Appointment } from '../types';

vi.mock('../services/api', () => ({
  authApi: {
    getCurrentUser: vi.fn().mockResolvedValue({ user: null }),
  },
  doctorApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    getAvailability: vi.fn(),
  },
  appointmentApi: {
    getAppointments: vi.fn(),
    getAppointmentById: vi.fn(),
    book: vi.fn(),
    cancel: vi.fn(),
    reschedule: vi.fn(),
  },
  notificationApi: {
    getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
  },
}));

vi.mock('../context/AuthContext', () => {
  const defaultUser = {
    id: 'u1',
    name: 'Alice Patient',
    email: 'alice@example.com',
    role: 'patient',
    isActive: true,
  };
  return {
    useAuth: vi.fn(() => ({
      user: defaultUser,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
    })),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('Appointments & Doctor Directory Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders doctors list with specialties', async () => {
    vi.mocked(doctorApi.getAll).mockResolvedValue({
      data: [
        {
          id: 'doc1',
          name: 'Dr. Sarah Mitchell',
          specialty: 'Cardiologist',
          rating: 4.9,
          experience: '12 years',
          hospital: 'City Heart Center',
          consultationFee: 150,
          workingDays: ['Monday', 'Tuesday', 'Wednesday'],
          workingHours: { start: '09:00', end: '17:00' },
          isActive: true,
        } as unknown as Doctor,
      ],
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <MemoryRouter>
        <Doctors />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dr. Sarah Mitchell')).toBeInTheDocument();
      expect(screen.getAllByText('Cardiologist').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('$150')).toBeInTheDocument();
    });
  });

  it('renders empty state when no doctors match the search filter', async () => {
    vi.mocked(doctorApi.getAll).mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasNextPage: false, hasPrevPage: false },
    });

    render(
      <MemoryRouter>
        <Doctors />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No doctors found/i)).toBeInTheDocument();
    });
  });

  it('renders appointments list for authenticated user', async () => {
    vi.mocked(appointmentApi.getAppointments).mockResolvedValue([
      {
        id: 'appt1',
        patientId: 'u1',
        doctor: {
          id: 'doc1',
          name: 'Dr. Sarah Mitchell',
          specialty: 'Cardiologist',
        } as unknown as Doctor,
        doctorName: 'Dr. Sarah Mitchell',
        date: '2026-10-20',
        startAt: '2026-10-20T10:00:00.000Z',
        timeSlot: '10:00',
        status: 'booked',
        type: 'in_person',
        reason: 'Routine checkup',
        location: 'City Heart Center',
      } as unknown as Appointment,
    ]);

    render(
      <MemoryRouter>
        <Appointments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dr. Sarah Mitchell')).toBeInTheDocument();
      expect(screen.getByText('Cardiologist')).toBeInTheDocument();
    });
  });

  it('renders empty state when patient has no appointments', async () => {
    vi.mocked(appointmentApi.getAppointments).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Appointments />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No upcoming appointments/i)).toBeInTheDocument();
    });
  });
});
