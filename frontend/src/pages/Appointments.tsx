import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, CalendarDays, Loader2, AlertCircle, X } from 'lucide-react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Button } from '../components/ui/Button';
import { AppointmentCard } from '../components/appointments/AppointmentCards';
import { EmptyState } from '../components/ui/StateComponents';
import { appointmentApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Appointment } from '../types';

export const Appointments: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation Modal state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await appointmentApi.getAppointments();
      setAppointments(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load appointments.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCancelConfirm = async () => {
    if (!cancellingId) return;
    try {
      setCancelling(true);
      await appointmentApi.cancelAppointment(cancellingId, cancelReason || undefined);
      setActionMessage({ type: 'success', text: 'Appointment cancelled successfully.' });
      setCancellingId(null);
      setCancelReason('');
      await fetchAppointments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel appointment.';
      setActionMessage({ type: 'error', text: msg });
    } finally {
      setCancelling(false);
    }
  };

  const upcoming = appointments.filter(
    (a) => a.status === 'upcoming' || a.status === 'booked'
  );
  const past = appointments.filter(
    (a) => a.status !== 'upcoming' && a.status !== 'booked'
  );

  return (
    <PageContainer>
      <PageHeader
        title="Appointments"
        subtitle="Manage your healthcare appointments."
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/appointments/book')}
            aria-label="Book a new appointment"
          >
            Book
          </Button>
        }
      />

      {/* Action feedback message */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between gap-2 p-3.5 mb-4 rounded-xl text-xs font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-text-muted hover:text-text-primary"
            aria-label="Dismiss message"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Book appointment CTA */}
      <button
        onClick={() => navigate('/appointments/book')}
        className={[
          'flex items-center gap-4 w-full p-4 rounded-2xl mb-6',
          'bg-gradient-to-r from-primary-600 to-secondary-500 text-white',
          'hover:opacity-95 active:scale-[0.99] transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        ].join(' ')}
        aria-label="Book an appointment"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 flex-shrink-0">
          <Calendar className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold">Book an appointment</p>
          <p className="text-xs opacity-80 mt-0.5">
            Find a doctor and schedule your visit
          </p>
        </div>
      </button>

      {/* Unauthenticated State */}
      {!isAuthenticated && (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl bg-slate-50 border border-slate-200 mb-6">
          <CalendarDays className="h-10 w-10 text-primary-500 mb-2" />
          <h3 className="text-sm font-semibold text-text-primary">Sign in to view your appointments</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-xs mb-4">
            Sign in to access your upcoming visits, consult doctors, and manage bookings.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isAuthenticated && loading && (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          <p className="text-xs">Loading appointments…</p>
        </div>
      )}

      {/* Error state */}
      {isAuthenticated && !loading && error && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-danger" />
          <p className="text-sm text-text-primary font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAppointments}>
            Retry
          </Button>
        </div>
      )}

      {/* Appointments Lists */}
      {isAuthenticated && !loading && !error && (
        <>
          {/* Upcoming appointments */}
          <section aria-labelledby="upcoming-appointments-heading" className="mb-6">
            <h2
              id="upcoming-appointments-heading"
              className="text-base font-semibold text-text-primary mb-3"
            >
              Upcoming ({upcoming.length})
            </h2>

            {upcoming.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-8 w-8" />}
                title="No upcoming appointments"
                description="Book an appointment with one of our healthcare providers."
                action={{
                  label: 'Book appointment',
                  onClick: () => navigate('/appointments/book'),
                }}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.map((appointment) => {
                  const apptId = appointment.id || (appointment._id as string);
                  return (
                    <AppointmentCard
                      key={apptId}
                      appointment={appointment}
                      onViewDetails={(id) => navigate(`/appointments/${id}`)}
                      onReschedule={(id) => navigate(`/appointments/book?rescheduleId=${id}`)}
                      onCancel={(id) => setCancellingId(id)}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Past appointments */}
          {past.length > 0 && (
            <section aria-labelledby="past-appointments-heading">
              <h2
                id="past-appointments-heading"
                className="text-base font-semibold text-text-primary mb-3"
              >
                Past appointments ({past.length})
              </h2>
              <div className="flex flex-col gap-3">
                {past.map((appointment) => {
                  const apptId = appointment.id || (appointment._id as string);
                  return (
                    <AppointmentCard
                      key={apptId}
                      appointment={appointment}
                      compact
                      onViewDetails={(id) => navigate(`/appointments/${id}`)}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* Browse doctors button */}
      <Button
        variant="outline"
        size="md"
        fullWidth
        leftIcon={<CalendarDays className="h-5 w-5" />}
        onClick={() => navigate('/appointments/doctors')}
        className="mt-6"
        aria-label="Browse all doctors"
      >
        Browse doctors
      </Button>

      {/* Cancellation Confirmation Modal */}
      {cancellingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl">
            <h3 id="cancel-modal-title" className="text-base font-bold text-text-primary mb-2">
              Cancel Appointment
            </h3>
            <p className="text-xs text-text-secondary mb-3">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </p>

            <div className="mb-4">
              <label htmlFor="cancel-reason-input" className="block text-xs font-medium text-text-primary mb-1">
                Reason for cancellation (optional, max 250 characters)
              </label>
              <textarea
                id="cancel-reason-input"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value.slice(0, 250))}
                rows={2}
                placeholder="e.g., Schedule conflict, feeling better…"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-[10px] text-text-muted text-right mt-0.5">
                {cancelReason.length}/250
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                disabled={cancelling}
                onClick={() => {
                  setCancellingId(null);
                  setCancelReason('');
                }}
              >
                Keep Appointment
              </Button>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                disabled={cancelling}
                onClick={handleCancelConfirm}
                className="!bg-danger hover:!bg-red-700 text-white"
              >
                {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default Appointments;
