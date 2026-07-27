// -----------------------------------------------------------------------
// Bill Hive — API Gateway
// -----------------------------------------------------------------------
// This is the single entry point for every data call in the app.
//
// Every read/write is routed to one of two backends, based on a runtime
// mode that lives outside of React state (localStorage), so it can be
// flipped from Settings without touching the rest of the app:
//
//   "internal"  (default, production behaviour)
//               -> the existing IndexedDB layer in src/db/indexedDB.js
//               -> fully offline, no network
//
//   "external"  (development only)
//               -> a REST API at VITE_API_BASE_URL
//               -> lets you develop/test against a real backend while
//                  the rest of the app keeps calling the same functions
//
// External mode can only ever be turned on in a dev build (import.meta.env.DEV).
// Production builds always run on internal/IndexedDB, no matter what is
// sitting in localStorage.
//
// Future modules (SMTP email, JWT auth, push/notification delivery) will
// be added below as their own sections, so every outbound call the app
// makes — data, mail, auth, notifications — funnels through this one file.
// -----------------------------------------------------------------------

import * as db from '../db/indexedDB';

// =========================================================================
// Mode switch (internal vs external) — dev-only
// =========================================================================

const MODE_STORAGE_KEY = 'billhive:api-mode'; // 'internal' | 'external'
const MODE_CHANGE_EVENT = 'billhive:api-mode-changed';

const isDevBuild = Boolean(import.meta.env && import.meta.env.DEV);

/** Current mode: 'internal' | 'external'. Always 'internal' in production. */
export function getApiMode() {
  if (!isDevBuild) return 'internal';
  return localStorage.getItem(MODE_STORAGE_KEY) === 'external' ? 'external' : 'internal';
}

/** Flip the mode. No-op outside of dev builds. Fires an event so any open UI can react. */
export function setApiMode(mode) {
  if (!isDevBuild) return;
  const next = mode === 'external' ? 'external' : 'internal';
  localStorage.setItem(MODE_STORAGE_KEY, next);
  window.dispatchEvent(new Event(MODE_CHANGE_EVENT));
}

export function isExternalMode() {
  return getApiMode() === 'external';
}

export const API_MODE_STORAGE_KEY = MODE_STORAGE_KEY;
export const API_MODE_CHANGE_EVENT = MODE_CHANGE_EVENT;

// =========================================================================
// External REST client
// =========================================================================
// Base URL is settable two ways:
//   1. From the UI — Settings > Developer Setting > Base URL (stored in
//      localStorage, takes priority, no rebuild needed).
//   2. Via VITE_API_BASE_URL in .env.local, as a machine-level default.
// Falls back to http://localhost:4000/api if neither is set.

const BASE_URL_STORAGE_KEY = 'billhive:api-base-url';
const DEFAULT_BASE_URL = 'http://localhost:4000/api';

export function getApiBaseUrl() {
  const stored = isDevBuild ? localStorage.getItem(BASE_URL_STORAGE_KEY) : null;
  const raw = (stored && stored.trim()) || import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;
  return raw.replace(/\/$/, '');
}

/** Set the base URL from the UI. No-op outside of dev builds. */
export function setApiBaseUrl(url) {
  if (!isDevBuild) return;
  const trimmed = (url || '').trim();
  if (trimmed) localStorage.setItem(BASE_URL_STORAGE_KEY, trimmed);
  else localStorage.removeItem(BASE_URL_STORAGE_KEY);
  window.dispatchEvent(new Event(MODE_CHANGE_EVENT));
}

export const API_BASE_URL_STORAGE_KEY = BASE_URL_STORAGE_KEY;

const EXTERNAL_API_KEY = import.meta.env.VITE_API_KEY || '';

async function externalRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(EXTERNAL_API_KEY ? { Authorization: `Bearer ${EXTERNAL_API_KEY}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[api] ${method} ${path} failed: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

// Almost every store holds one record under the fixed key 'value' (see
// src/db/indexedDB.js), so the common case is a clean /{store} route with no
// key in the path. Only non-default keys (e.g. authTokens, keyed per-token)
// get appended: /{store}/{key}.
function storePath(store, key) {
  return key === 'value' ? `/${store}` : `/${store}/${encodeURIComponent(key)}`;
}

// =========================================================================
// Data gateway
// =========================================================================
// Mirrors the signatures already used everywhere (dbGet/dbSet/dbGetAll/
// dbRemove/dbClearAll), so this can be dropped in as a drop-in replacement
// for the direct src/db/indexedDB.js imports on a page-by-page basis later.

export async function apiGet(store, key = 'value') {
  return isExternalMode()
    ? externalRequest(storePath(store, key))
    : db.dbGet(store, key);
}

export async function apiGetAll(store) {
  return isExternalMode()
    ? externalRequest(`/${store}/_all`)
    : db.dbGetAll(store);
}

export async function apiSet(store, value, key = 'value') {
  return isExternalMode()
    ? externalRequest(storePath(store, key), { method: 'PUT', body: value })
    : db.dbSet(store, value, key);
}

export async function apiRemove(store, key = 'value') {
  return isExternalMode()
    ? externalRequest(storePath(store, key), { method: 'DELETE' })
    : db.dbRemove(store, key);
}

export async function apiClearAll() {
  return isExternalMode()
    ? externalRequest('/clear-all', { method: 'POST' })
    : db.dbClearAll();
}

export async function apiExportAllData() {
  return isExternalMode()
    ? externalRequest('/export')
    : db.exportAllData();
}

export async function apiImportAllData(dump) {
  return isExternalMode()
    ? externalRequest('/import', { method: 'POST', body: dump })
    : db.importAllData(dump);
}

// =========================================================================
// Auth (placeholder — JWT backend lands here)
// =========================================================================
// Today, auth runs entirely through src/context/AuthContext.jsx + src/utils/auth.js
// (local account + cookie token, stored in IndexedDB). When the JWT backend
// is ready, its calls will live here instead, so AuthContext only ever talks
// to this gateway.

export const auth = {
  // login(credentials)   -> POST /auth/login    -> { token, user }
  // register(payload)    -> POST /auth/register -> { token, user }
  // logout()             -> POST /auth/logout
  // verify(token)        -> GET  /auth/verify
  // Not implemented yet.
};

// =========================================================================
// Notifications (placeholder)
// =========================================================================

export const notifications = {
  // send(notification)   -> POST /notifications
  // list()                -> GET  /notifications
  // Not implemented yet.
};

// =========================================================================
// Mail / SMTP (placeholder)
// =========================================================================

export const mail = {
  // send({ to, subject, body }) -> POST /mail/send
  // Not implemented yet.
};

// =========================================================================
// Default export — everything grouped, for convenience: `import api from '../api/api'`
// =========================================================================

const api = {
  getApiMode,
  setApiMode,
  isExternalMode,
  getApiBaseUrl,
  setApiBaseUrl,
  apiGet,
  apiGetAll,
  apiSet,
  apiRemove,
  apiClearAll,
  apiExportAllData,
  apiImportAllData,
  auth,
  notifications,
  mail
};

export default api;
