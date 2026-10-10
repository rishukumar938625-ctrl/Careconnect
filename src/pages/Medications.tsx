import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pill,
  Bell,
  BellRing,
  AlertCircle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { MedicationSchedule, MedicationCard, AddMedicationButton, ScheduleItem } from '../components/medications/MedicationCards';
import { EmptyState } from '../components/ui/StateComponents';
import { medicationApi, doseApi } from '../services/api';
import type { Medication, DoseRecord, AdherenceStats } from '../types';

export const Medications: React.FC = () => {
  const navigate = useNavigate();

  const [doses, setDoses] = useState<DoseRecord[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [adherence, setAdherence] = useState<AdherenceStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'medications'>('schedule');

  // Notification permission state
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [notifNotice, setNotifNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [todayDoses, allMeds, adhStats] = await Promise.all([
        doseApi.getTodayDoses(),
        medicationApi.getAll(),
        doseApi.getAdherence().catch(() => null),
      ]);
      setDoses(todayDoses);
      setMedications(allMeds);
      setAdherence(adhStats);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load medication data.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkTaken = async (_medicationId: string, doseId?: string) => {
    if (!doseId) return;
    try {
      await doseApi.updateStatus(doseId, 'taken');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update dose status.';
      setError(msg);
    }
  };

  const handleSkip = async (_medicationId: string, doseId?: string) => {
    if (!doseId) return;
    try {
      await doseApi.updateStatus(doseId, 'skipped');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update dose status.';
      setError(msg);
    }
  };

  const handleSnooze = async (_medicationId: string, doseId?: string) => {
    if (!doseId) return;
    try {
      await doseApi.updateStatus(doseId, 'snoozed', undefined, 30);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to snooze dose.';
      setError(msg);
    }
  };

  const handleDeleteMedication = async (medId: string) => {
    if (!window.confirm('Are you sure you want to archive this medication? Historical dose tracking records will be preserved.')) {
      return;
    }
    try {
      await medicationApi.delete(medId);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to archive medication.';
      setError(msg);
    }
  };

  const handleEditMedication = (medId: string) => {
    navigate(`/medications/${medId}/edit`);
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      setNotifNotice('Browser notifications are not supported in this browser.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        setNotifNotice('Notification permission granted! In-app dose tracking is active. Note: Notifications only fire while the browser tab is open.');
      } else {
        setNotifNotice('Notification permission was not granted. In-app reminders will continue working normally.');
      }
    } catch {
      setNotifNotice('Unable to request notification permission in this environment.');
    }
  };

  const scheduleItems: ScheduleItem[] = doses.map((d) => ({
    time: d.scheduledTime,
    medication: d.medicationId,
    doseId: d._id || d.id,
    status: d.status,
    snoozedUntil: d.snoozedUntil,
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Medications"
        subtitle="Keep track of your medication schedule and daily doses."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              aria-label="Refresh medication schedule"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => navigate('/medications/add')}
              aria-label="Add medication"
            >
              Add
            </Button>
          </div>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-danger mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Adherence Overview Banner */}
      {adherence && adherence.totalScheduled > 0 && (
        <section aria-labelledby="adherence-heading" className="mb-5">
          <Card className="bg-gradient-to-r from-primary-600 to-primary-700 text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 opacity-90" aria-hidden="true" />
                <h2 id="adherence-heading" className="text-sm font-semibold tracking-wide uppercase opacity-90">
                  Adherence Summary
                </h2>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 font-medium">
                {adherence.currentStreak} day streak 🔥
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/10 rounded-xl p-2.5">
                <p className="text-2xl font-bold">{adherence.adherenceRate}%</p>
                <p className="text-[11px] opacity-80 mt-0.5">Adherence Rate</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5">
                <p className="text-2xl font-bold">{adherence.takenDoses}</p>
                <p className="text-[11px] opacity-80 mt-0.5">Doses Taken</p>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5">
                <p className="text-2xl font-bold">{adherence.skippedDoses}</p>
                <p className="text-[11px] opacity-80 mt-0.5">Doses Skipped</p>
              </div>
            </div>
            <p className="text-[11px] opacity-75 mt-2.5 text-center">
              Calculated transparently from {adherence.totalScheduled} past scheduled doses.
            </p>
          </Card>
        </section>
      )}

      {/* Notification banner */}
      {notifPermission !== 'granted' && (
        <div className="mb-5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Bell className="h-4 w-4 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-text-primary">Enable browser reminder alerts</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                Get alerted for upcoming doses when this tab is open. In-app tracking works anytime.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRequestNotificationPermission}
            className="text-xs flex-shrink-0"
            leftIcon={<BellRing className="h-3.5 w-3.5" />}
          >
            Allow alerts
          </Button>
        </div>
      )}

      {notifNotice && (
        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-xs">
          {notifNotice}
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-200 mb-5" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'schedule'}
          onClick={() => setActiveTab('schedule')}
          className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'schedule'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Today's Doses ({doses.length})
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'medications'}
          onClick={() => setActiveTab('medications')}
          className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'medications'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Active Prescriptions ({medications.length})
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3 py-6" role="status" aria-label="Loading medications">
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      ) : activeTab === 'schedule' ? (
        /* ── Today's Schedule ── */
        <section aria-labelledby="todays-schedule-heading" className="mb-6">
          <h2 id="todays-schedule-heading" className="sr-only">
            Today's schedule
          </h2>

          {scheduleItems.length === 0 ? (
            <EmptyState
              icon={<Pill className="h-8 w-8" />}
              title="No doses scheduled for today"
              description={
                medications.length === 0
                  ? 'Add your first medication to start generating scheduled dose reminders.'
                  : 'All your medications are up to date or scheduled for different days.'
              }
              action={{
                label: 'Add medication',
                onClick: () => navigate('/medications/add'),
              }}
            />
          ) : (
            <MedicationSchedule
              items={scheduleItems}
              onMarkTaken={handleMarkTaken}
              onSkip={handleSkip}
              onSnooze={handleSnooze}
            />
          )}
        </section>
      ) : (
        /* ── Active Prescriptions List ── */
        <section aria-labelledby="prescriptions-heading" className="mb-6 space-y-3">
          <h2 id="prescriptions-heading" className="sr-only">
            Active Prescriptions
          </h2>

          {medications.length === 0 ? (
            <EmptyState
              icon={<Pill className="h-8 w-8" />}
              title="No active medications"
              description="You have no active medications recorded in your profile."
              action={{
                label: 'Add medication',
                onClick: () => navigate('/medications/add'),
              }}
            />
          ) : (
            medications.map((med) => (
              <MedicationCard
                key={med._id || med.id}
                medication={med}
                time={med.timesOfDay?.[0] || med.times?.[0]}
                status="upcoming"
                onEdit={handleEditMedication}
                onDelete={handleDeleteMedication}
              />
            ))
          )}
        </section>
      )}

      {/* Add Medication CTA */}
      <section aria-label="Add medication" className="mt-4">
        <AddMedicationButton />
      </section>

      {/* Disclaimer */}
      <p className="text-[11px] text-text-muted text-center mt-8 px-4 leading-relaxed">
        Always follow your healthcare provider's instructions when taking medications. CareConnect stores your prescribed instructions for personal adherence tracking only.
      </p>
    </PageContainer>
  );
};

export default Medications;
