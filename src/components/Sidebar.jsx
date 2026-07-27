import { useEffect, useRef, useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import BrandIcon from './BrandIcon';
import { useTheme } from '../context/ThemeContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useToast } from '../context/ToastContext';

const IS_DEV = import.meta.env.DEV;

/* Each entry is either a real route ({ to, label, icon }) or a not-yet-built
   page from v1 ({ label, icon, comingSoon: true }). Sections are separated
   by a divider, matching the v1 sidebar grouping. */
const NAV_SECTIONS = [
  [
    { to: '/', label: 'Dashboard', icon: IconHome, end: true }
  ],
  [
    { label: 'Create Bill', icon: IconCreateBill, to: '/create-bill' },
    { label: 'Past Bills', icon: IconPastBills, to: '/past-bills' },
    { label: 'Customers', icon: IconCustomers, to: '/customers' },
    { to: '/items', label: 'Items', icon: IconItems },
    { to: '/stock', label: 'Stock', icon: IconStock },
    { label: 'Sales Return', icon: IconSalesReturn, to: '/sales-return' },
    { label: 'Sale Summary', icon: IconSaleSummary, to: '/sale-summary' }
  ],
  [
    { to: '/brands', label: 'Your Brands', icon: IconBrands },
    { label: 'Suppliers', icon: IconSuppliers, to: '/suppliers' },
    { label: 'Fulfillment', icon: IconFulfillment, to: '/fulfillment' },
    { label: 'Catalogue', icon: IconCatalogue, to: '/catalogue' }
  ],
  [
    { to: '/your-data', label: 'Your Data', icon: IconBriefcase },
    { to: '/settings', label: 'Settings', icon: IconSliders },
    { to: '/account', label: 'Account', icon: IconUser }
  ]
];

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { theme, toggleTheme } = useTheme();
  const { canInstall, promptInstall } = usePWAInstall();
  const { showToast } = useToast();

  const navRef = useRef(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    updateScrollState();

    el.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateScrollState);
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
      if (ro) ro.disconnect();
    };
  }, [collapsed, updateScrollState]);

  const scrollNav = (direction) => {
    navRef.current?.scrollBy({ top: direction * 140, behavior: 'smooth' });
  };

  const handleComingSoon = (label) => {
    showToast(`${label} is coming soon`);
  };

  return (
    <>
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo"><BrandIcon size={26} /></span>
          <span className="sidebar-title">Bill Hive</span>
        </div>

        <div className="sidebar-nav-wrap">
          {canScrollUp && (
            <button
              type="button"
              className="sidebar-scroll-btn sidebar-scroll-up"
              onClick={() => scrollNav(-1)}
              aria-label="Scroll sidebar up"
              title="Scroll up"
            >
              <IconChevronUpDown dir="up" />
            </button>
          )}

          <nav className="sidebar-nav" ref={navRef}>
            {NAV_SECTIONS.map((section, sectionIdx) => (
              <div key={sectionIdx} className="sidebar-section">
                {sectionIdx > 0 && <div className="sidebar-divider" />}
                {section.map((item) =>
                  item.comingSoon ? (
                    <button
                      key={item.label}
                      type="button"
                      className="sidebar-link-soon"
                      title={`${item.label} — coming soon`}
                      onClick={() => handleComingSoon(item.label)}
                    >
                      <item.icon />
                      <span className="sidebar-link-label">{item.label}</span>
                      <span className="sidebar-soon-badge">Soon</span>
                    </button>
                  ) : (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end ?? (item.to === '/')}
                      onClick={onCloseMobile}
                      className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                      title={item.label}
                    >
                      <item.icon />
                      <span className="sidebar-link-label">{item.label}</span>
                    </NavLink>
                  )
                )}
                {sectionIdx === NAV_SECTIONS.length - 1 && IS_DEV && (
                  <a
                    href="/api-docs.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sidebar-link"
                    title="API Docs — external data reference"
                  >
                    <IconApiDocs />
                    <span className="sidebar-link-label">API Docs</span>
                  </a>
                )}
              </div>
            ))}
          </nav>

          {canScrollDown && (
            <button
              type="button"
              className="sidebar-scroll-btn sidebar-scroll-down"
              onClick={() => scrollNav(1)}
              aria-label="Scroll sidebar down"
              title="Scroll down"
            >
              <IconChevronUpDown dir="down" />
            </button>
          )}
        </div>

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
function IconChevronUpDown({ dir }) {
  const d = dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6';
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}
function IconApiDocs() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 13l-1.5 1.5L9 16M13 13l1.5 1.5L13 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}

/* --- Icons for v1 pages not yet ported (used for "Coming soon" nav items) --- */
function IconCreateBill() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/><line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
}
function IconCustomers() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}
function IconPastBills() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8"/><line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.8"/></svg>);
}
function IconItems() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8"/></svg>);
}
function IconStock() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}
function IconSalesReturn() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polyline points="1 4 1 10 7 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}
function IconSaleSummary() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
}
function IconBrands() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12.01V2h10.01l8.58 8.58a2 2 0 0 1 0 2.83z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>);
}
function IconSuppliers() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="1" y="3" width="15" height="13" stroke="currentColor" strokeWidth="1.8"/><path d="M16 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.8"/><circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.8"/></svg>);
}
function IconFulfillment() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 7l-8-4-8 4m16 0-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}
function IconCatalogue() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>);
}

export { IconHome, IconBriefcase, IconSliders, IconUser };
