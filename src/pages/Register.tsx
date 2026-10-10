import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Cross, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please check your information and try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Brand logo & header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-600 shadow-md shadow-primary-500/20 mb-3">
            <Cross className="h-6 w-6 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Create your Care<span className="text-primary-600">Connect</span> account
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Track your personal health, medications, and clinical appointments securely.
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
              label="Full name"
              id="register-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              leftAddon={<User className="h-4 w-4" aria-hidden="true" />}
              disabled={isSubmitting}
            />

            <Input
              label="Email address"
              id="register-email"
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
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              helpText="Must be at least 8 characters"
              leftAddon={<Lock className="h-4 w-4" aria-hidden="true" />}
              disabled={isSubmitting}
            />

            <Input
              label="Confirm password"
              id="register-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
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
                Create account
              </Button>
            </div>
          </form>

          {/* Privacy feature notice */}
          <div className="mt-5 space-y-2 text-xs text-text-muted bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-emerald-700 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span>Default patient role with strict credential isolation</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-700 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span>Encrypted password storage & HttpOnly secure cookies</span>
            </div>
          </div>

          {/* Login link */}
          <div className="mt-6 text-center text-sm text-text-muted border-t border-slate-100 pt-5">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              Sign in
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted leading-relaxed">
          By signing up, you acknowledge that CareConnect provides educational health information and is not a substitute for clinical care.
        </p>
      </div>
    </div>
  );
};

export default Register;
