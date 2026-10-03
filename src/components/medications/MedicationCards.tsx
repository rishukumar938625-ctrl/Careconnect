import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  XCircle,
  SkipForward,
  Plus,
  Pill,
  ChevronRight,
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
  taken: { label: 'Taken', variant: 'success', Icon: CheckCircle2 },
  missed: { label: 'Missed', variant: 'danger', Icon: XCircle },
  skipped: { label: 'Skipped', variant: 'neutral', Icon: SkipForward },
};


// ─── Medication Card ──────────────────────────────────────────────────────────

interface MedicationCardProps {
  medication: Medication;
  time?: string;
  status?: MedicationStatus;
  onMarkTaken?: (medicationId: string, scheduleId?: string) => void;
  compact?: boolean;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  time,
  status = 'upcoming',
  onMarkTaken,
  compact = false,
}) => {
  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.Icon;

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
            style={{ backgroundColor: `${medication.color}1A` }}
            aria-hidden="true"
          >
            <Pill
              className="h-5 w-5"
              style={{ color: medication.color ?? '#2563EB' }}
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
        </>
      ) : (
        // Full layout for medications page
        <>
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
              style={{ backgroundColor: `${medication.color}1A` }}
              aria-hidden="true"
            >
              <Pill
                className="h-6 w-6"
                style={{ color: medication.color ?? '#2563EB' }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-text-primary">
                {medication.name}
              </h3>
              <p className="text-sm text-text-secondary">
                {medication.dosage} ·{' '}
                {formatMedicationForm(medication.form)}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {formatFrequency(medication.frequency)}
                {time && ` · ${formatTime(time)}`}
              </p>
            </div>
            <Badge variant={statusInfo.variant} dot>
              <StatusIcon className="h-3 w-3" aria-hidden="true" />
              {statusInfo.label}
            </Badge>
          </div>

          {status === 'upcoming' && onMarkTaken && (
            <Button
              variant="outline"
              size="sm"
              fullWidth
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
              onClick={() => onMarkTaken(medication.id)}
              aria-label={`Mark ${medication.name} as taken`}
            >
              Mark as taken
            </Button>
          )}
        </>
      )}
    </Card>
  );
};

// ─── Medication Schedule ──────────────────────────────────────────────────────

interface ScheduleItem {
  time: string;
  medication: Medication;
  scheduleEntryId: string;
  status: MedicationStatus;
}

interface MedicationScheduleProps {
  items: ScheduleItem[];
  onMarkTaken?: (medicationId: string, scheduleId: string) => void;
  emptyMessage?: string;
}

export const MedicationSchedule: React.FC<MedicationScheduleProps> = ({
  items,
  onMarkTaken,
  emptyMessage = 'No medications scheduled.',
}) => {
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-6">{emptyMessage}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map(({ time, medication, scheduleEntryId, status }) => (
        <div key={`${medication.id}-${scheduleEntryId}`} className="flex gap-3 items-start">
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
                  : status === 'missed'
                  ? 'bg-danger'
                  : 'bg-primary-400'
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
              onMarkTaken={
                onMarkTaken
                  ? (id) => onMarkTaken(id, scheduleEntryId)
                  : undefined
              }
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
      <ChevronRight className="h-4 w-4 ml-auto" aria-hidden="true" />
    </button>
  );
};

