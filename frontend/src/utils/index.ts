// ─── Date & Time Utilities ────────────────────────────────────────────────────

/**
 * Format a 24-hour time string "HH:MM" to a 12-hour format "h:MM AM/PM"
 */
export function formatTime(time: string): string {
  const [hourStr, minute] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

/**
 * Get a friendly greeting based on the current time of day
 */
export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Parse a calendar date string (YYYY-MM-DD) or ISO string into a local Date object.
 *
 * NOTE: Standard new Date("YYYY-MM-DD") parses as UTC midnight per ECMAScript.
 * In timezones with a negative UTC offset (e.g. US Eastern UTC-4/5), formatting or
 * zeroing hours on a UTC Date causes it to roll backward to the previous calendar day.
 * Parsing explicitly by date components prevents this day-shift.
 */
export function parseCalendarDate(dateString: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateString);
}

/**
 * Format a date string to a friendly readable format
 */
export function formatDate(dateString: string): string {
  const date = parseCalendarDate(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a date string to a short format like "Sep 30, 2025"
 */
export function formatDateShort(dateString: string): string {
  const date = parseCalendarDate(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get a relative date label: "Today", "Tomorrow", or formatted date
 */
export function getRelativeDate(dateString: string): string {
  const today = new Date();
  const target = parseCalendarDate(dateString);

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return target.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return formatDateShort(dateString);
}

// ─── Medication Utilities ─────────────────────────────────────────────────────

/**
 * Convert medication frequency to a human-readable label
 */
export function formatFrequency(
  frequency: string,
): string {
  const map: Record<string, string> = {
    once_daily: 'Once daily',
    twice_daily: 'Twice daily',
    three_times_daily: '3× daily',
    four_times_daily: '4× daily',
    as_needed: 'As needed',
    weekly: 'Weekly',
  };
  return map[frequency] ?? frequency;
}

/**
 * Convert medication form to a human-readable label
 */
export function formatMedicationForm(form: string): string {
  const map: Record<string, string> = {
    tablet: 'Tablet',
    capsule: 'Capsule',
    liquid: 'Liquid',
    injection: 'Injection',
    topical: 'Topical',
    inhaler: 'Inhaler',
    drops: 'Drops',
  };
  return map[form] ?? form;
}

// ─── String Utilities ─────────────────────────────────────────────────────────

/**
 * Truncate a string to the given max length with an ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Get initials from a full name (e.g. "Sarah Johnson" → "SJ")
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Search Utilities ─────────────────────────────────────────────────────────

/**
 * Filter an array of items by a search query against specified keys
 */
export function filterByQuery<T>(
  items: T[],
  query: string,
  keys: (keyof T)[],
): T[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter((item) =>
    keys.some((key) => {
      const value = item[key];
      return typeof value === 'string' && value.toLowerCase().includes(q);
    }),
  );
}

// ─── React Hooks ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce a rapidly changing value (e.g. search query input).
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
