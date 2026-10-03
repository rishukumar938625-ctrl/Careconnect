import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar } from 'lucide-react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Button } from '../components/ui/Button';
import { AppointmentCard } from '../components/appointments/AppointmentCards';
import { EmptyState } from '../components/ui/StateComponents';
import { mockAppointments } from '../data/mockDoctorData';
import { CalendarDays } from 'lucide-react';

export const Appointments: React.FC = () => {
  const navigate = useNavigate();

  const upcoming = mockAppointments.filter((a) => a.status === 'upcoming');
  const past = mockAppointments.filter((a) => a.status !== 'upcoming');

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
            {upcoming.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onViewDetails={(id) => navigate(`/appointments/${id}`)}
                onReschedule={() => navigate('/appointments/book')}
                onCancel={() => {}}
              />
            ))}
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
            Past appointments
          </h2>
          <div className="flex flex-col gap-3">
            {past.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* Browse doctors */}
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
    </PageContainer>
  );
};

export default Appointments;
