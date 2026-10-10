import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  bordered?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  hover = false,
  bordered = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={[
        'bg-white rounded-2xl shadow-card',
        bordered ? 'border border-slate-100' : '',
        hover
          ? 'transition-shadow duration-200 hover:shadow-card-hover cursor-pointer'
          : '',
        paddingClasses[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
}) => {
  return (
    <div className={`flex items-start justify-between gap-2 mb-3 ${className}`}>
      <div>
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        {subtitle && (
          <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};
