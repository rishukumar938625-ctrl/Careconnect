import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save, AlertCircle, Loader2 } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { medicationApi } from '../services/api';
import type { MedicationForm, MedicationFrequency } from '../types';

const frequencyOptions = [
  { value: 'once_daily', label: 'Once daily' },
  { value: 'twice_daily', label: 'Twice daily' },
  { value: 'three_times_daily', label: '3\u00d7 daily' },
  { value: 'four_times_daily', label: '4\u00d7 daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'as_needed', label: 'As needed' },
];

const formOptions = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'liquid', label: 'Liquid' },
  { value: 'injection', label: 'Injection' },
  { value: 'topical', label: 'Topical' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'drops', label: 'Drops' },
  { value: 'other', label: 'Other' },
];

const colorOptions = [
  { value: '#2563EB', label: 'Blue' },
  { value: '#10B981', label: 'Emerald' },
  { value: '#7C3AED', label: 'Purple' },
  { value: '#D97706', label: 'Amber' },
  { value: '#EF4444', label: 'Red' },
];

interface FormValues {
  name: string;
  dosage: string;
  form: string;
  frequency: string;
  time: string;
  startDate: string;
  endDate: string;
  notes: string;
  color: string;
}

interface FormErrors {
  name?: string;
  dosage?: string;
  time?: string;
  startDate?: string;
  endDate?: string;
}

export const EditMedication: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [values, setValues] = useState<FormValues>({
    name: '',
    dosage: '',
    form: 'tablet',
    frequency: 'once_daily',
    time: '08:00',
    startDate: '',
    endDate: '',
    notes: '',
    color: '#2563EB',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate('/medications', { replace: true });
      return;
    }
    let cancelled = false;
    medicationApi.getById(id).then((med) => {
      if (cancelled) return;
      setValues({
        name: med.name,
        dosage: med.dosage,
        form: med.form || 'tablet',
        frequency: med.frequency || 'once_daily',
        time: med.timesOfDay?.[0] || med.times?.[0] || '08:00',
        startDate: med.startDate || '',
        endDate: med.endDate || '',
        notes: med.instructions || med.notes || '',
        color: med.color || '#2563EB',
      });
    }).catch((err: unknown) => {
      if (cancelled) return;
      const msg = err instanceof Error ? err.message : 'Failed to load medication.';
      setApiError(msg);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, navigate]);

  const set = (field: keyof FormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setApiError(null);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!values.name.trim()) newErrors.name = 'Medication name is required.';
    if (!values.dosage.trim()) newErrors.dosage = 'Prescribed dosage is required.';
    if (!values.time) newErrors.time = 'Please select a scheduled time.';
    if (!values.startDate) newErrors.startDate = 'Start date is required.';
    if (values.endDate && values.endDate < values.startDate) {
      newErrors.endDate = 'End date cannot be earlier than start date.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !validate()) return;
    setApiError(null);
    setIsSubmitting(true);
    try {
      const userTimezone =
        typeof Intl !== 'undefined' && Intl.DateTimeFormat
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
          : 'UTC';
      await medicationApi.update(id, {
        name: values.name.trim(),
        dosage: values.dosage.trim(),
        form: values.form as MedicationForm,
        frequency: values.frequency as MedicationFrequency,
        timesOfDay: [values.time],
        startDate: values.startDate,
        endDate: values.endDate || undefined,
        instructions: values.notes.trim() || undefined,
        timezone: userTimezone,
        color: values.color,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes. Please try again.';
      setApiError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600">
            <Save className="h-8 w-8" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Changes saved!</h2>
            <p className="text-sm text-text-secondary mt-1">
              <strong>{values.name}</strong> has been updated. Upcoming doses will reflect the new schedule.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button variant="primary" size="md" fullWidth onClick={() => navigate('/medications')}>
              View medications
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-24" role="status" aria-label="Loading medication">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </PageContainer>
    );
  }

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

      <h1 className="text-2xl font-bold text-text-primary mb-2">Edit Medication</h1>
      <p className="text-sm text-text-muted mb-6">
        Update your prescription details. Future dose reminders will reflect any schedule changes.
      </p>

      {apiError && (
        <div role="alert" className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-danger mt-0.5" aria-hidden="true" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate aria-label="Edit medication form">
        <Card className="flex flex-col gap-5 mb-4">
          <h2 className="text-base font-semibold text-text-primary">Medication details</h2>
          <Input label="Medication name" id="edit-med-name" placeholder="e.g. Metformin" value={values.name} onChange={(e) => set('name', e.target.value)} error={errors.name} required disabled={isSubmitting} autoComplete="off" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prescribed dosage" id="edit-med-dosage" placeholder="e.g. 500mg or 1 tablet" value={values.dosage} onChange={(e) => set('dosage', e.target.value)} error={errors.dosage} required disabled={isSubmitting} />
            <Select label="Form" id="edit-med-form" options={formOptions} value={values.form} onChange={(e) => set('form', e.target.value)} disabled={isSubmitting} />
          </div>
        </Card>

        <Card className="flex flex-col gap-5 mb-4">
          <h2 className="text-base font-semibold text-text-primary">Schedule &amp; recurrence</h2>
          <Select label="Frequency" id="edit-med-frequency" options={frequencyOptions} value={values.frequency} onChange={(e) => set('frequency', e.target.value)} disabled={isSubmitting} />
          <Input label="Scheduled time" id="edit-med-time" type="time" value={values.time} onChange={(e) => set('time', e.target.value)} error={errors.time} required disabled={isSubmitting} helpText="Local time for your dose reminder" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start date" id="edit-med-start-date" type="date" value={values.startDate} onChange={(e) => set('startDate', e.target.value)} error={errors.startDate} required disabled={isSubmitting} />
            <Input label="End date" id="edit-med-end-date" type="date" value={values.endDate} onChange={(e) => set('endDate', e.target.value)} error={errors.endDate} helpText="Leave blank if ongoing" disabled={isSubmitting} />
          </div>
        </Card>

        <Card className="flex flex-col gap-5 mb-6">
          <h2 className="text-base font-semibold text-text-primary">Prescription instructions &amp; color</h2>
          <Textarea label="Prescribed instructions / notes" id="edit-med-notes" placeholder="e.g. Take with dinner, drink plenty of water..." value={values.notes} onChange={(e) => set('notes', e.target.value)} rows={3} disabled={isSubmitting} />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Card accent color</label>
            <div className="flex gap-3">
              {colorOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => set('color', c.value)}
                  style={{ backgroundColor: c.value }}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    values.color === c.value ? 'scale-110 border-slate-900 shadow-md' : 'border-transparent'
                  }`}
                  aria-label={`Select color ${c.label}`}
                />
              ))}
            </div>
          </div>
        </Card>

        <Button type="submit" variant="primary" size="lg" fullWidth loading={isSubmitting} disabled={isSubmitting} leftIcon={<Save className="h-5 w-5" />} id="save-edit-medication-btn">
          Save changes
        </Button>
      </form>
    </PageContainer>
  );
};

export default EditMedication;
