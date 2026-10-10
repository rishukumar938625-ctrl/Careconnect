import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bookmark,
  Shield,
  HelpCircle,
  ChevronRight,
  Edit2,
  Droplets,
  AlertCircle,
  LogOut,
  X,
  Check,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const Profile: React.FC = () => {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editBloodGroup, setEditBloodGroup] = useState(user?.bloodGroup || '');
  const [editAllergies, setEditAllergies] = useState(user?.allergies?.join(', ') || '');
  const [editEmergencyName, setEditEmergencyName] = useState(user?.emergencyContact?.name || '');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState(user?.emergencyContact?.phone || '');
  const [editEmergencyRel, setEditEmergencyRel] = useState(user?.emergencyContact?.relationship || '');

  const openEditModal = () => {
    if (user) {
      setEditName(user.name);
      setEditPhone(user.phone || '');
      setEditBloodGroup(user.bloodGroup || '');
      setEditAllergies(user.allergies?.join(', ') || '');
      setEditEmergencyName(user.emergencyContact?.name || '');
      setEditEmergencyPhone(user.emergencyContact?.phone || '');
      setEditEmergencyRel(user.emergencyContact?.relationship || '');
    }
    setSaveError(null);
    setSaveSuccess(false);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaveError(null);
    setIsSaving(true);

    try {
      const parsedAllergies = editAllergies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await updateProfile({
        name: editName.trim() || user.name,
        phone: editPhone.trim(),
        bloodGroup: editBloodGroup.trim(),
        allergies: parsedAllergies,
        emergencyContact: {
          name: editEmergencyName.trim(),
          phone: editEmergencyPhone.trim(),
          relationship: editEmergencyRel.trim(),
        },
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setIsEditModalOpen(false);
        setSaveSuccess(false);
      }, 800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile.';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNotification = async (key: 'medicationReminders' | 'appointmentAlerts' | 'healthTips' | 'emailUpdates') => {
    if (!user) return;
    const currentPrefs = user.notificationPreferences || {
      medicationReminders: true,
      appointmentAlerts: true,
      healthTips: false,
      emailUpdates: true,
    };

    const newPrefs = {
      ...currentPrefs,
      [key]: !currentPrefs[key],
    };

    try {
      await updateProfile({
        notificationPreferences: newPrefs,
      });
    } catch {
      // Ignore background notification toggle error
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    return (
      <PageContainer>
        <PageHeader title="Profile" />
        <Card className="text-center py-12">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-text-muted mx-auto mb-3">
            <UserIcon className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-text-primary mb-1">Not signed in</h2>
          <p className="text-sm text-text-muted mb-4">
            Sign in to view and manage your profile and personal health data.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => navigate('/login')} size="md">
              Sign in
            </Button>
            <Button onClick={() => navigate('/register')} variant="outline" size="md">
              Create account
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const notifs = user.notificationPreferences || {
    medicationReminders: true,
    appointmentAlerts: true,
    healthTips: false,
    emailUpdates: true,
  };

  const emergencyString = user.emergencyContact?.name
    ? `${user.emergencyContact.name} (${user.emergencyContact.relationship || 'Contact'}): ${user.emergencyContact.phone || 'No phone'}`
    : 'None added';

  return (
    <PageContainer>
      <PageHeader title="Profile" />

      {/* Profile header card */}
      <section aria-labelledby="profile-header" className="mb-5">
        <Card className="flex flex-col items-center gap-3 py-6">
          <div
            className="flex items-center justify-center w-20 h-20 rounded-2xl text-white text-2xl font-bold bg-primary-600 shadow-md shadow-primary-500/20"
            aria-label={`Avatar for ${user.name}`}
          >
            {initials}
          </div>
          <div className="text-center">
            <h1 id="profile-header" className="text-xl font-bold text-text-primary">
              {user.name}
            </h1>
            <p className="text-sm text-text-muted">{user.email}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="primary" className="capitalize">
              {user.role}
            </Badge>
            {user.bloodGroup && (
              <Badge variant="danger">
                <Droplets className="h-3 w-3" aria-hidden="true" />
                Blood: {user.bloodGroup}
              </Badge>
            )}
            {user.allergies && user.allergies.length > 0 && user.allergies.map((a) => (
              <Badge key={a} variant="warning">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                Allergy: {a}
              </Badge>
            ))}
          </div>

          <button
            onClick={openEditModal}
            className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded p-1 transition-colors"
            aria-label="Edit profile information"
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
            <ProfileInfoRow label="Full name" value={user.name} />
            <ProfileInfoRow label="Email" value={user.email} />
            <ProfileInfoRow label="Phone number" value={user.phone || 'Not provided'} />
            <ProfileInfoRow label="Date of birth" value={user.dateOfBirth || 'Not provided'} />
            <ProfileInfoRow label="Blood group" value={user.bloodGroup || '—'} />
            <ProfileInfoRow label="Emergency contact" value={emergencyString} />
          </div>
        </Card>
      </section>

      {/* Notification preferences */}
      <section className="mb-4" aria-labelledby="notification-prefs-heading">
        <Card>
          <CardHeader title="Notification preferences" />
          <div className="flex flex-col gap-4">
            <ToggleRow
              label="Medication reminders"
              checked={Boolean(notifs.medicationReminders)}
              onChange={() => handleToggleNotification('medicationReminders')}
              id="notif-meds"
            />
            <ToggleRow
              label="Appointment alerts"
              checked={Boolean(notifs.appointmentAlerts)}
              onChange={() => handleToggleNotification('appointmentAlerts')}
              id="notif-appts"
            />
            <ToggleRow
              label="Educational health tips"
              checked={Boolean(notifs.healthTips)}
              onChange={() => handleToggleNotification('healthTips')}
              id="notif-tips"
            />
            <ToggleRow
              label="Email updates"
              checked={Boolean(notifs.emailUpdates)}
              onChange={() => handleToggleNotification('emailUpdates')}
              id="notif-email"
            />
          </div>
        </Card>
      </section>

      {/* User bookmarks and settings links */}
      <section className="mb-6" aria-labelledby="bookmarks-settings-heading">
        <Card padding="none">
          <h2 id="bookmarks-settings-heading" className="sr-only">
            Account bookmarks and settings
          </h2>
          <Link
            to="/health/articles?bookmarked=true"
            className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100"
          >
            <Bookmark className="h-5 w-5 text-primary-600" />
            <span className="flex-1 text-sm font-medium text-text-primary">Saved articles</span>
            <span className="text-xs text-text-muted">
              {user.bookmarkedArticles?.length || 0} saved
            </span>
            <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
          </Link>

          <Link
            to="/health/conditions?bookmarked=true"
            className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100"
          >
            <Bookmark className="h-5 w-5 text-primary-600" />
            <span className="flex-1 text-sm font-medium text-text-primary">Saved health conditions</span>
            <span className="text-xs text-text-muted">
              {user.bookmarkedConditions?.length || 0} saved
            </span>
            <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
          </Link>

          <Link
            to="/health/medicines?bookmarked=true"
            className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100"
          >
            <Bookmark className="h-5 w-5 text-primary-600" />
            <span className="flex-1 text-sm font-medium text-text-primary">Saved medicines</span>
            <span className="text-xs text-text-muted">
              {user.bookmarkedMedicines?.length || 0} saved
            </span>
            <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
          </Link>

          <div className="flex items-center gap-3 w-full px-4 py-3.5 text-left border-b border-slate-100">
            <Shield className="h-5 w-5 text-text-muted" />
            <span className="flex-1 text-sm font-medium text-text-primary">Data privacy & session</span>
            <Badge variant="success">Protected</Badge>
          </div>

          <div className="flex items-center gap-3 w-full px-4 py-3.5 text-left">
            <HelpCircle className="h-5 w-5 text-text-muted" />
            <span className="flex-1 text-sm font-medium text-text-primary">Help & support</span>
            <span className="text-xs text-text-muted">v0.3.0</span>
          </div>
        </Card>
      </section>

      {/* Log out action button */}
      <section className="mb-8">
        <Button
          variant="outline"
          fullWidth
          size="lg"
          onClick={handleLogout}
          className="border-red-200 text-danger hover:bg-red-50 hover:border-red-300"
          leftIcon={<LogOut className="h-4 w-4 text-danger" aria-hidden="true" />}
        >
          Sign out of CareConnect
        </Button>
      </section>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-modal-title"
        >
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h2 id="edit-profile-modal-title" className="text-lg font-bold text-text-primary">
                Edit personal profile
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg"
                aria-label="Close edit profile dialog"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {saveError && (
              <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs">
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div role="status" className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" />
                Profile updated successfully!
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <Input
                label="Full name"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={isSaving}
              />

              <Input
                label="Phone number"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+91 98765 43210"
                disabled={isSaving}
              />

              <Input
                label="Blood group"
                value={editBloodGroup}
                onChange={(e) => setEditBloodGroup(e.target.value)}
                placeholder="e.g. O+, A+, B+"
                disabled={isSaving}
              />

              <Input
                label="Allergies (comma-separated)"
                value={editAllergies}
                onChange={(e) => setEditAllergies(e.target.value)}
                placeholder="e.g. Penicillin, Peanuts"
                disabled={isSaving}
              />

              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-text-secondary mb-3">Emergency contact details</p>
                <div className="space-y-3">
                  <Input
                    label="Contact name"
                    value={editEmergencyName}
                    onChange={(e) => setEditEmergencyName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    disabled={isSaving}
                  />
                  <Input
                    label="Relationship"
                    value={editEmergencyRel}
                    onChange={(e) => setEditEmergencyRel(e.target.value)}
                    placeholder="e.g. Spouse, Brother"
                    disabled={isSaving}
                  />
                  <Input
                    label="Contact phone"
                    type="tel"
                    value={editEmergencyPhone}
                    onChange={(e) => setEditEmergencyPhone(e.target.value)}
                    placeholder="+91 98765 43211"
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSaving}
                  fullWidth
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={isSaving}
                  disabled={isSaving}
                  fullWidth
                >
                  Save changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer disclaimer */}
      <p className="text-[11px] text-text-muted text-center px-4 leading-relaxed">
        CareConnect provides general educational information and is not a substitute for professional medical advice, diagnosis, or treatment.
      </p>
    </PageContainer>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ProfileInfoRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between gap-2 py-0.5">
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

export default Profile;
