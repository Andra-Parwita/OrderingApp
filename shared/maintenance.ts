// Plan 046: the platform notice and maintenance mode. One small settings row on the server; the
// public `GET /api/status` hands it to every screen, the admin (or the release token) changes it.
import { isIsoDate, isRecord } from './parse';

export const NOTICE_NOTE_MAX = 200;

/** The announced update: its window, and an optional note per language. */
export type MaintenanceNotice = {
  /** When the pause starts and ends (ISO instants). */
  from: string;
  until: string;
  noteEn: string;
  noteId: string;
};

/** What is stored, and what `GET /api/status` answers. */
export type MaintenanceState = {
  /** True while the server refuses changes. */
  maintenance: boolean;
  notice: MaintenanceNotice | null;
};

/**
 * Plan 074: how often (minutes) a screen checks for news while its live connection is down. One
 * value for customers, one for sellers (owner/chef/helper screens). Set by the admin.
 */
export type BackupMinutes = { customer: number; seller: number };

export const BACKUP_MINUTES_DEFAULT = 5;
export const BACKUP_MINUTES_MIN = 1;
export const BACKUP_MINUTES_MAX = 30;
export const DEFAULT_BACKUP_MINUTES: BackupMinutes = {
  customer: BACKUP_MINUTES_DEFAULT,
  seller: BACKUP_MINUTES_DEFAULT,
};

function isBackupValue(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= BACKUP_MINUTES_MIN &&
    value <= BACKUP_MINUTES_MAX
  );
}

/** A value from the server, or 5 when absent or out of bounds (old Worker, bad data). */
export function parseBackupMinutes(input: unknown): BackupMinutes {
  if (!isRecord(input)) return DEFAULT_BACKUP_MINUTES;
  return {
    customer: isBackupValue(input['customer']) ? input['customer'] : BACKUP_MINUTES_DEFAULT,
    seller: isBackupValue(input['seller']) ? input['seller'] : BACKUP_MINUTES_DEFAULT,
  };
}

/** PATCH /api/admin/backup-minutes: either or both, whole minutes 1 to 30. */
export function parseBackupMinutesPatch(input: unknown): Partial<BackupMinutes> | null {
  if (!isRecord(input)) return null;
  const patch: Partial<BackupMinutes> = {};
  for (const key of ['customer', 'seller'] as const) {
    if (!(key in input)) continue;
    const value = input[key];
    if (!isBackupValue(value)) return null;
    patch[key] = value;
  }
  return 'customer' in patch || 'seller' in patch ? patch : null;
}

export type StatusResponse = MaintenanceState & { time: string; backupMinutes: BackupMinutes };

export const NO_MAINTENANCE: MaintenanceState = { maintenance: false, notice: null };

function parseNotice(input: unknown): MaintenanceNotice | null {
  if (!isRecord(input)) return null;
  const { from, until, noteEn, noteId } = input;
  if (!isIsoDate(from) || !isIsoDate(until) || Date.parse(until) <= Date.parse(from)) return null;
  if (typeof noteEn !== 'string' || typeof noteId !== 'string') return null;
  if (noteEn.length > NOTICE_NOTE_MAX || noteId.length > NOTICE_NOTE_MAX) return null;
  return { from, until, noteEn: noteEn.trim(), noteId: noteId.trim() };
}

export function parseMaintenanceState(input: unknown): MaintenanceState | null {
  if (!isRecord(input) || typeof input['maintenance'] !== 'boolean') return null;
  if (input['notice'] === null) return { maintenance: input['maintenance'], notice: null };
  const notice = parseNotice(input['notice']);
  return notice ? { maintenance: input['maintenance'], notice } : null;
}

export function parseStatus(input: unknown): StatusResponse | null {
  const state = parseMaintenanceState(input);
  if (!state || !isRecord(input) || !isIsoDate(input['time'])) return null;
  return {
    ...state,
    time: input['time'],
    backupMinutes: parseBackupMinutes(input['backupMinutes']),
  };
}

/** PATCH /api/admin/maintenance: any of the two; `notice: null` clears the announcement. */
export type MaintenancePatch = { maintenance?: boolean; notice?: MaintenanceNotice | null };

export function parseMaintenancePatch(input: unknown): MaintenancePatch | null {
  if (!isRecord(input)) return null;
  const patch: MaintenancePatch = {};
  if ('maintenance' in input) {
    if (typeof input['maintenance'] !== 'boolean') return null;
    patch.maintenance = input['maintenance'];
  }
  if ('notice' in input) {
    if (input['notice'] === null) patch.notice = null;
    else {
      const notice = parseNotice(input['notice']);
      if (!notice) return null;
      patch.notice = notice;
    }
  }
  return 'maintenance' in patch || 'notice' in patch ? patch : null;
}

/** POST /api/maintenance (the release token): on or off, nothing else. */
export function parseTokenSwitch(input: unknown): boolean | null {
  return isRecord(input) && typeof input['maintenance'] === 'boolean' ? input['maintenance'] : null;
}

/** The banner shows from the announcement until the window ends; never while the full screen is up. */
export function noticeVisible(state: MaintenanceState, now: number): boolean {
  return !state.maintenance && state.notice !== null && now < Date.parse(state.notice.until);
}
