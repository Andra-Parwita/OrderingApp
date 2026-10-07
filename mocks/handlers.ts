import { http, HttpResponse } from 'msw';
import type { HealthResponse } from '../shared/health';

export const healthFixture: HealthResponse = { status: 'ok', time: '2026-10-07T10:00:00.000Z' };

export const handlers = [http.get('*/api/health', () => HttpResponse.json(healthFixture))];
