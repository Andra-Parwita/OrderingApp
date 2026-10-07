import { parseHealth, type HealthResponse } from '../../shared/health';

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  const parsed = parseHealth(await response.json());
  if (!parsed) throw new Error('Health check returned an unexpected body');
  return parsed;
}
