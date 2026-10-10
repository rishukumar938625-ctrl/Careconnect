import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helpText,
  leftAddon,
  rightAddon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-text-primary"
      >
        {label}
        {props.required && (
          <span className="text-danger ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      <div className="relative flex items-center">
        {leftAddon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
            {leftAddon}
          </div>
        )}
        <input
          id={inputId}
          aria-describedby={
            [error ? errorId : '', helpText ? helpId : '']
              .filter(Boolean)
              .join(' ') || undefined
          }
          aria-invalid={error ? 'true' : undefined}
          className={[
            'block w-full rounded-xl border py-3 text-sm text-text-primary placeholder-text-muted',
            'transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0',
            leftAddon ? 'pl-10' : 'pl-4',
            rightAddon ? 'pr-10' : 'pr-4',
            error
              ? 'border-danger focus:ring-danger focus:border-transparent'
              : 'border-slate-200 hover:border-slate-300 focus:ring-primary-500 focus:border-transparent',
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {rightAddon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted">
            {rightAddon}
          </div>
        )}
      </div>

      {helpText && !error && (
        <p id={helpId} className="text-xs text-text-muted">
          {helpText}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helpText,
  className = '',
  id,
  rows = 4,
  ...props
}) => {
  const inputId = id ?? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-text-primary"
      >
        {label}
        {props.required && (
          <span className="text-danger ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      <textarea
        id={inputId}
        rows={rows}
        aria-describedby={
          [error ? errorId : '', helpText ? helpId : '']
            .filter(Boolean)
            .join(' ') || undefined
        }
        aria-invalid={error ? 'true' : undefined}
        className={[
          'block w-full rounded-xl border px-4 py-3 text-sm text-text-primary placeholder-text-muted',
          'transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 resize-none',
          error
            ? 'border-danger focus:ring-danger focus:border-transparent'
            : 'border-slate-200 hover:border-slate-300 focus:ring-primary-500 focus:border-transparent',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
      {helpText && !error && (
        <p id={helpId} className="text-xs text-text-muted">
          {helpText}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  helpText?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helpText,
  options,
  className = '',
  id,
  ...props
}) => {
  const inputId = id ?? `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-text-primary"
      >
        {label}
        {props.required && (
          <span className="text-danger ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      <select
        id={inputId}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? 'true' : undefined}
        className={[
          'block w-full rounded-xl border px-4 py-3 text-sm text-text-primary',
          'transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0',
          'appearance-none bg-white',
          error
            ? 'border-danger focus:ring-danger focus:border-transparent'
            : 'border-slate-200 hover:border-slate-300 focus:ring-primary-500 focus:border-transparent',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className="text-xs text-text-muted">{helpText}</p>
      )}
    </div>
  );
};
