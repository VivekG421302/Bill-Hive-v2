import { useEffect, useRef, useState } from 'react';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Full-screen product image zoom, like e-commerce PDPs.
 * - Desktop: scroll wheel to zoom, drag to pan once zoomed, double-click to toggle.
 * - Touch: pinch with two fingers to zoom, drag to pan, double-tap to toggle.
 * Pointer Events unify mouse/touch/pen so the same handlers cover both.
 */
export default function ImageZoomLightbox({ src, alt, open, onClose }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map());
  const dragState = useRef(null);
  const pinchState = useRef(null);
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (open) { setScale(1); setPos({ x: 0, y: 0 }); }
  }, [open, src]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;

  const toggleZoom = () => setScale((s) => (s > 1 ? 1 : 2.2));

  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setScale((s) => {
      const next = clamp(s + delta, 1, 4);
      if (next === 1) setPos({ x: 0, y: 0 });
      return next;
    });
  };

  const onPointerDown = (e) => {
    e.target.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      dragState.current = { startX: e.clientX, startY: e.clientY, startPos: { ...pos } };
      const now = Date.now();
      if (now - lastTapRef.current < 300) toggleZoom();
      lastTapRef.current = now;
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (!pinchState.current) pinchState.current = { startDist: dist, startScale: scale };
      else setScale(clamp(pinchState.current.startScale * (dist / pinchState.current.startDist), 1, 4));
    } else if (dragState.current && scale > 1) {
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      setPos({ x: dragState.current.startPos.x + dx, y: dragState.current.startPos.y + dy });
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchState.current = null;
    if (pointers.current.size === 0) dragState.current = null;
  };

  return (
    <div className="zoom-lightbox" onClick={onClose}>
      <button className="zoom-lightbox-close" onClick={onClose} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" /></svg>
      </button>
      <div className="zoom-lightbox-hint">{scale > 1 ? 'Drag to pan · Scroll or pinch to zoom' : 'Scroll, pinch, or double-tap to zoom'}</div>
      <img
        src={src}
        alt={alt}
        className="zoom-lightbox-img"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale > 1 ? 'grab' : 'zoom-in' }}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        draggable={false}
      />
    </div>
  );
}
