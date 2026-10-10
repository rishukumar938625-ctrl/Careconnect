import type { UserProfile } from '../types';

// ─── Mock User Profile ────────────────────────────────────────────────────────

export const mockUserProfile: UserProfile = {
  id: 'user-001',
  displayName: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  avatarInitials: 'AM',
  avatarColor: '#2563EB',
  bloodType: 'O+',
  allergies: ['Penicillin'],
  emergencyContact: '+1 (555) 012-3456',
  notificationPreferences: {
    medicationReminders: true,
    appointmentReminders: true,
    healthTips: true,
    emailNotifications: false,
    pushNotifications: true,
  },
  reminderSettings: {
    reminderBeforeMinutes: 30,
    snoozeEnabled: true,
    snoozeMinutes: 10,
  },
  savedArticleIds: ['art-001', 'art-004'],
  savedConditionIds: ['hc-002'],
};
