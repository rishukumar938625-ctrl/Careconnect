import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AuthContext, AuthContextType } from '../context/AuthContext';

vi.mock('../services/api');

const mockAuthContextValue = (overrides?: Partial<AuthContextType>): AuthContextType => ({
  user: null,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  updateProfile: vi.fn(),
  ...overrides,
});

describe('Authentication & Protected Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form with accessible inputs and labels', () => {
    const authContext = mockAuthContextValue();

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByRole('heading', { name: /Welcome back to CareConnect/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('validates empty inputs and prevents login submission', async () => {
    const user = userEvent.setup();
    const authContext = mockAuthContextValue();

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await user.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Please enter your email address/i);
    expect(authContext.login).not.toHaveBeenCalled();
  });

  it('displays error alert when login credentials are invalid', async () => {
    const user = userEvent.setup();
    const authContext = mockAuthContextValue({
      login: vi.fn().mockRejectedValue(new Error('Invalid email or password.')),
    });

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await user.type(screen.getByLabelText(/Email address/i), 'patient@example.com');
    await user.type(screen.getByLabelText(/Password/i), 'WrongPass123!');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid email or password/i);
    });
  });

  it('submits login with valid credentials', async () => {
    const user = userEvent.setup();
    const authContext = mockAuthContextValue({
      login: vi.fn().mockResolvedValue({
        id: 'u1',
        name: 'Alice Patient',
        email: 'alice@example.com',
        role: 'patient',
        isActive: true,
      }),
    });

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<div>Dashboard Home</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await user.type(screen.getByLabelText(/Email address/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/Password/i), 'SecurePass123!');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    await waitFor(() => {
      expect(authContext.login).toHaveBeenCalledWith({
        email: 'alice@example.com',
        password: 'SecurePass123!',
      });
    });
  });

  it('renders registration form and enforces required validation', async () => {
    const user = userEvent.setup();
    const authContext = mockAuthContextValue();

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={['/register']}>
          <Register />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByRole('heading', { name: /Create your CareConnect account/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Create account/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Please enter your full name/i);
  });

  it('ProtectedRoute redirects unauthenticated visitors to /login', () => {
    const authContext = mockAuthContextValue({ user: null, isLoading: false });

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={['/medications']}>
          <Routes>
            <Route
              path="/medications"
              element={
                <ProtectedRoute>
                  <div>Secret Meds</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret Meds')).not.toBeInTheDocument();
  });

  it('ProtectedRoute renders protected content for authenticated users', () => {
    const authContext = mockAuthContextValue({
      isLoading: false,
      user: {
        id: 'u1',
        name: 'Alice Patient',
        email: 'alice@example.com',
        role: 'patient',
        isActive: true,
      },
    });

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={['/medications']}>
          <Routes>
            <Route
              path="/medications"
              element={
                <ProtectedRoute>
                  <div>Secret Meds Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Secret Meds Content')).toBeInTheDocument();
  });
});
