import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkingHours {
  start: string; // e.g. "09:00"
  end: string;   // e.g. "17:00"
}

export interface IDoctor extends Document {
  _id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  specialty: string;
  bio?: string;
  about?: string;
  qualifications: string;
  experienceYears: number;
  experience?: string;
  hospital: string;
  rating: number;
  reviewCount: number;
  consultationFee: number;
  consultationDurationMinutes: number;
  consultationType: 'in-person' | 'online' | 'both';
  availableDays: string[];
  workingDays: string[];
  workingHours: IWorkingHours;
  timeSlots: string[];
  blockedDates: string[];
  timezone: string;
  isActive: boolean;
  isAvailable: boolean;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarColor?: string;
  languages: string[];
  isDemo?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorSchema = new Schema<IDoctor>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    specialty: { type: String, required: true, trim: true, index: true },
    bio: { type: String, trim: true },
    about: { type: String, trim: true },
    qualifications: { type: String, required: true, trim: true },
    experienceYears: { type: Number, required: true, default: 5 },
    experience: { type: String },
    hospital: { type: String, required: true, trim: true },
    rating: { type: Number, default: 4.8 },
    reviewCount: { type: Number, default: 100 },
    consultationFee: { type: Number, required: true, default: 50 },
    consultationDurationMinutes: { type: Number, required: true, default: 30 },
    consultationType: {
      type: String,
      enum: ['in-person', 'online', 'both'],
      default: 'both',
    },
    availableDays: [{ type: String }],
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
    },
    timeSlots: [{ type: String }],
    blockedDates: [{ type: String }],
    timezone: { type: String, default: 'UTC' },
    isActive: { type: Boolean, default: true, index: true },
    isAvailable: { type: Boolean, default: true },
    avatarUrl: { type: String },
    avatarInitials: { type: String },
    avatarColor: { type: String },
    languages: {
      type: [String],
      default: ['English'],
    },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound index for active doctor specialty searches
DoctorSchema.index({ specialty: 1, isActive: 1 });
DoctorSchema.index({ name: 1, specialty: 1, isActive: 1 });

export const Doctor =
  (mongoose.models.Doctor as mongoose.Model<IDoctor>) ||
  mongoose.model<IDoctor>('Doctor', DoctorSchema);
