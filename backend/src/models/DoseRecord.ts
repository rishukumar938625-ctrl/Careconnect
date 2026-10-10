import mongoose, { Schema, Document, Types } from 'mongoose';

export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'snoozed';

export interface IDoseRecord extends Document {
  userId: Types.ObjectId;
  medicationId: Types.ObjectId;
  scheduledAt: Date;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  timezone: string;
  status: DoseStatus;
  takenAt?: Date;
  snoozedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DoseRecordSchema = new Schema<IDoseRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    medicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Medication',
      required: [true, 'Medication ID is required'],
      index: true,
    },
    scheduledAt: {
      type: Date,
      required: [true, 'scheduledAt is required'],
      index: true,
    },
    scheduledDate: {
      type: String,
      required: [true, 'scheduledDate is required'],
      index: true,
      validate: {
        validator: (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: 'scheduledDate must be in YYYY-MM-DD format',
      },
    },
    scheduledTime: {
      type: String,
      required: [true, 'scheduledTime is required'],
      validate: {
        validator: (v: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(v),
        message: 'scheduledTime must be in HH:MM format',
      },
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'taken', 'skipped', 'snoozed'],
      default: 'pending',
      index: true,
    },
    takenAt: {
      type: Date,
    },
    snoozedUntil: {
      type: Date,
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

// Compound unique index guaranteeing idempotency: prevents duplicate doses for the same medication at the same date and time
DoseRecordSchema.index(
  { userId: 1, medicationId: 1, scheduledDate: 1, scheduledTime: 1 },
  { unique: true }
);

// Compound index for querying user's doses by date range
DoseRecordSchema.index({ userId: 1, scheduledDate: 1, scheduledTime: 1 });

export const DoseRecord =
  (mongoose.models.DoseRecord as mongoose.Model<IDoseRecord>) ||
  mongoose.model<IDoseRecord>('DoseRecord', DoseRecordSchema);
