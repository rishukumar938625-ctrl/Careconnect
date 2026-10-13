import mongoose, { Schema, Document, Types } from 'mongoose';

export type JobType =
  | 'medication_reminder'
  | 'appointment_24h'
  | 'appointment_1h'
  | 'health_tip';

export type JobChannel = 'in_app' | 'email' | 'sms';

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface INotificationJobPayload {
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: 'dose' | 'appointment' | 'medication';
  recipientEmail?: string;
  recipientName?: string;
  meta?: Record<string, unknown>;
}

export interface INotificationJob extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  jobType: JobType;
  channel: JobChannel;
  idempotencyKey: string;
  status: JobStatus;
  scheduledFor: Date;
  originalScheduledFor?: Date;
  deferredReason?: string;
  lockedUntil?: Date;
  lockedBy?: string;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  error?: string;
  payload: INotificationJobPayload;
  deliveredAt?: Date;
  deliveryResult?: {
    simulated?: boolean;
    provider?: string;
    messageId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const NotificationJobSchema = new Schema<INotificationJob>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    jobType: {
      type: String,
      enum: ['medication_reminder', 'appointment_24h', 'appointment_1h', 'health_tip'],
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'sms'],
      default: 'in_app',
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'delivered', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    originalScheduledFor: {
      type: Date,
    },
    deferredReason: {
      type: String,
    },
    lockedUntil: {
      type: Date,
      index: true,
    },
    lockedBy: {
      type: String,
      trim: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastAttemptAt: {
      type: Date,
    },
    error: {
      type: String,
    },
    payload: {
      title: { type: String, required: true },
      message: { type: String, required: true },
      referenceId: { type: String },
      referenceType: { type: String, enum: ['dose', 'appointment', 'medication'] },
      recipientEmail: { type: String },
      recipientName: { type: String },
      meta: { type: Schema.Types.Mixed, default: {} },
    },
    deliveredAt: {
      type: Date,
    },
    deliveryResult: {
      simulated: { type: Boolean },
      provider: { type: String },
      messageId: { type: String },
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

// Concurrency-safe claim index: finding eligible pending jobs to lock
NotificationJobSchema.index({ status: 1, scheduledFor: 1, lockedUntil: 1 });

// Cancellation lookup index: finding pending jobs by reference ID (e.g. appointmentId, doseId)
NotificationJobSchema.index({ 'payload.referenceId': 1, status: 1 });

export const NotificationJob =
  (mongoose.models.NotificationJob as mongoose.Model<INotificationJob>) ||
  mongoose.model<INotificationJob>('NotificationJob', NotificationJobSchema);
