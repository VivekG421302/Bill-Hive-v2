// IndexedDB wrapper — mirrors Bill-Hive's dbInit/dbGet/dbSet/dbRemove convention.
// Database: billhive-db. Each store holds a single row keyed by a fixed id ('value')
// unless noted otherwise (authTokens is keyed by the token string itself).

const DB_NAME = 'billhive-db';
const DB_VERSION = 1;
export const STORE_NAMES = [
  'company',    // company profile + logo
  'settings',   // thank-you messages, terms, currency, sidebar side, accent color, theme prefs
  'account',    // local user account (username + password hash + salt + profile)
  'authTokens', // { token, expiresAt } — issued on login, checked on load
  'theme'       // 'light' | 'dark'
];

let dbPromise = null;

export function dbInit() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORE_NAMES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function dbGet(store, key = 'value') {
  const db = await dbInit();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function dbSet(store, value, key = 'value') {
  const db = await dbInit();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbRemove(store, key = 'value') {
  const db = await dbInit();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetAll(store) {
  const db = await dbInit();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function dbClearAll() {
  const db = await dbInit();
  return Promise.all(
    STORE_NAMES.map(
      (name) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(name, 'readwrite');
          tx.objectStore(name).clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        })
    )
  );
}

// Export everything (used by Settings → Export All Data)
export async function exportAllData() {
  const dump = {};
  for (const name of STORE_NAMES) {
    if (name === 'authTokens' || name === 'account') continue; // never export secrets
    dump[name] = await dbGet(name);
  }
  dump._exportedAt = new Date().toISOString();
  return dump;
}

export async function importAllData(dump) {
  for (const name of Object.keys(dump)) {
    if (name === '_exportedAt' || !STORE_NAMES.includes(name)) continue;
    await dbSet(name, dump[name]);
  }
  return true;
}
