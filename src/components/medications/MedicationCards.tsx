import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  XCircle,
  SkipForward,
  Plus,
  Pill,
  Trash2,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { Medication, MedicationStatus } from '../../types';
import { formatTime, formatFrequency, formatMedicationForm } from '../../utils';

// ─── Status helpers ───────────────────────────────────────────────────────────

const statusConfig: Record<
  MedicationStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral'; Icon: React.ElementType }
> = {
  upcoming: { label: 'Upcoming', variant: 'warning', Icon: Clock },
  pending: { label: 'Pending', variant: 'warning', Icon: Clock },
  taken: { label: 'Taken', variant: 'success', Icon: CheckCircle2 },
  missed: { label: 'Missed', variant: 'danger', Icon: XCircle },
  skipped: { label: 'Skipped', variant: 'neutral', Icon: SkipForward },
  snoozed: { label: 'Snoozed', variant: 'neutral', Icon: Clock },
};

// ─── Medication Card ──────────────────────────────────────────────────────────

interface MedicationCardProps {
  medication: Medication;
  time?: string;
  status?: MedicationStatus;
  snoozedUntil?: string;
  doseId?: string;
  onMarkTaken?: (medicationId: string, doseId?: string) => void;
  onSkip?: (medicationId: string, doseId?: string) => void;
  onSnooze?: (medicationId: string, doseId?: string) => void;
  onDelete?: (medicationId: string) => void;
  onEdit?: (medicationId: string) => void;
  compact?: boolean;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  time,
  status = 'pending',
  snoozedUntil,
  doseId,
  onMarkTaken,
  onSkip,
  onSnooze,
  onDelete,
  onEdit,
  compact = false,
}) => {
  const currentStatus = status in statusConfig ? status : 'pending';
  const statusInfo = statusConfig[currentStatus];
  const StatusIcon = statusInfo.Icon;
  const medId = medication._id || medication.id;

  return (
    <Card
      bordered
      className={compact ? 'flex items-center gap-3 py-3' : 'flex flex-col gap-3'}
    >
      {compact ? (
        // Compact layout for dashboard
        <>
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
            style={{ backgroundColor: `${medication.color || '#2563EB'}1A` }}
            aria-hidden="true"
          >
            <Pill
              className="h-5 w-5"
              style={{ color: medication.color || '#2563EB' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">
              {medication.name}
            </p>
            <p className="text-xs text-text-muted">
              {medication.dosage} · {time ? formatTime(time) : ''}
            </p>
          </div>
          <Badge variant={statusInfo.variant} dot>
            {statusInfo.label}
          </Badge>
          {(currentStatus === 'pending' || currentStatus === 'upcoming' || currentStatus === 'snoozed') && onMarkTaken && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMarkTaken(medId, doseId)}
              className="px-2 py-1 h-8 text-xs font-medium"
              aria-label={`Mark ${medication.name} as taken`}
            >
              Take
            </Button>
          )}
        </>
      ) : (
        // Full layout for medications page
        <>
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
              style={{ backgroundColor: `${medication.color || '#2563EB'}1A` }}
              aria-hidden="true"
            >
              <Pill
                className="h-6 w-6"
                style={{ color: medication.color || '#2563EB' }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-text-primary truncate">
                  {medication.name}
                </h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(medId)}
                      className="text-text-muted hover:text-primary-600 p-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      aria-label={`Edit ${medication.name}`}
                      title="Edit medication"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(medId)}
                      className="text-text-muted hover:text-danger p-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                      aria-label={`Archive ${medication.name}`}
                      title="Archive medication"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                {medication.dosage} · {formatMedicationForm(medication.form)}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {formatFrequency(medication.frequency)}
                {time && ` · ${formatTime(time)}`}
              </p>
              {medication.instructions && (
                <p className="text-xs text-text-secondary mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <span className="font-medium text-text-primary">Instructions:</span> {medication.instructions}
                </p>
              )}
              {snoozedUntil && currentStatus === 'snoozed' && (
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1 bg-amber-50 p-1 rounded">
                  <AlertCircle className="h-3 w-3" />
                  Snoozed until {new Date(snoozedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <Badge variant={statusInfo.variant} dot>
              <StatusIcon className="h-3 w-3" aria-hidden="true" />
              {statusInfo.label}
            </Badge>
          </div>

          {(currentStatus === 'pending' || currentStatus === 'upcoming' || currentStatus === 'snoozed') && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              {onMarkTaken && (
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1 min-w-[100px]"
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => onMarkTaken(medId, doseId)}
                  aria-label={`Mark ${medication.name} as taken`}
                >
                  Take
                </Button>
              )}
              {onSnooze && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[90px]"
                  leftIcon={<Clock className="h-4 w-4" />}
                  onClick={() => onSnooze(medId, doseId)}
                  aria-label={`Snooze ${medication.name} by 30 minutes`}
                >
                  Snooze
                </Button>
              )}
              {onSkip && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-text-muted hover:text-text-primary"
                  leftIcon={<SkipForward className="h-4 w-4" />}
                  onClick={() => onSkip(medId, doseId)}
                  aria-label={`Skip ${medication.name}`}
                >
                  Skip
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
};

// ─── Medication Schedule ──────────────────────────────────────────────────────

export interface ScheduleItem {
  time: string;
  medication: Medication;
  doseId: string;
  status: MedicationStatus;
  snoozedUntil?: string;
}

interface MedicationScheduleProps {
  items: ScheduleItem[];
  onMarkTaken?: (medicationId: string, doseId?: string) => void;
  onSkip?: (medicationId: string, doseId?: string) => void;
  onSnooze?: (medicationId: string, doseId?: string) => void;
  emptyMessage?: string;
}

export const MedicationSchedule: React.FC<MedicationScheduleProps> = ({
  items,
  onMarkTaken,
  onSkip,
  onSnooze,
  emptyMessage = 'No medications scheduled for today.',
}) => {
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-6">{emptyMessage}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map(({ time, medication, doseId, status, snoozedUntil }) => (
        <div key={doseId || `${medication.id}-${time}`} className="flex gap-3 items-start">
          {/* Time column */}
          <div className="flex flex-col items-end pt-3.5 w-16 flex-shrink-0">
            <span className="text-xs font-semibold text-text-secondary">
              {formatTime(time)}
            </span>
          </div>
          {/* Timeline dot */}
          <div className="flex flex-col items-center pt-4 flex-shrink-0">
            <div
              className={`w-2.5 h-2.5 rounded-full mt-0.5 ${
                status === 'taken'
                  ? 'bg-success'
                  : status === 'skipped'
                  ? 'bg-slate-300'
                  : status === 'snoozed'
                  ? 'bg-amber-400'
                  : 'bg-primary-500'
              }`}
              aria-hidden="true"
            />
          </div>
          {/* Card */}
          <div className="flex-1 min-w-0">
            <MedicationCard
              medication={medication}
              time={time}
              status={status}
              snoozedUntil={snoozedUntil}
              doseId={doseId}
              onMarkTaken={onMarkTaken}
              onSkip={onSkip}
              onSnooze={onSnooze}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Add Medication Button ────────────────────────────────────────────────────

export const AddMedicationButton: React.FC = () => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/medications/add')}
      className={[
        'flex items-center gap-3 w-full p-4 rounded-2xl border-2 border-dashed border-slate-200',
        'text-text-muted hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50',
        'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
      ].join(' ')}
      aria-label="Add a new medication"
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100">
        <Plus className="h-5 w-5" aria-hidden="true" />
      </div>
      <span className="text-sm font-medium">Add medication</span>
    </button>
  );
};
