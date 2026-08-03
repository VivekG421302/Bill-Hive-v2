/**
 * src/context/DevContext.jsx
 *
 * Developer Mode state. Works in both local dev AND production Vercel preview.
 *
 * To enable on a production/preview deploy, run in browser console:
 *   localStorage.setItem('billhive:dev-enabled', '1'); location.reload();
 * To disable:
 *   localStorage.removeItem('billhive:dev-enabled'); location.reload();
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
} from '../api/api';

// IS_DEV is true when running `vite dev` OR when the override flag is set in localStorage.
// This lets you test dev mode on a Vercel preview URL without a code change.
const IS_DEV =
  Boolean(import.meta.env && import.meta.env.DEV) ||
  localStorage.getItem('billhive:dev-enabled') === '1';

const PAGE_COMPLETION_KEY = 'billhive:dev-page-completion';

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
  try { return JSON.parse(localStorage.getItem(PAGE_COMPLETION_KEY) || '{}'); }
  catch { return {}; }
}

export function DevProvider({ children }) {
  const [baseUrl, _setBaseUrl]           = useState(() => getApiBaseUrl());
  const [apiMode, _setApiMode]           = useState(() => getApiMode());
  const [pageCompletion, setPageCompletion] = useState(loadPageCompletion);
  const [connStatus, setConnStatus]      = useState('idle');

  useEffect(() => {
    const sync = () => { _setBaseUrl(getApiBaseUrl()); _setApiMode(getApiMode()); };
    window.addEventListener(API_MODE_CHANGE_EVENT, sync);
    return () => window.removeEventListener(API_MODE_CHANGE_EVENT, sync);
  }, []);

  useEffect(() => {
    localStorage.setItem(PAGE_COMPLETION_KEY, JSON.stringify(pageCompletion));
  }, [pageCompletion]);

  const updateBaseUrl = useCallback((url) => {
    setApiBaseUrl(url);
    _setBaseUrl(url || getApiBaseUrl());
    setConnStatus('idle');
  }, []);

  const updateApiMode = useCallback((mode) => {
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

  return (
    <DevContext.Provider value={{
      IS_DEV, baseUrl, apiMode, connStatus, pageCompletion,
      updateBaseUrl, updateApiMode, checkConnection, togglePageComplete, setConnStatus,
    }}>
      {children}
    </DevContext.Provider>
  );
}

export function useDev() {
  const ctx = useContext(DevContext);
  if (!ctx) throw new Error('useDev must be used within DevProvider');
  return ctx;
}
