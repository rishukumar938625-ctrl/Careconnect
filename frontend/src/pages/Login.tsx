import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Cross, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Safe redirect destination
  const fromState = (location.state as { from?: string } | null)?.from;
  const targetDestination =
    fromState && fromState.startsWith('/') && !fromState.startsWith('//')
      ? fromState
      : '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
      navigate(targetDestination, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Brand logo & title */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-600 shadow-md shadow-primary-500/20 mb-3">
            <Cross className="h-6 w-6 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Welcome back to Care<span className="text-primary-600">Connect</span>
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Sign in to manage your medications, appointments, and health record.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-100 rounded-2xl">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm"
            >
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-danger mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email address"
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              leftAddon={<Mail className="h-4 w-4" aria-hidden="true" />}
              disabled={isSubmitting}
            />

            <Input
              label="Password"
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftAddon={<Lock className="h-4 w-4" aria-hidden="true" />}
              disabled={isSubmitting}
            />

            <div className="pt-2">
              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={isSubmitting}
                disabled={isSubmitting}
                rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              >
                Sign in
              </Button>
            </div>
          </form>

          {/* Registration link */}
          <div className="mt-6 text-center text-sm text-text-muted border-t border-slate-100 pt-5">
            Don't have an account yet?{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              Create account
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted leading-relaxed">
          CareConnect uses encrypted, HttpOnly sessions to protect your personal health information.
        </p>
      </div>
    </div>
  );
};

export default Login;
