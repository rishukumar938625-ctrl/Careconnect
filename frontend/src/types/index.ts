// ─── Health Types ───────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface HealthCondition {
  id: string;
  _id?: string;
  slug?: string;
  name: string;
  category: HealthCategory | string;
  shortDescription: string;
  overview?: string;
  description: string;
  severity?: 'mild' | 'moderate' | 'severe' | 'chronic';
  symptoms: string[];
  causes?: string[];
  prevention?: string[];
  whenToSeekMedicalHelp?: string[];
  whenToSeeDoctor?: string[];
  lastReviewedAt?: string;
  tags?: string[];
  isSaved?: boolean;
  bookmarked?: boolean;
}

export interface Medicine {
  id: string;
  _id?: string;
  slug?: string;
  name: string;
  genericName: string;
  category: string;
  shortDescription?: string;
  description?: string;
  uses?: string[];
  commonUses?: string[];
  generalSafetyInformation?: string;
  precautions?: string[];
  commonSideEffects?: string[];
  sideEffects?: string[];
  warnings?: string[];
  dosageInstructions?: string;
  forms?: string[];
  requiresPrescription?: boolean;
  lastReviewedAt?: string;
  isSaved?: boolean;
  bookmarked?: boolean;
}

export interface HealthArticle {
  id: string;
  _id?: string;
  slug?: string;
  title: string;
  category: string;
  summary?: string;
  shortDescription?: string;
  content: string;
  tags?: string[];
  readTimeMinutes?: number;
  readingTimeMinutes?: number;
  author?: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
  lastReviewedAt?: string;
  publishedAt: string;
  isSaved?: boolean;
  bookmarked?: boolean;
}

export type HealthCategory =
  | 'Respiratory'
  | 'Neurological'
  | 'Cardiovascular'
  | 'Digestive'
  | 'Musculoskeletal'
  | 'Dermatological'
  | 'Immunological'
  | 'Mental Health'
  | 'Infectious Disease'
  | 'Wellness';

// ─── Medication Types ────────────────────────────────────────────────────────

export type MedicationFrequency =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'four_times_daily'
  | 'as_needed'
  | 'weekly'
  | 'custom';

export type MedicationStatus = 'upcoming' | 'taken' | 'missed' | 'skipped' | 'pending' | 'snoozed';
export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'snoozed';

export type MedicationForm =
  | 'tablet'
  | 'capsule'
  | 'liquid'
  | 'injection'
  | 'topical'
  | 'inhaler'
  | 'drops'
  | 'other';

export interface MedicationScheduleEntry {
  id: string;
  time: string; // HH:MM
  status: MedicationStatus;
}

export interface Medication {
  id: string;
  _id?: string;
  name: string;
  dosage: string;
  form: MedicationForm;
  frequency: MedicationFrequency;
  timesOfDay?: string[];
  times?: string[]; // Array of HH:MM strings
  startDate: string; // ISO date string
  endDate?: string; // ISO date string
  instructions?: string;
  notes?: string;
  timezone?: string;
  reminderEnabled?: boolean;
  color?: string; // Accent color for the card
  isActive?: boolean;
  todaySchedule?: MedicationScheduleEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DoseRecord {
  id: string;
  _id: string;
  userId: string;
  medicationId: Medication;
  scheduledAt: string;
  scheduledDate: string;
  scheduledTime: string;
  timezone: string;
  status: DoseStatus;
  takenAt?: string;
  snoozedUntil?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdherenceStats {
  totalScheduled: number;
  takenDoses: number;
  skippedDoses: number;
  missedDoses: number;
  adherenceRate: number;
  currentStreak: number;
  period?: string;
}

// ─── Appointment Types ───────────────────────────────────────────────────────

export type AppointmentType = 'in_person' | 'in-person' | 'video';

export type AppointmentStatus =
  | 'booked'
  | 'upcoming'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

export type DoctorSpecialty =
  | 'General Physician'
  | 'Cardiologist'
  | 'Dermatologist'
  | 'Neurologist'
  | 'Orthopedist'
  | 'Pediatrician'
  | 'Psychiatrist'
  | 'Ophthalmologist'
  | 'ENT Specialist'
  | 'Gynecologist'
  | string;

export interface Doctor {
  id?: string;
  _id?: string;
  slug?: string;
  name: string;
  specialty: DoctorSpecialty;
  qualifications: string;
  experience?: string;
  experienceYears?: number;
  hospital?: string;
  rating: number;
  reviewCount: number;
  availableToday?: boolean;
  nextAvailable?: string;
  consultationFee: string | number;
  consultationDurationMinutes?: number;
  consultationType?: 'in-person' | 'online' | 'both';
  workingDays?: string[];
  workingHours?: { start: string; end: string };
  avatarInitials: string;
  avatarColor: string;
  avatarUrl?: string;
  languages: string[];
  bio?: string;
  about?: string;
  isDemo?: boolean;
  isActive?: boolean;
  isAvailable?: boolean;
}

export interface DoctorSlot {
  startAt: string;
  endAt: string;
  timeSlot: string;
  displayTime: string;
  durationMinutes: number;
  available: boolean;
  unavailableReason?: 'booked' | 'past' | 'outside_notice' | 'blocked';
}

export interface DoctorAvailability {
  date: string;
  doctorId: string;
  doctorName: string;
  timezone: string;
  isWorkingDay: boolean;
  isBlocked: boolean;
  message?: string;
  slots: DoctorSlot[];
  availableCount: number;
  totalSlots: number;
}

export interface Appointment {
  id: string;
  _id?: string;
  patientId?: string;
  doctorId: string;
  doctor?: Doctor;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorAvatar?: string;
  startAt?: string;
  endAt?: string;
  timezone?: string;
  date: string; // ISO date string or YYYY-MM-DD
  time?: string; // HH:MM
  timeSlot?: string; // HH:MM
  type: AppointmentType;
  status: AppointmentStatus;
  reason?: string;
  cancellationReason?: string;
  notes?: string;
  hospital?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── User Profile Types ──────────────────────────────────────────────────────

export interface NotificationPreferences {
  medicationReminders: boolean;
  appointmentReminders: boolean;
  healthTips: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface ReminderSettings {
  reminderBeforeMinutes: number; // e.g. 15, 30, 60
  snoozeEnabled: boolean;
  snoozeMinutes: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatarInitials: string;
  avatarColor: string;
  dateOfBirth?: string;
  bloodType?: string;
  allergies?: string[];
  emergencyContact?: string;
  notificationPreferences: NotificationPreferences;
  reminderSettings: ReminderSettings;
  savedArticleIds: string[];
  savedConditionIds: string[];
}

export interface UserNotificationPreferences {
  medicationReminders: boolean;
  appointmentAlerts: boolean;
  healthTips: boolean;
  emailUpdates: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timeZone: string;
  crossesMidnight?: boolean;
  deliveryNotice?: string;
}

export interface PersonalHealthProfile {
  bloodGroup: string;
  allergies: string[];
  chronicConditions: string[];
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  disclaimer?: string;
}

export type UserRole = 'patient' | 'doctor' | 'admin';

export interface AuthUser {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  phone?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  notificationPreferences?: UserNotificationPreferences;
  bookmarkedConditions?: string[];
  bookmarkedMedicines?: string[];
  bookmarkedArticles?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ─── Navigation Types ────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  path: string;
  icon: string; // Lucide icon name
  activePattern?: RegExp;
}

// ─── UI Utility Types ────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

// ─── Notification Types (Phase 7) ───────────────────────────────────────────

export type NotificationType =
  | 'medication_reminder'
  | 'appointment_reminder'
  | 'health_tip'
  | 'system';

export interface AppNotification {
  id: string;
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  channel: 'in_app' | 'email' | 'sms';
  read: boolean;
  readAt?: string;
  data?: {
    medicationId?: string;
    doseId?: string;
    appointmentId?: string;
    doctorName?: string;
    scheduledFor?: string;
    actionUrl?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}
