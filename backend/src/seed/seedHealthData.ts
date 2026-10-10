/**
 * CareConnect Health Information Seed Script (Phase 2)
 *
 * Idempotent: Uses Mongoose upsert operations ({ upsert: true }) so running
 * multiple times will update/insert without deleting records or creating duplicates.
 *
 * Educational Content Notice:
 * All content provided is for general educational information only. It is not
 * medical advice, diagnosis, or treatment. Users should always consult a licensed
 * healthcare provider for individual medical guidance.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Condition } from '../models/Condition.js';
import { Medicine } from '../models/Medicine.js';
import { Article } from '../models/Article.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const educationalConditions = [
  {
    slug: 'common-cold',
    name: 'Common Cold',
    category: 'Respiratory',
    shortDescription: 'A self-limiting viral infection of the upper respiratory tract.',
    overview:
      'The common cold is an upper respiratory viral infection primarily affecting the nose, throat, and sinuses. Rhinoviruses are the most common cause. Most individuals recover within 7 to 10 days with supportive self-care.',
    description:
      'The common cold is an upper respiratory viral infection primarily affecting the nose, throat, and sinuses. Rhinoviruses are the most common cause. Most individuals recover within 7 to 10 days with supportive self-care.',
    severity: 'mild',
    symptoms: [
      'Runny or stuffy nose',
      'Mild sore throat',
      'Sneezing and watery eyes',
      'Low-grade fever or mild chills',
      'Mild fatigue and muscle ache',
    ],
    causes: [
      'Transmission of airborne respiratory droplets from sneezing or coughing',
      'Direct hand-to-hand contact with an infected individual',
      'Touching contaminated surfaces and subsequently touching the face',
    ],
    prevention: [
      'Wash hands thoroughly with soap and water for at least 20 seconds',
      'Avoid touching your eyes, nose, and mouth with unwashed hands',
      'Clean and disinfect frequently touched surfaces regularly',
      'Maintain adequate hydration and rest during seasonal cold peaks',
    ],
    whenToSeekMedicalHelp: [
      'Fever greater than 101.3°F (38.5°C) lasting more than three consecutive days',
      'Symptoms worsening significantly after initial improvement',
      'Shortness of breath, chest tightness, or wheezing',
      'Severe headache, sinus pain, or difficulty swallowing',
    ],
    whenToSeeDoctor: [
      'Fever greater than 101.3°F (38.5°C) lasting more than three consecutive days',
      'Symptoms worsening significantly after initial improvement',
      'Shortness of breath, chest tightness, or wheezing',
    ],
    tags: ['viral', 'respiratory', 'seasonal', 'educational'],
    lastReviewedAt: '2026-09-01',
    bookmarked: false,
  },
  {
    slug: 'headache',
    name: 'Headache & Tension Pain',
    category: 'Neurological',
    shortDescription: 'Discomfort or pain occurring in any region of the head or neck.',
    overview:
      'Headaches are among the most common neurological complaints. Tension headaches, caused by muscular contraction and stress, are the most frequent type, characterized by dull, aching head pain and tightness across the forehead or back of the head.',
    description:
      'Headaches are among the most common neurological complaints. Tension headaches, caused by muscular contraction and stress, are the most frequent type, characterized by dull, aching head pain and tightness across the forehead or back of the head.',
    severity: 'moderate',
    symptoms: [
      'Dull, aching head pain or sensation of a tight band around forehead',
      'Tenderness on the scalp, neck, and shoulder muscles',
      'Mild sensitivity to light or sound',
      'Difficulty concentrating due to persistent discomfort',
    ],
    causes: [
      'Physical or emotional stress and muscular strain',
      'Dehydration, skipped meals, or irregular sleep cycles',
      'Prolonged screen exposure and poor ergonomic posture',
    ],
    prevention: [
      'Maintain consistent hydration throughout the day',
      'Establish a regular sleep schedule of 7 to 9 hours nightly',
      'Take regular visual and postural breaks during computer work',
      'Practice stress management techniques such as deep breathing or gentle stretching',
    ],
    whenToSeekMedicalHelp: [
      'Sudden, extraordinarily severe headache (thunderclap headache)',
      'Headache accompanied by stiff neck, high fever, confusion, or speech impairment',
      'Headache following a recent head injury or trauma',
      'New or different headache pattern in individuals over age 50',
    ],
    whenToSeeDoctor: [
      'Sudden, extraordinarily severe headache (thunderclap headache)',
      'Headache accompanied by stiff neck, high fever, or confusion',
    ],
    tags: ['neurological', 'pain', 'stress', 'educational'],
    lastReviewedAt: '2026-09-10',
    bookmarked: true,
  },
  {
    slug: 'seasonal-allergies',
    name: 'Seasonal Allergies (Allergic Rhinitis)',
    category: 'Immunological',
    shortDescription: 'Immune system reaction to airborne environmental allergens such as pollen.',
    overview:
      'Allergic rhinitis occurs when the immune system mistakenly identifies airborne substances like tree, grass, or weed pollen as harmful invaders, releasing histamines that trigger nasal and ocular symptoms.',
    description:
      'Allergic rhinitis occurs when the immune system mistakenly identifies airborne substances like tree, grass, or weed pollen as harmful invaders, releasing histamines that trigger nasal and ocular symptoms.',
    severity: 'mild',
    symptoms: [
      'Frequent sneezing episodes',
      'Itchy, watery, or irritated eyes',
      'Clear, thin nasal discharge',
      'Itchy sensation in the throat or inner ears',
    ],
    causes: [
      'Exposure to tree pollen in spring, grass pollen in summer, or weed pollen in autumn',
      'Environmental mold spores and dust mites',
    ],
    prevention: [
      'Check local pollen forecasts and minimize outdoor exposure on high-count days',
      'Keep residential windows closed during peak pollen hours',
      'Shower and change clothing after spending extended time outdoors',
      'Utilize certified HEPA air filters in indoor living spaces',
    ],
    whenToSeekMedicalHelp: [
      'Allergy symptoms causing significant breathing difficulty or wheezing',
      'Over-the-counter allergy medications fail to provide relief',
      'Secondary bacterial sinus infection symptoms appear (e.g. facial swelling, high fever)',
    ],
    tags: ['immunological', 'allergy', 'seasonal', 'educational'],
    lastReviewedAt: '2026-09-15',
    bookmarked: false,
  },
  {
    slug: 'asthma',
    name: 'Asthma',
    category: 'Respiratory',
    shortDescription: 'A chronic airway condition causing episodic wheezing and breathlessness.',
    overview:
      'Asthma is a chronic inflammatory disorder of the bronchial airways. In response to environmental or physical triggers, airways narrow, swell, and produce excess mucus, impeding airflow into and out of the lungs.',
    description:
      'Asthma is a chronic inflammatory disorder of the bronchial airways. In response to environmental or physical triggers, airways narrow, swell, and produce excess mucus, impeding airflow into and out of the lungs.',
    severity: 'chronic',
    symptoms: [
      'Wheezing or whistling sound upon exhaling',
      'Chest tightness or feeling of compression',
      'Persistent coughing, frequently worse at night or early morning',
      'Shortness of breath during exertion or trigger exposure',
    ],
    causes: [
      'Complex interplay of genetic predisposition and environmental factors',
      'Airborne irritants including tobacco smoke, air pollution, and chemical fumes',
      'Viral respiratory infections, cold air, or physical exertion',
    ],
    prevention: [
      'Collaborate with a healthcare clinician to formulate an Asthma Action Plan',
      'Identify and systematically avoid known allergic and environmental triggers',
      'Use prescribed controller medications consistently as instructed by your doctor',
      'Monitor lung capacity with a peak flow meter if recommended by your physician',
    ],
    whenToSeekMedicalHelp: [
      'Rapidly worsening shortness of breath or inability to speak full sentences',
      'Rescue inhaler provides little or no relief after use',
      'Fingernails or lips turning gray, pale, or bluish',
      'Severe retractions (chest and ribs pulling inward deeply with each breath)',
    ],
    tags: ['respiratory', 'chronic', 'breathing', 'educational'],
    lastReviewedAt: '2026-09-20',
    bookmarked: false,
  },
  {
    slug: 'hypertension',
    name: 'Hypertension (High Blood Pressure)',
    category: 'Cardiovascular',
    shortDescription: 'Persistent elevation of arterial blood pressure requiring clinical management.',
    overview:
      'Hypertension is characterized by long-term force of blood against arterial walls that is persistently elevated (typically 130/80 mmHg or higher according to modern clinical guidelines). Because it frequently presents without noticeable symptoms, regular screening is essential.',
    description:
      'Hypertension is characterized by long-term force of blood against arterial walls that is persistently elevated (typically 130/80 mmHg or higher according to modern clinical guidelines). Because it frequently presents without noticeable symptoms, regular screening is essential.',
    severity: 'chronic',
    symptoms: [
      'Frequently completely asymptomatic ("silent condition")',
      'Occasional morning headaches in severe cases',
      'Dizziness or blurred vision during acute blood pressure spikes',
    ],
    causes: [
      'Primary (essential) hypertension: gradual development related to aging, diet, and genetics',
      'Excess dietary sodium and insufficient dietary potassium',
      'Physical inactivity, tobacco use, and chronic psychological stress',
    ],
    prevention: [
      'Follow a heart-healthy dietary pattern (such as DASH diet) low in sodium',
      'Engage in at least 150 minutes of moderate aerobic exercise weekly',
      'Maintain healthy body weight and avoid tobacco products',
      'Have blood pressure checked by a medical provider at least once yearly',
    ],
    whenToSeekMedicalHelp: [
      'Blood pressure reading exceeding 180/120 mmHg (Hypertensive Crisis)',
      'Chest pain, shortness of breath, back pain, or numbness/weakness',
      'Sudden vision disturbances or difficulty speaking',
    ],
    tags: ['cardiovascular', 'blood-pressure', 'chronic', 'educational'],
    lastReviewedAt: '2026-09-22',
    bookmarked: false,
  },
  {
    slug: 'type-2-diabetes',
    name: 'Type 2 Diabetes',
    category: 'Wellness',
    shortDescription: 'A metabolic condition affecting cellular glucose regulation and insulin utilization.',
    overview:
      'Type 2 diabetes is a chronic metabolic condition where the body becomes resistant to the normal effects of insulin, leading to elevated blood glucose levels. Early detection and evidence-based lifestyle changes can prevent or delay long-term complications.',
    description:
      'Type 2 diabetes is a chronic metabolic condition where the body becomes resistant to the normal effects of insulin, leading to elevated blood glucose levels. Early detection and evidence-based lifestyle changes can prevent or delay long-term complications.',
    severity: 'chronic',
    symptoms: [
      'Frequent urination, particularly at night (polyuria)',
      'Unexplained excessive thirst and dry mouth (polydipsia)',
      'Persistent fatigue and lack of energy',
      'Slow-healing cuts, sores, or frequent skin infections',
    ],
    causes: [
      'Insulin resistance combined with insufficient pancreatic insulin secretion',
      'Overweight/obesity and sedentary lifestyle',
      'Family history and genetic markers',
    ],
    prevention: [
      'Choose nutrient-dense whole foods rich in fiber and lean proteins',
      'Limit refined sugars, sugar-sweetened beverages, and ultra-processed foods',
      'Participate in consistent physical activity, combining aerobic and resistance training',
      'Maintain routine health screenings including fasting blood glucose or HbA1c tests',
    ],
    whenToSeekMedicalHelp: [
      'Signs of severe hyperglycemia: extreme thirst, nausea, confusion, fruity breath odor',
      'Persistent non-healing foot sores or ulcers',
      'Sudden blurring of vision or loss of sensation in fingers or toes',
    ],
    tags: ['metabolic', 'endocrine', 'glucose', 'chronic', 'educational'],
    lastReviewedAt: '2026-09-25',
    bookmarked: false,
  },
];

const educationalMedicines = [
  {
    slug: 'paracetamol',
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    category: 'Analgesics & Antipyretics',
    shortDescription: 'Common over-the-counter medication for mild-to-moderate pain and fever reduction.',
    description:
      'Paracetamol (known as acetaminophen in North America) is an analgesic and antipyretic medication used to manage mild-to-moderate pain and reduce fever. It works primarily in the central nervous system to inhibit prostaglandin synthesis.',
    commonUses: [
      'Temporary relief of mild headaches and tension pain',
      'Reduction of fever associated with common viral infections',
      'Relief of minor muscular aches and toothache discomfort',
    ],
    uses: [
      'Temporary relief of mild headaches and tension pain',
      'Reduction of fever associated with common viral infections',
      'Relief of minor muscular aches and toothache discomfort',
    ],
    generalSafetyInformation:
      'Do not exceed the maximum recommended daily dose (typically 4,000 mg in 24 hours for healthy adults; lower for individuals with liver disease). Avoid concurrent consumption of alcohol. Check combination cold/flu products to prevent accidental overdose.',
    precautions: [
      'Do not exceed 4,000 mg in any 24-hour period',
      'Consult a pharmacist before use if you have existing hepatic impairment',
      'Never take with other products containing acetaminophen or paracetamol',
    ],
    commonSideEffects: [
      'Well-tolerated at recommended therapeutic doses',
      'Rare mild nausea or allergic skin rash',
    ],
    sideEffects: [
      'Well-tolerated at recommended therapeutic doses',
      'Rare mild nausea or allergic skin rash',
    ],
    warnings: [
      'Severe liver damage can occur with doses exceeding daily limits or when combined with chronic alcohol use',
      'Seek emergency medical assistance immediately in cases of suspected overdose, even if no symptoms are apparent',
    ],
    dosageInstructions:
      'Adult dosage is typically 500 mg to 1,000 mg every 4 to 6 hours as needed. Always consult product packaging and your physician.',
    forms: ['Tablet', 'Capsule', 'Liquid Suspension', 'Effervescent Tablet'],
    requiresPrescription: false,
    lastReviewedAt: '2026-09-05',
    bookmarked: true,
  },
  {
    slug: 'ibuprofen',
    name: 'Ibuprofen',
    genericName: 'Ibuprofen',
    category: 'Non-Steroidal Anti-Inflammatory (NSAID)',
    shortDescription: 'Anti-inflammatory agent used to relieve pain, swelling, and fever.',
    description:
      'Ibuprofen is a non-steroidal anti-inflammatory drug (NSAID) that reduces hormones causing inflammation and pain in the body. It is widely used for inflammatory conditions, musculoskeletal injuries, and dental pain.',
    commonUses: [
      'Relief of inflammatory pain including arthritis and sprains',
      'Dental pain and menstrual cramps',
      'Reduction of fever and associated discomfort',
    ],
    uses: [
      'Relief of inflammatory pain including arthritis and sprains',
      'Dental pain and menstrual cramps',
      'Reduction of fever and associated discomfort',
    ],
    generalSafetyInformation:
      'Take with food or a glass of milk to minimize gastrointestinal discomfort. Do not take if you have an active peptic ulcer, severe kidney disease, or a history of asthma triggered by aspirin or other NSAIDs.',
    precautions: [
      'Always take with food or milk to protect stomach lining',
      'Inform your doctor if you take blood thinners, ACE inhibitors, or diuretics',
      'Avoid long-term daily use without direct physician oversight',
    ],
    commonSideEffects: [
      'Mild stomach upset or indigestion',
      'Heartburn and nausea',
      'Dizziness or mild headache',
    ],
    sideEffects: [
      'Mild stomach upset or indigestion',
      'Heartburn and nausea',
      'Dizziness or mild headache',
    ],
    warnings: [
      'NSAIDs may increase the risk of serious cardiovascular thrombotic events, myocardial infarction, and stroke',
      'NSAIDs cause an increased risk of serious gastrointestinal adverse events including bleeding and ulceration',
    ],
    dosageInstructions:
      'Adults: 200 mg to 400 mg every 4 to 6 hours with food. Do not exceed 1,200 mg daily for over-the-counter use without clinical guidance.',
    forms: ['Film-coated Tablet', 'Soft Gelatin Capsule', 'Oral Suspension', 'Topical Gel'],
    requiresPrescription: false,
    lastReviewedAt: '2026-09-12',
    bookmarked: false,
  },
  {
    slug: 'amoxicillin',
    name: 'Amoxicillin',
    genericName: 'Amoxicillin Trihydrate',
    category: 'Penicillin-Class Antibiotic',
    shortDescription: 'Broad-spectrum antibiotic prescribed to treat susceptible bacterial infections.',
    description:
      'Amoxicillin is a beta-lactam antibiotic used in the clinical treatment of susceptible bacterial infections. It works by inhibiting the synthesis of bacterial cell walls. Note: It is completely ineffective against viral infections such as colds or influenza.',
    commonUses: [
      'Treatment of confirmed bacterial ear, nose, and throat infections',
      'Bacterial lower respiratory tract infections',
      'Uncomplicated urinary tract infections and skin infections',
    ],
    uses: [
      'Treatment of confirmed bacterial ear, nose, and throat infections',
      'Bacterial lower respiratory tract infections',
      'Uncomplicated urinary tract infections and skin infections',
    ],
    generalSafetyInformation:
      'Must be taken strictly as prescribed by a licensed healthcare clinician. Complete the full course of therapy even if symptoms resolve earlier, to prevent antibiotic resistance.',
    precautions: [
      'Contraindicated in patients with known hypersensitivity to penicillin or cephalosporin antibiotics',
      'Inform prescriber of any kidney impairment or mononucleosis diagnosis',
    ],
    commonSideEffects: [
      'Mild diarrhea or loose stools',
      'Nausea and stomach discomfort',
      'Non-allergic mild skin rash',
    ],
    sideEffects: [
      'Mild diarrhea or loose stools',
      'Nausea and stomach discomfort',
      'Non-allergic mild skin rash',
    ],
    warnings: [
      'Serious and occasionally fatal anaphylactic hypersensitivity reactions can occur in allergic patients',
      'Pseudomembranous colitis (C. difficile diarrhea) may occur and warrants immediate medical consultation',
    ],
    dosageInstructions:
      'Dosage varies by diagnosis, severity, and patient renal function. Take strictly as directed on the prescription label.',
    forms: ['Capsule', 'Tablet', 'Oral Powder for Suspension'],
    requiresPrescription: true,
    lastReviewedAt: '2026-09-18',
    bookmarked: false,
  },
  {
    slug: 'metformin',
    name: 'Metformin',
    genericName: 'Metformin Hydrochloride',
    category: 'Antidiabetic Biguanide',
    shortDescription: 'First-line prescription medication for glycemic management in type 2 diabetes.',
    description:
      'Metformin is an oral antihyperglycemic medication of the biguanide class. It improves glucose tolerance by lowering basal and postprandial blood glucose, decreasing hepatic glucose production, and enhancing peripheral insulin sensitivity.',
    commonUses: [
      'Glycemic management in adult and pediatric patients with type 2 diabetes',
      'Adjunct to diet and exercise to optimize HbA1c levels',
    ],
    uses: [
      'Glycemic management in adult and pediatric patients with type 2 diabetes',
      'Adjunct to diet and exercise to optimize HbA1c levels',
    ],
    generalSafetyInformation:
      'Take with meals to reduce gastrointestinal adverse effects. Renal function must be evaluated prior to initiation and monitored regularly thereafter.',
    precautions: [
      'Contraindicated in patients with severe renal impairment (eGFR below 30 mL/min/1.73m²)',
      'Temporarily discontinue prior to and after iodinated contrast imaging procedures',
    ],
    commonSideEffects: [
      'Diarrhea, nausea, and abdominal flatulence',
      'Metallic taste in mouth',
      'Decreased vitamin B12 serum concentrations over prolonged therapy',
    ],
    sideEffects: [
      'Diarrhea, nausea, and abdominal flatulence',
      'Metallic taste in mouth',
      'Decreased vitamin B12 serum concentrations over prolonged therapy',
    ],
    warnings: [
      'Rare but life-threatening risk of lactic acidosis, primarily in patients with significant renal impairment or acute heart failure',
    ],
    dosageInstructions:
      'Individualized by physician. Often initiated at 500 mg with dinner and gradually titrated to reduce GI side effects.',
    forms: ['Immediate-Release Tablet', 'Extended-Release (XR) Tablet'],
    requiresPrescription: true,
    lastReviewedAt: '2026-09-22',
    bookmarked: false,
  },
  {
    slug: 'cetirizine',
    name: 'Cetirizine',
    genericName: 'Cetirizine Hydrochloride',
    category: 'Second-Generation Antihistamine',
    shortDescription: 'Non-sedating antihistamine for the relief of allergic symptoms.',
    description:
      'Cetirizine is a selective peripheral H1-receptor antagonist used to relieve allergy symptoms such as sneezing, rhinorrhea, and itchy eyes, as well as chronic urticaria.',
    commonUses: [
      'Relief of seasonal and perennial allergic rhinitis symptoms',
      'Management of uncomplicated skin manifestations of chronic idiopathic urticaria',
    ],
    uses: [
      'Relief of seasonal and perennial allergic rhinitis symptoms',
      'Management of uncomplicated skin manifestations of chronic idiopathic urticaria',
    ],
    generalSafetyInformation:
      'Although non-sedating for most individuals, somnolence can occur at standard therapeutic doses in susceptible persons. Exercise caution when operating machinery or driving.',
    precautions: [
      'Avoid concurrent central nervous system depressants or alcohol consumption',
      'Dose reduction is recommended in patients with moderate-to-severe renal impairment',
    ],
    commonSideEffects: [
      'Mild drowsiness or fatigue in sensitive individuals',
      'Dry mouth and mild dizziness',
    ],
    sideEffects: [
      'Mild drowsiness or fatigue in sensitive individuals',
      'Dry mouth and mild dizziness',
    ],
    warnings: [
      'Do not exceed recommended daily dosage. Discontinue use if hypersensitivity or urticaria worsens',
    ],
    dosageInstructions:
      'Adults and children 6 years and older: typically 10 mg once daily, or 5 mg twice daily. Follow package instructions.',
    forms: ['Film-coated Tablet', 'Chewable Tablet', 'Oral Solution'],
    requiresPrescription: false,
    lastReviewedAt: '2026-09-28',
    bookmarked: true,
  },
];

const educationalArticles = [
  {
    slug: 'evidence-based-sleep-hygiene',
    title: 'Evidence-Based Habits for Restorative Sleep',
    category: 'Wellness',
    summary:
      'Explore research-backed daily routines and bedroom environmental adjustments that support deeper, more restorative sleep cycles.',
    shortDescription:
      'Explore research-backed daily routines and bedroom environmental adjustments that support deeper, more restorative sleep cycles.',
    content:
      'Quality sleep is essential for immune function, cognitive performance, and emotional regulation. Scientific research indicates that maintaining a consistent sleep-wake schedule—even on weekends—synchronizes the body’s circadian clock. Limiting exposure to blue-wavelength light from screens at least one hour before bed, maintaining a cool bedroom temperature around 65°F (18°C), and avoiding caffeine after midday all demonstrably improve sleep architecture and reduce nocturnal awakenings. If sleep difficulties persist for more than three weeks, consulting a healthcare clinician or sleep specialist is recommended.',
    tags: ['sleep', 'wellness', 'circadian-rhythm', 'preventive-health'],
    readingTimeMinutes: 5,
    readTimeMinutes: 5,
    author: {
      name: 'CareConnect Health Editorial Team',
      role: 'Health Information Specialist',
    },
    publishedAt: '2026-09-15',
    lastReviewedAt: '2026-09-15',
    bookmarked: true,
  },
  {
    slug: 'understanding-blood-pressure-numbers',
    title: 'Understanding Your Blood Pressure Readings: Systolic and Diastolic',
    category: 'Cardiovascular',
    summary:
      'A plain-language guide explaining what systolic and diastolic numbers mean, how readings are classified, and when to consult a clinician.',
    shortDescription:
      'A plain-language guide explaining what systolic and diastolic numbers mean, how readings are classified, and when to consult a clinician.',
    content:
      'Blood pressure is recorded as two numbers measured in millimeters of mercury (mmHg). The systolic pressure (the top number) measures the pressure inside your blood vessels when the heart muscle contracts. The diastolic pressure (the bottom number) measures the pressure when the heart rests between beats. Normal blood pressure is defined as systolic under 120 and diastolic under 80 mmHg. Persistent elevations above 130/80 mmHg place added mechanical stress on artery walls and warrant a comprehensive medical consultation. Home monitoring should follow standardized protocols: resting quietly for five minutes prior, keeping feet flat on the floor, and supporting the arm at heart level.',
    tags: ['cardiovascular', 'blood-pressure', 'heart-health', 'vital-signs'],
    readingTimeMinutes: 4,
    readTimeMinutes: 4,
    author: {
      name: 'CareConnect Health Editorial Team',
      role: 'Health Information Specialist',
    },
    publishedAt: '2026-09-20',
    lastReviewedAt: '2026-09-20',
    bookmarked: false,
  },
  {
    slug: 'staying-hydrated-daily-health',
    title: 'Daily Hydration: Physiological Needs and Practical Guidelines',
    category: 'Nutrition',
    summary:
      'Learn how adequate fluid intake influences cardiovascular volume, renal filtration, cognitive clarity, and physical stamina.',
    shortDescription:
      'Learn how adequate fluid intake influences cardiovascular volume, renal filtration, cognitive clarity, and physical stamina.',
    content:
      'Water constitutes approximately 60 percent of adult body mass and participates in nearly every biological process, including cellular nutrient transport, thermoregulation, and joint lubrication. While individual hydration requirements vary based on body composition, physical exertion, and environmental climate, general medical guidance suggests approximately 2.5 to 3.5 liters of total fluid daily from beverages and moisture-rich foods. Thirst is often a late indicator of dehydration; observing pale straw-colored urine is a practical way to assess adequate hydration. Individuals with specific medical conditions such as heart failure or advanced kidney disease should adhere strictly to their physician’s fluid restriction guidelines.',
    tags: ['nutrition', 'hydration', 'kidney-health', 'wellness'],
    readingTimeMinutes: 4,
    readTimeMinutes: 4,
    author: {
      name: 'CareConnect Health Editorial Team',
      role: 'Health Information Specialist',
    },
    publishedAt: '2026-09-25',
    lastReviewedAt: '2026-09-25',
    bookmarked: false,
  },
  {
    slug: 'preparing-for-your-doctor-visit',
    title: 'How to Prepare Effectively for a Clinical Consultation',
    category: 'Healthcare Tips',
    summary:
      'Maximize your time with your doctor by organizing your medical history, current medications, and primary health questions in advance.',
    shortDescription:
      'Maximize your time with your doctor by organizing your medical history, current medications, and primary health questions in advance.',
    content:
      'A successful clinical appointment relies on clear, collaborative communication between patient and clinician. Before your appointment, write down your top three concerns in order of priority. Bring an accurate, comprehensive list of all current medications, including over-the-counter analgesics, vitamins, and herbal supplements with exact dosages. Be prepared to describe the timeline, frequency, and severity of any symptoms you are experiencing. Taking notes during the visit and asking for clarification whenever instructions seem ambiguous ensures you leave with a clear, safe understanding of your care plan.',
    tags: ['patient-advocacy', 'doctor-visit', 'healthcare-tips'],
    readingTimeMinutes: 4,
    readTimeMinutes: 4,
    author: {
      name: 'CareConnect Health Editorial Team',
      role: 'Health Information Specialist',
    },
    publishedAt: '2026-09-28',
    lastReviewedAt: '2026-09-28',
    bookmarked: true,
  },
  {
    slug: 'managing-daily-stress-mindful-practices',
    title: 'Evidence-Based Strategies for Chronic Stress Reduction',
    category: 'Mental Health',
    summary:
      'Understand the biological impact of chronic sympathetic activation and discover practical techniques to foster nervous system regulation.',
    shortDescription:
      'Understand the biological impact of chronic sympathetic activation and discover practical techniques to foster nervous system regulation.',
    content:
      'When the brain perceives prolonged threat or cognitive overload, the hypothalamic-pituitary-adrenal (HPA) axis releases cortisol and adrenaline, elevating heart rate, arterial pressure, and blood sugar. While adaptive in acute emergencies, chronic elevation of these hormones can contribute to impaired immunity, digestive disruption, and sleep disturbances. Somatic practices such as diaphragmatic breathing (activating the vagal parasympathetic nerve), progressive muscle relaxation, regular aerobic physical activity, and establishing clear boundary limits have all demonstrated efficacy in mitigating physiological stress markers.',
    tags: ['mental-health', 'stress-reduction', 'nervous-system', 'wellness'],
    readingTimeMinutes: 5,
    readTimeMinutes: 5,
    author: {
      name: 'CareConnect Health Editorial Team',
      role: 'Health Information Specialist',
    },
    publishedAt: '2026-10-01',
    lastReviewedAt: '2026-10-01',
    bookmarked: false,
  },
];

export async function seedHealthData(): Promise<void> {
  try {
    await connectDB();
    console.log('🌱 Starting idempotent health content seeding...');

    // Upsert Conditions (no deleteMany)
    let conditionCount = 0;
    for (const item of educationalConditions) {
      await Condition.updateOne({ slug: item.slug }, { $set: item }, { upsert: true });
      conditionCount++;
    }
    console.log(`✅ Upserted ${conditionCount} health conditions without deleting existing records.`);

    // Upsert Medicines (no deleteMany)
    let medicineCount = 0;
    for (const item of educationalMedicines) {
      await Medicine.updateOne({ slug: item.slug }, { $set: item }, { upsert: true });
      medicineCount++;
    }
    console.log(`✅ Upserted ${medicineCount} medicines without deleting existing records.`);

    // Upsert Articles (no deleteMany)
    let articleCount = 0;
    for (const item of educationalArticles) {
      await Article.updateOne({ slug: item.slug }, { $set: item }, { upsert: true });
      articleCount++;
    }
    console.log(`✅ Upserted ${articleCount} health articles without deleting existing records.`);

    console.log('🎉 Idempotent health seeding finished successfully!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error during health seeding:', error);
    process.exit(1);
  }
}

// Allow standalone execution from CLI
if (process.argv[1] && process.argv[1].endsWith('seedHealthData.ts')) {
  seedHealthData().then(() => process.exit(0));
}
