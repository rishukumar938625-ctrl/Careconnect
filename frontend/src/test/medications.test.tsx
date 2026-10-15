import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Medications } from '../pages/Medications';
import { AddMedication } from '../pages/AddMedication';
import { AuthProvider } from '../context/AuthContext';
import { medicationApi, doseApi } from '../services/api';
import type { Medication, DoseRecord, AdherenceStats } from '../types';

vi.mock('../services/api', () => ({
  authApi: {
    getCurrentUser: vi.fn().mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Alice Patient',
        email: 'alice@example.com',
        role: 'patient',
        isActive: true,
      },
    }),
  },
  medicationApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  doseApi: {
    getTodayDoses: vi.fn(),
    getAdherence: vi.fn(),
    updateStatus: vi.fn(),
  },
  notificationApi: {
    getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
  },
}));

describe('Medications & Dose Management Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders today dose schedule and triggers status update when taken', async () => {
    const user = userEvent.setup();

    const mockMed = {
      id: 'm1',
      name: 'Metformin',
      dosage: '500mg',
      form: 'tablet' as const,
      frequency: 'once_daily' as const,
      times: ['08:00'],
      startDate: '2026-01-01',
      color: '#2563EB',
      isActive: true,
    };

    vi.mocked(doseApi.getTodayDoses).mockResolvedValue([
      {
        id: 'd1',
        medicationId: mockMed as unknown as Medication,
        scheduledTime: '2026-10-13T08:00:00.000Z',
        status: 'pending',
        timeSlot: '08:00',
        medicationName: 'Metformin',
        dosage: '500mg',
        form: 'tablet',
        color: '#2563EB',
      } as unknown as DoseRecord,
    ]);
    vi.mocked(medicationApi.getAll).mockResolvedValue([mockMed]);
    vi.mocked(doseApi.getAdherence).mockResolvedValue({
      totalDoses: 10,
      takenDoses: 9,
      skippedDoses: 1,
      adherenceRate: 90,
    } as unknown as AdherenceStats);
    vi.mocked(doseApi.updateStatus).mockResolvedValue({
      id: 'd1',
      status: 'taken',
      takenAt: new Date().toISOString(),
    } as unknown as DoseRecord);

    render(
      <AuthProvider>
        <MemoryRouter>
          <Medications />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Metformin')).toBeInTheDocument();
      expect(screen.getByText(/500mg/i)).toBeInTheDocument();
    });

    const takeButton = screen.getByRole('button', { name: /Take/i });
    await user.click(takeButton);

    await waitFor(() => {
      expect(doseApi.updateStatus).toHaveBeenCalledWith('d1', 'taken');
    });
  });

  it('renders empty state when patient has no scheduled doses today', async () => {
    vi.mocked(doseApi.getTodayDoses).mockResolvedValue([]);
    vi.mocked(medicationApi.getAll).mockResolvedValue([]);
    vi.mocked(doseApi.getAdherence).mockResolvedValue({} as unknown as AdherenceStats);

    render(
      <AuthProvider>
        <MemoryRouter>
          <Medications />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/No doses scheduled for today/i)).toBeInTheDocument();
    });
  });

  it('validates required fields on AddMedication form', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <MemoryRouter>
          <AddMedication />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByRole('heading', { name: /Add Medication/i })).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /Save Medication/i });
    await user.click(saveButton);

    expect(screen.getByText(/Medication name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Dosage is required/i)).toBeInTheDocument();
    expect(medicationApi.create).not.toHaveBeenCalled();
  });

  it('submits valid medication data on AddMedication form', async () => {
    const user = userEvent.setup();
    vi.mocked(medicationApi.create).mockResolvedValue({
      id: 'm-new',
      name: 'Lisinopril',
      dosage: '10mg',
      form: 'tablet',
      frequency: 'once_daily',
      times: ['08:00'],
      startDate: '2026-10-13',
      color: '#2563EB',
      isActive: true,
    });

    render(
      <AuthProvider>
        <MemoryRouter>
          <AddMedication />
        </MemoryRouter>
      </AuthProvider>
    );

    await user.type(screen.getByLabelText(/Medication Name/i), 'Lisinopril');
    await user.type(screen.getByLabelText(/Dosage/i), '10mg');

    const saveButton = screen.getByRole('button', { name: /Save Medication/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(medicationApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Lisinopril',
          dosage: '10mg',
          form: 'tablet',
          frequency: 'once_daily',
        })
      );
    });
  });
});
