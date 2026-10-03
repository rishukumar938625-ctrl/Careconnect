/**
 * CareConnect Backend Types
 */

export type MongooseReadyState = 0 | 1 | 2 | 3;

export type DbConnectionStatus = 'disconnected' | 'connected' | 'connecting' | 'disconnecting';

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  timestamp: string;
  uptime: number;
  environment: string;
}

export interface DbHealthResponse {
  status: 'connected' | 'disconnected' | 'connecting' | 'disconnecting';
  database: 'connected' | 'disconnected';
  readyState: MongooseReadyState;
  timestamp: string;
  message?: string;
}

export interface ApiErrorResponse {
  status: 'error';
  message: string;
  code?: string;
  stack?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
