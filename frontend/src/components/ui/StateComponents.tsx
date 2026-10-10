import React from 'react';
import { PackageOpen, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './Button';

// ─── Loading State ────────────────────────────────────────────────────────────

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading…',
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 gap-4 ${className}`}
      role="status"
      aria-label={message}
    >
      <div className="rounded-full bg-primary-50 p-4">
        <Loader2
          className="h-8 w-8 text-primary-600 animate-spin"
          aria-hidden="true"
        />
      </div>
      <p className="text-sm text-text-secondary font-medium">{message}</p>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-6 text-center gap-4 ${className}`}
    >
      <div className="rounded-full bg-slate-100 p-5 text-text-muted">
        {icon ?? <PackageOpen className="h-8 w-8" aria-hidden="true" />}
      </div>
      <div>
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-text-secondary max-w-xs mx-auto">
            {description}
          </p>
        )}
      </div>
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

// ─── Error State ──────────────────────────────────────────────────────────────

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  description = 'We encountered an error. Please try again.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-6 text-center gap-4 ${className}`}
      role="alert"
    >
      <div className="rounded-full bg-red-50 p-5 text-danger">
        <AlertCircle className="h-8 w-8" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-text-secondary max-w-xs mx-auto">
            {description}
          </p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="md" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
};
