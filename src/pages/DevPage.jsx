/**
 * src/pages/DevPage.jsx
 * Always-accessible developer tools page at /dev
 * No IS_DEV guard — you need to reach this page to enable dev mode.
 */
import { useState, useRef, useEffect } from 'react';

const BASE_URL_KEY    = 'billhive:api-base-url';
const DEV_ENABLED_KEY = 'billhive:dev-enabled';

function readBaseUrl()    { return localStorage.getItem(BASE_URL_KEY)    || ''; }
function readDevEnabled() { return localStorage.getItem(DEV_ENABLED_KEY) === '1'; }

export default function DevPage() {
  const [baseUrl, setBaseUrl]       = useState(readBaseUrl);
  const [draft, setDraft]           = useState(readBaseUrl);
  const [devEnabled, setDevEnabled] = useState(readDevEnabled);
  const [connStatus, setConnStatus] = useState('idle');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const saveUrl = () => {
    const trimmed = draft.trim();
    if (trimmed) localStorage.setItem(BASE_URL_KEY, trimmed);
    else         localStorage.removeItem(BASE_URL_KEY);
    setBaseUrl(trimmed);
    setConnStatus('idle');
  };

  const toggleDevMode = () => {
    const next = !devEnabled;
    if (next) localStorage.setItem(DEV_ENABLED_KEY, '1');
    else      localStorage.removeItem(DEV_ENABLED_KEY);
    setDevEnabled(next);
  };

  const testConnection = async () => {
    const target = draft.trim().replace(/\/$/, '');
    if (!target) { setConnStatus('error'); return; }
    setConnStatus('checking');
    try {
      const res = await fetch(`${target}/health`, { signal: AbortSignal.timeout(5000) });
      setConnStatus(res.ok ? 'ok' : 'error');
    } catch {
      setConnStatus('error');
    }
  };

  const statusInfo = {
    idle:     { color: '#9aa1b1', label: 'Not tested yet' },
    checking: { color: '#f5a524', label: 'Checking…' },
    ok:       { color: '#3fb950', label: 'Connected ✓' },
    error:    { color: '#f85149', label: 'Unreachable ✗' },
  }[connStatus];

  return (
    <div className="dev-page">
      <div className="dev-page-header">
        <div className="dev-page-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 className="dev-page-title">Developer Tools</h1>
          <p className="dev-page-subtitle">Configure backend connection and dev mode settings</p>
        </div>
      </div>

      {/* ── Dev Mode Toggle ── */}
      <div className="dev-page-card">
        <div className="dev-page-card-header">
          <div>
            <div className="dev-page-card-title">Developer Mode</div>
            <div className="dev-page-card-desc">
              Enables the floating DEV button and Dev Console in the sidebar on this browser.
            </div>
          </div>
          <button
            className={`dev-toggle${devEnabled ? ' on' : ''}`}
            onClick={toggleDevMode}
            role="switch"
            aria-checked={devEnabled}
          >
            <span className="dev-toggle-thumb" />
          </button>
        </div>
        {devEnabled && (
          <div className="dev-page-card-note">
            ✓ Active — reload the page to see the floating DEV button and sidebar console.
            <button className="dev-reload-btn" onClick={() => window.location.reload()}>
              Reload now →
            </button>
          </div>
        )}
      </div>

      {/* ── Base URL ── */}
      <div className="dev-page-card">
        <div className="dev-page-card-title">Backend Base URL</div>
        <div className="dev-page-card-desc">
          Your local Spring Boot server or ngrok tunnel. All external API calls go here.
        </div>

        <div className="dev-url-row" style={{ marginTop: 14 }}>
          <input
            ref={inputRef}
            className="dev-url-input"
            type="url"
            placeholder="https://xxxx.ngrok-free.app/api  or  http://localhost:4000/api"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setConnStatus('idle'); }}
            onKeyDown={(e) => { if (e.key === 'Enter') saveUrl(); }}
          />
          <button className="dev-btn-save" onClick={saveUrl}>Save</button>
        </div>

        <div className="dev-status-row" style={{ marginTop: 10 }}>
          <span className="dev-status-dot" style={{ background: statusInfo.color }} />
          <span className="dev-status-label" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
          <button
            className="dev-btn-check"
            onClick={testConnection}
            disabled={connStatus === 'checking' || !draft.trim()}
          >
            {connStatus === 'checking' ? 'Checking…' : 'Test Connection'}
          </button>
        </div>

        {baseUrl && (
          <div className="dev-current-url" style={{ marginTop: 10 }}>
            <span className="dev-current-url-label">Saved:</span>
            <code className="dev-current-url-value">{baseUrl}</code>
          </div>
        )}
      </div>

      {/* ── Guide Link ── */}
      <div className="dev-page-card">
        <div className="dev-page-card-title">API & Entity Reference</div>
        <div className="dev-page-card-desc">
          Full list of planned backend routes, request payloads, and database schema.
        </div>
        <a
          className="dev-guide-link"
          href="/dev-guide.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginTop: 14, display: 'inline-flex' }}
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
  );
}
