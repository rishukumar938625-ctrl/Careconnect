import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Condition } from '../models/Condition.js';
import { Medicine } from '../models/Medicine.js';
import { Article } from '../models/Article.js';
import { Doctor } from '../models/Doctor.js';
import { Medication } from '../models/Medication.js';
import { User } from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const initialConditions = [
  {
    slug: 'hc-001',
    name: 'Common Cold',
    category: 'Respiratory',
    shortDescription: 'A mild viral infection of the upper respiratory tract.',
    description: 'The common cold is a viral infection of the nose and throat. It is usually harmless, though it may not feel that way.',
    severity: 'mild',
    symptoms: ['Runny nose', 'Sore throat', 'Cough', 'Sneezing', 'Mild fever'],
    treatments: ['Rest and hydration', 'Over-the-counter pain relievers', 'Decongestants', 'Warm liquids'],
    whenToSeeDoctor: ['Fever above 101.3°F', 'Symptoms last more than 10 days', 'Severe headache or chest pain'],
    prevention: ['Wash hands frequently', 'Avoid touching eyes/nose', 'Disinfect surfaces'],
    bookmarked: false,
  },
  {
    slug: 'hc-002',
    name: 'Migraine & Tension Headache',
    category: 'Neurological',
    shortDescription: 'Pain or discomfort in the head, scalp, or neck area.',
    description: 'Headaches are one of the most common health complaints. They range from mild discomfort to severe pain and can affect daily activities.',
    severity: 'moderate',
    symptoms: ['Throbbing pain', 'Sensitivity to light and sound', 'Nausea', 'Aura'],
    treatments: ['Rest in a quiet, dark room', 'Hydration', 'NSAIDs or Triptans', 'Cold compress'],
    whenToSeeDoctor: ['Sudden, severe headache (thunderclap)', 'Headache with fever or stiff neck', 'Confusion or numbness'],
    prevention: ['Maintain regular sleep schedule', 'Stay hydrated', 'Manage stress levels'],
    bookmarked: true,
  },
  {
    slug: 'hc-003',
    name: 'Asthma',
    category: 'Respiratory',
    shortDescription: 'A condition in which airways narrow, swell, and produce extra mucus.',
    description: 'Asthma is a chronic condition involving the airways in the lungs. It causes recurring episodes of wheezing, breathlessness, chest tightness, and coughing.',
    severity: 'chronic',
    symptoms: ['Shortness of breath', 'Chest tightness', 'Wheezing when exhaling', 'Coughing attacks'],
    treatments: ['Inhaled corticosteroids', 'Quick-relief bronchodilators', 'Avoidance of asthma triggers'],
    whenToSeeDoctor: ['Rapid worsening of shortness of breath', 'No improvement after using rescue inhaler', 'Shortness of breath with minimal activity'],
    prevention: ['Identify and avoid triggers', 'Take maintenance medications as prescribed', 'Monitor peak flow'],
    bookmarked: false,
  },
  {
    slug: 'hc-004',
    name: 'Hypertension',
    category: 'Cardiovascular',
    shortDescription: 'High blood pressure that can lead to serious cardiovascular events.',
    description: 'Hypertension is a common condition where the long-term force of the blood against artery walls is high enough that it may eventually cause heart disease.',
    severity: 'chronic',
    symptoms: ['Often asymptomatic (silent killer)', 'Occasional headaches', 'Shortness of breath'],
    treatments: ['Lifestyle modifications (DASH diet, exercise)', 'Antihypertensive medications (ACE inhibitors, ARBs, Beta blockers)'],
    whenToSeeDoctor: ['Blood pressure reading > 180/120 mmHg', 'Chest pain or shortness of breath', 'Numbness or vision changes'],
    prevention: ['Reduce sodium intake', 'Regular aerobic exercise', 'Maintain healthy body weight'],
    bookmarked: false,
  }
];

const initialMedicines = [
  {
    slug: 'med-001',
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    category: 'Analgesics',
    shortDescription: 'Common pain reliever and fever reducer.',
    description: 'Paracetamol is a widely used over-the-counter medicine for relieving mild to moderate pain and reducing fever.',
    uses: ['Headache', 'Fever', 'Toothache', 'Muscle aches', 'Cold and flu symptoms'],
    sideEffects: ['Rare at standard doses', 'Liver toxicity with high doses or alcohol combination'],
    precautions: ['Do not exceed 4000mg per 24 hours', 'Avoid alcohol', 'Consult doctor if liver issues exist'],
    dosageInstructions: '500mg - 1000mg every 4 to 6 hours as needed. Maximum 4g daily.',
    forms: ['Tablet', 'Syrup', 'Effervescent'],
    requiresPrescription: false,
    bookmarked: true,
  },
  {
    slug: 'med-002',
    name: 'Amoxicillin',
    genericName: 'Amoxicillin Trihydrate',
    category: 'Antibiotics',
    shortDescription: 'Broad-spectrum penicillin-type antibiotic for bacterial infections.',
    description: 'Amoxicillin is used to treat a wide variety of bacterial infections. It works by stopping the growth of bacteria.',
    uses: ['Ear infections', 'Throat and chest infections', 'Urinary tract infections', 'Skin infections'],
    sideEffects: ['Mild nausea', 'Diarrhea', 'Skin rash', 'Vomiting'],
    precautions: ['Complete the full course even if symptoms improve', 'Inform doctor of penicillin allergies'],
    dosageInstructions: '250mg - 500mg three times daily with meals, or as directed by physician.',
    forms: ['Capsule', 'Suspension'],
    requiresPrescription: true,
    bookmarked: false,
  },
  {
    slug: 'med-003',
    name: 'Metformin',
    genericName: 'Metformin Hydrochloride',
    category: 'Antidiabetics',
    shortDescription: 'First-line medication for the treatment of type 2 diabetes.',
    description: 'Metformin helps control high blood sugar in people with type 2 diabetes by decreasing glucose production by the liver.',
    uses: ['Type 2 Diabetes', 'Insulin resistance', 'Polycystic ovary syndrome (PCOS)'],
    sideEffects: ['Upset stomach', 'Metallic taste', 'Diarrhea', 'Gas'],
    precautions: ['Take with meals to reduce stomach upset', 'Monitor kidney function regularly'],
    dosageInstructions: '500mg once or twice daily with meals, gradually titrated by physician.',
    forms: ['Extended-release tablet', 'Standard tablet'],
    requiresPrescription: true,
    bookmarked: false,
  }
];

const initialArticles = [
  {
    slug: 'art-001',
    title: '10 Evidence-Based Habits for Better Sleep',
    category: 'Wellness',
    shortDescription: 'Improve your sleep quality and overall vitality with simple, proven nighttime habits.',
    content: 'Sleep is the foundation of physical and mental restoration. Consistent sleep schedules, limiting blue light exposure, avoiding caffeine late in the day, and creating a quiet, dark bedroom environment are all supported by clinical research to dramatically improve sleep cycles.',
    author: {
      name: 'Dr. Sarah Mitchell, MD',
      role: 'Sleep Medicine Specialist',
    },
    readTimeMinutes: 5,
    publishedAt: '2026-09-15',
    bookmarked: true,
  },
  {
    slug: 'art-002',
    title: 'Understanding Blood Pressure Readings: Systolic vs Diastolic',
    category: 'Heart Health',
    shortDescription: 'A straightforward guide to what your blood pressure numbers mean for your cardiovascular health.',
    content: 'Blood pressure is recorded as two numbers. The systolic pressure (top number) measures the pressure in your arteries when your heart beats. The diastolic pressure (bottom number) measures the pressure in your arteries between beats.',
    author: {
      name: 'Dr. James Chen, FACC',
      role: 'Consultant Cardiologist',
    },
    readTimeMinutes: 4,
    publishedAt: '2026-09-20',
    bookmarked: false,
  }
];

const initialDoctors = [
  {
    slug: 'doc-001',
    name: 'Dr. Anita Sharma',
    specialty: 'Cardiologist',
    qualifications: 'MBBS, MD, DM (Cardiology)',
    experienceYears: 14,
    hospital: 'Apex Heart Institute & Research Center',
    rating: 4.9,
    reviewCount: 230,
    consultationFee: 800,
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    timeSlots: ['09:00 AM', '10:30 AM', '02:00 PM', '04:30 PM'],
    isAvailable: true,
    about: 'Dr. Anita Sharma is a renowned cardiologist with extensive expertise in preventive cardiology and hypertension management.',
  },
  {
    slug: 'doc-002',
    name: 'Dr. Rajesh Verma',
    specialty: 'General Physician',
    qualifications: 'MBBS, MD (Internal Medicine)',
    experienceYears: 11,
    hospital: 'City Care Multispecialty Hospital',
    rating: 4.8,
    reviewCount: 185,
    consultationFee: 500,
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Saturday'],
    timeSlots: ['10:00 AM', '11:30 AM', '03:00 PM', '05:00 PM'],
    isAvailable: true,
    about: 'Experienced in general internal medicine, diabetes care, and infectious disease management.',
  },
  {
    slug: 'doc-003',
    name: 'Dr. Priya Patel',
    specialty: 'Dermatologist',
    qualifications: 'MBBS, MD (Dermatology)',
    experienceYears: 9,
    hospital: 'DermaClinique Aesthetic & Health',
    rating: 4.9,
    reviewCount: 310,
    consultationFee: 700,
    availableDays: ['Tuesday', 'Thursday', 'Friday', 'Saturday'],
    timeSlots: ['11:00 AM', '01:00 PM', '04:00 PM', '06:00 PM'],
    isAvailable: true,
    about: 'Specializes in clinical dermatology, allergy-induced skin reactions, and eczema care.',
  }
];

const initialMedications = [
  {
    name: 'Amoxicillin',
    dosage: '500mg',
    form: 'capsule',
    frequency: 'twice_daily',
    times: ['08:00', '20:00'],
    startDate: '2026-09-25',
    endDate: '2026-10-05',
    instructions: 'Take with food and full glass of water',
    reminderEnabled: true,
    color: '#2563EB',
    status: 'taken',
    adherenceLogs: [
      { date: '2026-10-01', time: '08:00', status: 'taken' },
    ],
  },
  {
    name: 'Metformin',
    dosage: '850mg',
    form: 'tablet',
    frequency: 'twice_daily',
    times: ['09:00', '21:00'],
    startDate: '2026-01-10',
    instructions: 'Take immediately after meals',
    reminderEnabled: true,
    color: '#059669',
    status: 'upcoming',
    adherenceLogs: [
      { date: '2026-09-30', time: '21:00', status: 'taken' },
    ],
  },
  {
    name: 'Atorvastatin',
    dosage: '20mg',
    form: 'tablet',
    frequency: 'once_daily',
    times: ['21:30'],
    startDate: '2026-03-01',
    instructions: 'Take at bedtime',
    reminderEnabled: true,
    color: '#7C3AED',
    status: 'upcoming',
    adherenceLogs: [],
  }
];

async function seed() {
  try {
    await connectDB();
    console.log('🌱 Seeding database...');

    await Condition.deleteMany({});
    await Condition.insertMany(initialConditions);
    console.log(`✅ Seeded ${initialConditions.length} conditions`);

    await Medicine.deleteMany({});
    await Medicine.insertMany(initialMedicines);
    console.log(`✅ Seeded ${initialMedicines.length} medicines`);

    await Article.deleteMany({});
    await Article.insertMany(initialArticles);
    console.log(`✅ Seeded ${initialArticles.length} articles`);

    await Doctor.deleteMany({});
    await Doctor.insertMany(initialDoctors);
    console.log(`✅ Seeded ${initialDoctors.length} doctors`);

    await Medication.deleteMany({});
    await Medication.insertMany(initialMedications);
    console.log(`✅ Seeded ${initialMedications.length} medications`);

    console.log('🎉 Database seeding complete!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
}

seed();
