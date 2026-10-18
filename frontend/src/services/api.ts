import type {
  HealthCondition,
  Medicine,
  HealthArticle,
  Medication,
  Doctor,
  DoctorAvailability,
  Appointment,
  AuthUser,
  DoseRecord,
  DoseStatus,
  AdherenceStats,
  PaginatedResponse,
  UserNotificationPreferences,
  PersonalHealthProfile,
  AppNotification,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

let activeCsrfToken: string | null = null;

export const setCsrfToken = (token: string | null): void => {
  activeCsrfToken = token;
};

export const getCsrfToken = (): string | null => {
  if (activeCsrfToken) return activeCsrfToken;
  if (typeof document !== 'undefined' && document.cookie) {
    const match = document.cookie.match(/(?:^|;\s*)careconnect_csrf_token=([^;]*)/);
    if (match) {
      const token = decodeURIComponent(match[1]);
      activeCsrfToken = token;
      return token;
    }
  }
  return null;
};

/**
 * Structured API error that carries the HTTP status code so callers can
 * distinguish 409 Conflict from 429 Too Many Requests, etc.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Helper to execute fetch requests with error handling, credentials, and CSRF token.
 *
 * Throws:
 *   - ApiError(status, message) for HTTP 4xx/5xx responses
 *   - Error('Unable to connect to the server…') for network failures (TypeError)
 */
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  const csrfToken = getCsrfToken();
  if (csrfToken && options?.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase())) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${url}`, {
      credentials: 'include',
      ...options,
      headers,
    });
  } catch {
    // TypeError: Failed to fetch — backend is unreachable (wrong port, CORS
    // preflight blocked, server down, etc.)
    throw new Error(
      'Unable to connect to the server. Please check your internet connection and try again.'
    );
  }

  if (!response.ok) {
    // Try to parse a JSON body for a user-friendly message.
    // Guard against HTML error pages returned by proxies (non-JSON).
    const contentType = response.headers.get('content-type') || '';
    let message: string;
    if (contentType.includes('application/json')) {
      const body = await response.json().catch(() => ({}) as Record<string, string>);
      message = (body as Record<string, string>).message ||
                (body as Record<string, string>).error ||
                `Request failed with status ${response.status}`;
    } else {
      message = `Request failed with status ${response.status}`;
    }
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

// ─── Health Check Service (Phase 1.5) ─────────────────────────────────────────

export interface BackendHealth {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  uptime: number;
  timestamp: string;
  environment?: string;
}

export interface DbHealth {
  status: 'connected' | 'disconnected' | 'connecting' | 'disconnecting';
  database: 'connected' | 'disconnected';
  readyState: number;
  timestamp: string;
  message?: string;
}

export const healthCheckApi = {
  checkBackend: (): Promise<BackendHealth> => fetchJson<BackendHealth>('/health'),
  checkDatabase: (): Promise<DbHealth> => fetchJson<DbHealth>('/health/db'),
};

// ─── Health Information Service (Phase 2) ───────────────────────────────────

export interface HealthFilterOptions {
  q?: string;
  category?: string;
  page?: number;
  limit?: number;
  bookmarked?: boolean;
}

export const healthApi = {
  getConditions: (qOrOptions?: string | HealthFilterOptions, category?: string) => {
    const opts: HealthFilterOptions =
      typeof qOrOptions === 'string' ? { q: qOrOptions, category } : qOrOptions || {};
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.category && opts.category !== 'All') params.set('category', opts.category);
    if (opts.page) params.set('page', String(opts.page));
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.bookmarked) params.set('bookmarked', 'true');
    return fetchJson<PaginatedResponse<HealthCondition>>(`/conditions?${params.toString()}`);
  },

  getConditionBySlug: (slug: string) => {
    return fetchJson<HealthCondition>(`/conditions/${slug}`);
  },

  toggleConditionBookmark: (slug: string) => {
    return fetchJson<{ slug: string; bookmarked: boolean }>(`/conditions/${slug}/bookmark`, {
      method: 'POST',
    });
  },

  getMedicines: (qOrOptions?: string | HealthFilterOptions, category?: string) => {
    const opts: HealthFilterOptions =
      typeof qOrOptions === 'string' ? { q: qOrOptions, category } : qOrOptions || {};
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.category && opts.category !== 'All') params.set('category', opts.category);
    if (opts.page) params.set('page', String(opts.page));
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.bookmarked) params.set('bookmarked', 'true');
    return fetchJson<PaginatedResponse<Medicine>>(`/medicines?${params.toString()}`);
  },

  getMedicineBySlug: (slug: string) => {
    return fetchJson<Medicine>(`/medicines/${slug}`);
  },

  toggleMedicineBookmark: (slug: string) => {
    return fetchJson<{ slug: string; bookmarked: boolean }>(`/medicines/${slug}/bookmark`, {
      method: 'POST',
    });
  },

  getArticles: (qOrOptions?: string | HealthFilterOptions, category?: string) => {
    const opts: HealthFilterOptions =
      typeof qOrOptions === 'string' ? { q: qOrOptions, category } : qOrOptions || {};
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.category && opts.category !== 'All') params.set('category', opts.category);
    if (opts.page) params.set('page', String(opts.page));
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.bookmarked) params.set('bookmarked', 'true');
    return fetchJson<PaginatedResponse<HealthArticle>>(`/articles?${params.toString()}`);
  },

  getArticleBySlug: (slug: string) => {
    return fetchJson<HealthArticle>(`/articles/${slug}`);
  },

  toggleArticleBookmark: (slug: string) => {
    return fetchJson<{ slug: string; bookmarked: boolean }>(`/articles/${slug}/bookmark`, {
      method: 'POST',
    });
  },
};

// ─── Medication Reminders Service ─────────────────────────────────────────────

export const medicationApi = {
  getAll: () => {
    return fetchJson<Medication[]>('/medications');
  },

  getById: (id: string) => {
    return fetchJson<Medication>(`/medications/${id}`);
  },

  create: (data: Partial<Medication>) => {
    return fetchJson<Medication>('/medications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: string, data: Partial<Medication>) => {
    return fetchJson<Medication>(`/medications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: (id: string) => {
    return fetchJson<{ status: string; message: string }>(`/medications/${id}`, {
      method: 'DELETE',
    });
  },

  getAdherenceStats: () => {
    return fetchJson<AdherenceStats>('/doses/adherence');
  },
};


// ─── Dose Tracking Service (Phase 4) ──────────────────────────────────────────

export interface DoseFilterOptions {
  page?: number;
  limit?: number;
  status?: DoseStatus;
  from?: string;
  to?: string;
  medicationId?: string;
}

export const doseApi = {
  getTodayDoses: () => {
    return fetchJson<DoseRecord[]>('/doses/today');
  },

  getHistory: (opts?: DoseFilterOptions) => {
    const params = new URLSearchParams();
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.status) params.set('status', opts.status);
    if (opts?.from) params.set('from', opts.from);
    if (opts?.to) params.set('to', opts.to);
    if (opts?.medicationId) params.set('medicationId', opts.medicationId);
    return fetchJson<PaginatedResponse<DoseRecord>>(`/doses/history?${params.toString()}`);
  },

  updateStatus: (id: string, status: DoseStatus, snoozedUntil?: string, snoozeMinutes?: number) => {
    return fetchJson<DoseRecord>(`/doses/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, snoozedUntil, snoozeMinutes }),
    });
  },

  getAdherence: () => {
    return fetchJson<AdherenceStats>('/doses/adherence');
  },
};

// ─── Doctor Directory & Availability Service (Phase 5) ─────────────────────────

export interface DoctorFilterOptions {
  q?: string;
  specialty?: string;
  page?: number;
  limit?: number;
  activeOnly?: boolean;
}

export const doctorApi = {
  getAll: (opts?: DoctorFilterOptions) => {
    const params = new URLSearchParams();
    if (opts?.q) params.set('q', opts.q);
    if (opts?.specialty && opts.specialty !== 'All') params.set('specialty', opts.specialty);
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.activeOnly !== undefined) params.set('activeOnly', String(opts.activeOnly));
    return fetchJson<PaginatedResponse<Doctor>>(`/doctors?${params.toString()}`);
  },

  getById: (id: string) => {
    return fetchJson<Doctor>(`/doctors/${id}`);
  },

  getAvailability: (id: string, date: string) => {
    return fetchJson<{ status: string; data: DoctorAvailability }>(
      `/doctors/${id}/availability?date=${encodeURIComponent(date)}`
    );
  },
};

// ─── Appointments Service (Phase 5) ───────────────────────────────────────────

export interface AppointmentFilterOptions {
  status?: string;
  page?: number;
  limit?: number;
}

export const appointmentApi = {
  getDoctors: async (q?: string, specialty?: string) => {
    const res = await doctorApi.getAll({ q, specialty });
    return res.data;
  },

  getDoctorBySlug: (slug: string) => {
    return doctorApi.getById(slug);
  },

  getAppointments: (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    return fetchJson<Appointment[]>(`/appointments?${params.toString()}`);
  },

  getHistory: (opts?: { page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.limit) params.set('limit', String(opts.limit));
    return fetchJson<PaginatedResponse<Appointment>>(`/appointments/history?${params.toString()}`);
  },

  getAppointmentById: (id: string) => {
    return fetchJson<Appointment>(`/appointments/${id}`);
  },

  bookAppointment: (data: {
    doctorId: string;
    startAt?: string;
    date?: string;
    timeSlot?: string;
    type?: string;
    reason?: string;
    notes?: string;
  }) => {
    return fetchJson<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  rescheduleAppointment: (
    id: string,
    data: {
      startAt?: string;
      date?: string;
      timeSlot?: string;
      reason?: string;
    }
  ) => {
    return fetchJson<{ message: string; appointment: Appointment }>(
      `/appointments/${id}/reschedule`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  },

  cancelAppointment: (id: string, cancellationReason?: string) => {
    return fetchJson<{ message: string; appointment: Appointment }>(
      `/appointments/${id}/cancel`,
      {
        method: 'PATCH',
        body: JSON.stringify({ cancellationReason }),
      }
    );
  },
};

// ─── Authentication Service (Phase 3) ─────────────────────────────────────────
export interface AuthResponse {
  status: 'success' | 'error';
  message?: string;
  user: AuthUser;
  csrfToken?: string;
}

export const authApi = {
  register: async (data: { name: string; email: string; password: string }): Promise<AuthResponse> => {
    const res = await fetchJson<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.csrfToken) {
      setCsrfToken(res.csrfToken);
    }
    return res;
  },

  login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    const res = await fetchJson<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.csrfToken) {
      setCsrfToken(res.csrfToken);
    }
    return res;
  },

  logout: async (): Promise<{ status: string; message: string }> => {
    const res = await fetchJson<{ status: string; message: string }>('/auth/logout', {
      method: 'POST',
    });
    setCsrfToken(null);
    return res;
  },

  getCurrentUser: async (): Promise<AuthResponse> => {
    const res = await fetchJson<AuthResponse>('/auth/me');
    if (res.csrfToken) {
      setCsrfToken(res.csrfToken);
    }
    return res;
  },
};

// ─── User Profile Service ─────────────────────────────────────────────────────

export const userApi = {
  getProfile: () => {
    return fetchJson<AuthUser>('/user/profile');
  },

  updateProfile: (data: Partial<AuthUser>) => {
    return fetchJson<AuthUser>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getHealthProfile: () => {
    return fetchJson<{ status: string; data: PersonalHealthProfile }>('/user/health-profile');
  },

  updateHealthProfile: (data: Partial<PersonalHealthProfile>) => {
    return fetchJson<{ status: string; data: PersonalHealthProfile }>('/user/health-profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  addAllergy: (allergy: string) => {
    return fetchJson<{ status: string; message: string; allergies: string[] }>('/user/health-profile/allergies', {
      method: 'POST',
      body: JSON.stringify({ allergy }),
    });
  },

  removeAllergy: (allergy: string) => {
    return fetchJson<{ status: string; message: string; allergies: string[] }>(
      `/user/health-profile/allergies/${encodeURIComponent(allergy)}`,
      {
        method: 'DELETE',
      }
    );
  },

  addCondition: (condition: string) => {
    return fetchJson<{ status: string; message: string; chronicConditions: string[] }>('/user/health-profile/conditions', {
      method: 'POST',
      body: JSON.stringify({ condition }),
    });
  },

  removeCondition: (condition: string) => {
    return fetchJson<{ status: string; message: string; chronicConditions: string[] }>(
      `/user/health-profile/conditions/${encodeURIComponent(condition)}`,
      {
        method: 'DELETE',
      }
    );
  },

  getNotifications: () => {
    return fetchJson<{ status: string; data: UserNotificationPreferences }>('/user/notifications');
  },

  updateNotifications: (preferences: Partial<UserNotificationPreferences>) => {
    return fetchJson<{ status: string; data: UserNotificationPreferences }>('/user/notifications', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },
};

// ─── Notification Service (Phase 7) ──────────────────────────────────────────

export const notificationApi = {
  getNotifications: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.unreadOnly) query.set('unreadOnly', 'true');
    const qs = query.toString();
    return fetchJson<PaginatedResponse<AppNotification>>(`/notifications${qs ? `?${qs}` : ''}`);
  },

  getUnreadCount: () => {
    return fetchJson<{ unreadCount: number }>('/notifications/unread-count');
  },

  markAsRead: (id: string) => {
    return fetchJson<{ message: string; notification: AppNotification }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  markAllAsRead: () => {
    return fetchJson<{ message: string; modifiedCount: number }>('/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  syncReminders: () => {
    return fetchJson<{ message: string; jobsScheduled: number }>('/notifications/sync', {
      method: 'POST',
    });
  },
};


