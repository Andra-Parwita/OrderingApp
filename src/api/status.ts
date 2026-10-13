import { parseStatus, type StatusResponse } from '../../shared/maintenance';

/** The public status (plan 046). Null when it cannot be read: then nothing about maintenance changes. */
export async function fetchStatus(fetchImpl: typeof fetch = fetch): Promise<StatusResponse | null> {
  try {
    const response = await fetchImpl('/api/status', { cache: 'no-store' });
    if (!response.ok) return null;
    return parseStatus(await response.json());
  } catch {
    return null;
  }
}
