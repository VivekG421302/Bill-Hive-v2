/**
 * src/components/dev/DevFloatingButton.jsx
 *
 * Fixed floating icon (bottom-right). Opens the dev modal.
 * Hidden when the current route is marked "complete" in DevContext.
 */

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDev } from '../../context/DevContext';
import DevModal from './DevModal';

export default function DevFloatingButton() {
  const { IS_DEV, pageCompletion } = useDev();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  if (!IS_DEV) return null;

  // Hide when the current page is marked complete
  const isComplete = Boolean(pageCompletion[pathname]);
  if (isComplete) return null;

  return (
    <>
      <button
        className="dev-fab"
        onClick={() => setOpen(true)}
        title="Developer Mode"
        aria-label="Open developer tools"
      >
        <IconCode />
        <span className="dev-fab-label">DEV</span>
      </button>

      {open && <DevModal onClose={() => setOpen(false)} />}
    </>
  );
}

function IconCode() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
