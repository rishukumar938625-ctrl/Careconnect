import mongoose, { Schema, Document } from 'mongoose';

export interface IDoctor extends Document {
  slug: string;
  name: string;
  specialty: string;
  qualifications: string;
  experienceYears: number;
  hospital: string;
  rating: number;
  reviewCount: number;
  consultationFee: number;
  availableDays: string[];
  timeSlots: string[];
  isAvailable: boolean;
  avatarUrl?: string;
  about?: string;
}

const DoctorSchema = new Schema<IDoctor>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    specialty: { type: String, required: true },
    qualifications: { type: String, required: true },
    experienceYears: { type: Number, required: true },
    hospital: { type: String, required: true },
    rating: { type: Number, default: 4.8 },
    reviewCount: { type: Number, default: 120 },
    consultationFee: { type: Number, required: true },
    availableDays: [{ type: String }],
    timeSlots: [{ type: String }],
    isAvailable: { type: Boolean, default: true },
    avatarUrl: { type: String },
    about: { type: String },
  },
  { timestamps: true }
);

export const Doctor =
  (mongoose.models.Doctor as mongoose.Model<IDoctor>) ||
  mongoose.model<IDoctor>('Doctor', DoctorSchema);
