import type { HealthCondition, Medicine, HealthArticle } from '../types';

// ─── Mock Health Conditions ──────────────────────────────────────────────────

export const mockConditions: HealthCondition[] = [
  {
    id: 'hc-001',
    name: 'Common Cold',
    category: 'Respiratory',
    shortDescription: 'A mild viral infection of the upper respiratory tract.',
    description:
      'The common cold is a viral infection of the nose and throat. It is usually harmless, though it may not feel that way. Many types of viruses can cause a common cold.',
    symptoms: ['Runny nose', 'Sore throat', 'Cough', 'Sneezing', 'Mild fever'],
    tags: ['viral', 'respiratory', 'seasonal'],
    isSaved: false,
  },
  {
    id: 'hc-002',
    name: 'Headache',
    category: 'Neurological',
    shortDescription: 'Pain or discomfort in the head, scalp, or neck area.',
    description:
      'Headaches are one of the most common health complaints. They range from mild discomfort to severe pain and can affect daily activities.',
    symptoms: ['Head pain', 'Pressure sensation', 'Throbbing', 'Sensitivity to light'],
    tags: ['pain', 'neurological', 'common'],
    isSaved: true,
  },
  {
    id: 'hc-003',
    name: 'Seasonal Allergies',
    category: 'Immunological',
    shortDescription: 'Immune response to environmental allergens like pollen.',
    description:
      'Seasonal allergies, also called hay fever or allergic rhinitis, cause symptoms similar to a cold. They are triggered by airborne substances such as pollen.',
    symptoms: ['Sneezing', 'Itchy eyes', 'Runny nose', 'Nasal congestion'],
    tags: ['allergy', 'seasonal', 'pollen'],
    isSaved: false,
  },
  {
    id: 'hc-004',
    name: 'Asthma',
    category: 'Respiratory',
    shortDescription: 'A condition in which airways narrow and swell.',
    description:
      'Asthma is a chronic condition involving the airways in the lungs. The airways swell and can produce extra mucus, making breathing difficult.',
    symptoms: ['Shortness of breath', 'Chest tightness', 'Wheezing', 'Coughing'],
    tags: ['chronic', 'respiratory', 'breathing'],
    isSaved: false,
  },
  {
    id: 'hc-005',
    name: 'Hypertension',
    category: 'Cardiovascular',
    shortDescription: 'High blood pressure that can lead to serious health issues.',
    description:
      'Hypertension, or high blood pressure, is a condition where the force of blood against artery walls is consistently too high. It is often called the "silent killer" because it has no symptoms.',
    symptoms: ['Often no symptoms', 'Headaches', 'Shortness of breath', 'Nosebleeds'],
    tags: ['cardiovascular', 'chronic', 'blood pressure'],
    isSaved: false,
  },
  {
    id: 'hc-006',
    name: 'Type 2 Diabetes',
    category: 'Wellness',
    shortDescription: 'A condition affecting how the body processes blood sugar.',
    description:
      'Type 2 diabetes is a common condition that causes the level of sugar in the blood to become too high. It is a lifelong condition but can be managed with lifestyle changes.',
    symptoms: ['Increased thirst', 'Frequent urination', 'Fatigue', 'Blurred vision'],
    tags: ['metabolic', 'chronic', 'blood sugar'],
    isSaved: false,
  },
  {
    id: 'hc-007',
    name: 'Eczema',
    category: 'Dermatological',
    shortDescription: 'A condition that makes your skin red and itchy.',
    description:
      'Eczema (atopic dermatitis) is a condition that makes skin red and itchy. It is common in children but can occur at any age and tends to flare periodically.',
    symptoms: ['Dry skin', 'Itching', 'Red patches', 'Small bumps', 'Thickened skin'],
    tags: ['skin', 'inflammatory', 'chronic'],
    isSaved: false,
  },
  {
    id: 'hc-008',
    name: 'Anxiety',
    category: 'Mental Health',
    shortDescription: 'Persistent feelings of worry, nervousness, or unease.',
    description:
      'Anxiety is a normal emotion, but anxiety disorders involve more than temporary worry or fear. For people with anxiety disorders, the anxiety does not go away and can get worse over time.',
    symptoms: ['Excessive worry', 'Restlessness', 'Rapid heartbeat', 'Difficulty concentrating'],
    tags: ['mental health', 'stress', 'chronic'],
    isSaved: false,
  },
];

// ─── Mock Medicines ──────────────────────────────────────────────────────────

export const mockMedicines: Medicine[] = [
  {
    id: 'med-001',
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    category: 'Pain Reliever / Fever Reducer',
    shortDescription: 'A common medication used to treat pain and fever.',
    uses: ['Pain relief', 'Fever reduction', 'Headache', 'Cold & flu symptoms'],
    isSaved: false,
  },
  {
    id: 'med-002',
    name: 'Ibuprofen',
    genericName: 'Ibuprofen',
    category: 'NSAID / Anti-inflammatory',
    shortDescription: 'A non-steroidal anti-inflammatory drug (NSAID).',
    uses: ['Pain relief', 'Inflammation', 'Fever reduction', 'Arthritis'],
    isSaved: false,
  },
  {
    id: 'med-003',
    name: 'Cetirizine',
    genericName: 'Cetirizine HCl',
    category: 'Antihistamine',
    shortDescription: 'An antihistamine used to relieve allergy symptoms.',
    uses: ['Allergic rhinitis', 'Hives', 'Itching', 'Seasonal allergies'],
    isSaved: true,
  },
  {
    id: 'med-004',
    name: 'Amoxicillin',
    genericName: 'Amoxicillin',
    category: 'Antibiotic',
    shortDescription: 'A penicillin-type antibiotic used to treat bacterial infections.',
    uses: ['Bacterial infections', 'Ear infections', 'Pneumonia', 'Bronchitis'],
    isSaved: false,
  },
  {
    id: 'med-005',
    name: 'Omeprazole',
    genericName: 'Omeprazole',
    category: 'Proton Pump Inhibitor',
    shortDescription: 'Reduces stomach acid to treat heartburn and related conditions.',
    uses: ['Acid reflux', 'GERD', 'Stomach ulcers', 'Heartburn'],
    isSaved: false,
  },
  {
    id: 'med-006',
    name: 'Metformin',
    genericName: 'Metformin HCl',
    category: 'Antidiabetic',
    shortDescription: 'A medication commonly used to treat type 2 diabetes.',
    uses: ['Type 2 diabetes', 'Blood sugar control'],
    isSaved: false,
  },
  {
    id: 'med-007',
    name: 'Vitamin D3',
    genericName: 'Cholecalciferol',
    category: 'Vitamin Supplement',
    shortDescription: 'A vitamin supplement supporting bone health and immune function.',
    uses: ['Vitamin D deficiency', 'Bone health', 'Immune support'],
    isSaved: false,
  },
  {
    id: 'med-008',
    name: 'Atorvastatin',
    genericName: 'Atorvastatin Calcium',
    category: 'Statin / Cholesterol-lowering',
    shortDescription: 'Used to lower cholesterol and reduce the risk of heart disease.',
    uses: ['High cholesterol', 'Cardiovascular risk reduction'],
    isSaved: false,
  },
];

// ─── Mock Health Articles ────────────────────────────────────────────────────

export const mockArticles: HealthArticle[] = [
  {
    id: 'art-001',
    title: 'Understanding Healthy Sleep',
    category: 'Wellness',
    shortDescription:
      'Learn why quality sleep is essential for physical and mental wellbeing, and simple steps to improve your sleep habits.',
    content: 'Placeholder article content. Full content will be available in a later phase.',
    readTimeMinutes: 5,
    publishedAt: '2025-09-15',
    isSaved: true,
  },
  {
    id: 'art-002',
    title: 'Staying Hydrated: More Than Just Water',
    category: 'Nutrition',
    shortDescription:
      'Discover how proper hydration impacts every system in your body and how to stay adequately hydrated throughout the day.',
    content: 'Placeholder article content. Full content will be available in a later phase.',
    readTimeMinutes: 4,
    publishedAt: '2025-09-20',
    isSaved: false,
  },
  {
    id: 'art-003',
    title: 'Everyday Heart Health Habits',
    category: 'Cardiovascular',
    shortDescription:
      'Small daily choices add up to big heart health benefits. Explore evidence-based habits that protect your cardiovascular system.',
    content: 'Placeholder article content. Full content will be available in a later phase.',
    readTimeMinutes: 6,
    publishedAt: '2025-09-22',
    isSaved: false,
  },
  {
    id: 'art-004',
    title: 'How to Prepare for a Doctor Visit',
    category: 'Healthcare Tips',
    shortDescription:
      'Make the most of your appointment by knowing what to bring, what to say, and which questions to ask your doctor.',
    content: 'Placeholder article content. Full content will be available in a later phase.',
    readTimeMinutes: 3,
    publishedAt: '2025-09-25',
    isSaved: true,
  },
  {
    id: 'art-005',
    title: 'Managing Stress in Daily Life',
    category: 'Mental Health',
    shortDescription:
      'Practical, science-backed techniques to identify stress triggers and build resilience through mindful daily practices.',
    content: 'Placeholder article content. Full content will be available in a later phase.',
    readTimeMinutes: 7,
    publishedAt: '2025-09-28',
    isSaved: false,
  },
  {
    id: 'art-006',
    title: 'The Power of Preventive Care',
    category: 'Healthcare Tips',
    shortDescription:
      'Why regular check-ups and screenings are your best investment in long-term health — and how to stay on schedule.',
    content: 'Placeholder article content. Full content will be available in a later phase.',
    readTimeMinutes: 5,
    publishedAt: '2025-10-01',
    isSaved: false,
  },
];

// ─── Popular Health Topics ────────────────────────────────────────────────────

export const popularTopics = [
  { label: 'Common Cold', conditionId: 'hc-001' },
  { label: 'Headache', conditionId: 'hc-002' },
  { label: 'Seasonal Allergies', conditionId: 'hc-003' },
  { label: 'Healthy Sleep', articleId: 'art-001' },
  { label: 'Dehydration', conditionId: null },
];
