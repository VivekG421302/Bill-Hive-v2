import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiGet, apiSet } from '../api/api';

const ThemeContext = createContext(null);

export const ACCENT_PRESETS = [
  { name: 'Honey (default)', value: '' },
  { name: 'Amber', hex: '#DB9327' },
  { name: 'Hive Green', hex: '#4C6B4A' },
  { name: 'Sky', hex: '#3E7CB8' },
  { name: 'Berry', hex: '#A9436F' },
  { name: 'Slate', hex: '#556270' }
];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [accentColor, setAccentColor] = useState('');
  const [sidebarSide, setSidebarSide] = useState('right');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const savedTheme = await apiGet('theme');
      const settings = await apiGet('settings');
      if (savedTheme) setTheme(savedTheme);
      if (settings?.accentColor) setAccentColor(settings.accentColor);
      if (settings?.sidebarSide) setSidebarSide(settings.sidebarSide);
      setReady(true);
    })();
  }, []);

  // Apply theme class to body
  useEffect(() => {
    document.body.classList.toggle('dark-mode', theme === 'dark');
  }, [theme]);

  // Apply sidebar side class to body
  useEffect(() => {
    document.body.classList.toggle('side-left', sidebarSide === 'left');
    document.body.classList.toggle('side-right', sidebarSide !== 'left');
  }, [sidebarSide]);

  // Apply accent color as inline style on body (must win over .dark-mode's own value —
  // see Bill-Hive's v4.02.1 fix note: override on body, not documentElement).
  useEffect(() => {
    if (accentColor) {
      document.body.style.setProperty('--accent-primary', accentColor);
      document.body.style.setProperty('--accent-primary-hover', shade(accentColor, -12));
      document.body.style.setProperty('--accent-primary-soft', hexToRgba(accentColor, 0.12));
    } else {
      document.body.style.removeProperty('--accent-primary');
      document.body.style.removeProperty('--accent-primary-hover');
      document.body.style.removeProperty('--accent-primary-soft');
    }
  }, [accentColor, theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      apiSet('theme', next);
      return next;
    });
  }, []);

  const updateAccentColor = useCallback(async (hex) => {
    setAccentColor(hex);
    const settings = (await apiGet('settings')) || {};
    await apiSet('settings', { ...settings, accentColor: hex });
  }, []);

  const updateSidebarSide = useCallback(async (side) => {
    setSidebarSide(side);
    const settings = (await apiGet('settings')) || {};
    await apiSet('settings', { ...settings, sidebarSide: side });
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, toggleTheme, accentColor, updateAccentColor, sidebarSide, updateSidebarSide, ready }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

function shade(hex, percent) {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16);
  let r = (num >> 16) + Math.round((percent / 100) * 255);
  let g = ((num >> 8) & 0x00ff) + Math.round((percent / 100) * 255);
  let b = (num & 0x0000ff) + Math.round((percent / 100) * 255);
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function hexToRgba(hex, alpha) {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
