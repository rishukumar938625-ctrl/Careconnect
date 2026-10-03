import mongoose, { Schema, Document } from 'mongoose';

export interface IAdherenceLog {
  date: string;
  time: string;
  status: 'taken' | 'missed' | 'skipped';
}

export interface IMedication extends Document {
  name: string;
  dosage: string;
  form: 'tablet' | 'capsule' | 'liquid' | 'injection' | 'topical' | 'inhaler' | 'drops';
  frequency: 'once_daily' | 'twice_daily' | 'thrice_daily' | 'as_needed' | 'weekly';
  times: string[];
  startDate: string;
  endDate?: string;
  instructions?: string;
  reminderEnabled: boolean;
  color?: string;
  status: 'upcoming' | 'taken' | 'missed' | 'skipped';
  adherenceLogs: IAdherenceLog[];
}

const AdherenceLogSchema = new Schema<IAdherenceLog>({
  date: { type: String, required: true },
  time: { type: String, required: true },
  status: { type: String, enum: ['taken', 'missed', 'skipped'], required: true },
});

const MedicationSchema = new Schema<IMedication>(
  {
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    form: {
      type: String,
      enum: ['tablet', 'capsule', 'liquid', 'injection', 'topical', 'inhaler', 'drops'],
      default: 'tablet',
    },
    frequency: {
      type: String,
      enum: ['once_daily', 'twice_daily', 'thrice_daily', 'as_needed', 'weekly'],
      default: 'once_daily',
    },
    times: [{ type: String }],
    startDate: { type: String, required: true },
    endDate: { type: String },
    instructions: { type: String },
    reminderEnabled: { type: Boolean, default: true },
    color: { type: String, default: '#2563EB' },
    status: {
      type: String,
      enum: ['upcoming', 'taken', 'missed', 'skipped'],
      default: 'upcoming',
    },
    adherenceLogs: [AdherenceLogSchema],
  },
  { timestamps: true }
);

export const Medication =
  (mongoose.models.Medication as mongoose.Model<IMedication>) ||
  mongoose.model<IMedication>('Medication', MedicationSchema);
