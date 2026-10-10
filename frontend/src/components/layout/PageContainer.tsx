import React from 'react';
import { Sidebar, BottomNavigation } from './Navigation';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Main page layout wrapper. Handles the desktop sidebar offset and
 * the mobile bottom navigation padding automatically.
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
}) => {
  return (
    <>
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main
        className={[
          'min-h-screen bg-surface',
          // On desktop, offset for the sidebar
          'lg:ml-64',
          // On mobile, add bottom padding for the bottom nav
          'pb-20 lg:pb-8',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="max-w-3xl mx-auto px-4 py-4 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <BottomNavigation />
    </>
  );
};

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-start justify-between gap-2 mb-4 ${className}`}>
      <div>
        <h2 className="text-xl font-bold text-text-primary">{title}</h2>
        {subtitle && (
          <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};

export const PageHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
}) => {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          {subtitle && (
            <p className="text-base text-text-secondary mt-1">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
};

export const Divider: React.FC<{ className?: string }> = ({
  className = '',
}) => <hr className={`border-slate-100 ${className}`} />;
