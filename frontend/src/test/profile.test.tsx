import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Profile } from '../pages/Profile';
import { AuthContext, AuthContextType } from '../context/AuthContext';

vi.mock('../services/api', () => ({
  userApi: {
    getNotifications: vi.fn(),
    updateNotifications: vi.fn(),
    updateProfile: vi.fn(),
    updateHealthProfile: vi.fn(),
  },
  notificationApi: {
    getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
  },
}));

const mockAuthContextValue = (overrides?: Partial<AuthContextType>): AuthContextType => ({
  user: {
    id: 'u1',
    name: 'Alice Patient',
    email: 'alice@example.com',
    role: 'patient',
    isActive: true,
    bloodGroup: 'O+',
    allergies: ['Penicillin'],
    chronicConditions: ['Asthma'],
    emergencyContact: {
      name: 'Bob Patient',
      relationship: 'Spouse',
      phone: '+1 555-0199',
    },
  },
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  updateProfile: vi.fn(),
  ...overrides,
});

describe('Profile & Health Preferences Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders patient personal details and emergency contact', () => {
    render(
      <AuthContext.Provider value={mockAuthContextValue()}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getAllByText('Alice Patient').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('alice@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(screen.getByText('Asthma')).toBeInTheDocument();
    expect(screen.getByText('Bob Patient')).toBeInTheDocument();
    expect(screen.getByText(/Spouse/)).toBeInTheDocument();
  });

  it('loads and toggles notification preferences', async () => {
    render(
      <AuthContext.Provider value={mockAuthContextValue()}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Medication reminder alerts/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Quiet Hours/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls logout when sign out button is clicked', async () => {
    const user = userEvent.setup();
    const logoutMock = vi.fn().mockResolvedValue(undefined);

    render(
      <AuthContext.Provider value={mockAuthContextValue({ logout: logoutMock })}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const logoutBtn = screen.getByRole('button', { name: /Sign out/i });
    await user.click(logoutBtn);

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
