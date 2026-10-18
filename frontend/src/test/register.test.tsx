/**
 * Registration flow regression tests — Phase 10 fix
 *
 * Covers:
 * 1.  Successful registration with valid input
 * 2.  Duplicate email (409)
 * 3.  Invalid / short password validation
 * 4.  Backend unavailable / network failure
 * 5.  Rate limit (429)
 * 6.  Server error (500)
 * 7.  Malformed / non-JSON API response
 * 8.  Repeated click while submission is pending (button disabled)
 * 9.  Mismatched confirm-password field
 * 10. Short name validation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Register } from '../pages/Register';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { ApiError } from '../services/api';

// ── helpers ──────────────────────────────────────────────────────────────────

const mockAuthCtx = (overrides?: Partial<AuthContextType>): AuthContextType => ({
  user: null,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  updateProfile: vi.fn(),
  ...overrides,
});

const renderRegister = (ctx: AuthContextType) =>
  render(
    <AuthContext.Provider value={ctx}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

/**
 * Fill the register form and click Submit.
 * Uses element IDs directly for password fields because the Input component
 * renders labels with an appended required-asterisk <span>, which can confuse
 * getByLabelText when two similar labels ("Password" / "Confirm password") are
 * on the same page.
 */
const fillAndSubmit = async (
  user: ReturnType<typeof userEvent.setup>,
  opts: {
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
  } = {}
) => {
  const {
    name = 'Alice Patient',
    email = 'alice@example.com',
    password = 'SecurePass123!',
    confirm = 'SecurePass123!',
  } = opts;

  if (name) await user.type(screen.getByLabelText(/Full name/i), name);
  if (email) await user.type(screen.getByLabelText(/Email address/i), email);

  // Target by id to avoid ambiguity between "Password" and "Confirm password" labels
  if (password) {
    await user.type(
      document.getElementById('register-password') as HTMLInputElement,
      password
    );
  }
  if (confirm) {
    await user.type(
      document.getElementById('register-confirm-password') as HTMLInputElement,
      confirm
    );
  }

  await user.click(screen.getByRole('button', { name: /Create account/i }));
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Register page — registration flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });


  // 1. Successful registration
  it('navigates to /dashboard on successful registration', async () => {
    const user = userEvent.setup();
    const ctx = mockAuthCtx({ register: vi.fn().mockResolvedValue(undefined) });
    renderRegister(ctx);

    await fillAndSubmit(user);

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(ctx.register).toHaveBeenCalledWith({
      name: 'Alice Patient',
      email: 'alice@example.com',
      password: 'SecurePass123!',
    });
  });

  // 2. Duplicate email → 409
  it('shows duplicate-email message when API returns 409', async () => {
    const user = userEvent.setup();
    const ctx = mockAuthCtx({
      register: vi.fn().mockRejectedValue(new ApiError(409, 'Email already in use.')),
    });
    renderRegister(ctx);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i)
    );
    // Must stay on register page
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  // 3. Short password validation (client-side — never calls API)
  it('blocks submission and shows password validation error for short password', async () => {
    const user = userEvent.setup();
    const ctx = mockAuthCtx();
    renderRegister(ctx);

    await fillAndSubmit(user, { password: 'short', confirm: 'short' });

    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    expect(ctx.register).not.toHaveBeenCalled();
  });

  // 4. Backend unavailable / network failure
  it('shows a friendly message when the server is unreachable', async () => {
    const user = userEvent.setup();
    const ctx = mockAuthCtx({
      register: vi.fn().mockRejectedValue(
        new Error('Unable to connect to the server. Please check your internet connection and try again.')
      ),
    });
    renderRegister(ctx);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Unable to connect to the server/i)
    );
  });

  // 5. Rate limit → 429
  it('shows rate-limit message when API returns 429', async () => {
    const user = userEvent.setup();
    const ctx = mockAuthCtx({
      register: vi.fn().mockRejectedValue(new ApiError(429, 'Too many requests.')),
    });
    renderRegister(ctx);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Too many registration attempts/i)
    );
  });

  // 6. Server error → 500
  it('shows a server-error message when API returns 500', async () => {
    const user = userEvent.setup();
    const ctx = mockAuthCtx({
      register: vi.fn().mockRejectedValue(new ApiError(500, 'Internal Server Error')),
    });
    renderRegister(ctx);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/server encountered an error/i)
    );
  });

  // 7. Malformed / non-JSON API response falls through without crashing
  it('shows a generic error when a non-JSON response is received', async () => {
    const user = userEvent.setup();
    const ctx = mockAuthCtx({
      register: vi.fn().mockRejectedValue(new Error('Request failed with status 502')),
    });
    renderRegister(ctx);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Request failed with status 502/i)
    );
  });

  // 8. Repeated clicks — button must be disabled while submitting
  it('disables the submit button while submission is pending', async () => {
    const user = userEvent.setup();
    let resolveRegister!: () => void;
    const pendingPromise = new Promise<void>((res) => {
      resolveRegister = res;
    });
    const ctx = mockAuthCtx({ register: vi.fn().mockReturnValue(pendingPromise) });
    renderRegister(ctx);

    await user.type(screen.getByLabelText(/Full name/i), 'Alice Patient');
    await user.type(screen.getByLabelText(/Email address/i), 'alice@example.com');
    await user.type(
      document.getElementById('register-password') as HTMLInputElement,
      'SecurePass123!'
    );
    await user.type(
      document.getElementById('register-confirm-password') as HTMLInputElement,
      'SecurePass123!'
    );

    const btn = screen.getByRole('button', { name: /Create account/i });
    await user.click(btn);

    // Button should be disabled while the promise is pending
    expect(btn).toBeDisabled();
    expect(ctx.register).toHaveBeenCalledTimes(1);

    // Clean up
    resolveRegister();
  });

  // 9. Confirm password mismatch
  it('blocks submission and shows mismatch error when passwords differ', async () => {
    const user = userEvent.setup();
    const ctx = mockAuthCtx();
    renderRegister(ctx);

    await fillAndSubmit(user, { password: 'SecurePass123!', confirm: 'Different456!' });

    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i);
    expect(ctx.register).not.toHaveBeenCalled();
  });

  // 10. Short name validation
  it('blocks submission when name is too short', async () => {
    const user = userEvent.setup();
    const ctx = mockAuthCtx();
    renderRegister(ctx);

    // Only type name — validation fires before API is reached
    await user.type(screen.getByLabelText(/Full name/i), 'A');
    await user.click(screen.getByRole('button', { name: /Create account/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/at least 2 characters/i);
    expect(ctx.register).not.toHaveBeenCalled();
  });
});
