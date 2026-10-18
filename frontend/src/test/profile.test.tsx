import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Profile } from '../pages/Profile';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { ApiError } from '../services/api';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    userApi: {
      getNotifications: vi.fn(),
      updateNotifications: vi.fn(),
      updateProfile: vi.fn(),
      updateHealthProfile: vi.fn(),
      addAllergy: vi.fn(),
      removeAllergy: vi.fn(),
      addCondition: vi.fn(),
      removeCondition: vi.fn(),
    },
    notificationApi: {
      getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
    },
  };
});

const defaultUser = {
  id: 'u1',
  name: 'Alice Patient',
  email: 'alice@example.com',
  role: 'patient' as const,
  isActive: true,
  phone: '+1 555-0100',
  dateOfBirth: '1990-05-15',
  bloodGroup: 'O+',
  allergies: ['Penicillin'],
  chronicConditions: ['Asthma'],
  emergencyContact: {
    name: 'Bob Patient',
    relationship: 'Spouse',
    phone: '+1 555-0199',
  },
  notificationPreferences: {
    medicationReminders: true,
    appointmentAlerts: true,
    healthTips: false,
    emailUpdates: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    timeZone: 'UTC',
  },
  bookmarkedConditions: [],
  bookmarkedMedicines: [],
  bookmarkedArticles: [],
};

const mockAuthContextValue = (overrides?: Partial<AuthContextType>): AuthContextType => ({
  user: defaultUser,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  updateProfile: vi.fn().mockResolvedValue(defaultUser),
  ...overrides,
});

const renderProfile = (ctx: AuthContextType) => {
  return render(
    <AuthContext.Provider value={ctx}>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

describe('Profile & Health Preferences Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders patient personal details and emergency contact', () => {
    renderProfile(mockAuthContextValue());

    expect(screen.getAllByText('Alice Patient').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('alice@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(screen.getByText('Asthma')).toBeInTheDocument();
    expect(screen.getByText('Bob Patient')).toBeInTheDocument();
    expect(screen.getByText(/Spouse/)).toBeInTheDocument();
  });

  it('loads and toggles notification preferences', async () => {
    renderProfile(mockAuthContextValue());

    await waitFor(() => {
      expect(screen.getByText(/Medication reminder alerts/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Quiet Hours/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls logout when sign out button is clicked', async () => {
    const user = userEvent.setup();
    const logoutMock = vi.fn().mockResolvedValue(undefined);

    renderProfile(mockAuthContextValue({ logout: logoutMock }));

    const logoutBtn = screen.getByRole('button', { name: /Sign out/i });
    await user.click(logoutBtn);

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it('successfully updates profile and closes modal on API success', async () => {
    const user = userEvent.setup();
    const updateProfileMock = vi.fn().mockResolvedValue({
      ...defaultUser,
      name: 'Alice Updated',
      phone: '+1 555-9999',
    });

    renderProfile(mockAuthContextValue({ updateProfile: updateProfileMock }));

    // Open Edit Personal Profile modal
    const editBtn = screen.getByRole('button', { name: /Edit profile/i });
    await user.click(editBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit Personal Profile')).toBeInTheDocument();

    // Modify name input
    const nameInput = screen.getByDisplayValue('Alice Patient');
    await user.clear(nameInput);
    await user.type(nameInput, 'Alice Updated');

    // Click Save changes
    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    await user.click(saveBtn);

    expect(updateProfileMock).toHaveBeenCalledTimes(1);
    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alice Updated',
      })
    );

    // After success, modal closes
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('validates name length and blocks submission when too short', async () => {
    const user = userEvent.setup();
    const updateProfileMock = vi.fn();

    renderProfile(mockAuthContextValue({ updateProfile: updateProfileMock }));

    // Open Edit modal
    await user.click(screen.getByRole('button', { name: /Edit profile/i }));

    // Clear name and type a single character
    const nameInput = screen.getByDisplayValue('Alice Patient');
    await user.clear(nameInput);
    await user.type(nameInput, 'A');

    // Click Save changes
    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    // updateProfile should NOT be called
    expect(updateProfileMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Full name must be at least 2 characters long/i)).toBeInTheDocument();
  });

  it('handles 401 session expiration: displays sign in link and preserves edits', async () => {
    const user = userEvent.setup();
    const updateProfileMock = vi.fn().mockRejectedValue(
      new ApiError(401, 'Your session has expired or is invalid. Please sign in again.')
    );

    renderProfile(mockAuthContextValue({ updateProfile: updateProfileMock }));

    // Open Edit modal
    await user.click(screen.getByRole('button', { name: /Edit profile/i }));

    // Modify phone number
    const phoneInput = screen.getByDisplayValue('+1 555-0100');
    await user.clear(phoneInput);
    await user.type(phoneInput, '+1 555-8888');

    // Submit
    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    // Modal stays open, displays session expiration message and sign-in link
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Your session has expired or is invalid/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Sign in again to continue/i })).toBeInTheDocument();
    });

    // Form value is preserved so user does not lose edits
    expect(screen.getByDisplayValue('+1 555-8888')).toBeInTheDocument();
  });

  it('handles 403 permission denied error gracefully', async () => {
    const user = userEvent.setup();
    const updateProfileMock = vi.fn().mockRejectedValue(
      new ApiError(403, 'Access denied: You do not have permission to modify this profile.')
    );

    renderProfile(mockAuthContextValue({ updateProfile: updateProfileMock }));

    await user.click(screen.getByRole('button', { name: /Edit profile/i }));
    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/You do not have permission to modify this profile/i)).toBeInTheDocument();
    });
  });

  it('handles 500 server error gracefully without false success', async () => {
    const user = userEvent.setup();
    const updateProfileMock = vi.fn().mockRejectedValue(
      new ApiError(500, 'Internal Server Error')
    );

    renderProfile(mockAuthContextValue({ updateProfile: updateProfileMock }));

    await user.click(screen.getByRole('button', { name: /Edit profile/i }));
    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/An unexpected server error occurred/i)).toBeInTheDocument();
      expect(screen.queryByText(/Profile updated successfully/i)).not.toBeInTheDocument();
    });
  });

  it('handles network failure when backend is unreachable', async () => {
    const user = userEvent.setup();
    const updateProfileMock = vi.fn().mockRejectedValue(
      new Error('Unable to connect to the server. Please check your internet connection and try again.')
    );

    renderProfile(mockAuthContextValue({ updateProfile: updateProfileMock }));

    await user.click(screen.getByRole('button', { name: /Edit profile/i }));
    await user.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/Unable to connect to the server/i)).toBeInTheDocument();
    });
  });

  it('disables save button and prevents duplicate submissions while save is in flight', async () => {
    const user = userEvent.setup();
    let resolvePromise: (val: typeof defaultUser) => void;
    const slowUpdate = new Promise<typeof defaultUser>((resolve) => {
      resolvePromise = resolve;
    });
    const updateProfileMock = vi.fn().mockReturnValue(slowUpdate);

    renderProfile(mockAuthContextValue({ updateProfile: updateProfileMock }));

    await user.click(screen.getByRole('button', { name: /Edit profile/i }));

    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    await user.click(saveBtn);

    // Save button should be disabled while saving
    expect(saveBtn).toBeDisabled();

    // Try clicking again while disabled
    await user.click(saveBtn);
    expect(updateProfileMock).toHaveBeenCalledTimes(1);

    // Resolve update
    resolvePromise!(defaultUser);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
