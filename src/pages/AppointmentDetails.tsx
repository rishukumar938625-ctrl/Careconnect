import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Video, MapPin, Calendar, Clock } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DoctorAvatar } from '../components/appointments/AppointmentCards';
import { mockAppointments } from '../data/mockDoctorData';
import { EmptyState } from '../components/ui/StateComponents';
import { getRelativeDate, formatTime } from '../utils';

export const AppointmentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const appointment = mockAppointments.find((a) => a.id === id);

  if (!appointment) {
    return (
      <PageContainer>
        <EmptyState
          title="Appointment not found"
          description="This appointment could not be found."
          action={{ label: 'Back to appointments', onClick: () => navigate('/appointments') }}
        />
      </PageContainer>
    );
  }

  const relativeDate = getRelativeDate(appointment.date);
  const formattedTime = formatTime(appointment.time);

  return (
    <PageContainer>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        aria-label="Go back"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-text-primary mb-5">
        Appointment Details
      </h1>

      {/* Doctor info */}
      <Card className="flex items-center gap-4 mb-4">
        <DoctorAvatar
          initials={appointment.doctor.avatarInitials}
          color={appointment.doctor.avatarColor}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-text-primary">
            {appointment.doctor.name}
          </h2>
          <p className="text-sm text-text-secondary">
            {appointment.doctor.specialty}
          </p>
          <p className="text-xs text-text-muted">
            {appointment.doctor.qualifications}
          </p>
        </div>
      </Card>

      {/* Appointment info */}
      <Card className="flex flex-col gap-4 mb-4">
        <h2 className="text-base font-semibold text-text-primary">
          Appointment info
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <InfoItem
            icon={<Calendar className="h-4 w-4" />}
            label="Date"
            value={`${relativeDate}, ${new Date(appointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          />
          <InfoItem
            icon={<Clock className="h-4 w-4" />}
            label="Time"
            value={formattedTime}
          />
          <InfoItem
            icon={
              appointment.type === 'video' ? (
                <Video className="h-4 w-4" />
              ) : (
                <MapPin className="h-4 w-4" />
              )
            }
            label="Type"
            value={
              appointment.type === 'video'
                ? 'Video Consultation'
                : 'In-Person Visit'
            }
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Status</span>
            <Badge
              variant={
                appointment.status === 'upcoming'
                  ? 'warning'
                  : appointment.status === 'completed'
                  ? 'success'
                  : 'danger'
              }
              dot
            >
              {appointment.status.charAt(0).toUpperCase() +
                appointment.status.slice(1)}
            </Badge>
          </div>
        </div>

        {appointment.reason && (
          <div>
            <p className="text-xs text-text-muted mb-1">Reason</p>
            <p className="text-sm text-text-primary">{appointment.reason}</p>
          </div>
        )}

        {appointment.notes && (
          <div>
            <p className="text-xs text-text-muted mb-1">Notes</p>
            <p className="text-sm text-text-secondary">{appointment.notes}</p>
          </div>
        )}
      </Card>

      {/* Actions */}
      {appointment.status === 'upcoming' && (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={() => navigate('/appointments/book')}
          >
            Reschedule
          </Button>
          <Button
            variant="ghost"
            size="md"
            fullWidth
            className="!text-danger hover:!bg-red-50"
          >
            Cancel appointment
          </Button>
        </div>
      )}
    </PageContainer>
  );
};

const InfoItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="flex flex-col gap-1">
    <p className="text-xs text-text-muted">{label}</p>
    <p className="text-sm font-medium text-text-primary flex items-center gap-1.5">
      <span className="text-text-muted">{icon}</span>
      {value}
    </p>
  </div>
);

export default AppointmentDetails;
