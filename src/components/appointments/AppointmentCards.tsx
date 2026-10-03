import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Clock,
  Video,
  MapPin,
  Calendar,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { Doctor, Appointment, AppointmentType, AppointmentStatus } from '../../types';
import { formatTime, getRelativeDate } from '../../utils';

// ─── Doctor Avatar ─────────────────────────────────────────────────────────────

interface DoctorAvatarProps {
  initials: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

export const DoctorAvatar: React.FC<DoctorAvatarProps> = ({
  initials,
  color,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
  };

  return (
    <div
      className={`flex items-center justify-center rounded-2xl font-bold text-white flex-shrink-0 ${sizeClasses[size]}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
};

// ─── Doctor Card ──────────────────────────────────────────────────────────────

interface DoctorCardProps {
  doctor: Doctor;
  onViewProfile?: (id: string) => void;
  onBook?: (id: string) => void;
}

export const DoctorCard: React.FC<DoctorCardProps> = ({
  doctor,
  onViewProfile,
  onBook,
}) => {
  const navigate = useNavigate();

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <DoctorAvatar
          initials={doctor.avatarInitials}
          color={doctor.avatarColor}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {doctor.name}
          </h3>
          <p className="text-xs text-text-secondary">{doctor.specialty}</p>
          <p className="text-xs text-text-muted">{doctor.qualifications}</p>
        </div>
        <Badge
          variant={doctor.availableToday ? 'success' : 'neutral'}
          dot
          className="flex-shrink-0"
        >
          {doctor.availableToday ? 'Available' : 'Busy'}
        </Badge>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" aria-hidden="true" />
          <span className="font-medium">{doctor.rating}</span>
          <span className="text-text-muted">({doctor.reviewCount})</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
          <span>{doctor.experience}</span>
        </div>
        <div className="ml-auto font-semibold text-primary-600">
          {doctor.consultationFee}
        </div>
      </div>

      {/* Availability */}
      <div className="flex items-center gap-2 text-xs text-text-muted bg-slate-50 rounded-xl px-3 py-2">
        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Next available: {doctor.nextAvailable}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          rightIcon={<ChevronRight className="h-4 w-4" />}
          onClick={() =>
            onViewProfile ? onViewProfile(doctor.id) : navigate(`/appointments/doctors`)
          }
          className="flex-1"
          aria-label={`View profile of ${doctor.name}`}
        >
          Profile
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Calendar className="h-4 w-4" />}
          onClick={() =>
            onBook ? onBook(doctor.id) : navigate('/appointments/book')
          }
          className="flex-1"
          aria-label={`Book appointment with ${doctor.name}`}
        >
          Book
        </Button>
      </div>
    </Card>
  );
};

// ─── Appointment Type Icon ────────────────────────────────────────────────────

const appointmentTypeIcon: Record<AppointmentType, React.ReactNode> = {
  in_person: <MapPin className="h-3.5 w-3.5" />,
  video: <Video className="h-3.5 w-3.5" />,
};

const appointmentTypeLabel: Record<AppointmentType, string> = {
  in_person: 'In-Person',
  video: 'Video',
};

const appointmentStatusConfig: Record<
  AppointmentStatus,
  { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string }
> = {
  upcoming: { variant: 'warning', label: 'Upcoming' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'danger', label: 'Cancelled' },
  rescheduled: { variant: 'neutral', label: 'Rescheduled' },
};

// ─── Appointment Card ─────────────────────────────────────────────────────────

interface AppointmentCardProps {
  appointment: Appointment;
  onViewDetails?: (id: string) => void;
  onReschedule?: (id: string) => void;
  onCancel?: (id: string) => void;
  compact?: boolean;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onViewDetails,
  onReschedule,
  onCancel,
  compact = false,
}) => {
  const navigate = useNavigate();
  const statusInfo = appointmentStatusConfig[appointment.status];
  const relativeDate = getRelativeDate(appointment.date);
  const formattedTime = formatTime(appointment.time);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <DoctorAvatar
          initials={appointment.doctor.avatarInitials}
          color={appointment.doctor.avatarColor}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {appointment.doctor.name}
            </h3>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <p className="text-xs text-text-secondary">
            {appointment.doctor.specialty}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{relativeDate}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{formattedTime}</span>
            </div>
            <div className="flex items-center gap-1">
              {appointmentTypeIcon[appointment.type]}
              <span>{appointmentTypeLabel[appointment.type]}</span>
            </div>
          </div>
        </div>
      </div>

      {!compact && appointment.status === 'upcoming' && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
            onClick={() =>
              onViewDetails
                ? onViewDetails(appointment.id)
                : navigate(`/appointments/${appointment.id}`)
            }
            className="flex-1"
            aria-label="View appointment details"
          >
            Details
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReschedule && onReschedule(appointment.id)}
            className="flex-1"
            aria-label="Reschedule appointment"
          >
            Reschedule
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel && onCancel(appointment.id)}
            className="flex-1 !text-danger hover:!bg-red-50"
            aria-label="Cancel appointment"
          >
            Cancel
          </Button>
        </div>
      )}

      {compact && (
        <Button
          variant="outline"
          size="sm"
          fullWidth
          rightIcon={<ChevronRight className="h-4 w-4" />}
          onClick={() =>
            onViewDetails
              ? onViewDetails(appointment.id)
              : navigate(`/appointments/${appointment.id}`)
          }
          aria-label="View appointment details"
        >
          View details
        </Button>
      )}
    </Card>
  );
};
