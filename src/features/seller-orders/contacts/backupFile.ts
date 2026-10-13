import { backupStatus, listCustomers, localDate, markBackedUp } from './addressBook';
import { csvFileName, customersToCsv } from './customersCsv';

/** Saves the whole address book as `customers-<slug>-<date>.csv` and notes that it was backed up. */
export function downloadBackup(slug: string, now: Date = new Date()): string {
  const name = csvFileName(slug, localDate(now));
  const blob = new Blob([customersToCsv(listCustomers(slug))], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  markBackedUp(slug, now);
  return name;
}

/** "3 new customers and 2 changed customers", or '' when nothing is new. */
export function changeSummary(
  slug: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const { added, changed } = backupStatus(slug);
  const parts: Array<string> = [];
  if (added > 0) parts.push(t('customers.newCount', { count: added }));
  if (changed > 0) parts.push(t('customers.changedCount', { count: changed }));
  return parts.join(t('customers.and'));
}
