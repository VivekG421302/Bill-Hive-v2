/**
 * src/components/dev/DevModal.jsx
 * Base URL input + connection test. Self-contained, no api.js dependency.
 */
import { useState, useEffect, useRef } from 'react';
import { useDev } from '../../context/DevContext';

export default function DevModal({ onClose }) {
  const { baseUrl, connStatus, updateBaseUrl, checkConnection, setConnStatus } = useDev();
  const [draft, setDraft] = useState(baseUrl || '');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    updateBaseUrl(draft.trim());
  };

  const statusColor = {
    idle: '#9aa1b1', checking: '#f5a524', ok: '#3fb950', error: '#f85149'
  }[connStatus];
  const statusLabel = {
    idle: 'Not checked', checking: 'Checking…', ok: 'Connected ✓', error: 'Unreachable ✗'
  }[connStatus];

  return (
    <>
      <div className="dev-modal-backdrop" onClick={onClose} />
      <div className="dev-modal" role="dialog" aria-modal="true">

        <div className="dev-modal-header">
          <div className="dev-modal-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <polyline points="4 17 10 11 4 5" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="19" x2="20" y2="19" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round"/>
            </svg>
            Developer Tools
          </div>
          <button className="dev-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="dev-modal-body">
          <p className="dev-modal-hint">
            Paste your local backend or ngrok URL and hit <strong>Save</strong>.
          </p>

          <label className="dev-field-label">Backend Base URL</label>
          <div className="dev-url-row">
            <input
              ref={inputRef}
              className="dev-url-input"
              type="url"
              placeholder="https://xxxx.ngrok.io/api"
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
              {connStatus === 'checking' ? 'Checking…' : 'Test Connection'}
            </button>
          </div>

          {baseUrl && (
            <div className="dev-current-url">
              <span className="dev-current-url-label">Active:</span>
              <code className="dev-current-url-value">{baseUrl}</code>
            </div>
          )}

          <div className="dev-modal-divider" />

          <a
            className="dev-guide-link"
            href="/dev-guide.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
                stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
            Open API & Entity Reference →
          </a>
        </div>

      </div>
    </>
  );
}
