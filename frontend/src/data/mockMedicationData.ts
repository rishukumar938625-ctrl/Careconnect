import type { Medication } from '../types';

// ─── Mock Medications ─────────────────────────────────────────────────────────

export const mockMedications: Medication[] = [
  {
    id: 'rx-001',
    name: 'Vitamin D3',
    dosage: '1000 IU',
    form: 'tablet',
    frequency: 'once_daily',
    times: ['09:00'],
    startDate: '2025-09-01',
    notes: 'Take with breakfast',
    color: '#2563EB',
    todaySchedule: [
      { id: 'rx-001-t1', time: '09:00', status: 'upcoming' },
    ],
  },
  {
    id: 'rx-002',
    name: 'Amoxicillin',
    dosage: '500mg',
    form: 'capsule',
    frequency: 'three_times_daily',
    times: ['08:00', '14:00', '20:00'],
    startDate: '2025-09-28',
    endDate: '2025-10-05',
    notes: 'Complete the full course',
    color: '#0EA5A4',
    todaySchedule: [
      { id: 'rx-002-t1', time: '08:00', status: 'taken' },
      { id: 'rx-002-t2', time: '14:00', status: 'upcoming' },
      { id: 'rx-002-t3', time: '20:00', status: 'upcoming' },
    ],
  },
  {
    id: 'rx-003',
    name: 'Cetirizine',
    dosage: '10mg',
    form: 'tablet',
    frequency: 'once_daily',
    times: ['22:00'],
    startDate: '2025-09-15',
    notes: 'Take at night to avoid drowsiness',
    color: '#16A34A',
    todaySchedule: [
      { id: 'rx-003-t1', time: '22:00', status: 'upcoming' },
    ],
  },
];

// ─── Today's Medication Schedule (derived from mockMedications) ───────────────

export interface TodayScheduleItem {
  time: string;
  medication: Medication;
  scheduleEntry: NonNullable<Medication['todaySchedule']>[0];
}

export const getTodaySchedule = (): TodayScheduleItem[] => {
  const items: TodayScheduleItem[] = [];

  mockMedications.forEach((med) => {
    if (med.todaySchedule) {
      med.todaySchedule.forEach((entry) => {
        items.push({ time: entry.time, medication: med, scheduleEntry: entry });
      });
    }
  });

  return items.sort((a, b) => a.time.localeCompare(b.time));
};
