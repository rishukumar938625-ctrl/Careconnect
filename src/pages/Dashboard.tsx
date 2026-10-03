import React from 'react';
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
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MedicationCard } from '../components/medications/MedicationCards';
import { AppointmentCard } from '../components/appointments/AppointmentCards';
import { mockMedications, getTodaySchedule } from '../data/mockMedicationData';
import { mockAppointments } from '../data/mockDoctorData';
import { getTimeGreeting } from '../utils';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const greeting = getTimeGreeting();
  const todaySchedule = getTodaySchedule();
  const upcomingAppointment = mockAppointments.find(
    (a) => a.status === 'upcoming',
  );

  // Stats derived from mock data
  const medicinesCount = todaySchedule.filter(
    (i) => i.scheduleEntry.status === 'upcoming',
  ).length;
  const appointmentsCount = mockAppointments.filter(
    (a) => a.status === 'upcoming',
  ).length;
  const savedCount = 4; // mock value

  return (
    <PageContainer>
      {/* ── Page Header ── */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {greeting}! 👋
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Stay on top of your health today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-card hover:shadow-card-hover transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Notifications"
            onClick={() => {}}
          >
            <Bell className="h-5 w-5 text-text-secondary" aria-hidden="true" />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full"
              aria-label="Unread notifications"
            />
          </button>
          <button
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-600 shadow-card hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Profile"
            onClick={() => navigate('/profile')}
          >
            <span className="text-sm font-bold text-white">AM</span>
          </button>
        </div>
      </header>

      {/* ── Health Overview Stats ── */}
      <section aria-labelledby="health-overview-heading">
        <Card className="bg-gradient-to-br from-primary-600 to-primary-700 text-white mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 id="health-overview-heading" className="text-base font-semibold opacity-90">
                Your Health Overview
              </h2>
              <p className="text-xs opacity-70 mt-0.5">Today's snapshot</p>
            </div>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <StatItem
              value={String(medicinesCount)}
              label="Medicines today"
              icon={<Pill className="h-4 w-4" />}
            />
            <StatItem
              value={String(appointmentsCount)}
              label="Upcoming appts"
              icon={<Calendar className="h-4 w-4" />}
            />
            <StatItem
              value={String(savedCount)}
              label="Saved articles"
              icon={<BookOpen className="h-4 w-4" />}
            />
          </div>
        </Card>
      </section>

      {/* ── Today's Medications ── */}
      <section className="mb-4" aria-labelledby="todays-meds-heading">
        <Card>
          <CardHeader
            title="Today's Medications"
            subtitle="Sample schedule"
            action={
              <button
                className="text-xs font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                onClick={() => navigate('/medications')}
                aria-label="View all medications"
              >
                View all
              </button>
            }
          />
          <div className="flex flex-col gap-2">
            {mockMedications.slice(0, 2).map((med) => {
              const scheduleEntry = med.todaySchedule?.[0];
              return (
                <MedicationCard
                  key={med.id}
                  medication={med}
                  time={scheduleEntry?.time}
                  status={scheduleEntry?.status ?? 'upcoming'}
                  compact
                />
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            rightIcon={<ChevronRight className="h-4 w-4" />}
            onClick={() => navigate('/medications')}
            className="mt-3"
          >
            View full schedule
          </Button>
        </Card>
      </section>

      {/* ── Upcoming Appointment ── */}
      {upcomingAppointment && (
        <section className="mb-4" aria-labelledby="upcoming-apt-heading">
          <div className="flex items-center justify-between mb-2">
            <h2
              id="upcoming-apt-heading"
              className="text-base font-semibold text-text-primary"
            >
              Upcoming Appointment
            </h2>
            <button
              className="text-xs font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              onClick={() => navigate('/appointments')}
              aria-label="View all appointments"
            >
              View all
            </button>
          </div>
          <AppointmentCard appointment={upcomingAppointment} compact />
        </section>
      )}

      {/* ── Quick Actions ── */}
      <section aria-labelledby="quick-actions-heading">
        <h2
          id="quick-actions-heading"
          className="text-base font-semibold text-text-primary mb-3"
        >
          Quick Actions
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction
            icon={<Search className="h-5 w-5 text-primary-600" />}
            label="Health Info"
            onClick={() => navigate('/health')}
            bgClass="bg-primary-50"
            id="qa-health-info"
          />
          <QuickAction
            icon={<Plus className="h-5 w-5 text-secondary-600" />}
            label="Add Medication"
            onClick={() => navigate('/medications/add')}
            bgClass="bg-secondary-50"
            id="qa-add-medication"
          />
          <QuickAction
            icon={<Calendar className="h-5 w-5 text-purple-600" />}
            label="Book Appt"
            onClick={() => navigate('/appointments/book')}
            bgClass="bg-purple-50"
            id="qa-book-appointment"
          />
        </div>
      </section>

      {/* ── Medical disclaimer ── */}
      <p className="text-[11px] text-text-muted text-center mt-8 px-4 leading-relaxed">
        CareConnect provides general educational information and is not a
        substitute for professional medical advice, diagnosis, or treatment.
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
    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 mb-1">
      {icon}
    </div>
    <span className="text-2xl font-bold">{value}</span>
    <span className="text-[10px] opacity-75 leading-tight">{label}</span>
  </div>
);

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  bgClass: string;
  id: string;
}

const QuickAction: React.FC<QuickActionProps> = ({
  icon,
  label,
  onClick,
  bgClass,
  id,
}) => (
  <button
    id={id}
    onClick={onClick}
    className={[
      'flex flex-col items-center justify-center gap-2 p-4 rounded-2xl',
      bgClass,
      'hover:brightness-95 active:scale-95 transition-all duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
    ].join(' ')}
    aria-label={label}
  >
    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-sm">
      {icon}
    </div>
    <span className="text-xs font-semibold text-text-primary text-center leading-tight">
      {label}
    </span>
  </button>
);

export default Dashboard;
