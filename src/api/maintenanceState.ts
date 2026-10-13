// Plan 046: "the server refused a call because maintenance is on". `http.ts` sets it when it sees a
// 503 `maintenance`; the full "Updating" screen reads it and clears it once /api/status says the
// update is over. No imports, so any module can use it without a cycle.
let blocked = false;
const watchers = new Set<() => void>();

export function setMaintenanceBlocked(next: boolean): void {
  if (blocked === next) return;
  blocked = next;
  for (const watcher of [...watchers]) watcher();
}

export function isMaintenanceBlocked(): boolean {
  return blocked;
}

export function watchMaintenanceBlocked(onChange: () => void): () => void {
  watchers.add(onChange);
  return () => {
    watchers.delete(onChange);
  };
}
