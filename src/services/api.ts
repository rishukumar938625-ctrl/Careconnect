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
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let activeCsrfToken: string | null = null;

export const setCsrfToken = (token: string | null): void => {
  activeCsrfToken = token;
};

export const getCsrfToken = (): string | null => {
  return activeCsrfToken;
};

/**
 * Helper to execute fetch requests with error handling, credentials, and CSRF token
 */
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (activeCsrfToken && options?.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase())) {
    headers['X-CSRF-Token'] = activeCsrfToken;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `Request failed with status ${response.status}`);
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

  updateNotifications: (preferences: Partial<NonNullable<AuthUser['notificationPreferences']>>) => {
    return fetchJson<NonNullable<AuthUser['notificationPreferences']>>('/user/notifications', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    });
  },
};

