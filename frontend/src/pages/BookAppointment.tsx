import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  CheckCircle2,
  Video,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { DoctorAvatar } from '../components/appointments/AppointmentCards';
import { doctorApi, appointmentApi } from '../services/api';
import type { Doctor, DoctorSlot, AppointmentType, Appointment } from '../types';

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { step: 1 as Step, label: 'Doctor' },
  { step: 2 as Step, label: 'Date' },
  { step: 3 as Step, label: 'Time' },
  { step: 4 as Step, label: 'Type' },
  { step: 5 as Step, label: 'Confirm' },
];

function getNextFourteenDays() {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDateToIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const BookAppointment: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedDoctorId = searchParams.get('doctorId') || '';
  const rescheduleAppointmentId = searchParams.get('rescheduleId') || '';

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(preselectedDoctorId);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availableSlots, setAvailableSlots] = useState<DoctorSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<DoctorSlot | null>(null);

  const [appointmentType, setAppointmentType] = useState<AppointmentType>('in_person');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);

  const nextDays = getNextFourteenDays();

  // Load doctors and existing appointment (if rescheduling)
  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      try {
        setLoadingDoctors(true);
        const [docsRes, apptRes] = await Promise.all([
          doctorApi.getAll(),
          rescheduleAppointmentId
            ? appointmentApi.getAppointmentById(rescheduleAppointmentId).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (!isMounted) return;
        setDoctors(docsRes.data || []);

        if (apptRes) {
          const doc = apptRes.doctor as { _id?: string; id?: string } | undefined;
          const docId = apptRes.doctorId || doc?.id || doc?._id;
          if (docId) {
            setSelectedDoctorId(docId);
            setCurrentStep(2); // In reschedule mode, skip straight to Date selection
          }
          if (apptRes.type) {
            setAppointmentType(apptRes.type);
          }
          if (apptRes.reason) {
            setReason(apptRes.reason);
          }
        } else if (preselectedDoctorId) {
          setSelectedDoctorId(preselectedDoctorId);
          setCurrentStep(2); // Preselected doctor skips to date
        }
      } catch (err) {
        console.error('Error loading doctors or appointment for booking:', err);
      } finally {
        if (isMounted) setLoadingDoctors(false);
      }
    }
    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [preselectedDoctorId, rescheduleAppointmentId]);

  const selectedDoctor = doctors.find(
    (d) =>
      d.id === selectedDoctorId ||
      d._id === selectedDoctorId ||
      d.slug === selectedDoctorId
  );

  // Fetch slots whenever selectedDate or selectedDoctor changes
  const fetchSlotsForDate = useCallback(
    async (date: Date) => {
      if (!selectedDoctorId) return;
      const dateStr = formatDateToIsoDay(date);
      try {
        setLoadingSlots(true);
        setSlotsError(null);
        setSelectedSlot(null);
        const res = await doctorApi.getAvailability(selectedDoctorId, dateStr);
        if (res.data?.slots) {
          setAvailableSlots(res.data.slots);
          if (res.data.slots.length === 0 && res.data.message) {
            setSlotsError(res.data.message);
          }
        } else {
          setAvailableSlots([]);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch doctor availability slots.';
        setSlotsError(msg);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [selectedDoctorId]
  );

  useEffect(() => {
    if (selectedDate && selectedDoctorId) {
      fetchSlotsForDate(selectedDate);
    }
  }, [selectedDate, selectedDoctorId, fetchSlotsForDate]);

  const goNext = () => {
    if (currentStep < 5) setCurrentStep((s) => (s + 1) as Step);
  };
  const goBack = () => {
    if (currentStep > 1) setCurrentStep((s) => (s - 1) as Step);
    else navigate(-1);
  };

  const handleConfirm = async () => {
    if (!selectedDoctor || !selectedSlot || submitting) return;
    try {
      setSubmitting(true);
      setSubmitError(null);

      const targetDoctorId = (selectedDoctor._id || selectedDoctor.id || selectedDoctor.slug) as string;

      if (rescheduleAppointmentId) {
        // Reschedule flow
        const res = await appointmentApi.rescheduleAppointment(
          rescheduleAppointmentId,
          {
            startAt: selectedSlot.startAt,
            reason: reason.trim() || undefined,
          }
        );
        setConfirmedAppointment(res.appointment);
      } else {
        // New booking flow
        const newAppt = await appointmentApi.bookAppointment({
          doctorId: targetDoctorId,
          startAt: selectedSlot.startAt,
          type: appointmentType === 'video' ? 'video' : 'in-person',
          reason: reason.trim() || undefined,
        });
        setConfirmedAppointment(newAppt);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to book appointment. The slot may have just been reserved by another patient.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmation Success View
  if (confirmedAppointment) {
    const formattedDateStr = selectedDate?.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {rescheduleAppointmentId
                ? 'Appointment rescheduled successfully!'
                : 'Appointment confirmed!'}
            </h2>
            {selectedDoctor && (
              <p className="text-sm text-text-secondary mt-2">
                {selectedDoctor.name} · {formattedDateStr} at{' '}
                {selectedSlot?.displayTime || selectedSlot?.timeSlot}
              </p>
            )}
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs text-text-secondary">
              <Clock className="h-3.5 w-3.5 text-text-muted" />
              <span>Timezone: {selectedDoctor?.workingHours ? 'UTC' : 'Local'}</span>
            </div>
          </div>

          <Card className="max-w-sm w-full text-left text-xs text-text-secondary p-4 bg-slate-50">
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="font-medium text-text-muted">Doctor:</span>
              <span className="font-semibold text-text-primary">{selectedDoctor?.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="font-medium text-text-muted">Specialty:</span>
              <span>{selectedDoctor?.specialty}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="font-medium text-text-muted">Consultation:</span>
              <span className="capitalize">
                {appointmentType === 'video' ? 'Video Consultation' : 'In-Person Visit'}
              </span>
            </div>
            {reason && (
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="font-medium text-text-muted">Reason:</span>
                <span className="truncate max-w-[180px]">{reason}</span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="font-medium text-text-muted">Status:</span>
              <span className="text-emerald-700 font-semibold">Confirmed (Booked)</span>
            </div>
          </Card>

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
              Go to Dashboard
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
        onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        aria-label="Go back"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-text-primary mb-1">
        {rescheduleAppointmentId ? 'Reschedule Appointment' : 'Book Appointment'}
      </h1>
      <p className="text-xs text-text-muted mb-5">
        {rescheduleAppointmentId
          ? 'Select a new date and time for your consultation.'
          : 'Schedule a visit with a verified healthcare specialist.'}
      </p>

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

          {loadingDoctors ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-text-muted">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              <p className="text-xs">Loading available doctors…</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mb-5">
              {doctors.map((doctor) => {
                const docId = (doctor.id || doctor._id || doctor.slug) as string;
                const isSelected = selectedDoctorId === docId;
                return (
                  <button
                    key={docId}
                    onClick={() => setSelectedDoctorId(docId)}
                    aria-pressed={isSelected}
                    className={[
                      'flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      isSelected
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {doctor.name}
                        </p>
                        {doctor.isDemo && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                            Demo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">{doctor.specialty}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-primary-600">
                        {typeof doctor.consultationFee === 'number'
                          ? `$${doctor.consultationFee}`
                          : doctor.consultationFee}
                      </p>
                      <Badge
                        variant={doctor.availableToday ? 'success' : 'neutral'}
                        dot
                      >
                        {doctor.availableToday ? 'Available' : 'Schedule'}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

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
          <h2 id="step2-heading" className="text-base font-semibold text-text-primary mb-1">
            Select a date
          </h2>
          <p className="text-xs text-text-muted mb-4">
            Showing available consultation days for {selectedDoctor?.name || 'selected doctor'}.
          </p>

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
                      ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold'
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
            Continue to Select Time
          </Button>
        </section>
      )}

      {/* Step 3: Select Time Slot */}
      {currentStep === 3 && (
        <section aria-labelledby="step3-heading">
          <h2 id="step3-heading" className="text-base font-semibold text-text-primary mb-1">
            Select an available time slot
          </h2>
          <p className="text-xs text-text-muted mb-4">
            {selectedDate?.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>

          {loadingSlots ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-text-muted">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
              <p className="text-xs">Fetching real-time available slots…</p>
            </div>
          ) : slotsError ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs mb-5">
              <p className="font-semibold mb-1">Notice</p>
              <p>{slotsError}</p>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-text-muted text-xs text-center mb-5">
              No time slots available for this date. Please pick another date.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-5 sm:grid-cols-4">
              {availableSlots.map((slot) => {
                const isSelected = selectedSlot?.startAt === slot.startAt;
                const isAvailable = slot.available;

                return (
                  <button
                    key={slot.startAt}
                    disabled={!isAvailable}
                    onClick={() => setSelectedSlot(slot)}
                    aria-pressed={isSelected}
                    title={
                      !isAvailable
                        ? slot.unavailableReason === 'booked'
                          ? 'This slot is already booked'
                          : 'Unavailable'
                        : 'Available'
                    }
                    className={[
                      'py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition-all duration-150 relative',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      !isAvailable
                        ? 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed line-through'
                        : isSelected
                        ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold shadow-sm'
                        : 'border-slate-200 bg-white hover:border-primary-300 text-text-secondary',
                    ].join(' ')}
                  >
                    <span>{slot.displayTime || slot.timeSlot}</span>
                    {!isAvailable && (
                      <span className="block text-[8px] text-slate-400 no-underline capitalize mt-0.5">
                        {slot.unavailableReason === 'booked' ? 'Booked' : 'Passed'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled={!selectedSlot}
            onClick={goNext}
          >
            Continue
          </Button>
        </section>
      )}

      {/* Step 4: Appointment Type & Reason */}
      {currentStep === 4 && (
        <section aria-labelledby="step4-heading">
          <h2 id="step4-heading" className="text-base font-semibold text-text-primary mb-3">
            Appointment details
          </h2>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => setAppointmentType('in_person')}
              aria-pressed={appointmentType === 'in_person' || appointmentType === 'in-person'}
              className={[
                'flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                appointmentType === 'in_person' || appointmentType === 'in-person'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 bg-white hover:border-primary-300',
              ].join(' ')}
            >
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-xl ${
                  appointmentType === 'in_person' || appointmentType === 'in-person'
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-slate-100 text-text-muted'
                }`}
              >
                <MapPin className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="text-center">
                <p
                  className={`text-sm font-semibold ${
                    appointmentType === 'in_person' || appointmentType === 'in-person'
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

          {/* Reason for visit (Limited-length text) */}
          <div className="mb-5">
            <label htmlFor="reason-input" className="block text-xs font-medium text-text-primary mb-1">
              Reason for visit (optional, max 250 characters)
            </label>
            <textarea
              id="reason-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 250))}
              placeholder="e.g. Annual checkup, seasonal allergy symptoms, follow-up on medication…"
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex justify-between text-[10px] text-text-muted mt-1">
              <span>Please avoid entering sensitive financial or unneeded private details.</span>
              <span>{reason.length}/250</span>
            </div>
          </div>

          <Button variant="primary" size="md" fullWidth onClick={goNext}>
            Review and Confirm
          </Button>
        </section>
      )}

      {/* Step 5: Review and Final Confirmation */}
      {currentStep === 5 && selectedDoctor && selectedSlot && (
        <section aria-labelledby="step5-heading">
          <h2 id="step5-heading" className="text-base font-semibold text-text-primary mb-3">
            Confirm your appointment
          </h2>

          {submitError && (
            <div className="flex items-start gap-2.5 p-3.5 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Booking failed</p>
                <p>{submitError}</p>
              </div>
            </div>
          )}

          <Card className="flex flex-col gap-4 mb-5">
            {/* Doctor */}
            <div className="flex items-center gap-3">
              <DoctorAvatar
                initials={selectedDoctor.avatarInitials}
                color={selectedDoctor.avatarColor}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">
                  {selectedDoctor.name}
                </p>
                <p className="text-xs text-text-muted">
                  {selectedDoctor.specialty} · {selectedDoctor.qualifications}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-primary-600">
                  {typeof selectedDoctor.consultationFee === 'number'
                    ? `$${selectedDoctor.consultationFee}`
                    : selectedDoctor.consultationFee}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-text-muted mb-1 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Date
                </p>
                <p className="font-medium text-text-primary text-xs">
                  {selectedDate?.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-text-muted mb-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Time
                </p>
                <p className="font-medium text-text-primary text-xs">
                  {selectedSlot.displayTime || selectedSlot.timeSlot}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                <p className="text-xs text-text-muted mb-1">Type</p>
                <p className="font-medium text-text-primary capitalize flex items-center gap-2 text-xs">
                  {appointmentType === 'video' ? (
                    <Video className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  )}
                  {appointmentType === 'video'
                    ? 'Video Consultation'
                    : 'In-Person Visit (Partner Clinic)'}
                </p>
              </div>
              {reason && (
                <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                  <p className="text-xs text-text-muted mb-1">Reason for visit</p>
                  <p className="text-xs text-text-primary font-medium">{reason}</p>
                </div>
              )}
            </div>
          </Card>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={submitting}
            leftIcon={
              submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )
            }
            onClick={handleConfirm}
            id="confirm-appointment-btn"
          >
            {submitting
              ? 'Processing Booking…'
              : rescheduleAppointmentId
              ? 'Confirm Reschedule'
              : 'Confirm Appointment'}
          </Button>
        </section>
      )}
    </PageContainer>
  );
};

export default BookAppointment;
