import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Home,
  Heart,
  Pill,
  Calendar,
  User,
  Cross,
  LogOut,
  LogIn,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationApi } from '../../services/api';

const navItems = [
  { label: 'Home', path: '/dashboard', icon: Home, ariaLabel: 'Dashboard' },
  { label: 'Health', path: '/health', icon: Heart, ariaLabel: 'Health Information' },
  { label: 'Meds', path: '/medications', icon: Pill, ariaLabel: 'Medications' },
  { label: 'Appointments', path: '/appointments', icon: Calendar, ariaLabel: 'Appointments' },
  { label: 'Notifications', path: '/notifications', icon: Bell, ariaLabel: 'Notifications', showBadge: true },
  { label: 'Profile', path: '/profile', icon: User, ariaLabel: 'Profile' },
] as const;

// Bottom nav items (keep 5 items for mobile bottom bar)
const bottomNavItems = [
  { label: 'Home', path: '/dashboard', icon: Home, ariaLabel: 'Dashboard' },
  { label: 'Health', path: '/health', icon: Heart, ariaLabel: 'Health Information' },
  { label: 'Meds', path: '/medications', icon: Pill, ariaLabel: 'Medications' },
  { label: 'Appointments', path: '/appointments', icon: Calendar, ariaLabel: 'Appointments' },
  { label: 'Profile', path: '/profile', icon: User, ariaLabel: 'Profile' },
] as const;

/**
 * Custom hook to periodically poll unread notification count
 */
function useUnreadCount(user: unknown): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    let isMounted = true;
    const fetchCount = async () => {
      try {
        const res = await notificationApi.getUnreadCount();
        if (isMounted) {
          setCount(res.unreadCount);
        }
      } catch {
        // Silently ignore if unauthenticated or network failure
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000); // 60-second polling interval
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  return count;
}

// ─── Bottom Navigation (Mobile) ───────────────────────────────────────────────

export const BottomNavigation: React.FC = () => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-nav safe-bottom lg:hidden"
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch justify-around h-16" role="list">
        {bottomNavItems.map(({ label, path, icon: Icon, ariaLabel }) => (
          <li key={path} className="flex-1">
            <NavLink
              to={path}
              aria-label={ariaLabel}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center h-full gap-1 px-1 transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset',
                  isActive
                    ? 'text-primary-600'
                    : 'text-text-muted hover:text-text-secondary',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-5 w-5 transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-[10px] font-medium leading-none ${isActive ? 'text-primary-600' : ''}`}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 w-6 h-0.5 bg-primary-600 rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

// ─── Sidebar Navigation (Desktop) ─────────────────────────────────────────────

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const unreadCount = useUnreadCount(user);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-r lg:border-slate-100 lg:bg-white lg:z-40"
      aria-label="Sidebar navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary-600 shadow-sm shadow-primary-500/20">
          <Cross className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <span className="text-xl font-bold text-text-primary tracking-tight">
          Care<span className="text-primary-600">Connect</span>
        </span>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-6 px-3 overflow-y-auto">
        <ul className="space-y-1" role="list">
          {navItems.map((item) => {
            const { label, path, icon: Icon, ariaLabel } = item;
            const hasBadge = 'showBadge' in item && item.showBadge && unreadCount > 0;

            return (
              <li key={path}>
                <NavLink
                  to={path}
                  aria-label={ariaLabel}
                  className={({ isActive }) =>
                    [
                      'flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-text-secondary hover:bg-slate-50 hover:text-text-primary',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-text-muted'}`}
                          aria-hidden="true"
                        />
                        <span>{label}</span>
                      </div>
                      {hasBadge && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary-100 text-primary-700">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section / Authentication Actions */}
      <div className="p-3 border-t border-slate-100">
        {user ? (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity"
                aria-label={`Go to ${user.name}'s profile`}
              >
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-600 text-white font-semibold text-xs flex-shrink-0"
                  aria-hidden="true"
                >
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-text-primary truncate">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-text-muted truncate capitalize">
                    {user.role} account
                  </p>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
                className="p-1.5 text-text-muted hover:text-danger hover:bg-red-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-semibold rounded-xl bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Sign in
            </Link>
            <Link
              to="/register"
              className="flex items-center justify-center w-full py-2 px-3 text-xs font-medium rounded-xl border border-slate-200 text-text-secondary hover:bg-slate-50 transition-colors"
            >
              Create account
            </Link>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="px-5 py-3 border-t border-slate-100">
        <p className="text-[10px] text-text-muted leading-relaxed">
          CareConnect provides educational health information.
        </p>
      </div>
    </aside>
  );
};

// ─── Top App Bar (Mobile) ─────────────────────────────────────────────────────

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  rightAction,
}) => {
  const { user } = useAuth();
  const unreadCount = useUnreadCount(user);
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 lg:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary-600">
            <Cross className="h-4 w-4 text-white" aria-hidden="true" />
          </div>
          {title ? (
            <h1 className="text-base font-bold text-text-primary">{title}</h1>
          ) : (
            <span className="text-base font-bold text-text-primary">
              Care<span className="text-primary-600">Connect</span>
            </span>
          )}
        </div>
        <div>
          {rightAction ? (
            rightAction
          ) : user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/notifications"
                aria-label={unreadCount > 0 ? `View notifications (${unreadCount} unread)` : 'View notifications'}
                className="relative p-1.5 rounded-lg text-slate-600 hover:text-primary-600 hover:bg-slate-100 transition-colors"
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-600"></span>
                  </span>
                )}
              </Link>
              <Link
                to="/profile"
                aria-label="View your profile"
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary-600 text-white font-semibold text-xs"
              >
                {userInitial}
              </Link>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 py-1.5 px-2.5 rounded-lg border border-primary-200 hover:bg-primary-50"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
