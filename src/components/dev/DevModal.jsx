/**
 * src/components/dev/DevModal.jsx
 *
 * The dev popup with:
 *   Tab 1 — Base URL input + connection status
 *   Tab 2 — API mode toggle (internal / external)
 */

import { useState, useEffect, useRef } from 'react';
import { useDev } from '../../context/DevContext';

export default function DevModal({ onClose }) {
  const {
    baseUrl, apiMode, connStatus,
    updateBaseUrl, updateApiMode, checkConnection, setConnStatus,
  } = useDev();

  const [tab, setTab] = useState('url');
  const [draft, setDraft] = useState(baseUrl || '');
  const inputRef = useRef(null);

  // Focus input on open
  useEffect(() => {
    if (tab === 'url') inputRef.current?.focus();
  }, [tab]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    updateBaseUrl(draft.trim());
    if (draft.trim()) checkConnection(draft.trim());
  };

  const statusColor = { idle: '#9aa1b1', checking: '#f5a524', ok: '#3fb950', error: '#f85149' }[connStatus];
  const statusLabel = { idle: 'Not checked', checking: 'Checking…', ok: 'Connected', error: 'Unreachable' }[connStatus];

  return (
    <>
      <div className="dev-modal-backdrop" onClick={onClose} />
      <div className="dev-modal" role="dialog" aria-modal="true" aria-label="Developer Tools">
        {/* Header */}
        <div className="dev-modal-header">
          <div className="dev-modal-title">
            <IconTerminal />
            <span>Developer Tools</span>
          </div>
          <button className="dev-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tabs */}
        <div className="dev-modal-tabs">
          <button
            className={`dev-tab${tab === 'url' ? ' active' : ''}`}
            onClick={() => setTab('url')}
          >Base URL</button>
          <button
            className={`dev-tab${tab === 'mode' ? ' active' : ''}`}
            onClick={() => setTab('mode')}
          >API Mode</button>
        </div>

        {/* Tab: Base URL */}
        {tab === 'url' && (
          <div className="dev-modal-body">
            <p className="dev-modal-hint">
              Paste your local backend or ngrok URL. Changes take effect immediately.
            </p>

            <div className="dev-url-row">
              <input
                ref={inputRef}
                className="dev-url-input"
                type="url"
                placeholder="http://localhost:4000/api"
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setConnStatus('idle'); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              />
              <button className="dev-btn-save" onClick={handleSave}>Save</button>
            </div>

            <div className="dev-status-row">
              <span className="dev-status-dot" style={{ background: statusColor }} />
              <span className="dev-status-label" style={{ color: statusColor }}>{statusLabel}</span>
              <button
                className="dev-btn-check"
                onClick={() => checkConnection(draft)}
                disabled={connStatus === 'checking' || !draft.trim()}
              >
                {connStatus === 'checking' ? 'Checking…' : 'Test'}
              </button>
            </div>

            <div className="dev-modal-divider" />

            <a
              className="dev-guide-link"
              href="/dev-guide.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBook />
              Open API & Entity Reference →
            </a>
          </div>
        )}

        {/* Tab: API Mode */}
        {tab === 'mode' && (
          <div className="dev-modal-body">
            <p className="dev-modal-hint">
              Switch between the local IndexedDB store and your live REST backend.
            </p>

            <div className="dev-mode-options">
              {['internal', 'external'].map((m) => (
                <button
                  key={m}
                  className={`dev-mode-btn${apiMode === m ? ' selected' : ''}`}
                  onClick={() => updateApiMode(m)}
                >
                  {m === 'internal' ? <IconDatabase /> : <IconCloud />}
                  <div>
                    <div className="dev-mode-btn-title">
                      {m === 'internal' ? 'Internal (IndexedDB)' : 'External (REST API)'}
                    </div>
                    <div className="dev-mode-btn-desc">
                      {m === 'internal'
                        ? 'Offline, browser-local. Default & production behaviour.'
                        : 'Routes all calls to the base URL above. Requires backend running.'}
                    </div>
                  </div>
                  {apiMode === m && <span className="dev-mode-tick">✓</span>}
                </button>
              ))}
            </div>

            <div className="dev-modal-divider" />

            <a
              className="dev-guide-link"
              href="/dev-guide.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBook />
              Open API & Entity Reference →
            </a>
          </div>
        )}
      </div>
    </>
  );
}

function IconTerminal() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <polyline points="4 17 10 11 4 5" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12" y1="19" x2="20" y2="19" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round"/>
    </svg>
  );
}
function IconBook() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}
function IconDatabase() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}
function IconCloud() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}
