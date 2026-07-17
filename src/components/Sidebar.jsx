import { NavLink } from 'react-router-dom';
import BrandIcon from './BrandIcon';
import { useTheme } from '../context/ThemeContext';
import { usePWAInstall } from '../hooks/usePWAInstall';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconHome },
  { to: '/your-data', label: 'Your Data', icon: IconBriefcase },
  { to: '/settings', label: 'Settings', icon: IconSliders },
  { to: '/account', label: 'Account', icon: IconUser }
];

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { theme, toggleTheme } = useTheme();
  const { canInstall, promptInstall } = usePWAInstall();

  return (
    <>
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo"><BrandIcon size={26} /></span>
          <span className="sidebar-title">Bill Hive</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onCloseMobile}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              title={item.label}
            >
              <item.icon />
              <span className="sidebar-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {canInstall && (
            <button className="pwa-install-btn" onClick={promptInstall} title="Install App">
              <IconDownload />
              <span>Install App</span>
            </button>
          )}
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button className="sidebar-collapse-btn" onClick={onToggleCollapse} title="Collapse sidebar">
            <IconChevrons collapsed={collapsed} />
            <span>Collapse</span>
          </button>
        </div>
      </aside>
      <div className={`sidebar-backdrop${mobileOpen ? ' show' : ''}`} onClick={onCloseMobile} />
    </>
  );
}

/* --- Inline icon set (no external icon lib needed) --- */
function IconHome() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 11.5 12 4l8 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 10v9h12v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}
function IconBriefcase() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="7.5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5" stroke="currentColor" strokeWidth="1.8"/></svg>);
}
function IconSliders() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h10M18 6h2M4 12h2M8 12h12M4 18h14M22 18h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="14" cy="6" r="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="6" cy="12" r="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.8"/></svg>);
}
function IconUser() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"/><path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
}
function IconDownload() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}
function IconSun() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
}
function IconMoon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>);
}
function IconChevrons({ collapsed }) {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }}><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}

export { IconHome, IconBriefcase, IconSliders, IconUser };
