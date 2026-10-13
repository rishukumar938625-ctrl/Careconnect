import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'patient' | 'doctor' | 'admin';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  phone?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  allergies: string[];
  chronicConditions: string[];
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  notificationPreferences: {
    medicationReminders: boolean;
    appointmentAlerts: boolean;
    healthTips: boolean;
    emailUpdates: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    timeZone: string;
  };
  bookmarkedConditions: string[];
  bookmarkedMedicines: string[];
  bookmarkedArticles: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISafeUser {
  id: string;
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  phone?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  allergies: string[];
  chronicConditions: string[];
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  notificationPreferences: {
    medicationReminders: boolean;
    appointmentAlerts: boolean;
    healthTips: boolean;
    emailUpdates: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    timeZone: string;
  };
  bookmarkedConditions: string[];
  bookmarkedMedicines: string[];
  bookmarkedArticles: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: true,
    },
    role: {
      type: String,
      enum: ['patient', 'doctor', 'admin'],
      default: 'patient',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    dateOfBirth: {
      type: String,
      default: '',
    },
    bloodGroup: {
      type: String,
      default: '',
    },
    allergies: {
      type: [String],
      default: [],
    },
    chronicConditions: {
      type: [String],
      default: [],
    },
    emergencyContact: {
      name: { type: String, default: '' },
      relationship: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    notificationPreferences: {
      medicationReminders: { type: Boolean, default: true },
      appointmentAlerts: { type: Boolean, default: true },
      healthTips: { type: Boolean, default: false },
      emailUpdates: { type: Boolean, default: true },
      quietHoursEnabled: { type: Boolean, default: false },
      quietHoursStart: { type: String, default: '22:00' },
      quietHoursEnd: { type: String, default: '07:00' },
      timeZone: { type: String, default: 'UTC' },
    },
    bookmarkedConditions: {
      type: [String],
      default: [],
    },
    bookmarkedMedicines: {
      type: [String],
      default: [],
    },
    bookmarkedArticles: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.__v;
        if (ret._id) {
          ret.id = String(ret._id);
        }
        return ret;
      },
    },
  }
);

/**
 * Returns a safe representation of the user without password hash.
 */
export function toSafeUser(user: any): ISafeUser {
  if (!user) return user;
  const raw = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete raw.passwordHash;
  delete raw.__v;
  const idStr = raw._id ? raw._id.toString() : raw.id;
  return {
    ...raw,
    id: idStr,
    _id: idStr,
    notificationPreferences: {
      medicationReminders: true,
      appointmentAlerts: true,
      healthTips: false,
      emailUpdates: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      timeZone: 'UTC',
      ...(raw.notificationPreferences || {}),
    },
  } as ISafeUser;
}

export const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>('User', UserSchema);
