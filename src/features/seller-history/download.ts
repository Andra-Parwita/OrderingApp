/** Saves a Blob through a temporary download link. */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Local date as YYYY-MM-DD, for file names. */
export function dateStamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function backupFileName(slug: string, now?: Date): string {
  return `delave-${slug}-${dateStamp(now)}.json`;
}

export function csvFileName(slug: string, now?: Date): string {
  return `orders-${slug}-${dateStamp(now)}.csv`;
}

export function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsText(file);
  });
}

const LAST_KEY = 'lastBackup';

/** The date (YYYY-MM-DD) of this device's last backup of one kitchen, or null. */
export function lastBackupDate(slug: string): string | null {
  try {
    return localStorage.getItem(`${LAST_KEY}:${slug}`);
  } catch {
    return null;
  }
}

export function rememberBackup(slug: string, date: string): void {
  try {
    localStorage.setItem(`${LAST_KEY}:${slug}`, date);
  } catch {
    // storage unavailable: the date just is not remembered
  }
}
