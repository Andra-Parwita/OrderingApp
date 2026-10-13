// Plan 046: the platform's one settings row (id 1): maintenance on/off and the announced update.
import {
  NO_MAINTENANCE,
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
  return {
    maintenance: read,
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
