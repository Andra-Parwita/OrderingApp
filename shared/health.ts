export type HealthResponse = {
  status: 'ok';
  time: string;
  /** True only when the server runs with DEV_TOOLS on (a local dev server); false in production. */
  devTools: boolean;
  /** The build's app version, e.g. "1.0.18 · c491a12" (plan 020). */
  version: string;
};

/** Narrows unknown JSON to a HealthResponse; returns null for anything else. */
export function parseHealth(input: unknown): HealthResponse | null {
  if (typeof input !== 'object' || input === null) return null;
  const { status, time, devTools, version } = input as Record<string, unknown>;
  if (status !== 'ok') return null;
  if (typeof time !== 'string' || Number.isNaN(Date.parse(time))) return null;
  return {
    status,
    time,
    devTools: devTools === true,
    version: typeof version === 'string' ? version : '',
  };
}
