import mongoose, { Schema, Document } from 'mongoose';

export interface IAppointment extends Document {
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorAvatar?: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  date: string;
  timeSlot: string;
  type: 'in-person' | 'video';
  status: 'upcoming' | 'completed' | 'cancelled';
  reason: string;
  notes?: string;
  hospital: string;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    doctorId: { type: String, required: true },
    doctorName: { type: String, required: true },
    doctorSpecialty: { type: String, required: true },
    doctorAvatar: { type: String },
    patientName: { type: String, required: true },
    patientPhone: { type: String, required: true },
    patientEmail: { type: String },
    date: { type: String, required: true },
    timeSlot: { type: String, required: true },
    type: { type: String, enum: ['in-person', 'video'], default: 'in-person' },
    status: {
      type: String,
      enum: ['upcoming', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    reason: { type: String, required: true },
    notes: { type: String },
    hospital: { type: String, required: true },
  },
  { timestamps: true }
);

export const Appointment =
  (mongoose.models.Appointment as mongoose.Model<IAppointment>) ||
  mongoose.model<IAppointment>('Appointment', AppointmentSchema);
