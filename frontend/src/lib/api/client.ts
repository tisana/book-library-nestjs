import { authSession } from '@/lib/auth/session';
import type { NormalizedApiError } from './types';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? DEFAULT_API_BASE_URL;

export class ApiClientError extends Error implements NormalizedApiError {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: NormalizedApiError['details'],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
}

function normalizeMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    (typeof payload.message === 'string' || Array.isArray(payload.message))
  ) {
    return Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message;
  }

  return fallback;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (response.status === 204) {
    return undefined;
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const headers = new Headers(options.headers);
  const session = authSession.getSnapshot();

  if (options.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (options.auth !== false && session.accessToken) {
    headers.set('authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      authSession.clear('expired');
    }

    throw new ApiClientError(
      response.status,
      normalizeMessage(payload, response.statusText),
      typeof payload === 'object' && payload !== null
        ? (payload as NormalizedApiError['details'])
        : undefined,
    );
  }

  return payload as TResponse;
}

export const apiClient = {
  get: <TResponse>(path: string, options?: ApiRequestOptions) =>
    apiRequest<TResponse>(path, { ...options, method: 'GET' }),
  post: <TResponse>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ) => apiRequest<TResponse>(path, { ...options, method: 'POST', body }),
  patch: <TResponse>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ) => apiRequest<TResponse>(path, { ...options, method: 'PATCH', body }),
  delete: <TResponse>(path: string, options?: ApiRequestOptions) =>
    apiRequest<TResponse>(path, { ...options, method: 'DELETE' }),
};
