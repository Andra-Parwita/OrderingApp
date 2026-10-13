// Plan 046: the platform's one settings row (id 1): maintenance on/off and the announced update.
import {
  DEFAULT_BACKUP_MINUTES,
  NO_MAINTENANCE,
  type BackupMinutes,
  type MaintenancePatch,
  type MaintenanceState,
} from '../../shared/maintenance';
import type { Db } from './d1';

type Row = {
  maintenance: number;
  notice_from: string | null;
  notice_until: string | null;
  notice_text_en: string | null;
  notice_text_id: string | null;
};

export type AppSettingsRepository = {
  maintenance(): Promise<MaintenanceState>;
  /** Plan 074: the backup-check minutes (customers, sellers). */
  backupMinutes(): Promise<BackupMinutes>;
  setBackupMinutes(patch: Partial<BackupMinutes>): Promise<BackupMinutes>;
  /** Changes what the patch names; the rest stays. */
  setMaintenance(patch: MaintenancePatch): Promise<MaintenanceState>;
};

export function createAppSettingsRepository(db: Db): AppSettingsRepository {
  async function read(): Promise<MaintenanceState> {
    const row = await db.first<Row>(
      'SELECT maintenance, notice_from, notice_until, notice_text_en, notice_text_id FROM app_settings WHERE id = 1',
    );
    if (!row) return NO_MAINTENANCE;
    return {
      maintenance: row.maintenance === 1,
      notice:
        row.notice_from && row.notice_until
          ? {
              from: row.notice_from,
              until: row.notice_until,
              noteEn: row.notice_text_en ?? '',
              noteId: row.notice_text_id ?? '',
            }
          : null,
    };
  }
  async function readBackup(): Promise<BackupMinutes> {
    const row = await db.first<{ backup_customer_min: number; backup_seller_min: number }>(
      'SELECT backup_customer_min, backup_seller_min FROM app_settings WHERE id = 1',
    );
    return row
      ? { customer: row.backup_customer_min, seller: row.backup_seller_min }
      : DEFAULT_BACKUP_MINUTES;
  }
  return {
    maintenance: read,
    backupMinutes: readBackup,
    async setBackupMinutes(patch) {
      const current = await readBackup();
      const next: BackupMinutes = {
        customer: patch.customer ?? current.customer,
        seller: patch.seller ?? current.seller,
      };
      // The row may not exist yet (no maintenance ever saved): the other columns have defaults.
      await db
        .stmt(
          `INSERT INTO app_settings (id, backup_customer_min, backup_seller_min) VALUES (1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET backup_customer_min = excluded.backup_customer_min,
             backup_seller_min = excluded.backup_seller_min`,
          next.customer,
          next.seller,
        )
        .run();
      return next;
    },
    async setMaintenance(patch) {
      const current = await read();
      const next: MaintenanceState = {
        maintenance: patch.maintenance ?? current.maintenance,
        notice: patch.notice === undefined ? current.notice : patch.notice,
      };
      await db
        .stmt(
          `INSERT INTO app_settings (id, maintenance, notice_from, notice_until, notice_text_en, notice_text_id)
           VALUES (1, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET maintenance = excluded.maintenance,
             notice_from = excluded.notice_from, notice_until = excluded.notice_until,
             notice_text_en = excluded.notice_text_en, notice_text_id = excluded.notice_text_id`,
          next.maintenance ? 1 : 0,
          next.notice?.from ?? null,
          next.notice?.until ?? null,
          next.notice?.noteEn ?? null,
          next.notice?.noteId ?? null,
        )
        .run();
      return next;
    },
  };
}
