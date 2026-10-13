// Plan 071 (D-099): where the seller's address book is kept on THIS device: IndexedDB (one small
// database per kitchen), with a plain in-memory fallback when it is missing or blocked. No library.
// The book never goes to the server. `navigator.storage.persist()` is asked for once.

import type { BookMeta, Customer } from './bookTypes';

export type BookBackend = {
  /** True when what is saved survives closing the app. */
  persistent: boolean;
  load(): Promise<{ customers: Array<Customer>; meta: BookMeta }>;
  put(customers: ReadonlyArray<Customer>): Promise<void>;
  remove(id: string): Promise<void>;
  setMeta(meta: BookMeta): Promise<void>;
};

const EMPTY_META: BookMeta = { lastBackupAt: null };

/** Keeps the book for this visit only (tests, private windows). */
export function memoryBackend(): BookBackend {
  const rows = new Map<string, Customer>();
  let meta = EMPTY_META;
  return {
    persistent: false,
    load: () => Promise.resolve({ customers: [...rows.values()], meta }),
    put: (customers) => {
      for (const c of customers) rows.set(c.id, c);
      return Promise.resolve();
    },
    remove: (id) => {
      rows.delete(id);
      return Promise.resolve();
    },
    setMeta: (next) => {
      meta = next;
      return Promise.resolve();
    },
  };
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('idb'));
  });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('idb'));
    tx.onabort = () => reject(tx.error ?? new Error('idb'));
  });
}

let persistAsked = false;
/** Asks the browser to keep this storage (once per visit). Never throws. */
export function askPersistence(): void {
  if (persistAsked) return;
  persistAsked = true;
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // not supported: the book is still saved, only eviction is not prevented
  }
}

/** IndexedDB for one kitchen, or the memory fallback when it is not available. */
export function openBackend(slug: string): BookBackend {
  if (typeof indexedDB === 'undefined') return memoryBackend();
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`customers-${slug}`, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('customers', { keyPath: 'id' });
      request.result.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('idb'));
    request.onblocked = () => reject(new Error('idb blocked'));
  });
  return {
    persistent: true,
    async load() {
      const db = await opening;
      const tx = db.transaction(['customers', 'meta'], 'readonly');
      const customers = (await wrap(tx.objectStore('customers').getAll())) as Array<Customer>;
      const last = (await wrap(tx.objectStore('meta').get('lastBackupAt'))) as unknown;
      return {
        customers,
        meta: { lastBackupAt: typeof last === 'string' ? last : null },
      };
    },
    async put(customers) {
      const db = await opening;
      const tx = db.transaction('customers', 'readwrite');
      for (const customer of customers) tx.objectStore('customers').put(customer);
      await done(tx);
    },
    async remove(id) {
      const db = await opening;
      const tx = db.transaction('customers', 'readwrite');
      tx.objectStore('customers').delete(id);
      await done(tx);
    },
    async setMeta(meta) {
      const db = await opening;
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put(meta.lastBackupAt, 'lastBackupAt');
      await done(tx);
    },
  };
}
