export type HealthResponse = { status: 'ok'; time: string };

/** Narrows unknown JSON to a HealthResponse; returns null for anything else. */
export function parseHealth(input: unknown): HealthResponse | null {
  if (typeof input !== 'object' || input === null) return null;
  const { status, time } = input as Record<string, unknown>;
  if (status !== 'ok') return null;
  if (typeof time !== 'string' || Number.isNaN(Date.parse(time))) return null;
  return { status, time };
}
