import React, { useState } from 'react';
import {
  Bookmark,
  Shield,
  HelpCircle,
  ChevronRight,
  Edit2,
  Droplets,
  AlertCircle,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { mockUserProfile } from '../data/mockAppointmentData';

export const Profile: React.FC = () => {
  const profile = mockUserProfile;
  const [notifications, setNotifications] = useState(
    profile.notificationPreferences,
  );

  const toggleNotification = (
    key: keyof typeof notifications,
  ) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <PageContainer>
      <PageHeader title="Profile" />

      {/* Profile header */}
      <section aria-labelledby="profile-header" className="mb-5">
        <Card className="flex flex-col items-center gap-3 py-6">
          <div
            className="flex items-center justify-center w-20 h-20 rounded-2xl text-white text-2xl font-bold"
            style={{ backgroundColor: profile.avatarColor }}
            aria-label={`Avatar for ${profile.displayName}`}
          >
            {profile.avatarInitials}
          </div>
          <div className="text-center">
            <h1
              id="profile-header"
              className="text-xl font-bold text-text-primary"
            >
              {profile.displayName}
            </h1>
            <p className="text-sm text-text-muted">{profile.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {profile.bloodType && (
              <Badge variant="danger">
                <Droplets className="h-3 w-3" aria-hidden="true" />
                {profile.bloodType}
              </Badge>
            )}
            {profile.allergies?.map((a) => (
              <Badge key={a} variant="warning">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                Allergy: {a}
              </Badge>
            ))}
          </div>
          <button
            className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            aria-label="Edit profile"
          >
            <Edit2 className="h-4 w-4" aria-hidden="true" />
            Edit profile
          </button>
        </Card>
      </section>

      {/* Personal info */}
      <section className="mb-4" aria-labelledby="personal-info-heading">
        <Card>
          <CardHeader title="Personal information" />
          <div className="flex flex-col gap-3">
            <ProfileInfoRow label="Full name" value={profile.displayName} />
            <ProfileInfoRow label="Email" value={profile.email} />
            <ProfileInfoRow
              label="Blood type"
              value={profile.bloodType ?? '—'}
            />
            <ProfileInfoRow
              label="Emergency contact"
              value={profile.emergencyContact ?? '—'}
            />
          </div>
        </Card>
      </section>

      {/* Notification preferences */}
      <section className="mb-4" aria-labelledby="notification-prefs-heading">
        <Card>
          <CardHeader title="Notification preferences" />
          <div className="flex flex-col gap-4">
            {(
              Object.keys(notifications) as (keyof typeof notifications)[]
            ).map((key) => (
              <ToggleRow
                key={key}
                label={formatNotifKey(key)}
                checked={notifications[key]}
                onChange={() => toggleNotification(key)}
                id={`notif-${key}`}
              />
            ))}
          </div>
        </Card>
      </section>

      {/* Reminder settings */}
      <section className="mb-4" aria-labelledby="reminder-settings-heading">
        <Card>
          <CardHeader title="Reminder settings" />
          <div className="flex flex-col gap-3">
            <ProfileInfoRow
              label="Remind me before"
              value={`${profile.reminderSettings.reminderBeforeMinutes} minutes`}
            />
            <ProfileInfoRow
              label="Snooze"
              value={
                profile.reminderSettings.snoozeEnabled
                  ? `Enabled (${profile.reminderSettings.snoozeMinutes} min)`
                  : 'Disabled'
              }
            />
          </div>
        </Card>
      </section>

      {/* Settings menu items */}
      <section className="mb-8" aria-labelledby="account-settings-heading">
        <Card padding="none">
          <h2 id="account-settings-heading" className="sr-only">
            Account settings
          </h2>
          {[
            {
              icon: <Bookmark className="h-5 w-5" />,
              label: 'Saved articles',
              detail: `${profile.savedArticleIds.length} saved`,
              id: 'saved-articles-link',
            },
            {
              icon: <Shield className="h-5 w-5" />,
              label: 'Privacy & data',
              id: 'privacy-link',
            },
            {
              icon: <HelpCircle className="h-5 w-5" />,
              label: 'Help & support',
              id: 'help-link',
            },
          ].map((item, idx, arr) => (
            <button
              key={item.label}
              id={item.id}
              className={[
                'flex items-center gap-3 w-full px-4 py-3.5 text-left',
                'hover:bg-slate-50 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500',
                idx < arr.length - 1 ? 'border-b border-slate-100' : '',
              ].join(' ')}
              aria-label={item.label}
            >
              <span className="text-text-muted">{item.icon}</span>
              <span className="flex-1 text-sm font-medium text-text-primary">
                {item.label}
              </span>
              {item.detail && (
                <span className="text-xs text-text-muted">{item.detail}</span>
              )}
              <ChevronRight
                className="h-4 w-4 text-text-muted ml-1"
                aria-hidden="true"
              />
            </button>
          ))}
        </Card>
      </section>

      {/* Footer disclaimer */}
      <p className="text-[11px] text-text-muted text-center px-4 leading-relaxed">
        CareConnect provides general educational information and is not a
        substitute for professional medical advice, diagnosis, or treatment.
      </p>
    </PageContainer>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ProfileInfoRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-sm text-text-muted">{label}</span>
    <span className="text-sm font-medium text-text-primary text-right">
      {value}
    </span>
  </div>
);

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  id: string;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  checked,
  onChange,
  id,
}) => (
  <div className="flex items-center justify-between gap-3">
    <label htmlFor={id} className="text-sm text-text-primary cursor-pointer flex-1">
      {label}
    </label>
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={[
        'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        checked ? 'bg-primary-600' : 'bg-slate-200',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg',
          'transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
        aria-hidden="true"
      />
    </button>
  </div>
);

function formatNotifKey(key: string): string {
  const map: Record<string, string> = {
    medicationReminders: 'Medication reminders',
    appointmentReminders: 'Appointment reminders',
    healthTips: 'Health tips',
    emailNotifications: 'Email notifications',
    pushNotifications: 'Push notifications',
  };
  return map[key] ?? key;
}

export default Profile;
