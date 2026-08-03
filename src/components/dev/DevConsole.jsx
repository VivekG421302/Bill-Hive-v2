/**
 * src/components/dev/DevConsole.jsx
 *
 * Collapsible section rendered at the bottom of the Sidebar (dev builds only).
 * Lists every route with a "complete" checkbox. Completed pages hide the FAB.
 */

import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useDev, ALL_ROUTES } from '../../context/DevContext';

export default function DevConsole({ collapsed }) {
  const { IS_DEV, pageCompletion, togglePageComplete } = useDev();
  const [open, setOpen] = useState(false);

  if (!IS_DEV) return null;

  const completedCount = ALL_ROUTES.filter((r) => pageCompletion[r.path]).length;
  const pct = Math.round((completedCount / ALL_ROUTES.length) * 100);

  if (collapsed) {
    // Just show a compact icon when sidebar is collapsed
    return (
      <button
        className="dev-console-icon-btn"
        title="Dev Console"
        onClick={() => setOpen((v) => !v)}
      >
        <IconDev />
        {completedCount > 0 && (
          <span className="dev-console-badge">{completedCount}</span>
        )}
      </button>
    );
  }

  return (
    <div className="dev-console">
      {/* Header toggle */}
      <button className="dev-console-header" onClick={() => setOpen((v) => !v)}>
        <span className="dev-console-title">
          <IconDev />
          <span>Dev Console</span>
        </span>
        <span className="dev-console-meta">
          {completedCount}/{ALL_ROUTES.length}
          <IconChevron open={open} />
        </span>
      </button>

      {/* Progress bar */}
      <div className="dev-console-progress-track">
        <div className="dev-console-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Route list */}
      {open && (
        <ul className="dev-console-list">
          {ALL_ROUTES.map((route) => {
            const done = Boolean(pageCompletion[route.path]);
            return (
              <li key={route.path} className={`dev-console-item${done ? ' done' : ''}`}>
                <label className="dev-console-check-label">
                  <input
                    type="checkbox"
                    className="dev-console-checkbox"
                    checked={done}
                    onChange={() => togglePageComplete(route.path)}
                  />
                  <NavLink
                    to={route.path}
                    end={route.path === '/'}
                    className="dev-console-route-link"
                  >
                    {route.label}
                  </NavLink>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function IconDev() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconChevron({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
