import { useEffect, useState } from 'react';
import BrandIcon from './BrandIcon';
import { apiGet } from '../api/api';

export default function Header({ onOpenMobileSidebar }) {
  const [company, setCompany] = useState(null);

  useEffect(() => {
    apiGet('company').then(setCompany);
    const onFocus = () => apiGet('company').then(setCompany); // refresh after Your Data edits
    window.addEventListener('billhive:company-updated', onFocus);
    return () => window.removeEventListener('billhive:company-updated', onFocus);
  }, []);

  return (
    <header className="app-header">
      <button className="menu-toggle-btn" onClick={onOpenMobileSidebar} aria-label="Open menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div className="header-center">
        <span className="header-brand-icon"><BrandIcon size={22} /></span>
        {company?.logo ? (
          <img src={company.logo} alt={company.name || 'Company logo'} className="header-company-logo" />
        ) : (
          <span className="header-company-name">{company?.name || 'Bill Hive'}</span>
        )}
      </div>

      <span />
    </header>
  );
}
