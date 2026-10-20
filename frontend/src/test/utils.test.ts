import { describe, it, expect } from 'vitest';
import {
  parseCalendarDate,
  formatDate,
  formatDateShort,
  getRelativeDate,
  formatTime,
  formatFrequency,
} from '../utils';

describe('Date & Utility Functions — Timezone & Boundary Tests', () => {
  it('parses YYYY-MM-DD as local calendar date without timezone shift', () => {
    const d = parseCalendarDate('2026-10-21');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9); // 0-indexed: October is 9
    expect(d.getDate()).toBe(21);
  });

  it('formats dates consistently without rolling back to previous day', () => {
    const formatted = formatDateShort('2026-10-21');
    expect(formatted).toContain('Oct 21, 2026');

    const fullFormatted = formatDate('2026-10-21');
    expect(fullFormatted).toContain('October 21, 2026');
  });

  it('calculates getRelativeDate accurately for today, tomorrow, and yesterday', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    expect(getRelativeDate(todayStr)).toBe('Today');

    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomY = tomorrow.getFullYear();
    const tomM = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const tomD = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowStr = `${tomY}-${tomM}-${tomD}`;

    expect(getRelativeDate(tomorrowStr)).toBe('Tomorrow');

    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yestY = yesterday.getFullYear();
    const yestM = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yestD = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yestY}-${yestM}-${yestD}`;

    expect(getRelativeDate(yesterdayStr)).toBe('Yesterday');
  });

  it('formats 24h time to 12h AM/PM correctly', () => {
    expect(formatTime('09:00')).toBe('9:00 AM');
    expect(formatTime('12:30')).toBe('12:30 PM');
    expect(formatTime('14:45')).toBe('2:45 PM');
    expect(formatTime('00:15')).toBe('12:15 AM');
  });

  it('formats medication frequencies to user-friendly labels', () => {
    expect(formatFrequency('once_daily')).toBe('Once daily');
    expect(formatFrequency('twice_daily')).toBe('Twice daily');
    expect(formatFrequency('weekly')).toBe('Weekly');
    expect(formatFrequency('as_needed')).toBe('As needed');
  });
});
