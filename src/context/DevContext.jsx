/**
 * src/context/DevContext.jsx
 *
 * Global Developer Mode state.
 *   - baseUrl  : the local/ngrok backend URL (persisted in localStorage)
 *   - apiMode  : 'internal' | 'external' (via existing api.js helpers)
 *   - pageCompletion : { [route]: boolean } — persisted in localStorage
 *
 * Only rendered in DEV builds. In production the provider still wraps the
 * tree (so children never crash), but all state is inert.
 */

import {
  createContext, useContext, useState, useEffect, useCallback
} from 'react';
import {
  getApiBaseUrl,
  setApiBaseUrl,
  getApiMode,
  setApiMode,
  API_MODE_CHANGE_EVENT,
  API_BASE_URL_STORAGE_KEY,
} from '../api/api';

const IS_DEV = Boolean(import.meta.env && import.meta.env.DEV);

const PAGE_COMPLETION_KEY = 'billhive:dev-page-completion';

// ── All app routes (mirrors NAV_SECTIONS in Sidebar.jsx) ──────────────────
export const ALL_ROUTES = [
  { path: '/',             label: 'Dashboard' },
  { path: '/create-bill',  label: 'Create Bill' },
  { path: '/past-bills',   label: 'Past Bills' },
  { path: '/customers',    label: 'Customers' },
  { path: '/items',        label: 'Items' },
  { path: '/stock',        label: 'Stock' },
  { path: '/sales-return', label: 'Sales Return' },
  { path: '/sale-summary', label: 'Sale Summary' },
  { path: '/brands',       label: 'Your Brands' },
  { path: '/suppliers',    label: 'Suppliers' },
  { path: '/fulfillment',  label: 'Fulfillment' },
  { path: '/catalogue',    label: 'Catalogue' },
  { path: '/your-data',    label: 'Your Data' },
  { path: '/settings',     label: 'Settings' },
  { path: '/account',      label: 'Account' },
  { path: '/login',        label: 'Login' },
];

const DevContext = createContext(null);

function loadPageCompletion() {
  try {
    return JSON.parse(localStorage.getItem(PAGE_COMPLETION_KEY) || '{}');
  } catch {
    return {};
  }
}

export function DevProvider({ children }) {
  const [baseUrl, _setBaseUrl]       = useState(() => IS_DEV ? getApiBaseUrl() : '');
  const [apiMode, _setApiMode]        = useState(() => IS_DEV ? getApiMode() : 'internal');
  const [pageCompletion, setPageCompletion] = useState(loadPageCompletion);
  const [connStatus, setConnStatus]   = useState('idle'); // 'idle'|'checking'|'ok'|'error'

  // Keep local state in sync when localStorage changes from other places
  useEffect(() => {
    if (!IS_DEV) return;
    const sync = () => {
      _setBaseUrl(getApiBaseUrl());
      _setApiMode(getApiMode());
    };
    window.addEventListener(API_MODE_CHANGE_EVENT, sync);
    return () => window.removeEventListener(API_MODE_CHANGE_EVENT, sync);
  }, []);

  // Persist page completion
  useEffect(() => {
    localStorage.setItem(PAGE_COMPLETION_KEY, JSON.stringify(pageCompletion));
  }, [pageCompletion]);

  const updateBaseUrl = useCallback((url) => {
    if (!IS_DEV) return;
    setApiBaseUrl(url);
    _setBaseUrl(url || getApiBaseUrl());
    setConnStatus('idle');
  }, []);

  const updateApiMode = useCallback((mode) => {
    if (!IS_DEV) return;
    setApiMode(mode);
    _setApiMode(mode);
  }, []);

  const togglePageComplete = useCallback((path) => {
    setPageCompletion((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const checkConnection = useCallback(async (url) => {
    const target = (url || baseUrl).replace(/\/$/, '');
    if (!target) { setConnStatus('error'); return; }
    setConnStatus('checking');
    try {
      const res = await fetch(`${target}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
      });
      setConnStatus(res.ok ? 'ok' : 'error');
    } catch {
      setConnStatus('error');
    }
  }, [baseUrl]);

  const value = {
    IS_DEV,
    baseUrl,
    apiMode,
    connStatus,
    pageCompletion,
    updateBaseUrl,
    updateApiMode,
    checkConnection,
    togglePageComplete,
    setConnStatus,
  };

  return <DevContext.Provider value={value}>{children}</DevContext.Provider>;
}

export function useDev() {
  const ctx = useContext(DevContext);
  if (!ctx) throw new Error('useDev must be used within DevProvider');
  return ctx;
}
