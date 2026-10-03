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
  | 'weekly';

export type MedicationStatus = 'upcoming' | 'taken' | 'missed' | 'skipped';

export type MedicationForm =
  | 'tablet'
  | 'capsule'
  | 'liquid'
  | 'injection'
  | 'topical'
  | 'inhaler'
  | 'drops';

export interface MedicationScheduleEntry {
  id: string;
  time: string; // HH:MM
  status: MedicationStatus;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  form: MedicationForm;
  frequency: MedicationFrequency;
  times: string[]; // Array of HH:MM strings
  startDate: string; // ISO date string
  endDate?: string; // ISO date string
  notes?: string;
  color?: string; // Accent color for the card
  todaySchedule?: MedicationScheduleEntry[];
}

// ─── Appointment Types ───────────────────────────────────────────────────────

export type AppointmentType = 'in_person' | 'video';

export type AppointmentStatus =
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
  | 'Gynecologist';

export interface Doctor {
  id: string;
  name: string;
  specialty: DoctorSpecialty;
  qualifications: string;
  experience: string;
  rating: number;
  reviewCount: number;
  availableToday: boolean;
  nextAvailable: string;
  consultationFee: string;
  avatarInitials: string;
  avatarColor: string;
  languages: string[];
}

export interface Appointment {
  id: string;
  doctorId: string;
  doctor: Doctor;
  date: string; // ISO date string
  time: string; // HH:MM
  type: AppointmentType;
  status: AppointmentStatus;
  reason?: string;
  notes?: string;
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
