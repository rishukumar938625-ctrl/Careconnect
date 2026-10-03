import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Video, MapPin } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DoctorAvatar } from '../components/appointments/AppointmentCards';
import { mockDoctors, availableTimeSlots } from '../data/mockDoctorData';
import type { AppointmentType } from '../types';

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { step: 1 as Step, label: 'Doctor' },
  { step: 2 as Step, label: 'Date' },
  { step: 3 as Step, label: 'Time' },
  { step: 4 as Step, label: 'Type' },
  { step: 5 as Step, label: 'Confirm' },
];

// Generate next 7 days for date selection
function getNextSevenDays() {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

export const BookAppointment: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('in_person');
  const [confirmed, setConfirmed] = useState(false);

  const selectedDoctor = mockDoctors.find((d) => d.id === selectedDoctorId);
  const nextDays = getNextSevenDays();

  const goNext = () => {
    if (currentStep < 5) setCurrentStep((s) => (s + 1) as Step);
  };
  const goBack = () => {
    if (currentStep > 1) setCurrentStep((s) => (s - 1) as Step);
    else navigate(-1);
  };

  const handleConfirm = () => {
    setConfirmed(true);
  };

  if (confirmed) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              Appointment confirmed!
            </h2>
            {selectedDoctor && (
              <p className="text-sm text-text-secondary mt-2">
                {selectedDoctor.name} ·{' '}
                {selectedDate?.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
                {selectedTime && ` at ${selectedTime}`}
              </p>
            )}
            <p className="text-xs text-text-muted mt-2">
              (Phase 1: booking is not persisted)
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => navigate('/appointments')}
            >
              View appointments
            </Button>
            <Button
              variant="ghost"
              size="md"
              fullWidth
              onClick={() => navigate('/dashboard')}
            >
              Go home
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Back */}
      <button
        onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        aria-label="Go back"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-text-primary mb-5">
        Book Appointment
      </h1>

      {/* Progress stepper */}
      <div className="flex items-center gap-1 mb-6" aria-label="Booking steps">
        {STEPS.map(({ step, label }, idx) => (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div
                className={[
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all',
                  currentStep === step
                    ? 'bg-primary-600 text-white'
                    : currentStep > step
                    ? 'bg-success text-white'
                    : 'bg-slate-200 text-text-muted',
                ].join(' ')}
                aria-current={currentStep === step ? 'step' : undefined}
              >
                {currentStep > step ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  step
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  currentStep >= step ? 'text-primary-600' : 'text-text-muted'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mb-4 ${
                  currentStep > step ? 'bg-success' : 'bg-slate-200'
                }`}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Select Doctor */}
      {currentStep === 1 && (
        <section aria-labelledby="step1-heading">
          <h2 id="step1-heading" className="text-base font-semibold text-text-primary mb-3">
            Select a doctor
          </h2>
          <div className="flex flex-col gap-3 mb-5">
            {mockDoctors.slice(0, 4).map((doctor) => (
              <button
                key={doctor.id}
                onClick={() => setSelectedDoctorId(doctor.id)}
                aria-pressed={selectedDoctorId === doctor.id}
                className={[
                  'flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  selectedDoctorId === doctor.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 bg-white hover:border-primary-300',
                ].join(' ')}
              >
                <DoctorAvatar
                  initials={doctor.avatarInitials}
                  color={doctor.avatarColor}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">
                    {doctor.name}
                  </p>
                  <p className="text-xs text-text-muted">{doctor.specialty}</p>
                </div>
                <Badge
                  variant={doctor.availableToday ? 'success' : 'neutral'}
                  dot
                >
                  {doctor.availableToday ? 'Today' : 'Tomorrow'}
                </Badge>
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled={!selectedDoctorId}
            onClick={goNext}
          >
            Continue
          </Button>
        </section>
      )}

      {/* Step 2: Select Date */}
      {currentStep === 2 && (
        <section aria-labelledby="step2-heading">
          <h2 id="step2-heading" className="text-base font-semibold text-text-primary mb-3">
            Select a date
          </h2>
          <div className="grid grid-cols-4 gap-2 mb-5 sm:grid-cols-7">
            {nextDays.map((day, idx) => {
              const isSelected =
                selectedDate?.toDateString() === day.toDateString();
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  aria-pressed={isSelected}
                  aria-label={day.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                  className={[
                    'flex flex-col items-center p-2.5 rounded-xl border-2 transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    isSelected
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 bg-white hover:border-primary-300 text-text-secondary',
                  ].join(' ')}
                >
                  <span className="text-[10px] font-medium">
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="text-lg font-bold">{day.getDate()}</span>
                  <span className="text-[10px]">
                    {day.toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                </button>
              );
            })}
          </div>
          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled={!selectedDate}
            onClick={goNext}
          >
            Continue
          </Button>
        </section>
      )}

      {/* Step 3: Select Time */}
      {currentStep === 3 && (
        <section aria-labelledby="step3-heading">
          <h2 id="step3-heading" className="text-base font-semibold text-text-primary mb-3">
            Select a time
          </h2>
          <div className="grid grid-cols-3 gap-2 mb-5 sm:grid-cols-4">
            {availableTimeSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => setSelectedTime(slot)}
                aria-pressed={selectedTime === slot}
                className={[
                  'py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  selectedTime === slot
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 bg-white hover:border-primary-300 text-text-secondary',
                ].join(' ')}
              >
                {slot}
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled={!selectedTime}
            onClick={goNext}
          >
            Continue
          </Button>
        </section>
      )}

      {/* Step 4: Appointment Type */}
      {currentStep === 4 && (
        <section aria-labelledby="step4-heading">
          <h2 id="step4-heading" className="text-base font-semibold text-text-primary mb-3">
            Appointment type
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => setAppointmentType('in_person')}
              aria-pressed={appointmentType === 'in_person'}
              className={[
                'flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                appointmentType === 'in_person'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 bg-white hover:border-primary-300',
              ].join(' ')}
            >
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                  appointmentType === 'in_person'
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-slate-100 text-text-muted'
                }`}
              >
                <MapPin className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="text-center">
                <p
                  className={`text-sm font-semibold ${
                    appointmentType === 'in_person'
                      ? 'text-primary-700'
                      : 'text-text-primary'
                  }`}
                >
                  In-Person
                </p>
                <p className="text-xs text-text-muted mt-0.5">Visit the clinic</p>
              </div>
            </button>

            <button
              onClick={() => setAppointmentType('video')}
              aria-pressed={appointmentType === 'video'}
              className={[
                'flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                appointmentType === 'video'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 bg-white hover:border-primary-300',
              ].join(' ')}
            >
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                  appointmentType === 'video'
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-slate-100 text-text-muted'
                }`}
              >
                <Video className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="text-center">
                <p
                  className={`text-sm font-semibold ${
                    appointmentType === 'video'
                      ? 'text-primary-700'
                      : 'text-text-primary'
                  }`}
                >
                  Video Call
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  Consult from home
                </p>
              </div>
            </button>
          </div>
          <Button variant="primary" size="md" fullWidth onClick={goNext}>
            Continue
          </Button>
        </section>
      )}

      {/* Step 5: Confirm */}
      {currentStep === 5 && selectedDoctor && (
        <section aria-labelledby="step5-heading">
          <h2 id="step5-heading" className="text-base font-semibold text-text-primary mb-3">
            Confirm appointment
          </h2>

          <Card className="flex flex-col gap-4 mb-5">
            {/* Doctor */}
            <div className="flex items-center gap-3">
              <DoctorAvatar
                initials={selectedDoctor.avatarInitials}
                color={selectedDoctor.avatarColor}
                size="md"
              />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {selectedDoctor.name}
                </p>
                <p className="text-xs text-text-muted">
                  {selectedDoctor.specialty}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-text-muted mb-1">Date</p>
                <p className="font-medium text-text-primary">
                  {selectedDate?.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-text-muted mb-1">Time</p>
                <p className="font-medium text-text-primary">{selectedTime}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                <p className="text-xs text-text-muted mb-1">Type</p>
                <p className="font-medium text-text-primary capitalize flex items-center gap-2">
                  {appointmentType === 'video' ? (
                    <Video className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  )}
                  {appointmentType === 'video' ? 'Video Consultation' : 'In-Person Visit'}
                </p>
              </div>
            </div>
          </Card>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={<CheckCircle2 className="h-5 w-5" />}
            onClick={handleConfirm}
            id="confirm-appointment-btn"
          >
            Confirm appointment
          </Button>
        </section>
      )}
    </PageContainer>
  );
};

export default BookAppointment;
