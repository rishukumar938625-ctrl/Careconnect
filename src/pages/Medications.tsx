import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Button } from '../components/ui/Button';
import { MedicationSchedule, AddMedicationButton } from '../components/medications/MedicationCards';
import { EmptyState } from '../components/ui/StateComponents';
import { getTodaySchedule } from '../data/mockMedicationData';
import type { MedicationStatus } from '../types';
import { Pill } from 'lucide-react';

export const Medications: React.FC = () => {
  const navigate = useNavigate();
  const [scheduleItems, setScheduleItems] = useState(getTodaySchedule());

  const handleMarkTaken = (medicationId: string, scheduleId: string) => {
    // Phase 1: local state update only, no real backend
    setScheduleItems((prev) =>
      prev.map((item) =>
        item.medication.id === medicationId &&
        item.scheduleEntry.id === scheduleId
          ? {
              ...item,
              scheduleEntry: {
                ...item.scheduleEntry,
                status: 'taken' as MedicationStatus,
              },
            }
          : item,
      ),
    );
  };

  const scheduleForComponent = scheduleItems.map((item) => ({
    time: item.time,
    medication: item.medication,
    scheduleEntryId: item.scheduleEntry.id,
    status: item.scheduleEntry.status,
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Medications"
        subtitle="Keep track of your medication schedule."
        action={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/medications/add')}
            aria-label="Add medication"
          >
            Add
          </Button>
        }
      />

      {/* Today's Schedule */}
      <section aria-labelledby="todays-schedule-heading" className="mb-6">
        <h2
          id="todays-schedule-heading"
          className="text-base font-semibold text-text-primary mb-4"
        >
          Today's schedule
        </h2>

        {scheduleItems.length === 0 ? (
          <EmptyState
            icon={<Pill className="h-8 w-8" />}
            title="No medications scheduled"
            description="Add your first medication to start tracking your schedule."
            action={{
              label: 'Add medication',
              onClick: () => navigate('/medications/add'),
            }}
          />
        ) : (
          <MedicationSchedule
            items={scheduleForComponent}
            onMarkTaken={handleMarkTaken}
          />
        )}
      </section>

      {/* Add Medication CTA */}
      <section aria-label="Add medication">
        <AddMedicationButton />
      </section>

      {/* Disclaimer */}
      <p className="text-[11px] text-text-muted text-center mt-8 px-4 leading-relaxed">
        Always follow your healthcare provider's instructions when taking
        medications. This schedule is for personal tracking only.
      </p>
    </PageContainer>
  );
};

export default Medications;
