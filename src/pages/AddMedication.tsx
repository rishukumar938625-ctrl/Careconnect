import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

const frequencyOptions = [
  { value: 'once_daily', label: 'Once daily' },
  { value: 'twice_daily', label: 'Twice daily' },
  { value: 'three_times_daily', label: '3× daily' },
  { value: 'four_times_daily', label: '4× daily' },
  { value: 'as_needed', label: 'As needed' },
  { value: 'weekly', label: 'Weekly' },
];

const formOptions = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'liquid', label: 'Liquid' },
  { value: 'injection', label: 'Injection' },
  { value: 'topical', label: 'Topical' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'drops', label: 'Drops' },
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
}

interface FormErrors {
  name?: string;
  dosage?: string;
  time?: string;
  startDate?: string;
}

export const AddMedication: React.FC = () => {
  const navigate = useNavigate();

  const [values, setValues] = useState<FormValues>({
    name: '',
    dosage: '',
    form: 'tablet',
    frequency: 'once_daily',
    time: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (field: keyof FormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!values.name.trim()) newErrors.name = 'Medication name is required.';
    if (!values.dosage.trim()) newErrors.dosage = 'Dosage is required.';
    if (!values.time) newErrors.time = 'Please select a time.';
    if (!values.startDate) newErrors.startDate = 'Start date is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Phase 1: no backend — show success state
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
            <Save className="h-8 w-8 text-success" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Medication saved!</h2>
            <p className="text-sm text-text-secondary mt-1">
              <strong>{values.name}</strong> has been added to your medication
              list.
            </p>
            <p className="text-xs text-text-muted mt-2">
              (Phase 1: data is not persisted)
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
                  time: '',
                  startDate: '',
                  endDate: '',
                  notes: '',
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

      <h1 className="text-2xl font-bold text-text-primary mb-6">
        Add Medication
      </h1>

      <form onSubmit={handleSubmit} noValidate aria-label="Add medication form">
        <Card className="flex flex-col gap-5 mb-4">
          <h2 className="text-base font-semibold text-text-primary">
            Medication details
          </h2>

          <Input
            label="Medication name"
            id="med-name"
            placeholder="e.g. Vitamin D3"
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            required
            autoComplete="off"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Dosage"
              id="med-dosage"
              placeholder="e.g. 500mg"
              value={values.dosage}
              onChange={(e) => set('dosage', e.target.value)}
              error={errors.dosage}
              required
            />
            <Select
              label="Form"
              id="med-form"
              options={formOptions}
              value={values.form}
              onChange={(e) => set('form', e.target.value)}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-5 mb-4">
          <h2 className="text-base font-semibold text-text-primary">
            Schedule
          </h2>

          <Select
            label="Frequency"
            id="med-frequency"
            options={frequencyOptions}
            value={values.frequency}
            onChange={(e) => set('frequency', e.target.value)}
          />

          <Input
            label="Time"
            id="med-time"
            type="time"
            value={values.time}
            onChange={(e) => set('time', e.target.value)}
            error={errors.time}
            required
            helpText="When should you take this medication?"
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
            />
            <Input
              label="End date"
              id="med-end-date"
              type="date"
              value={values.endDate}
              onChange={(e) => set('endDate', e.target.value)}
              helpText="Leave blank if ongoing"
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-5 mb-6">
          <h2 className="text-base font-semibold text-text-primary">Notes</h2>
          <Textarea
            label="Additional notes"
            id="med-notes"
            placeholder="e.g. Take with food, avoid alcohol…"
            value={values.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
          />
        </Card>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
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
