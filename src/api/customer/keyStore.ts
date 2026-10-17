// The sealing key of this phone, in IndexedDB (a CryptoKey can be stored there without ever being
// readable). Failing storage means the address simply stays unsealed on this phone only.
const DB = 'remember-me';
const STORE = 'keys';
const ID = 'address';

export type KeyStore = Readonly<{
  get: () => Promise<CryptoKey | null>;
  set: (key: CryptoKey) => Promise<void>;
  clear: () => Promise<void>;
}>;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opened = indexedDB.open(DB, 1);
    opened.onupgradeneeded = () => {
      opened.result.createObjectStore(STORE);
    };
    opened.onsuccess = () => {
      resolve(opened.result);
    };
    opened.onerror = () => {
      reject(opened.error ?? new Error('IndexedDB failed'));
    };
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB failed'));
      };
    });
  } finally {
    db.close();
  }
}

export const idbKeyStore: KeyStore = {
  async get() {
    try {
      const found: unknown = await run('readonly', (store) => store.get(ID));
      return found instanceof CryptoKey ? found : null;
    } catch {
      return null;
    }
  },
  async set(key) {
    try {
      await run('readwrite', (store) => store.put(key, ID));
    } catch {
      // storage blocked: the address stays on this phone only
    }
  },
  async clear() {
    try {
      await run('readwrite', (store) => store.delete(ID));
    } catch {
      // nothing to forget
    }
  },
};

let current: KeyStore = idbKeyStore;
export const keyStore = (): KeyStore => current;
/** Tests: swap the store (jsdom has no IndexedDB). */
export function setKeyStoreForTests(store: KeyStore): void {
  current = store;
}
