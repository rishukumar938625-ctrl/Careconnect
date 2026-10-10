import mongoose, { Schema, Document } from 'mongoose';

export type AppointmentStatus =
  | 'booked'
  | 'upcoming'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

export type AppointmentType = 'in-person' | 'video';

export interface IAppointment extends Document {
  _id: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  doctorName: string;
  doctorSpecialty: string;
  doctorAvatar?: string;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  date: string;
  timeSlot: string;
  type: AppointmentType;
  status: AppointmentStatus;
  reason?: string;
  cancellationReason?: string;
  notes?: string;
  hospital?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    doctorName: { type: String, required: true, trim: true },
    doctorSpecialty: { type: String, required: true, trim: true },
    doctorAvatar: { type: String },
    patientName: { type: String, trim: true },
    patientPhone: { type: String, trim: true },
    patientEmail: { type: String, trim: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, default: 'UTC' },
    date: { type: String, required: true },
    timeSlot: { type: String, required: true },
    type: {
      type: String,
      enum: ['in-person', 'video'],
      default: 'in-person',
    },
    status: {
      type: String,
      enum: ['booked', 'upcoming', 'completed', 'cancelled', 'rescheduled'],
      default: 'booked',
      index: true,
    },
    reason: {
      type: String,
      maxlength: 250,
      trim: true,
    },
    cancellationReason: {
      type: String,
      maxlength: 250,
      trim: true,
    },
    notes: { type: String, trim: true },
    hospital: { type: String, default: 'CareConnect Partner Clinic' },
  },
  { timestamps: true }
);

// Database-level double-booking prevention:
// Unique partial index on (doctorId, startAt) for active appointments.
// Cancelled and completed appointments are excluded from this index, allowing previously cancelled slots to be re-booked.
AppointmentSchema.index(
  { doctorId: 1, startAt: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['booked', 'upcoming', 'rescheduled'] },
    },
  }
);

// Patient history and sorting
AppointmentSchema.index({ patientId: 1, startAt: -1 });
AppointmentSchema.index({ patientId: 1, status: 1 });
AppointmentSchema.index({ doctorId: 1, startAt: 1, endAt: 1 });

export const Appointment =
  (mongoose.models.Appointment as mongoose.Model<IAppointment>) ||
  mongoose.model<IAppointment>('Appointment', AppointmentSchema);
