import { useEffect, useRef, useState } from 'react';
import BrandIcon from './BrandIcon';
import { dbGet } from '../db/indexedDB';

export default function ScreenSaver() {
  const [config, setConfig] = useState({ enabled: false, seconds: 30 });
  const [active, setActive] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const load = () => dbGet('settings').then((s) => {
      setConfig(s?.screensaver || { enabled: false, seconds: 30 });
    });
    load();
    window.addEventListener('billhive:settings-updated', load);
    return () => window.removeEventListener('billhive:settings-updated', load);
  }, []);

  useEffect(() => {
    if (!config.enabled) {
      setActive(false);
      return undefined;
    }

    const reset = () => {
      setActive(false);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setActive(true), config.seconds * 1000);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, reset));
    reset();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, reset));
      clearTimeout(timerRef.current);
    };
  }, [config]);

  if (!active) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg-primary)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent-primary)', gap: 14, cursor: 'pointer'
      }}
      onClick={() => setActive(false)}
    >
      <BrandIcon size={64} />
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Click, tap, or press any key to continue</span>
    </div>
  );
}
