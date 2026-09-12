/**
 * Shared API client - central fetch plumbing for every store.
 * OWNER: Dev Team
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Typed error thrown by apiFetch on non-ok responses. The 401 handling
 * (token cleanup, redirect to login) is the caller's decision — the client
 * passes the status through untouched.
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Perform an authenticated JSON request against the API.
 *
 * Injects the bearer token from localStorage, Accept/Content-Type headers
 * and cookie credentials. Throws an ApiError on non-ok responses; returns
 * the raw Response (body not consumed) on success.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('auth_token');

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Content-Type only makes sense when a body travels along
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    // Optional chaining: a body parsing to JSON null (e.g. a proxy response)
    // must still surface as an ApiError, not a TypeError.
    throw new ApiError(response.status, data?.message ?? '');
  }

  return response;
}

/**
 * Extract a human-readable message from a thrown value.
 */
export function getApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
