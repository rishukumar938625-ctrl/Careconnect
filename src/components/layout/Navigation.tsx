import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Heart,
  Pill,
  Calendar,
  User,
  Cross,
} from 'lucide-react';

const navItems = [
  { label: 'Home', path: '/dashboard', icon: Home, ariaLabel: 'Dashboard' },
  { label: 'Health', path: '/health', icon: Heart, ariaLabel: 'Health Information' },
  { label: 'Meds', path: '/medications', icon: Pill, ariaLabel: 'Medications' },
  { label: 'Appointments', path: '/appointments', icon: Calendar, ariaLabel: 'Appointments' },
  { label: 'Profile', path: '/profile', icon: User, ariaLabel: 'Profile' },
] as const;

// ─── Bottom Navigation (Mobile) ───────────────────────────────────────────────

export const BottomNavigation: React.FC = () => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 shadow-nav safe-bottom lg:hidden"
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch justify-around h-16" role="list">
        {navItems.map(({ label, path, icon: Icon, ariaLabel }) => (
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
  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-r lg:border-slate-100 lg:bg-white lg:z-40"
      aria-label="Sidebar navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary-600">
          <Cross className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <span className="text-xl font-bold text-text-primary tracking-tight">
          Care<span className="text-primary-600">Connect</span>
        </span>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-6 px-3 overflow-y-auto">
        <ul className="space-y-1" role="list">
          {navItems.map(({ label, path, icon: Icon, ariaLabel }) => {
            return (
              <li key={path}>
                <NavLink
                  to={path}
                  aria-label={ariaLabel}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-text-secondary hover:bg-slate-50 hover:text-text-primary',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-text-muted'}`}
                        aria-hidden="true"
                      />
                      <span>{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Disclaimer */}
      <div className="px-5 py-4 border-t border-slate-100">
        <p className="text-[11px] text-text-muted leading-relaxed">
          CareConnect provides general educational information and is not a
          substitute for professional medical advice.
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
        {rightAction && <div>{rightAction}</div>}
      </div>
    </header>
  );
};
