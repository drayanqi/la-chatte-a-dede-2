/**
 * API Client Unit Tests
 *
 * Tests the shared fetch wrapper used by every store:
 * - Base URL + default header injection
 * - Bearer token injection from localStorage
 * - Typed error thrown on non-ok responses (including 401 passthrough)
 * - getApiError extraction
 *
 * @see Epic 3: Practice Mode & Match Experience
 * @see Story 3.1: Tactics Data Model & API (Task 6)
 * @priority P0
 */
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { apiFetch, ApiError, getApiError } from '@/lib/apiClient';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('request building', () => {
    it('should prefix the path with the API base URL', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('tok');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiFetch('/tactics');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/tactics$/),
        expect.any(Object),
      );
    });

    it('should inject Authorization and Accept headers', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('tok');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiFetch('/tactics', { method: 'POST', body: JSON.stringify({ name: 'X' }) });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer tok',
            Accept: 'application/json',
            'Content-Type': 'application/json',
          }),
          credentials: 'include',
        }),
      );
    });

    it('should omit Authorization when there is no token', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiFetch('/user');

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it('should not set Content-Type on body-less requests', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('tok');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await apiFetch('/logout', { method: 'POST' });

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers['Content-Type']).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw an ApiError with status and message on non-ok responses', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('tok');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Validation failed' }),
      });

      const error = await apiFetch('/tactics').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(422);
      expect((error as ApiError).message).toBe('Validation failed');
    });

    it('should pass 401 responses through as typed errors (no auto-logout)', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('expired');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthenticated.' }),
      });

      const error = await apiFetch('/user').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
      expect((error as ApiError).message).toBe('Unauthenticated.');
      // Token removal is the caller's decision, not the client's
      expect(window.localStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should produce an empty message when the error body has none', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('tok');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const error = await apiFetch('/tactics').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
      expect((error as ApiError).message).toBe('');
    });

    it('should tolerate a non-JSON error body', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('tok');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('not json');
        },
      });

      const error = await apiFetch('/tactics').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(502);
      expect((error as ApiError).message).toBe('');
    });

    it('should tolerate an error body that parses to JSON null', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('tok');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => null,
      });

      const error = await apiFetch('/tactics').catch((e) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
      expect((error as ApiError).message).toBe('');
    });

    it('should return the raw response on success', async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('tok');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 't1', name: 'Tactic' }],
      });

      const response = await apiFetch('/tactics');

      expect(response.ok).toBe(true);
      expect(await response.json()).toEqual([{ id: 't1', name: 'Tactic' }]);
    });
  });

  describe('getApiError', () => {
    it('should extract the message from an ApiError', () => {
      const error = new ApiError(404, 'Tactic not found');
      expect(getApiError(error)).toBe('Tactic not found');
    });

    it('should extract the message from a plain Error', () => {
      expect(getApiError(new Error('Network failure'))).toBe('Network failure');
    });

    it('should fall back for unknown thrown values', () => {
      expect(getApiError('boom')).toBe('An unexpected error occurred');
    });
  });
});
