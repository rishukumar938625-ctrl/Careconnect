import React, { useState, useEffect } from 'react';
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
  Plus,
  Moon,
  Clock,
  Globe,
  Heart,
  Phone,
  Info,
  Bell,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { userApi, ApiError } from '../services/api';
import type { UserNotificationPreferences } from '../types';

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'London, Edinburgh, Dublin (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris, Berlin, Rome (CET/CEST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore Standard Time (SGT)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AEST)' },
];

export const Profile: React.FC = () => {
  const { user, logout, updateProfile, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Profile Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editDateOfBirth, setEditDateOfBirth] = useState(user?.dateOfBirth || '');
  const [editBloodGroup, setEditBloodGroup] = useState(user?.bloodGroup || '');

  // Emergency Contact Edit Modal State
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isSavingEmergency, setIsSavingEmergency] = useState(false);
  const [emergencySuccess, setEmergencySuccess] = useState(false);
  const [emergencyError, setEmergencyError] = useState<string | null>(null);
  const [isEmergencySessionExpired, setIsEmergencySessionExpired] = useState(false);

  const [emergencyName, setEmergencyName] = useState(user?.emergencyContact?.name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergencyContact?.phone || '');
  const [emergencyRel, setEmergencyRel] = useState(user?.emergencyContact?.relationship || '');

  // Quick Health Profile Inline States
  const [newAllergy, setNewAllergy] = useState('');
  const [isAddingAllergy, setIsAddingAllergy] = useState(false);
  const [allergyError, setAllergyError] = useState<string | null>(null);

  const [newCondition, setNewCondition] = useState('');
  const [isAddingCondition, setIsAddingCondition] = useState(false);
  const [conditionError, setConditionError] = useState<string | null>(null);

  // Notification Preferences State
  const [notifPrefs, setNotifPrefs] = useState<UserNotificationPreferences>({
    medicationReminders: true,
    appointmentAlerts: true,
    healthTips: false,
    emailUpdates: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    timeZone: 'UTC',
  });
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);
  const [notifMessage, setNotifMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync notification preferences from user state on load
  useEffect(() => {
    if (user?.notificationPreferences) {
      setNotifPrefs({
        medicationReminders: user.notificationPreferences.medicationReminders ?? true,
        appointmentAlerts: user.notificationPreferences.appointmentAlerts ?? true,
        healthTips: user.notificationPreferences.healthTips ?? false,
        emailUpdates: user.notificationPreferences.emailUpdates ?? true,
        quietHoursEnabled: user.notificationPreferences.quietHoursEnabled ?? false,
        quietHoursStart: user.notificationPreferences.quietHoursStart || '22:00',
        quietHoursEnd: user.notificationPreferences.quietHoursEnd || '07:00',
        timeZone: user.notificationPreferences.timeZone || 'UTC',
      });
    }
  }, [user]);

  const openEditModal = () => {
    if (user) {
      setEditName(user.name);
      setEditPhone(user.phone || '');
      setEditDateOfBirth(user.dateOfBirth || '');
      setEditBloodGroup(user.bloodGroup || '');
    }
    setSaveError(null);
    setIsSessionExpired(false);
    setSaveSuccess(false);
    setIsEditModalOpen(true);
  };

  const openEmergencyModal = () => {
    if (user) {
      setEmergencyName(user.emergencyContact?.name || '');
      setEmergencyPhone(user.emergencyContact?.phone || '');
      setEmergencyRel(user.emergencyContact?.relationship || '');
    }
    setEmergencyError(null);
    setIsEmergencySessionExpired(false);
    setEmergencySuccess(false);
    setIsEmergencyModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSaving) return;

    setSaveError(null);
    setIsSessionExpired(false);

    const trimmedName = editName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setSaveError('Full name must be at least 2 characters long.');
      return;
    }
    if (trimmedName.length > 100) {
      setSaveError('Full name cannot exceed 100 characters.');
      return;
    }

    setIsSaving(true);

    try {
      await updateProfile({
        name: trimmedName,
        phone: editPhone.trim(),
        dateOfBirth: editDateOfBirth.trim(),
        bloodGroup: editBloodGroup.trim(),
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setIsEditModalOpen(false);
        setSaveSuccess(false);
      }, 700);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setIsSessionExpired(true);
          setSaveError('Your session has expired or is invalid. Please sign in again to save your profile changes.');
        } else if (err.status === 403) {
          setSaveError('Access denied: You do not have permission to modify this profile.');
        } else if (err.status === 400) {
          setSaveError(err.message || 'Invalid profile information. Please check your entries.');
        } else if (err.status >= 500) {
          setSaveError('An unexpected server error occurred. Please try again shortly.');
        } else {
          setSaveError(err.message || 'Failed to update profile.');
        }
      } else if (err instanceof Error) {
        setSaveError(err.message);
      } else {
        setSaveError('Failed to update profile. Please check your connection and try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmergencyContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSavingEmergency) return;

    setEmergencyError(null);
    setIsEmergencySessionExpired(false);

    const trimmedName = emergencyName.trim();
    const trimmedPhone = emergencyPhone.trim();
    const trimmedRel = emergencyRel.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setEmergencyError('Contact name must be at least 2 characters long.');
      return;
    }
    if (!trimmedRel) {
      setEmergencyError('Relationship is required.');
      return;
    }
    if (!trimmedPhone) {
      setEmergencyError('Phone number is required.');
      return;
    }

    setIsSavingEmergency(true);

    try {
      await updateProfile({
        emergencyContact: {
          name: trimmedName,
          phone: trimmedPhone,
          relationship: trimmedRel,
        },
      });

      setEmergencySuccess(true);
      setTimeout(() => {
        setIsEmergencyModalOpen(false);
        setEmergencySuccess(false);
      }, 700);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setIsEmergencySessionExpired(true);
          setEmergencyError('Your session has expired or is invalid. Please sign in again to save your emergency contact.');
        } else if (err.status === 403) {
          setEmergencyError('Access denied: You do not have permission to modify emergency contact.');
        } else if (err.status === 400) {
          setEmergencyError(err.message || 'Invalid emergency contact details.');
        } else if (err.status >= 500) {
          setEmergencyError('An unexpected server error occurred. Please try again shortly.');
        } else {
          setEmergencyError(err.message || 'Failed to update emergency contact.');
        }
      } else if (err instanceof Error) {
        setEmergencyError(err.message);
      } else {
        setEmergencyError('Failed to update emergency contact. Please check your connection and try again.');
      }
    } finally {
      setIsSavingEmergency(false);
    }
  };

  // Allergy handlers
  const handleAddAllergy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllergy.trim() || !user || isAddingAllergy) return;

    setAllergyError(null);
    setIsAddingAllergy(true);

    try {
      await userApi.addAllergy(newAllergy.trim());
      await refreshUser();
      setNewAllergy('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add allergy.';
      setAllergyError(message);
    } finally {
      setIsAddingAllergy(false);
    }
  };

  const handleRemoveAllergy = async (allergyName: string) => {
    if (!user) return;
    try {
      await userApi.removeAllergy(allergyName);
      await refreshUser();
    } catch {
      // Ignore removal failure or log safely
    }
  };

  // Condition handlers
  const handleAddCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCondition.trim() || !user || isAddingCondition) return;

    setConditionError(null);
    setIsAddingCondition(true);

    try {
      await userApi.addCondition(newCondition.trim());
      await refreshUser();
      setNewCondition('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add health condition.';
      setConditionError(message);
    } finally {
      setIsAddingCondition(false);
    }
  };

  const handleRemoveCondition = async (conditionName: string) => {
    if (!user) return;
    try {
      await userApi.removeCondition(conditionName);
      await refreshUser();
    } catch {
      // Ignore removal failure
    }
  };

  // Notification preference toggles & updates
  const handleTogglePref = (key: keyof UserNotificationPreferences) => {
    setNotifPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveNotifications = async () => {
    if (!user || isSavingNotifs) return;
    setIsSavingNotifs(true);
    setNotifMessage(null);

    try {
      const res = await userApi.updateNotifications(notifPrefs);
      if (res.data) {
        setNotifPrefs((prev) => ({
          ...prev,
          ...res.data,
        }));
      }
      await refreshUser();
      setNotifMessage({ type: 'success', text: 'Notification preferences saved successfully!' });
      setTimeout(() => setNotifMessage(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save preferences.';
      setNotifMessage({ type: 'error', text: message });
    } finally {
      setIsSavingNotifs(false);
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
            Sign in to view and manage your profile, personal health data, and notifications.
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

  const crossesMidnight = Boolean(
    notifPrefs.quietHoursStart &&
      notifPrefs.quietHoursEnd &&
      notifPrefs.quietHoursStart > notifPrefs.quietHoursEnd
  );

  return (
    <PageContainer>
      <PageHeader title="Personal Profile & Settings" />

      {/* Profile Header Summary */}
      <section aria-labelledby="profile-header" className="mb-5">
        <Card className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-6">
          <div
            className="flex items-center justify-center w-20 h-20 rounded-2xl text-white text-2xl font-bold bg-primary-600 shadow-md shadow-primary-500/20 flex-shrink-0"
            aria-label={`Avatar for ${user.name}`}
          >
            {initials}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
              <h1 id="profile-header" className="text-xl font-bold text-text-primary">
                {user.name}
              </h1>
              <div className="flex items-center justify-center sm:justify-start gap-1.5">
                <Badge variant="primary" className="capitalize">
                  {user.role} Account
                </Badge>
                {user.bloodGroup && (
                  <Badge variant="danger">
                    <Droplets className="h-3 w-3" aria-hidden="true" />
                    {user.bloodGroup}
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-sm text-text-muted mb-3">{user.email}</p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openEditModal}
                leftIcon={<Edit2 className="h-3.5 w-3.5 text-primary-600" />}
              >
                Edit Profile
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={openEmergencyModal}
                leftIcon={<Phone className="h-3.5 w-3.5 text-secondary-600" />}
              >
                Emergency Contact
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* Personal Information Card */}
      <section className="mb-4" aria-labelledby="personal-info-heading">
        <Card>
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div>
              <h2 id="personal-info-heading" className="text-base font-semibold text-text-primary">
                Personal Information
              </h2>
              <p className="text-xs text-text-muted mt-0.5">Basic identity and contact details</p>
            </div>
            <Button variant="ghost" size="sm" onClick={openEditModal}>
              <Edit2 className="h-4 w-4 mr-1 text-primary-600" />
              Edit
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ProfileInfoRow label="Full Name" value={user.name} />
            <ProfileInfoRow
              label="Email Address"
              value={
                <span className="flex items-center gap-1.5">
                  {user.email}
                  <span title="Email is protected">
                    <Lock className="h-3 w-3 text-slate-400" />
                  </span>
                </span>
              }
            />
            <ProfileInfoRow label="Phone Number" value={user.phone || 'Not provided'} />
            <ProfileInfoRow label="Date of Birth" value={user.dateOfBirth || 'Not provided'} />
            <ProfileInfoRow label="Blood Group" value={user.bloodGroup || 'Not specified'} />
            <ProfileInfoRow
              label="Account Role"
              value={
                <span className="flex items-center gap-1.5 capitalize">
                  {user.role}
                  <span title="Role is protected">
                    <Lock className="h-3 w-3 text-slate-400" />
                  </span>
                </span>
              }
            />
          </div>
        </Card>
      </section>

      {/* Personal Health Profile (Allergies & Conditions) */}
      <section className="mb-4" aria-labelledby="health-profile-heading">
        <Card>
          <div className="flex items-start justify-between pb-3 mb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" aria-hidden="true" />
                <h2 id="health-profile-heading" className="text-base font-semibold text-text-primary">
                  Personal Health Profile
                </h2>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Self-reported allergies and ongoing conditions for your personal tracking
              </p>
            </div>
            <Badge variant="neutral" className="text-[11px] hidden sm:inline-flex">
              User-Managed
            </Badge>
          </div>

          {/* Non-diagnostic notice banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-900 mb-4 text-xs">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              <strong>Notice:</strong> This information is user-provided for your personal wellness tracking. It does not constitute a clinical medical diagnosis or medical record.
            </p>
          </div>

          {/* Allergies Section */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-warning" />
                Allergies ({user.allergies?.length || 0})
              </span>
              <span className="text-xs text-text-muted">Max 30 items</span>
            </div>

            {/* List of allergies chips */}
            <div className="flex flex-wrap gap-2 mb-3 min-h-[32px] items-center">
              {user.allergies && user.allergies.length > 0 ? (
                user.allergies.map((allergy) => (
                  <span
                    key={allergy}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200"
                  >
                    <span>{allergy}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAllergy(allergy)}
                      className="text-amber-700 hover:text-amber-950 p-0.5 rounded-full hover:bg-amber-100 transition-colors"
                      aria-label={`Remove allergy ${allergy}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-xs text-text-muted italic">No allergies recorded.</p>
              )}
            </div>

            {/* Add allergy form */}
            <form onSubmit={handleAddAllergy} className="flex gap-2">
              <input
                type="text"
                value={newAllergy}
                onChange={(e) => setNewAllergy(e.target.value)}
                placeholder="Add an allergy (e.g. Penicillin, Peanuts)"
                maxLength={60}
                disabled={isAddingAllergy}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button
                type="submit"
                size="sm"
                loading={isAddingAllergy}
                disabled={!newAllergy.trim() || isAddingAllergy}
                leftIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Add
              </Button>
            </form>
            {allergyError && <p className="text-xs text-red-600 mt-1">{allergyError}</p>}
          </div>

          {/* Chronic Conditions Section */}
          <div className="mb-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-primary-600" />
                Health Conditions ({user.chronicConditions?.length || 0})
              </span>
              <span className="text-xs text-text-muted">Max 30 items</span>
            </div>

            {/* List of condition chips */}
            <div className="flex flex-wrap gap-2 mb-3 min-h-[32px] items-center">
              {user.chronicConditions && user.chronicConditions.length > 0 ? (
                user.chronicConditions.map((condition) => (
                  <span
                    key={condition}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-900 border border-blue-200"
                  >
                    <span>{condition}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(condition)}
                      className="text-blue-700 hover:text-blue-950 p-0.5 rounded-full hover:bg-blue-100 transition-colors"
                      aria-label={`Remove condition ${condition}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-xs text-text-muted italic">No ongoing conditions recorded.</p>
              )}
            </div>

            {/* Add condition form */}
            <form onSubmit={handleAddCondition} className="flex gap-2">
              <input
                type="text"
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                placeholder="Add condition (e.g. Asthma, Hypertension)"
                maxLength={100}
                disabled={isAddingCondition}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button
                type="submit"
                size="sm"
                loading={isAddingCondition}
                disabled={!newCondition.trim() || isAddingCondition}
                leftIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Add
              </Button>
            </form>
            {conditionError && <p className="text-xs text-red-600 mt-1">{conditionError}</p>}
          </div>

          {/* Emergency Contact Summary */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-emerald-600" />
                Emergency Contact
              </span>
              <button
                type="button"
                onClick={openEmergencyModal}
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                {user.emergencyContact?.name ? 'Edit Contact' : 'Add Contact'}
              </button>
            </div>
            {user.emergencyContact?.name ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-text-primary">{user.emergencyContact.name}</span>
                  <span className="text-text-muted"> ({user.emergencyContact.relationship || 'Contact'})</span>
                </div>
                <div className="text-text-secondary font-mono">
                  {user.emergencyContact.phone || 'No phone number'}
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">No emergency contact designated.</p>
            )}
          </div>
        </Card>
      </section>

      {/* Notification Preferences & Quiet Hours Card */}
      <section className="mb-4" aria-labelledby="notification-prefs-heading">
        <Card>
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary-600" />
                <h2 id="notification-prefs-heading" className="text-base font-semibold text-text-primary">
                  Notification Preferences & Quiet Hours
                </h2>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Configure your reminder alerts, sleep windows, and local time zone
              </p>
            </div>
            <Badge variant="primary" className="text-[11px] hidden sm:inline-flex">
              Phase 6 Settings
            </Badge>
          </div>

          {/* Phase 7 delivery notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 mb-4 text-xs">
            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              <strong>Note:</strong> Preferences configured here are securely saved to your profile. Automated notification dispatch, push delivery, and background worker jobs will be enabled in Phase 7.
            </p>
          </div>

          {notifMessage && (
            <div
              role="alert"
              className={`p-3 rounded-xl text-xs mb-4 flex items-center gap-2 ${
                notifMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                  : 'bg-red-50 text-red-800 border border-red-100'
              }`}
            >
              {notifMessage.type === 'success' ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
              {notifMessage.text}
            </div>
          )}

          {/* Reminder Toggles */}
          <div className="space-y-3 mb-6">
            <ToggleRow
              label="Medication reminder alerts"
              description="Receive alerts for upcoming and scheduled medication doses"
              checked={Boolean(notifPrefs.medicationReminders)}
              onChange={() => handleTogglePref('medicationReminders')}
              id="notif-meds"
            />
            <ToggleRow
              label="Appointment alerts"
              description="Notifications for confirmed, rescheduled, and upcoming consultations"
              checked={Boolean(notifPrefs.appointmentAlerts)}
              onChange={() => handleTogglePref('appointmentAlerts')}
              id="notif-appts"
            />
            <ToggleRow
              label="Educational health tips"
              description="Occasional verified medical articles and seasonal advice"
              checked={Boolean(notifPrefs.healthTips)}
              onChange={() => handleTogglePref('healthTips')}
              id="notif-tips"
            />
            <ToggleRow
              label="Email updates"
              description="Account and appointment confirmations sent to your registered email"
              checked={Boolean(notifPrefs.emailUpdates)}
              onChange={() => handleTogglePref('emailUpdates')}
              id="notif-email"
            />
          </div>

          {/* Quiet Hours Sub-Section */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-semibold text-text-primary">Quiet Hours</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifPrefs.quietHoursEnabled}
                onClick={() => handleTogglePref('quietHoursEnabled')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  notifPrefs.quietHoursEnabled ? 'bg-primary-600' : 'bg-slate-300'
                }`}
                aria-label="Toggle quiet hours"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                    notifPrefs.quietHoursEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-text-secondary mb-4">
              Suppress audible sound and banner notifications during your sleep hours.
            </p>

            {notifPrefs.quietHoursEnabled && (
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="quiet-start" className="block text-xs font-medium text-text-secondary mb-1">
                      Start Time (Quiet begins)
                    </label>
                    <input
                      id="quiet-start"
                      type="time"
                      value={notifPrefs.quietHoursStart}
                      onChange={(e) => setNotifPrefs((prev) => ({ ...prev, quietHoursStart: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="quiet-end" className="block text-xs font-medium text-text-secondary mb-1">
                      End Time (Quiet ends)
                    </label>
                    <input
                      id="quiet-end"
                      type="time"
                      value={notifPrefs.quietHoursEnd}
                      onChange={(e) => setNotifPrefs((prev) => ({ ...prev, quietHoursEnd: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {crossesMidnight && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs">
                    <Moon className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Crosses midnight window ({notifPrefs.quietHoursStart} to {notifPrefs.quietHoursEnd} next morning)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Time Zone Selector */}
          <div className="mb-6">
            <label htmlFor="user-timezone" className="block text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-primary-600" />
              Local Time Zone
            </label>
            <select
              id="user-timezone"
              value={notifPrefs.timeZone}
              onChange={(e) => setNotifPrefs((prev) => ({ ...prev, timeZone: e.target.value }))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.value})
                </option>
              ))}
            </select>
          </div>

          {/* Save Preferences Button */}
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button
              type="button"
              onClick={handleSaveNotifications}
              loading={isSavingNotifs}
              disabled={isSavingNotifs}
              size="md"
            >
              Save Notification Preferences
            </Button>
          </div>
        </Card>
      </section>

      {/* Bookmarks and System Links */}
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
            <span className="text-xs text-text-muted">{user.bookmarkedArticles?.length || 0} saved</span>
            <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
          </Link>

          <Link
            to="/health/conditions?bookmarked=true"
            className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100"
          >
            <Bookmark className="h-5 w-5 text-primary-600" />
            <span className="flex-1 text-sm font-medium text-text-primary">Saved health conditions</span>
            <span className="text-xs text-text-muted">{user.bookmarkedConditions?.length || 0} saved</span>
            <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
          </Link>

          <Link
            to="/health/medicines?bookmarked=true"
            className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100"
          >
            <Bookmark className="h-5 w-5 text-primary-600" />
            <span className="flex-1 text-sm font-medium text-text-primary">Saved medicines</span>
            <span className="text-xs text-text-muted">{user.bookmarkedMedicines?.length || 0} saved</span>
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
            <span className="text-xs text-text-muted">CareConnect v0.6.0</span>
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
                Edit Personal Profile
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
              <div role="alert" className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
                {isSessionExpired && (
                  <Link
                    to="/login"
                    state={{ from: '/profile' }}
                    className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:text-primary-800 underline mt-0.5"
                  >
                    Sign in again to continue
                  </Link>
                )}
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
                placeholder="+1 555-019-2834"
                disabled={isSaving}
              />

              <Input
                label="Date of birth"
                type="date"
                value={editDateOfBirth}
                onChange={(e) => setEditDateOfBirth(e.target.value)}
                disabled={isSaving}
              />

              <Input
                label="Blood group"
                value={editBloodGroup}
                onChange={(e) => setEditBloodGroup(e.target.value)}
                placeholder="e.g. O+, A+, B+, AB-"
                disabled={isSaving}
              />

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-text-muted flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                <span>Email address and account role are protected and cannot be changed here.</span>
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
                <Button type="submit" loading={isSaving} disabled={isSaving} fullWidth>
                  Save changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Emergency Contact Modal */}
      {isEmergencyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-emergency-modal-title"
        >
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h2 id="edit-emergency-modal-title" className="text-lg font-bold text-text-primary">
                Emergency Contact Details
              </h2>
              <button
                onClick={() => setIsEmergencyModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg"
                aria-label="Close emergency contact dialog"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {emergencyError && (
              <div role="alert" className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span>{emergencyError}</span>
                </div>
                {isEmergencySessionExpired && (
                  <Link
                    to="/login"
                    state={{ from: '/profile' }}
                    className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:text-primary-800 underline mt-0.5"
                  >
                    Sign in again to continue
                  </Link>
                )}
              </div>
            )}

            {emergencySuccess && (
              <div role="status" className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" />
                Emergency contact updated successfully!
              </div>
            )}

            <form onSubmit={handleSaveEmergencyContact} className="space-y-4">
              <Input
                label="Contact Name"
                required
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="e.g. Sarah Connor"
                disabled={isSavingEmergency}
              />

              <Input
                label="Relationship"
                required
                value={emergencyRel}
                onChange={(e) => setEmergencyRel(e.target.value)}
                placeholder="e.g. Spouse, Parent, Sibling"
                disabled={isSavingEmergency}
              />

              <Input
                label="Phone Number"
                type="tel"
                required
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="e.g. +1 555-019-9999"
                disabled={isSavingEmergency}
              />

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEmergencyModalOpen(false)}
                  disabled={isSavingEmergency}
                  fullWidth
                >
                  Cancel
                </Button>
                <Button type="submit" loading={isSavingEmergency} disabled={isSavingEmergency} fullWidth>
                  Save Contact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer disclaimer */}
      <p className="text-[11px] text-text-muted text-center px-4 leading-relaxed">
        CareConnect provides general educational information and personal management tools. It is not a substitute for clinical medical evaluation, diagnosis, or emergency healthcare services.
      </p>
    </PageContainer>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ProfileInfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex flex-col py-1 border-b border-slate-50">
    <span className="text-xs text-text-muted mb-0.5">{label}</span>
    <span className="text-sm font-medium text-text-primary">{value}</span>
  </div>
);

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  id: string;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  description,
  checked,
  onChange,
  id,
}) => (
  <div className="flex items-start justify-between gap-3 py-1">
    <div className="flex-1">
      <label htmlFor={id} className="text-sm font-medium text-text-primary cursor-pointer block">
        {label}
      </label>
      {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 mt-0.5 ${
        checked ? 'bg-primary-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
        aria-hidden="true"
      />
    </button>
  </div>
);

export default Profile;
