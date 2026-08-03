/**
 * src/components/dev/DevFloatingButton.jsx
 * Always mounted by Layout. Hides itself when IS_DEV is false or page is complete.
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
  if (pageCompletion[pathname]) return null;

  return (
    <>
      <button
        className="dev-fab"
        onClick={() => setOpen(true)}
        title="Developer Tools"
        aria-label="Open developer tools"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="dev-fab-label">DEV</span>
      </button>
      {open && <DevModal onClose={() => setOpen(false)} />}
    </>
  );
}
