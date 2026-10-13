// Plan 074: how often a screen checks for news while its live connection is down. The admin sets it
// (customers and sellers separately); `GET /api/status` carries it and MaintenanceHost keeps this
// copy fresh. Until a status has arrived (and for an old Worker) it is 5 minutes. No imports from
// the app, so any module can read it.
import { DEFAULT_BACKUP_MINUTES, type BackupMinutes } from '../../shared/maintenance';

const MINUTE_MS = 60_000;
let current: BackupMinutes = DEFAULT_BACKUP_MINUTES;

export function setBackupMinutes(next: BackupMinutes): void {
  current = next;
}

/** The seller screens' backup gap in ms (Orders, Cook, Sell, Hand over / Deliveries). */
export function sellerBackupMs(): number {
  return current.seller * MINUTE_MS;
}

/** The customer screens' backup gap in ms. */
export function customerBackupMs(): number {
  return current.customer * MINUTE_MS;
}
