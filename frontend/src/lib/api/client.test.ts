import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from '@/lib/auth/session';
import { ApiClientError, apiBaseUrl, apiClient, apiRequest } from './client';

const staffUser = {
  id: 'staff-1',
  email: 'staff@example.com',
  displayName: 'Staff User',
  roles: ['staff' as const],
  roleArea: 'staff' as const,
  permissions: ['catalog:read' as const],
};

describe('api client', () => {
  beforeEach(() => {
    authSession.clear('signed-out');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds JSON and bearer headers while keeping credentialed cookies', async () => {
    authSession.setSession('access-token', staffUser);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'book-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      apiClient.post('/books', { title: 'Refactoring' }),
    ).resolves.toEqual({ id: 'book-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      `${apiBaseUrl}/books`,
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({ title: 'Refactoring' }),
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('authorization')).toBe('Bearer access-token');
  });

  it('keeps caller content types and omits authorization when explicitly public', async () => {
    authSession.setSession('access-token', staffUser);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('created', { status: 201, statusText: 'Created' }),
    );

    await expect(
      apiClient.post('/uploads', { name: 'cover.png' }, {
        auth: false,
        headers: { 'content-type': 'application/vnd.library+json' },
      }),
    ).resolves.toBe('created');

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('content-type')).toBe('application/vnd.library+json');
    expect(headers.get('authorization')).toBeNull();
  });

  it('parses empty responses and delegates GET, PATCH, and DELETE methods', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'book-1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(apiRequest('/empty')).resolves.toBeUndefined();
    await expect(apiClient.get('/books/book-1')).resolves.toEqual({
      id: 'book-1',
    });
    await expect(apiClient.patch('/books/book-1', { title: 'Clean Code' })).resolves.toBeUndefined();
    await expect(apiClient.delete('/books/book-1')).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual([
      undefined,
      'GET',
      'PATCH',
      'DELETE',
    ]);
  });

  it('normalizes API errors, clears an expired session, and preserves non-401 sessions', async () => {
    authSession.setSession('active-token', staffUser);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: ['title is required', 'author is required'] }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Unavailable' }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      );

    await expect(apiClient.get('/invalid')).rejects.toMatchObject({
      status: 400,
      message: 'title is required, author is required',
      details: { message: ['title is required', 'author is required'] },
    });
    expect(authSession.getSnapshot().accessToken).toBe('active-token');

    await expect(apiClient.get('/unavailable')).rejects.toEqual(
      new ApiClientError(500, 'Unavailable'),
    );
    expect(authSession.getSnapshot().accessToken).toBe('active-token');

    await expect(apiClient.get('/expired')).rejects.toMatchObject({ status: 401 });
    expect(authSession.getSnapshot()).toEqual({ reason: 'expired' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
