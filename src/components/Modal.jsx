import { useEffect } from 'react';

/**
 * Generic modal shell: dim overlay + centered card with header/close button.
 * `bodyClassName` / `contentClassName` let callers opt into edge-to-edge
 * layouts (e.g. the brand detail "ecom" page) while keeping the same
 * overlay/close/escape-key behavior.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  contentClassName = '',
  bodyClassName = '',
  zIndex
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal active" style={zIndex ? { zIndex } : undefined}>
      <div className="modal-overlay" onClick={onClose} />
      <div className={`modal-content ${contentClassName}`}>
        {title !== undefined && (
          <div className="modal-header">
            <h3>{title}</h3>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <IconClose />
            </button>
          </div>
        )}
        <div className={`modal-body ${bodyClassName}`}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
