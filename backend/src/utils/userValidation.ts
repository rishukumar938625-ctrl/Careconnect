/**
 * User validation and sanitation utilities for Phase 6 Profile & Settings
 */

/**
 * Validates whether a given string is a recognized IANA time zone identifier.
 */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates whether a time string is in 24-hour HH:MM format (00:00 to 23:59).
 */
export function isValidTimeStr(time: string): boolean {
  if (!time || typeof time !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim());
}

/**
 * Parses HH:MM string to total minutes since midnight.
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Checks whether a quiet-hours window crosses midnight (e.g. 22:00 to 07:00).
 */
export function isQuietHoursOvernight(start: string, end: string): boolean {
  if (!isValidTimeStr(start) || !isValidTimeStr(end)) return false;
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  return startMin > endMin;
}

/**
 * Checks whether a specific Date falls within configured quiet hours.
 */
export function isCurrentlyQuietHours(
  date: Date,
  start: string,
  end: string,
  timeZone = 'UTC'
): boolean {
  if (!isValidTimeStr(start) || !isValidTimeStr(end)) return false;

  // Format local hour & minute in target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: isValidTimeZone(timeZone) ? timeZone : 'UTC',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const currentMin = hour * 60 + minute;

  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);

  if (startMin <= endMin) {
    // Normal window within same day (e.g. 13:00 to 17:00)
    return currentMin >= startMin && currentMin < endMin;
  } else {
    // Spans midnight (e.g. 22:00 to 07:00)
    return currentMin >= startMin || currentMin < endMin;
  }
}

/**
 * Sanitizes and normalizes an array of health strings (allergies or conditions).
 * - Trims entries
 * - Removes duplicates case-insensitively
 * - Enforces max length per item
 * - Enforces maximum item count
 */
export function sanitizeHealthList(
  items: unknown[],
  maxItems = 30,
  maxItemLength = 80
): string[] {
  if (!Array.isArray(items)) return [];

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const item of items) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > maxItemLength) continue;

    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      sanitized.push(trimmed);
      if (sanitized.length >= maxItems) break;
    }
  }

  return sanitized;
}
