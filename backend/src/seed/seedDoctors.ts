import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, disconnectDB } from '../config/db.js';
import { Doctor } from '../models/Doctor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

/**
 * FICTIONAL DEMO DOCTORS
 * Notice: All records below are simulated demonstration data created strictly for
 * software testing and UI development. None of the entries represent licensed medical
 * practitioners or real healthcare facilities.
 */
export const demoDoctors = [
  {
    slug: 'demo-doc-johnson',
    name: 'Dr. Sarah Johnson',
    specialty: 'General Physician',
    qualifications: 'MBBS, MD (Simulated Demo Credential)',
    experienceYears: 12,
    experience: '12 years',
    hospital: 'CareConnect Demo Wellness Center',
    rating: 4.8,
    reviewCount: 234,
    consultationFee: 50,
    consultationDurationMinutes: 30,
    consultationType: 'both',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    workingHours: { start: '09:00', end: '17:00' },
    blockedDates: [],
    timezone: 'UTC',
    isActive: true,
    isAvailable: true,
    avatarInitials: 'SJ',
    avatarColor: '#2563EB',
    languages: ['English', 'Spanish'],
    isDemo: true,
    bio: '[DEMO DATA — Fictional healthcare profile for testing and development purposes only. Not a licensed professional.] Focused on preventive care, general consultations, and holistic wellness monitoring.',
    about: 'Experienced in outpatient general medicine, preventive annual health checkups, and chronic lifestyle condition monitoring in a demonstration setting.',
  },
  {
    slug: 'demo-doc-lee',
    name: 'Dr. Michael Lee',
    specialty: 'Cardiologist',
    qualifications: 'MBBS, MD, DM (Simulated Demo Credential)',
    experienceYears: 18,
    experience: '18 years',
    hospital: 'Metro Demo Cardiovascular Institute',
    rating: 4.9,
    reviewCount: 412,
    consultationFee: 80,
    consultationDurationMinutes: 30,
    consultationType: 'both',
    workingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    workingHours: { start: '10:00', end: '16:00' },
    blockedDates: [],
    timezone: 'UTC',
    isActive: true,
    isAvailable: true,
    avatarInitials: 'ML',
    avatarColor: '#0EA5A4',
    languages: ['English', 'Mandarin'],
    isDemo: true,
    bio: '[DEMO DATA — Fictional healthcare profile for testing and development purposes only. Not a licensed professional.] Demonstration profile for cardiovascular risk assessment and hypertension consultations.',
    about: 'Simulated cardiology specialist with experience in lipid disorders, non-invasive cardiac evaluation, and long-term blood pressure control.',
  },
  {
    slug: 'demo-doc-carter',
    name: 'Dr. Emily Carter',
    specialty: 'Dermatologist',
    qualifications: 'MBBS, MD (Simulated Demo Credential)',
    experienceYears: 9,
    experience: '9 years',
    hospital: 'DermaHealth Demo Clinic',
    rating: 4.7,
    reviewCount: 178,
    consultationFee: 65,
    consultationDurationMinutes: 30,
    consultationType: 'both',
    workingDays: ['Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
    workingHours: { start: '09:30', end: '16:30' },
    blockedDates: [],
    timezone: 'UTC',
    isActive: true,
    isAvailable: true,
    avatarInitials: 'EC',
    avatarColor: '#7C3AED',
    languages: ['English', 'French'],
    isDemo: true,
    bio: '[DEMO DATA — Fictional healthcare profile for testing and development purposes only. Not a licensed professional.] Clinical dermatology testing profile focusing on dermatitis and skin barrier health.',
    about: 'Demonstration practitioner focusing on eczema, allergic dermatitis, and outpatient skincare evaluations.',
  },
  {
    slug: 'demo-doc-patel',
    name: 'Dr. Raj Patel',
    specialty: 'Neurologist',
    qualifications: 'MBBS, MD, DM (Simulated Demo Credential)',
    experienceYears: 15,
    experience: '15 years',
    hospital: 'NeuroCare Demo Research Center',
    rating: 4.8,
    reviewCount: 301,
    consultationFee: 90,
    consultationDurationMinutes: 45,
    consultationType: 'both',
    workingDays: ['Monday', 'Wednesday', 'Friday'],
    workingHours: { start: '09:00', end: '15:00' },
    blockedDates: [],
    timezone: 'UTC',
    isActive: true,
    isAvailable: true,
    avatarInitials: 'RP',
    avatarColor: '#EA580C',
    languages: ['English', 'Hindi', 'Gujarati'],
    isDemo: true,
    bio: '[DEMO DATA — Fictional healthcare profile for testing and development purposes only. Not a licensed professional.] Neurological consultation profile for headache and migraine management testing.',
    about: 'Simulated specialist in chronic migraine syndromes, nerve pain evaluation, and sleep disorder assessments.',
  },
  {
    slug: 'demo-doc-khan',
    name: 'Dr. Aisha Khan',
    specialty: 'Pediatrician',
    qualifications: 'MBBS, MD (Simulated Demo Credential)',
    experienceYears: 11,
    experience: '11 years',
    hospital: 'HappyKids Demo Health Pavilion',
    rating: 4.9,
    reviewCount: 519,
    consultationFee: 55,
    consultationDurationMinutes: 30,
    consultationType: 'both',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    workingHours: { start: '08:30', end: '16:30' },
    blockedDates: [],
    timezone: 'UTC',
    isActive: true,
    isAvailable: true,
    avatarInitials: 'AK',
    avatarColor: '#DB2777',
    languages: ['English', 'Urdu'],
    isDemo: true,
    bio: '[DEMO DATA — Fictional healthcare profile for testing and development purposes only. Not a licensed professional.] Pediatric outpatient demonstration profile for infant and child wellness checkups.',
    about: 'Dedicated to child wellness, immunization schedules, and childhood infection triage in a demonstration capacity.',
  },
  {
    slug: 'demo-doc-wilson',
    name: 'Dr. James Wilson',
    specialty: 'Orthopedist',
    qualifications: 'MBBS, MS (Simulated Demo Credential)',
    experienceYears: 20,
    experience: '20 years',
    hospital: 'OrthoSpine Demo Institute',
    rating: 4.7,
    reviewCount: 287,
    consultationFee: 75,
    consultationDurationMinutes: 30,
    consultationType: 'both',
    workingDays: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    workingHours: { start: '09:00', end: '17:00' },
    blockedDates: [],
    timezone: 'UTC',
    isActive: true,
    isAvailable: true,
    avatarInitials: 'JW',
    avatarColor: '#059669',
    languages: ['English'],
    isDemo: true,
    bio: '[DEMO DATA — Fictional healthcare profile for testing and development purposes only. Not a licensed professional.] Orthopedic demonstration profile for joint mobility and sports recovery guidance.',
    about: 'Simulated orthopedic specialist with extensive focus on joint pain, sports injuries, and rehabilitation advice.',
  },
];

export async function seedDoctors(): Promise<void> {
  console.log('🌱 Starting idempotent development seed for demo doctors...');
  console.log('ℹ️  Note: All records are strictly synthetic demo profiles labeled with isDemo: true.\n');

  try {
    await connectDB();

    // Idempotent upsert operations by slug — preserves existing user data and avoids duplicate entries
    const bulkOps = demoDoctors.map((doc) => ({
      updateOne: {
        filter: { slug: doc.slug },
        update: { $set: doc },
        upsert: true,
      },
    }));

    const result = await Doctor.bulkWrite(bulkOps as any);

    console.log(`✅ Doctor seeding complete:`);
    console.log(`   • Matched:  ${result.matchedCount}`);
    console.log(`   • Modified: ${result.modifiedCount}`);
    console.log(`   • Upserted: ${result.upsertedCount}`);
    console.log(`   • Total Demo Doctors: ${demoDoctors.length}`);
  } catch (error) {
    console.error('❌ Failed to seed demo doctors:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

// Execute directly if run as a script
if (process.argv[1] && process.argv[1].endsWith('seedDoctors.ts')) {
  seedDoctors().then(() => {
    console.log('🏁 Seed script finished successfully.');
    process.exit(0);
  });
}
