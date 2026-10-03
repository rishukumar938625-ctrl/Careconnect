import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
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
  };
  bookmarkedConditions: string[];
  bookmarkedMedicines: string[];
  bookmarkedArticles: string[];
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    dateOfBirth: { type: String },
    bloodGroup: { type: String },
    allergies: [{ type: String }],
    chronicConditions: [{ type: String }],
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
    },
    bookmarkedConditions: [{ type: String }],
    bookmarkedMedicines: [{ type: String }],
    bookmarkedArticles: [{ type: String }],
  },
  { timestamps: true }
);

export const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>('User', UserSchema);
