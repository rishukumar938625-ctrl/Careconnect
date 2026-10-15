import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  Pill,
  Calendar,
  Sparkles,
  Info,
  RefreshCw,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { notificationApi } from '../services/api';
import { AppNotification } from '../types';

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [res, countRes] = await Promise.all([
        notificationApi.getNotifications({ unreadOnly: filter === 'unread', limit: 50 }),
        notificationApi.getUnreadCount(),
      ]);
      setNotifications(res.data);
      setUnreadCount(countRes.unreadCount);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id || n._id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      setActionLoading(true);
      await notificationApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark all as read');
    } finally {
      setActionLoading(false);
    }
  };

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'medication_reminder':
        return <Pill className="h-5 w-5 text-indigo-600" aria-hidden="true" />;
      case 'appointment_reminder':
        return <Calendar className="h-5 w-5 text-blue-600" aria-hidden="true" />;
      case 'health_tip':
        return <Sparkles className="h-5 w-5 text-emerald-600" aria-hidden="true" />;
      default:
        return <Info className="h-5 w-5 text-slate-600" aria-hidden="true" />;
    }
  };

  const getNotificationBadgeColor = (type: string) => {
    switch (type) {
      case 'medication_reminder':
        return 'bg-indigo-50 border-indigo-100 text-indigo-700';
      case 'appointment_reminder':
        return 'bg-blue-50 border-blue-100 text-blue-700';
      case 'health_tip':
        return 'bg-emerald-50 border-emerald-100 text-emerald-700';
      default:
        return 'bg-slate-50 border-slate-100 text-slate-700';
    }
  };

  const getTargetLink = (item: AppNotification) => {
    if (item.type === 'medication_reminder' || item.data?.medicationId || item.data?.doseId) {
      return { path: '/medications', label: 'View Medication' };
    }
    if (item.type === 'appointment_reminder' || item.data?.appointmentId) {
      return { path: '/appointments', label: 'View Appointments' };
    }
    return null;
  };

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-800">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Stay updated with your medication reminders and upcoming appointments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            disabled={loading}
            aria-label="Refresh notifications"
            className="p-2 rounded-xl border border-slate-200 bg-white text-text-secondary hover:text-text-primary hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>

          <button
            onClick={handleMarkAllAsRead}
            disabled={actionLoading || unreadCount === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-text-secondary hover:text-text-primary hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <CheckCheck className="h-4 w-4 text-primary-600" aria-hidden="true" />
            <span>Mark all read</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-red-50 border border-red-100 text-red-800">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 text-sm">{error}</div>
          <button
            onClick={fetchNotifications}
            className="text-xs font-semibold text-red-700 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 mb-6 rounded-xl bg-slate-100/80 w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === 'all'
              ? 'bg-white text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === 'unread'
              ? 'bg-white text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-primary-600" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-white border border-slate-100 animate-pulse flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-1/3 h-4 bg-slate-200 rounded" />
                <div className="w-2/3 h-3.5 bg-slate-100 rounded" />
                <div className="w-1/5 h-3 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-white border border-slate-100 shadow-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 mb-4">
            <Bell className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">
            {filter === 'unread' ? 'No unread notifications' : 'All caught up!'}
          </h2>
          <p className="text-sm text-text-secondary max-w-sm mx-auto mt-1">
            {filter === 'unread'
              ? 'You have viewed all your notifications. Check back later for upcoming reminders.'
              : 'You have no notifications right now. Medication doses and appointment reminders will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3" role="list">
          {notifications.map((item) => {
            const link = getTargetLink(item);
            return (
              <div
                key={item.id || item._id}
                role="listitem"
                className={`group relative p-4 sm:p-5 rounded-2xl border transition-all duration-150 ${
                  item.read
                    ? 'bg-white border-slate-100 hover:border-slate-200'
                    : 'bg-primary-50/40 border-primary-100/80 shadow-sm hover:border-primary-200'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Type Icon */}
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-xl border flex-shrink-0 ${getNotificationBadgeColor(
                      item.type
                    )}`}
                  >
                    {getNotificationIcon(item.type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className={`text-sm font-semibold truncate ${
                          item.read ? 'text-text-primary' : 'text-slate-900 font-bold'
                        }`}
                      >
                        {item.title}
                      </h3>
                      {!item.read && (
                        <span
                          className="w-2 h-2 rounded-full bg-primary-600 flex-shrink-0"
                          title="Unread notification"
                        >
                          <span className="sr-only">Unread notification</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed mb-3">
                      {item.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatRelativeTime(item.createdAt)}
                      </span>

                      {link && (
                        <Link
                          to={link.path}
                          className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                        >
                          <span>{link.label}</span>
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Mark as read button */}
                  {!item.read && (
                    <button
                      onClick={() => handleMarkAsRead(item.id || item._id)}
                      title="Mark as read"
                      aria-label={`Mark "${item.title}" as read`}
                      className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
};
