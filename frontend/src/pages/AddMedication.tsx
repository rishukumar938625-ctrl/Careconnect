import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, AlertCircle } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { medicationApi } from '../services/api';
import type { MedicationForm, MedicationFrequency } from '../types';

const frequencyOptions = [
  { value: 'once_daily', label: 'Once daily' },
  { value: 'twice_daily', label: 'Twice daily' },
  { value: 'three_times_daily', label: '3× daily' },
  { value: 'four_times_daily', label: '4× daily' },
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

export const AddMedication: React.FC = () => {
  const navigate = useNavigate();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [values, setValues] = useState<FormValues>({
    name: '',
    dosage: '',
    form: 'tablet',
    frequency: 'once_daily',
    time: '08:00',
    startDate: todayStr,
    endDate: '',
    notes: '',
    color: '#2563EB',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    if (!validate()) return;

    setApiError(null);
    setIsSubmitting(true);

    try {
      const userTimezone =
        typeof Intl !== 'undefined' && Intl.DateTimeFormat
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
          : 'UTC';

      await medicationApi.create({
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
      const msg = err instanceof Error ? err.message : 'Failed to save medication. Please try again.';
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
            <h2 className="text-xl font-bold text-text-primary">Medication added to your record!</h2>
            <p className="text-sm text-text-secondary mt-1">
              <strong>{values.name}</strong> has been saved. Your upcoming doses have been automatically scheduled.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => navigate('/medications')}
            >
              View medications
            </Button>
            <Button
              variant="ghost"
              size="md"
              fullWidth
              onClick={() => {
                setValues({
                  name: '',
                  dosage: '',
                  form: 'tablet',
                  frequency: 'once_daily',
                  time: '08:00',
                  startDate: todayStr,
                  endDate: '',
                  notes: '',
                  color: '#2563EB',
                });
                setSubmitted(false);
              }}
            >
              Add another
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        aria-label="Go back"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-text-primary mb-2">
        Add Medication
      </h1>
      <p className="text-sm text-text-muted mb-6">
        Enter your prescribed medication details. CareConnect will generate dose reminders based on your schedule.
      </p>

      {apiError && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-danger mt-0.5" aria-hidden="true" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate aria-label="Add medication form">
        <Card className="flex flex-col gap-5 mb-4">
          <h2 className="text-base font-semibold text-text-primary">
            Medication details
          </h2>

          <Input
            label="Medication name"
            id="med-name"
            placeholder="e.g. Metformin"
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            required
            disabled={isSubmitting}
            autoComplete="off"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Prescribed dosage"
              id="med-dosage"
              placeholder="e.g. 500mg or 1 tablet"
              value={values.dosage}
              onChange={(e) => set('dosage', e.target.value)}
              error={errors.dosage}
              required
              disabled={isSubmitting}
            />
            <Select
              label="Form"
              id="med-form"
              options={formOptions}
              value={values.form}
              onChange={(e) => set('form', e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-5 mb-4">
          <h2 className="text-base font-semibold text-text-primary">
            Schedule & recurrence
          </h2>

          <Select
            label="Frequency"
            id="med-frequency"
            options={frequencyOptions}
            value={values.frequency}
            onChange={(e) => set('frequency', e.target.value)}
            disabled={isSubmitting}
          />

          <Input
            label="Scheduled time"
            id="med-time"
            type="time"
            value={values.time}
            onChange={(e) => set('time', e.target.value)}
            error={errors.time}
            required
            disabled={isSubmitting}
            helpText="Local time for your dose reminder"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start date"
              id="med-start-date"
              type="date"
              value={values.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              error={errors.startDate}
              required
              disabled={isSubmitting}
            />
            <Input
              label="End date"
              id="med-end-date"
              type="date"
              value={values.endDate}
              onChange={(e) => set('endDate', e.target.value)}
              error={errors.endDate}
              helpText="Leave blank if ongoing"
              disabled={isSubmitting}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-5 mb-6">
          <h2 className="text-base font-semibold text-text-primary">Prescription instructions & color</h2>
          <Textarea
            label="Prescribed instructions / notes"
            id="med-notes"
            placeholder="e.g. Take with dinner, drink plenty of water…"
            value={values.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            disabled={isSubmitting}
          />

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

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          disabled={isSubmitting}
          leftIcon={<Save className="h-5 w-5" />}
          id="save-medication-btn"
        >
          Save medication
        </Button>
      </form>
    </PageContainer>
  );
};

export default AddMedication;
