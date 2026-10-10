import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  id = 'search-bar',
}) => {
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
        <Search className="h-4 w-4 text-text-muted" aria-hidden="true" />
      </div>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          'block w-full rounded-xl border border-slate-200 bg-white',
          'py-3 pl-10 pr-10 text-sm text-text-primary placeholder-text-muted',
          'transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          'hover:border-slate-300',
        ].join(' ')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
