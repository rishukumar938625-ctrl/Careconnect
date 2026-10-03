import type {
  HealthCondition,
  Medicine,
  HealthArticle,
  Medication,
  Doctor,
  Appointment,
  UserProfile,
  MedicationStatus,
  PaginatedResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/**
 * Helper to execute fetch requests with error handling
 */
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed with status ${response.status}`);
  }

  return response.json();
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

  create: (data: Partial<Medication>) => {
    return fetchJson<Medication>('/medications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateStatus: (id: string, status: MedicationStatus, time?: string) => {
    return fetchJson<Medication>(`/medications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, time }),
    });
  },

  delete: (id: string) => {
    return fetchJson<{ message: string }>(`/medications/${id}`, {
      method: 'DELETE',
    });
  },

  getAdherenceStats: () => {
    return fetchJson<{
      totalDoses: number;
      takenDoses: number;
      missedDoses: number;
      currentStreak: number;
      adherenceRate: number;
    }>('/medications/stats/adherence');
  },
};

// ─── Appointments Service ─────────────────────────────────────────────────────

export const appointmentApi = {
  getDoctors: (q?: string, specialty?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (specialty && specialty !== 'All') params.set('specialty', specialty);
    return fetchJson<Doctor[]>(`/appointments/doctors?${params.toString()}`);
  },

  getDoctorBySlug: (slug: string) => {
    return fetchJson<Doctor>(`/appointments/doctors/${slug}`);
  },

  getAppointments: (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    return fetchJson<Appointment[]>(`/appointments?${params.toString()}`);
  },

  getAppointmentById: (id: string) => {
    return fetchJson<Appointment>(`/appointments/${id}`);
  },

  bookAppointment: (data: Partial<Appointment>) => {
    return fetchJson<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  cancelAppointment: (id: string) => {
    return fetchJson<{ message: string; appointment: Appointment }>(`/appointments/${id}/cancel`, {
      method: 'PATCH',
    });
  },
};

// ─── User Profile Service ─────────────────────────────────────────────────────

export const userApi = {
  getProfile: () => {
    return fetchJson<UserProfile>('/user/profile');
  },

  updateProfile: (data: Partial<UserProfile>) => {
    return fetchJson<UserProfile>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  updateNotifications: (preferences: Partial<UserProfile['notificationPreferences']>) => {
    return fetchJson<UserProfile['notificationPreferences']>('/user/notifications', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    });
  },
};
