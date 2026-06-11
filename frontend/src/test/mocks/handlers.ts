import { http, HttpResponse } from 'msw';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export const handlers = [
  http.get(`${API_BASE_URL}/health`, () =>
    HttpResponse.json({ status: 'ok' }),
  ),
];
