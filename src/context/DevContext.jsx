/**
 * src/context/DevContext.jsx
 *
 * Fully self-contained Developer Mode — works on Vercel previews too.
 *
 * Enable from browser console (any deploy):
 *   localStorage.setItem('billhive:dev-enabled', '1'); location.reload();
 * Disable:
 *   localStorage.removeItem('billhive:dev-enabled'); location.reload();
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const DEV_ENABLED_KEY  = 'billhive:dev-enabled';
const BASE_URL_KEY     = 'billhive:api-base-url';
const PAGE_DONE_KEY    = 'billhive:dev-page-completion';
const URL_CHANGE_EVENT = 'billhive:baseurl-changed';

// True in `vite dev` OR when manually enabled in localStorage on any deploy
export const IS_DEV =
  Boolean(import.meta.env?.DEV) ||
  localStorage.getItem(DEV_ENABLED_KEY) === '1';

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

function readBaseUrl() {
  return localStorage.getItem(BASE_URL_KEY) || '';
}
function readPageCompletion() {
  try { return JSON.parse(localStorage.getItem(PAGE_DONE_KEY) || '{}'); }
  catch { return {}; }
}

const DevContext = createContext(null);

export function DevProvider({ children }) {
  const [baseUrl, setBaseUrlState]       = useState(readBaseUrl);
  const [pageCompletion, setPageCompletion] = useState(readPageCompletion);
  const [connStatus, setConnStatus]      = useState('idle'); // idle|checking|ok|error

  // Keep state in sync if another tab or the console changes localStorage
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === BASE_URL_KEY) setBaseUrlState(e.newValue || '');
    };
    const onUrlChange = () => setBaseUrlState(readBaseUrl());
    window.addEventListener('storage', onStorage);
    window.addEventListener(URL_CHANGE_EVENT, onUrlChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(URL_CHANGE_EVENT, onUrlChange);
    };
  }, []);

  // Persist page completion
  useEffect(() => {
    localStorage.setItem(PAGE_DONE_KEY, JSON.stringify(pageCompletion));
  }, [pageCompletion]);

  const updateBaseUrl = useCallback((url) => {
    const trimmed = (url || '').trim();
    if (trimmed) localStorage.setItem(BASE_URL_KEY, trimmed);
    else localStorage.removeItem(BASE_URL_KEY);
    setBaseUrlState(trimmed);
    setConnStatus('idle');
    window.dispatchEvent(new Event(URL_CHANGE_EVENT));
  }, []);

  const checkConnection = useCallback(async (url) => {
    const target = (url ?? readBaseUrl()).replace(/\/$/, '');
    if (!target) { setConnStatus('error'); return; }
    setConnStatus('checking');
    try {
      const res = await fetch(`${target}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      setConnStatus(res.ok ? 'ok' : 'error');
    } catch {
      setConnStatus('error');
    }
  }, []);

  const togglePageComplete = useCallback((path) => {
    setPageCompletion((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  return (
    <DevContext.Provider value={{
      IS_DEV,
      baseUrl,
      connStatus,
      pageCompletion,
      updateBaseUrl,
      checkConnection,
      togglePageComplete,
      setConnStatus,
    }}>
      {children}
    </DevContext.Provider>
  );
}

export function useDev() {
  const ctx = useContext(DevContext);
  if (!ctx) throw new Error('useDev must be used within <DevProvider>');
  return ctx;
}
