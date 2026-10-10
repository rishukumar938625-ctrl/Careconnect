import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Video,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DoctorAvatar } from '../components/appointments/AppointmentCards';
import { EmptyState } from '../components/ui/StateComponents';
import { appointmentApi } from '../services/api';
import { getRelativeDate, formatTime } from '../utils';
import type { Appointment } from '../types';

export const AppointmentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchAppointment = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await appointmentApi.getAppointmentById(id);
      setAppointment(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Appointment not found or inaccessible.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  const handleCancel = async () => {
    if (!id) return;
    try {
      setCancelling(true);
      setActionError(null);
      await appointmentApi.cancelAppointment(id, cancelReason || undefined);
      setShowCancelModal(false);
      await fetchAppointment();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel appointment.';
      setActionError(msg);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
          <p className="text-xs">Loading appointment details…</p>
        </div>
      </PageContainer>
    );
  }

  if (error || !appointment) {
    return (
      <PageContainer>
        <EmptyState
          title="Appointment not found"
          description={error || 'This appointment could not be found or you do not have permission to view it.'}
          action={{ label: 'Back to appointments', onClick: () => navigate('/appointments') }}
        />
      </PageContainer>
    );
  }

  const apptId = appointment.id || (appointment._id as string);
  const relativeDate = getRelativeDate(appointment.date);
  const rawTime = appointment.time || appointment.timeSlot || '09:00';
  const formattedTime = formatTime(rawTime);

  const docName = appointment.doctor?.name || appointment.doctorName || 'Doctor';
  const docSpecialty = appointment.doctor?.specialty || appointment.doctorSpecialty || 'General Practice';
  const docInitials =
    appointment.doctor?.avatarInitials ||
    docName
      .replace(/^Dr\.\s*/i, '')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    'DR';
  const docColor = appointment.doctor?.avatarColor || '#2563EB';

  const isUpcoming = appointment.status === 'upcoming' || appointment.status === 'booked';

  return (
    <PageContainer>
      <button
        onClick={() => navigate('/appointments')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        aria-label="Back to appointments"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to appointments
      </button>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-text-primary">
          Appointment Details
        </h1>
        <Badge
          variant={
            isUpcoming
              ? 'warning'
              : appointment.status === 'completed'
              ? 'success'
              : 'danger'
          }
          dot
        >
          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
        </Badge>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-50 text-red-800 text-xs border border-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Doctor info */}
      <Card className="flex items-center gap-4 mb-4">
        <DoctorAvatar
          initials={docInitials}
          color={docColor}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-text-primary truncate">
            {docName}
          </h2>
          <p className="text-sm text-text-secondary">
            {docSpecialty}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {appointment.hospital || 'CareConnect Partner Clinic'}
          </p>
        </div>
      </Card>

      {/* Appointment info */}
      <Card className="flex flex-col gap-4 mb-5">
        <h2 className="text-base font-semibold text-text-primary">
          Appointment info
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <InfoItem
            icon={<Calendar className="h-4 w-4" />}
            label="Date"
            value={`${relativeDate}, ${new Date(appointment.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}`}
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
          <InfoItem
            icon={<Clock className="h-4 w-4" />}
            label="Timezone"
            value={appointment.timezone || 'UTC'}
          />
        </div>

        {appointment.reason && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-text-muted mb-1 font-medium">Reason for visit</p>
            <p className="text-sm text-text-primary">{appointment.reason}</p>
          </div>
        )}

        {appointment.cancellationReason && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-danger font-medium mb-1">Cancellation Reason</p>
            <p className="text-xs text-text-secondary">{appointment.cancellationReason}</p>
          </div>
        )}

        {appointment.notes && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-text-muted mb-1 font-medium">Notes</p>
            <p className="text-sm text-text-secondary">{appointment.notes}</p>
          </div>
        )}
      </Card>

      {/* Actions */}
      {isUpcoming && (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={() => navigate(`/appointments/book?rescheduleId=${apptId}`)}
          >
            Reschedule appointment
          </Button>
          <Button
            variant="ghost"
            size="md"
            fullWidth
            onClick={() => setShowCancelModal(true)}
            className="!text-danger hover:!bg-red-50"
          >
            Cancel appointment
          </Button>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cancel-title"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 id="modal-cancel-title" className="text-base font-bold text-text-primary">
                Cancel Appointment
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-text-secondary mb-3">
              Are you sure you want to cancel this visit? Your scheduled slot will be released for other patients.
            </p>

            <div className="mb-4">
              <label htmlFor="reason-cancel-text" className="block text-xs font-medium text-text-primary mb-1">
                Reason (optional, max 250 characters)
              </label>
              <textarea
                id="reason-cancel-text"
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value.slice(0, 250))}
                placeholder="e.g. Conflict in schedule…"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                disabled={cancelling}
                onClick={() => setShowCancelModal(false)}
              >
                Keep visit
              </Button>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                disabled={cancelling}
                onClick={handleCancel}
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

const InfoItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="flex flex-col gap-1">
    <p className="text-xs text-text-muted">{label}</p>
    <p className="text-xs font-medium text-text-primary flex items-center gap-1.5">
      <span className="text-text-muted">{icon}</span>
      {value}
    </p>
  </div>
);

export default AppointmentDetails;
