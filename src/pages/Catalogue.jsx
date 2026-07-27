import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ImageZoomLightbox from '../components/ImageZoomLightbox';

const currency = (n, symbol = '₹') => `${symbol} ${(parseFloat(n) || 0).toFixed(2)}`;
const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default function Catalogue() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [company, setCompany] = useState({});
  const [settings, setSettings] = useState({ currencySymbol: '₹' });
  const [loaded, setLoaded] = useState(false);

  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');

  const [detailItem, setDetailItem] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const touchXRef = useRef(0);

  useEffect(() => {
    Promise.all([apiGet('items'), apiGet('brands'), apiGet('company'), apiGet('settings')]).then(([it, br, co, se]) => {
      setItems(Array.isArray(it) ? it : []);
      setBrands(Array.isArray(br) ? br : []);
      setCompany(co || {});
      if (se) setSettings((prev) => ({ ...prev, ...se }));
      setLoaded(true);
    });
  }, []);

  const brandNames = useMemo(() => {
    const names = new Set();
    items.forEach((it) => { if (it.brand) names.add(it.brand); });
    brands.forEach((b) => { if (b.name) names.add(b.name); });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [items, brands]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      const matchesQuery = !q || it.name.toLowerCase().includes(q) || (it.brand || '').toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q);
      const matchesBrand = !brandFilter || (it.brand || 'Unbranded') === brandFilter || (brandFilter === 'Unbranded' && !it.brand);
      return matchesQuery && matchesBrand;
    });
  }, [items, search, brandFilter]);

  const groups = useMemo(() => {
    const g = {};
    filtered.forEach((it) => {
      const key = it.brand && it.brand.trim() ? it.brand.trim() : 'Unbranded';
      if (!g[key]) g[key] = [];
      g[key].push(it);
    });
    const keys = Object.keys(g).sort((a, b) => {
      if (a === 'Unbranded') return 1;
      if (b === 'Unbranded') return -1;
      return a.localeCompare(b);
    });
    return keys.map((name) => ({ name, items: g[name], meta: brands.find((b) => b.name === name) }));
  }, [filtered, brands]);

  // ---------- Product view ----------
  const openDetail = (it) => { setGalleryIndex(0); setDetailItem(it); };
  const closeDetail = () => setDetailItem(null);
  const galleryImages = useMemo(() => (Array.isArray(detailItem?.images) ? detailItem.images.filter(Boolean) : []), [detailItem]);
  const moveGallery = (dir) => setGalleryIndex((i) => Math.max(0, Math.min(galleryImages.length - 1, i + dir)));
  const onGalleryTouchStart = (e) => { touchXRef.current = e.touches[0].clientX; };
  const onGalleryTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchXRef.current;
    if (Math.abs(dx) > 40) moveGallery(dx < 0 ? 1 : -1);
  };

  // ---------- Print ----------
  const printCatalogue = () => {
    if (filtered.length === 0) {
      showToast('No items to print with the current filters');
      return;
    }
    const symbol = settings.currencySymbol || '₹';
    const logoHtml = company.logo
      ? `<img src="${company.logo}" alt="Logo" style="max-width:220px;max-height:70px;object-fit:contain;filter:grayscale(100%) contrast(1.15);">`
      : '';
    const sectionsHtml = groups.map((g) => `
      <div class="cat-section">
        <div class="cat-brand-name">${escapeHtml(g.name)}</div>
        <table class="cat-table">
          <thead><tr><th>Item</th><th>SKU</th><th class="right">Price</th><th class="right">Tax %</th></tr></thead>
          <tbody>
            ${g.items.map((it) => `
              <tr>
                <td>${escapeHtml(it.name)}</td>
                <td>${escapeHtml(it.sku) || '—'}</td>
                <td class="right">${symbol} ${parseFloat(it.price || 0).toFixed(2)}</td>
                <td class="right">${it.tax || 0}%</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('');

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Catalogue — ${escapeHtml(company.name || 'Bill Hive')}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', 'Consolas', monospace; font-weight: 700; color: #000; background: #fff; padding: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .cat-header { text-align: center; padding-bottom: 14px; border-bottom: 3px double #000; margin-bottom: 18px; }
        .cat-company-name { font-size: 22px; font-weight: 800; margin-top: 6px; }
        .cat-sub { font-size: 12px; font-weight: 700; margin-top: 2px; }
        .cat-title { font-size: 14px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-top: 8px; }
        .cat-section { margin-bottom: 20px; break-inside: avoid; }
        .cat-brand-name { font-size: 15px; font-weight: 800; text-transform: uppercase; padding: 4px 0; border-bottom: 2px solid #000; margin-bottom: 6px; }
        .cat-table { width: 100%; border-collapse: collapse; font-size: 12px; font-weight: 700; }
        .cat-table th { text-align: left; border-bottom: 2px solid #000; padding: 4px 6px; font-weight: 800; }
        .cat-table td { padding: 4px 6px; border-bottom: 1px dashed #999; }
        .cat-table .right { text-align: right; }
        .cat-footer { text-align: center; font-size: 10px; font-weight: 700; margin-top: 24px; padding-top: 8px; border-top: 2px dashed #000; }
        @media print { body { padding: 12px; } .cat-section { page-break-inside: avoid; } }
      </style></head>
      <body>
        <div class="cat-header">
          ${logoHtml}
          <div class="cat-company-name">${escapeHtml(company.name) || 'Your Company'}</div>
          ${company.address ? `<div class="cat-sub">${escapeHtml(company.address)}</div>` : ''}
          ${(company.phone || company.email) ? `<div class="cat-sub">${escapeHtml([company.phone, company.email].filter(Boolean).join(' · '))}</div>` : ''}
          <div class="cat-title">Product Catalogue</div>
        </div>
        ${sectionsHtml}
        <div class="cat-footer">Generated by Bill Hive on ${formatDate(new Date())}</div>
        <script>window.onload=function(){setTimeout(function(){window.print();},200);};</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div>
      <h1 className="page-title">Catalogue</h1>
      <p className="page-subtitle">Browse your products grouped by brand.</p>

      {!loaded ? null : items.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <IconCatalogue size={40} />
            <p className="empty-state-text">No items yet. Add products to build your catalogue.</p>
            <button className="action-btn btn-save" onClick={() => navigate('/items')}>+ Add Item</button>
          </div>
        </div>
      ) : (
        <>
          <div className="brands-toolbar">
            <div className="search-box">
              <IconSearch />
              <input type="text" placeholder="Search items or brands..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">All Brands</option>
              {brandNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <button className="action-btn btn-save" onClick={printCatalogue}><IconPrinter size={14} /> Print Catalogue</button>
          </div>

          {groups.length === 0 ? (
            <div className="card"><p className="empty-state-text" style={{ margin: 0, textAlign: 'center' }}>No items match your search.</p></div>
          ) : groups.map((g) => (
            <div className="bill-section" style={{ marginTop: 16 }} key={g.name}>
              <div className="section-header">
                {g.meta?.logo ? <img src={g.meta.logo} alt={g.name} style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} /> : <IconBrand />}
                <h2>{g.name}</h2>
                <span className="cell-muted" style={{ marginLeft: 'auto', fontSize: 13 }}>{g.items.length} item{g.items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Name</th><th>SKU</th><th>Price</th><th>Tax %</th><th>Stock</th></tr></thead>
                  <tbody>
                    {g.items.map((it) => (
                      <tr key={it.id} className="table-row-clickable" onClick={() => openDetail(it)}>
                        <td className="cell-strong">{it.name}</td>
                        <td className="cell-muted">{it.sku || '—'}</td>
                        <td>{currency(it.price, settings.currencySymbol)}</td>
                        <td>{it.tax || 0}%</td>
                        <td>{it.trackStock !== false ? (it.stock || 0) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ---------- Read-only product view ---------- */}
      <Modal open={!!detailItem} onClose={closeDetail} title={detailItem?.name || ''} bodyClassName="product-page-modal-body">
        {detailItem && (
          <>
            <div className="product-page-gallery" onTouchStart={onGalleryTouchStart} onTouchEnd={onGalleryTouchEnd}>
              {galleryImages.length === 0 ? (
                <div className="product-page-gallery-empty"><IconImagePlaceholder size={48} /><span>No images</span></div>
              ) : (
                <div className="product-page-gallery-track" style={{ transform: `translateX(${-galleryIndex * 100}%)` }}>
                  {galleryImages.map((src, i) => <img key={i} src={src} alt={detailItem.name} />)}
                </div>
              )}
              {galleryImages.length > 0 && (
                <button className="product-page-zoom-btn" onClick={() => setZoomOpen(true)} title="Zoom image" aria-label="Zoom image"><IconZoom /></button>
              )}
              {galleryImages.length > 1 && (
                <>
                  <button className="product-page-arrow prev" disabled={galleryIndex === 0} onClick={() => moveGallery(-1)}><IconChevron dir="left" /></button>
                  <button className="product-page-arrow next" disabled={galleryIndex === galleryImages.length - 1} onClick={() => moveGallery(1)}><IconChevron dir="right" /></button>
                  <div className="product-page-img-counter">{galleryIndex + 1} / {galleryImages.length}</div>
                </>
              )}
            </div>
            {galleryImages.length > 1 && (
              <div className="product-page-dots">
                {galleryImages.map((_, i) => (
                  <button key={i} className={`product-page-dot${i === galleryIndex ? ' active' : ''}`} onClick={() => setGalleryIndex(i)} />
                ))}
              </div>
            )}
            <div className="product-page-info">
              <div className="product-page-name">{detailItem.name}</div>
              <div className="product-page-brand-badge">{detailItem.brand || 'Unbranded'}</div>
              <div className="product-page-price-row">
                <div className="product-page-price">{currency(detailItem.price, settings.currencySymbol)}</div>
              </div>
              <div className="product-page-specs">
                {[
                  detailItem.sku ? ['SKU', detailItem.sku] : null,
                  detailItem.ean ? ['Barcode / EAN', detailItem.ean] : null,
                  detailItem.itemNumber ? ['Item Number', detailItem.itemNumber] : null,
                  ['Tax', `${detailItem.tax || 0}%`],
                  ['Available Stock', detailItem.trackStock !== false ? (detailItem.stock || 0) : 'Not tracked']
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label} className="product-page-spec-row">
                    <span className="product-page-spec-label">{label}</span>
                    <span className="product-page-spec-value mono">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Modal>

      <ImageZoomLightbox
        src={galleryImages[galleryIndex]}
        alt={detailItem?.name}
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
      />
    </div>
  );
}

/* ---------- Icons ---------- */
function IconCatalogue({ size = 22 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinejoin="round" /></svg>); }
function IconSearch() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" /><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>); }
function IconPrinter({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>); }
function IconBrand() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12.01V2h10.01l8.58 8.58a2 2 0 0 1 0 2.83z" strokeLinejoin="round" /><line x1="7" y1="7" x2="7.01" y2="7" strokeLinecap="round" /></svg>); }
function IconImagePlaceholder({ size = 32 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>); }
function IconZoom() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>); }
function IconChevron({ dir }) {
  const points = dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points={points} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
