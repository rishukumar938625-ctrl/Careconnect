import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  Calendar,
  Plus,
  ChevronRight,
  Pill,
  TrendingUp,
  BookOpen,
  Stethoscope,
  RefreshCw,
  AlertCircle,
  Heart,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MedicationCard } from '../components/medications/MedicationCards';
import { AppointmentCard } from '../components/appointments/AppointmentCards';
import { getTimeGreeting, getInitials } from '../utils';
import { useAuth } from '../context/AuthContext';
import { doseApi, appointmentApi } from '../services/api';
import type { DoseRecord, Medication, Appointment } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const greeting = getTimeGreeting();

  // Medication Doses State
  const [todayDoses, setTodayDoses] = useState<DoseRecord[]>([]);
  const [dosesLoading, setDosesLoading] = useState(true);
  const [dosesError, setDosesError] = useState<string | null>(null);

  // Appointments State
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [apptsLoading, setApptsLoading] = useState(true);
  const [apptsError, setApptsError] = useState<string | null>(null);

  // Fetch today's doses
  const fetchDoses = useCallback(async () => {
    if (!user) {
      setTodayDoses([]);
      setDosesLoading(false);
      return;
    }

    setDosesLoading(true);
    setDosesError(null);

    try {
      const doses = await doseApi.getTodayDoses();
      setTodayDoses(doses);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load today’s medication schedule.';
      setDosesError(message);
    } finally {
      setDosesLoading(false);
    }
  }, [user]);

  // Fetch upcoming appointments
  const fetchAppointments = useCallback(async () => {
    if (!user) {
      setUpcomingAppointments([]);
      setApptsLoading(false);
      return;
    }

    setApptsLoading(true);
    setApptsError(null);

    try {
      const appts = await appointmentApi.getAppointments('upcoming');
      // Guarantee cancelled appointments are strictly excluded
      const activeUpcoming = (appts || []).filter(
        (a) => a.status === 'booked' || a.status === 'upcoming' || a.status === 'rescheduled'
      );
      setUpcomingAppointments(activeUpcoming);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to load upcoming appointments.';
      setApptsError(message);
    } finally {
      setApptsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (!cancelled && user) {
        await Promise.all([fetchDoses(), fetchAppointments()]);
      } else if (!user) {
        setDosesLoading(false);
        setApptsLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [user, fetchDoses, fetchAppointments]);

  // Handle marking a dose as taken directly from the dashboard
  const handleTakeDose = async (_medicationId: string, doseId?: string) => {
    if (!doseId) return;

    try {
      const updated = await doseApi.updateStatus(doseId, 'taken');
      setTodayDoses((prev) =>
        prev.map((d) => (d.id === doseId || d._id === doseId ? { ...d, status: updated.status, takenAt: updated.takenAt } : d))
      );
    } catch (err) {
      // Re-fetch to sync with backend on failure
      fetchDoses();
    }
  };

  const pendingDoses = todayDoses.filter((d) => d.status === 'pending' || d.status === 'snoozed');
  const takenDoses = todayDoses.filter((d) => d.status === 'taken');
  const userInitials = user ? getInitials(user.name) : '?';
  const savedCount =
    (user?.bookmarkedConditions?.length ?? 0) +
    (user?.bookmarkedMedicines?.length ?? 0) +
    (user?.bookmarkedArticles?.length ?? 0);

  const nextAppointment = upcomingAppointments[0] || null;
  const subsequentAppointments = upcomingAppointments.slice(1, 3);

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  return (
    <PageContainer>
      {/* Page Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {greeting}{user ? `, ${user.name.split(' ')[0]}` : ''}! 👋
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {todayFormatted} · Stay on top of your health today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-card hover:shadow-card-hover transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Medication reminders"
            onClick={() => navigate('/medications')}
          >
            <Bell className="h-5 w-5 text-text-secondary" aria-hidden="true" />
            {pendingDoses.length > 0 && (
              <span
                className="absolute top-1.5 right-1.5 flex h-2 w-2 items-center justify-center"
                aria-label={`${pendingDoses.length} pending doses`}
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
              </span>
            )}
          </button>
          <button
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 shadow-card hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Profile and Settings"
            onClick={() => navigate('/profile')}
          >
            <span className="text-sm font-bold text-white">{userInitials}</span>
          </button>
        </div>
      </header>

      {/* Health Overview Stats Banner */}
      <section aria-labelledby="health-overview-heading" className="mb-5">
        <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-md shadow-primary-700/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 id="health-overview-heading" className="text-base font-semibold opacity-95">
                Your Health Snapshot
              </h2>
              <p className="text-xs opacity-75 mt-0.5">Real-time daily tracker</p>
            </div>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatItem
              value={!user ? '–' : dosesLoading ? '…' : `${pendingDoses.length}`}
              label={dosesLoading ? 'Loading' : `${pendingDoses.length === 1 ? 'dose' : 'doses'} due`}
              icon={<Pill className="h-4 w-4" />}
            />
            <StatItem
              value={!user ? '–' : apptsLoading ? '…' : String(upcomingAppointments.length)}
              label="Upcoming appts"
              icon={<Calendar className="h-4 w-4" />}
            />
            <StatItem
              value={!user ? '–' : String(savedCount)}
              label="Saved items"
              icon={<BookOpen className="h-4 w-4" />}
            />
          </div>
        </Card>
      </section>

      {/* Today's Medications Section */}
      <section className="mb-5" aria-labelledby="todays-meds-heading">
        <Card>
          <CardHeader
            title="Today's Medications"
            subtitle={
              !user
                ? 'Sign in to view your schedule'
                : dosesLoading
                ? 'Loading doses…'
                : todayDoses.length === 0
                ? 'No doses scheduled for today'
                : `${takenDoses.length} of ${todayDoses.length} doses taken`
            }
            action={
              <button
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded py-1 px-1.5"
                onClick={() => navigate('/medications')}
                aria-label="View all medications"
              >
                View all
              </button>
            }
          />

          {!user ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center my-2">
              <p className="text-sm text-text-muted mb-2">
                Sign in to view your personalized daily medication reminders and track dose adherence.
              </p>
              <Button size="sm" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            </div>
          ) : dosesLoading ? (
            <div className="flex flex-col gap-2 my-2">
              <div className="h-14 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : dosesError ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-center my-2">
              <div className="flex items-center justify-center gap-1.5 text-xs text-red-700 mb-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                {dosesError}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDoses}
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Retry
              </Button>
            </div>
          ) : todayDoses.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-text-muted mb-3">No doses scheduled for today.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/medications/add')}
                leftIcon={<Plus className="h-3.5 w-3.5 text-secondary-600" />}
              >
                Add medication
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 my-1">
              {todayDoses.map((dose) => {
                const med = dose.medicationId as Medication;
                const doseId = dose.id || dose._id;
                return (
                  <MedicationCard
                    key={doseId}
                    medication={med}
                    time={dose.scheduledTime}
                    status={dose.status}
                    snoozedUntil={dose.snoozedUntil}
                    doseId={doseId}
                    onMarkTaken={handleTakeDose}
                    compact
                  />
                );
              })}
            </div>
          )}

          {user && todayDoses.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              rightIcon={<ChevronRight className="h-4 w-4" />}
              onClick={() => navigate('/medications')}
              className="mt-2 text-xs"
            >
              Open Full Medication Schedule
            </Button>
          )}
        </Card>
      </section>

      {/* Upcoming Appointments Section */}
      <section className="mb-5" aria-labelledby="upcoming-appointments-heading">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary-600" />
            <h2 id="upcoming-appointments-heading" className="text-base font-semibold text-text-primary">
              Upcoming Consultations
            </h2>
          </div>
          <button
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded py-1 px-1.5"
            onClick={() => navigate('/appointments')}
            aria-label="View all appointments"
          >
            View all ({upcomingAppointments.length})
          </button>
        </div>

        {!user ? (
          <Card className="text-center py-6">
            <p className="text-sm text-text-muted mb-3">
              Sign in to view your scheduled doctor consultations.
            </p>
            <Button size="sm" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          </Card>
        ) : apptsLoading ? (
          <div className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
        ) : apptsError ? (
          <Card className="text-center py-6 border-red-100 bg-red-50/50">
            <div className="flex items-center justify-center gap-1.5 text-xs text-red-700 mb-3 font-medium">
              <AlertCircle className="h-4 w-4" />
              {apptsError}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAppointments}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Retry
            </Button>
          </Card>
        ) : upcomingAppointments.length === 0 ? (
          <Card className="text-center py-6">
            <p className="text-sm text-text-muted mb-3">No upcoming doctor appointments scheduled.</p>
            <Button
              size="sm"
              onClick={() => navigate('/appointments/book')}
              leftIcon={<Calendar className="h-4 w-4" />}
            >
              Book an appointment
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Highlighted Next Appointment */}
            {nextAppointment && (
              <div>
                <span className="text-[11px] font-semibold text-primary-700 uppercase tracking-wider block mb-1.5">
                  Next Appointment
                </span>
                <AppointmentCard appointment={nextAppointment} compact />
              </div>
            )}

            {/* Subsequent Upcoming Appointments */}
            {subsequentAppointments.length > 0 && (
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
                  Later Appointments
                </span>
                <div className="flex flex-col gap-2">
                  {subsequentAppointments.map((appt) => (
                    <AppointmentCard key={appt.id || appt._id} appointment={appt} compact />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Quick Actions Grid */}
      <section aria-labelledby="quick-actions-heading" className="mb-6">
        <h2 id="quick-actions-heading" className="text-base font-semibold text-text-primary mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction
            icon={<Search className="h-5 w-5 text-primary-600" />}
            label="Health Info"
            description="Articles & Conditions"
            onClick={() => navigate('/health')}
            bgClass="bg-primary-50 hover:bg-primary-100/70"
            id="qa-health-info"
          />
          <QuickAction
            icon={<Plus className="h-5 w-5 text-secondary-600" />}
            label="Add Medication"
            description="New reminder dose"
            onClick={() => navigate('/medications/add')}
            bgClass="bg-secondary-50 hover:bg-secondary-100/70"
            id="qa-add-medication"
          />
          <QuickAction
            icon={<Calendar className="h-5 w-5 text-purple-600" />}
            label="Book Appt"
            description="Consult a doctor"
            onClick={() => navigate('/appointments/book')}
            bgClass="bg-purple-50 hover:bg-purple-100/70"
            id="qa-book-appointment"
          />
          <QuickAction
            icon={<Stethoscope className="h-5 w-5 text-emerald-600" />}
            label="Find Doctors"
            description="Specialist directory"
            onClick={() => navigate('/doctors')}
            bgClass="bg-emerald-50 hover:bg-emerald-100/70"
            id="qa-find-doctors"
          />
        </div>
      </section>

      {/* Personal Profile & Health Status Banner */}
      {user && (
        <section aria-label="Personal health profile reminder" className="mb-6">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white shadow-sm text-red-500">
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-text-primary">Personal Health Profile</p>
                <p className="text-[11px] text-text-muted">
                  {user.allergies?.length || 0} allergies · {user.chronicConditions?.length || 0} conditions · Blood: {user.bloodGroup || 'Not set'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/profile')}
              className="text-xs"
            >
              Manage
            </Button>
          </div>
        </section>
      )}

      {/* Medical disclaimer */}
      <p className="text-[11px] text-text-muted text-center px-4 leading-relaxed">
        CareConnect provides general educational information and personal management tools. It is not a substitute for clinical medical evaluation, diagnosis, or emergency healthcare services.
      </p>
    </PageContainer>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatItemProps {
  value: string;
  label: string;
  icon: React.ReactNode;
}

const StatItem: React.FC<StatItemProps> = ({ value, label, icon }) => (
  <div className="flex flex-col items-center text-center gap-1">
    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 mb-1">{icon}</div>
    <span className="text-2xl font-bold tracking-tight">{value}</span>
    <span className="text-[10px] opacity-80 leading-tight">{label}</span>
  </div>
);

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  bgClass: string;
  id: string;
}

const QuickAction: React.FC<QuickActionProps> = ({
  icon,
  label,
  description,
  onClick,
  bgClass,
  id,
}) => (
  <button
    id={id}
    type="button"
    onClick={onClick}
    className={[
      'flex flex-col items-start gap-2 p-3.5 rounded-2xl text-left border border-transparent',
      bgClass,
      'hover:border-slate-200/60 active:scale-[0.98] transition-all duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
    ].join(' ')}
    aria-label={label}
  >
    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white shadow-sm">{icon}</div>
    <div>
      <span className="text-xs font-bold text-text-primary block leading-tight">{label}</span>
      {description && <span className="text-[10px] text-text-muted block mt-0.5">{description}</span>}
    </div>
  </button>
);

export default Dashboard;
