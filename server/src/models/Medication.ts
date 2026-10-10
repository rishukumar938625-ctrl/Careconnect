import mongoose, { Schema, Document, Types } from 'mongoose';

export type MedicationForm =
  | 'tablet'
  | 'capsule'
  | 'liquid'
  | 'injection'
  | 'topical'
  | 'inhaler'
  | 'drops'
  | 'other';

export type MedicationFrequency =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'four_times_daily'
  | 'as_needed'
  | 'weekly'
  | 'custom';

export interface IMedication extends Document {
  userId: Types.ObjectId;
  name: string;
  dosage: string;
  form: MedicationForm;
  instructions?: string;
  frequency: MedicationFrequency;
  timesOfDay: string[]; // e.g. ["08:00", "20:00"]
  startDate: string; // ISO date string YYYY-MM-DD
  endDate?: string; // Optional ISO date string YYYY-MM-DD
  timezone: string; // IANA timezone e.g. 'UTC', 'America/New_York', 'Asia/Kolkata'
  reminderEnabled: boolean;
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MedicationSchema = new Schema<IMedication>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Medication name is required'],
      trim: true,
      minlength: [1, 'Name cannot be empty'],
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    dosage: {
      type: String,
      required: [true, 'Prescribed dosage is required'],
      trim: true,
      maxlength: [80, 'Dosage cannot exceed 80 characters'],
    },
    form: {
      type: String,
      enum: ['tablet', 'capsule', 'liquid', 'injection', 'topical', 'inhaler', 'drops', 'other'],
      default: 'tablet',
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: [500, 'Instructions cannot exceed 500 characters'],
    },
    frequency: {
      type: String,
      enum: [
        'once_daily',
        'twice_daily',
        'three_times_daily',
        'four_times_daily',
        'as_needed',
        'weekly',
        'custom',
      ],
      default: 'once_daily',
    },
    timesOfDay: {
      type: [String],
      default: ['08:00'],
      validate: {
        validator: function (times: string[]) {
          return times.every((t) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(t));
        },
        message: 'Each time in timesOfDay must be in HH:MM format (24-hour)',
      },
    },
    startDate: {
      type: String,
      required: [true, 'Start date is required'],
      validate: {
        validator: (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: 'startDate must be in YYYY-MM-DD format',
      },
    },
    endDate: {
      type: String,
      validate: {
        validator: function (this: IMedication, v: string) {
          if (!v) return true;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
          return v >= this.startDate;
        },
        message: 'endDate must be in YYYY-MM-DD format and after startDate',
      },
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
    reminderEnabled: {
      type: Boolean,
      default: true,
    },
    color: {
      type: String,
      default: '#2563EB',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        if (ret._id) {
          ret.id = String(ret._id);
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for efficient user-scoped queries
MedicationSchema.index({ userId: 1, isActive: 1, createdAt: -1 });

export const Medication =
  (mongoose.models.Medication as mongoose.Model<IMedication>) ||
  mongoose.model<IMedication>('Medication', MedicationSchema);
