import { useEffect, useMemo, useRef, useState } from 'react';
import { dbGet, dbSet } from '../db/indexedDB';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import BrandFormModal, { BRAND_COLORS } from '../components/BrandFormModal';
import ImageZoomLightbox from '../components/ImageZoomLightbox';
import '../utils/imageEditor';

function colorDarken(hex, amount) {
  const num = parseInt((hex || '228be6').replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export default function Brands() {
  const { showToast } = useToast();
  useTheme(); // ensures accent/theme vars are applied before first paint

  const [brands, setBrands] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);

  const [deleteId, setDeleteId] = useState(null);

  const [items, setItems] = useState(null); // lazy-loaded, null = not fetched yet
  const [detailBrand, setDetailBrand] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const touchXRef = useRef(0);

  useEffect(() => {
    dbGet('brands').then((data) => {
      setBrands(Array.isArray(data) ? data : []);
      setLoaded(true);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, search]);

  const refreshBrands = async () => {
    const data = await dbGet('brands');
    setBrands(Array.isArray(data) ? data : []);
  };

  // ---------- Add / edit modal ----------
  const openAdd = () => {
    setEditingBrand(null);
    setModalOpen(true);
  };

  const openEdit = (b) => {
    setEditingBrand(b);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  // ---------- Delete ----------
  const requestDelete = (id) => setDeleteId(id);
  const cancelDelete = () => setDeleteId(null);
  const confirmDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    const next = brands.filter((b) => b.id !== id);
    setBrands(next);
    await dbSet('brands', next);
    if (detailBrand?.id === id) setDetailBrand(null);
    showToast('Brand deleted');
  };

  // ---------- Ecom-style brand detail page ----------
  const ensureItems = async () => {
    if (items === null) {
      const data = await dbGet('items');
      setItems(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
    }
    return items;
  };

  const openDetail = async (b) => {
    await ensureItems();
    setDetailBrand(b);
  };
  const closeDetail = () => setDetailBrand(null);
  const editFromDetail = () => {
    const b = detailBrand;
    setDetailBrand(null);
    openEdit(b);
  };

  const brandProducts = useMemo(() => {
    if (!detailBrand || !items) return [];
    return items.filter((it) => (it.brand || '').toLowerCase() === detailBrand.name.toLowerCase());
  }, [detailBrand, items]);

  // ---------- Product detail sub-modal ----------
  const openItemDetail = (it) => {
    setGalleryIndex(0);
    setDetailItem(it);
  };
  const closeItemDetail = () => setDetailItem(null);

  const galleryImages = useMemo(
    () => (Array.isArray(detailItem?.images) ? detailItem.images.filter(Boolean) : []),
    [detailItem]
  );

  const moveGallery = (dir) => {
    setGalleryIndex((i) => Math.max(0, Math.min(galleryImages.length - 1, i + dir)));
  };

  const onGalleryTouchStart = (e) => { touchXRef.current = e.touches[0].clientX; };
  const onGalleryTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchXRef.current;
    if (Math.abs(dx) > 40) moveGallery(dx < 0 ? 1 : -1);
  };

  const stockInfo = (it) => {
    if (!it) return null;
    if (it.trackStock === false) return { label: 'Stock not tracked', cls: 'in-stock' };
    const stock = it.stock || 0;
    if (stock <= 0) return { label: 'Out of Stock', cls: 'out-stock' };
    if (stock <= 5) return { label: `Low Stock — ${stock} left`, cls: 'low-stock' };
    return { label: `In Stock — ${stock} units`, cls: 'in-stock' };
  };

  const cardStock = (it) => {
    if (it.trackStock === false) return '';
    if (it.stock <= 0) return 'Out of stock';
    if (it.stock <= 5) return `${it.stock} left`;
    return `${it.stock} in stock`;
  };

  const currency = (n) => `₹ ${parseFloat(n || 0).toFixed(2)}`;

  const si = stockInfo(detailItem);

  return (
    <div>
      <h1 className="page-title">Your Brands</h1>
      <p className="page-subtitle">Manage the different brands you sell under.</p>

      {!loaded ? null : brands.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <IconBrand size={40} />
            <p className="empty-state-text">No brands yet. Add the brands you sell under to keep them organized.</p>
            <button className="action-btn btn-save" onClick={openAdd}>+ Add Brand</button>
          </div>
        </div>
      ) : (
        <>
          <div className="brands-toolbar">
            <div className="search-box">
              <IconSearch />
              <input type="text" placeholder="Search brands..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="action-btn btn-save" onClick={openAdd}>+ Add Brand</button>
          </div>

          {filtered.length === 0 ? (
            <div className="card"><p className="empty-state-text" style={{ margin: 0, textAlign: 'center' }}>No brands match your search.</p></div>
          ) : (
            <div className="brand-grid">
              {filtered.map((b) => (
                <div key={b.id} className="brand-card" style={{ borderTop: `3px solid ${b.color || BRAND_COLORS[0]}` }} onClick={() => openDetail(b)}>
                  <div className="brand-card-logo">
                    {b.logo
                      ? <img src={b.logo} alt={b.name} />
                      : <div className="brand-card-logo-placeholder" style={{ color: b.color || BRAND_COLORS[0] }}><IconBrand /></div>}
                  </div>
                  <div className="brand-card-body">
                    <div className="brand-card-name">
                      {b.name}
                      <span className="brand-card-color-dot" style={{ background: b.color || BRAND_COLORS[0] }} />
                    </div>
                    {b.description && <div className="brand-card-desc">{b.description}</div>}
                  </div>
                  <div className="brand-card-actions">
                    <button className="icon-btn" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(b); }}>
                      <IconEdit />
                    </button>
                    <button className="icon-btn icon-btn-danger" title="Delete" onClick={(e) => { e.stopPropagation(); requestDelete(b.id); }}>
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---------- Add / Edit modal ---------- */}
      <BrandFormModal
        open={modalOpen}
        onClose={closeModal}
        brand={editingBrand}
        onSaved={refreshBrands}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Brand"
        message="Delete this brand? This can't be undone."
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* ---------- Ecom-style brand detail page ---------- */}
      <Modal
        open={!!detailBrand}
        onClose={closeDetail}
        zIndex={1100}
        contentClassName="brand-page-content"
      >
        {detailBrand && (
          <>
            <div
              className="brand-page-hero"
              style={{ background: `linear-gradient(135deg, ${detailBrand.color || BRAND_COLORS[0]} 0%, ${colorDarken(detailBrand.color || BRAND_COLORS[0], 20)} 100%)` }}
            >
              <button className="modal-close brand-page-close" onClick={closeDetail} aria-label="Close">
                <IconClose light />
              </button>
              <div className="brand-page-hero-logo">
                {detailBrand.logo ? <img src={detailBrand.logo} alt={detailBrand.name} /> : <IconBrand light />}
              </div>
              <div className="brand-page-name">{detailBrand.name}</div>
              {detailBrand.description && <div className="brand-page-desc">{detailBrand.description}</div>}
              <div className="brand-page-hero-actions">
                <button className="brand-page-action-btn" onClick={editFromDetail}>
                  <IconEdit light size={14} /> Edit
                </button>
              </div>
            </div>
            <div className="brand-page-body">
              <div className="brand-page-section-title">
                {brandProducts.length > 0 ? `${brandProducts.length} Product${brandProducts.length !== 1 ? 's' : ''}` : ''}
              </div>
              {brandProducts.length === 0 ? (
                <div className="brand-page-empty">
                  No products linked to {detailBrand.name} yet.<br />
                  <small>Set the Brand field on items to link them here.</small>
                </div>
              ) : (
                <div className="brand-page-products">
                  {brandProducts.map((it) => (
                    <div key={it.id} className="brand-product-card" onClick={() => openItemDetail(it)}>
                      <div className="brand-product-img">
                        {Array.isArray(it.images) && it.images[0] ? <img src={it.images[0]} alt={it.name} /> : <IconImagePlaceholder />}
                      </div>
                      <div className="brand-product-info">
                        <div className="brand-product-name">{it.name}</div>
                        <div className="brand-product-price" style={{ color: detailBrand.color || BRAND_COLORS[0] }}>{currency(it.price)}</div>
                        {cardStock(it) && <div className="brand-product-stock">{cardStock(it)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* ---------- Product detail sub-modal ---------- */}
      <Modal
        open={!!detailItem}
        onClose={closeItemDetail}
        title={detailItem?.name || ''}
        zIndex={1200}
        bodyClassName="product-page-modal-body"
      >
        {detailItem && (
          <>
            <div
              className="product-page-gallery"
              onTouchStart={onGalleryTouchStart}
              onTouchEnd={onGalleryTouchEnd}
            >
              {galleryImages.length === 0 ? (
                <div className="product-page-gallery-empty">
                  <IconImagePlaceholder size={48} />
                  <span>No images</span>
                </div>
              ) : (
                <div className="product-page-gallery-track" style={{ transform: `translateX(${-galleryIndex * 100}%)` }}>
                  {galleryImages.map((src, i) => <img key={i} src={src} alt={detailItem.name} />)}
                </div>
              )}
              {galleryImages.length > 0 && (
                <button className="product-page-zoom-btn" onClick={() => setZoomOpen(true)} title="Zoom image" aria-label="Zoom image">
                  <IconZoom />
                </button>
              )}
              {galleryImages.length > 1 && (
                <>
                  <button className="product-page-arrow prev" disabled={galleryIndex === 0} onClick={() => moveGallery(-1)}>
                    <IconChevron dir="left" />
                  </button>
                  <button className="product-page-arrow next" disabled={galleryIndex === galleryImages.length - 1} onClick={() => moveGallery(1)}>
                    <IconChevron dir="right" />
                  </button>
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
              {detailItem.brand && <div className="product-page-brand-badge">{detailItem.brand}</div>}
              <div className="product-page-price-row">
                <div className="product-page-price">{currency(detailItem.price)}</div>
                {detailItem.cost ? <div className="product-page-cost">Cost: {currency(detailItem.cost)}</div> : null}
              </div>
              {si && <div className={`product-page-stock-badge ${si.cls}`}>{si.label}</div>}
              <div className="product-page-specs">
                {[
                  detailItem.sku ? ['SKU', detailItem.sku] : null,
                  detailItem.ean ? ['Barcode / EAN', detailItem.ean] : null,
                  detailItem.itemNumber ? ['Item Number', detailItem.itemNumber] : null,
                  ['Discount', `${detailItem.discount || 0}%`],
                  ['Tax', `${detailItem.tax || 0}%`]
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
function IconBrand({ size = 22, light = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={light ? 'rgba(255,255,255,.7)' : 'currentColor'} strokeWidth="1.8">
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12.01V2h10.01l8.58 8.58a2 2 0 0 1 0 2.83z" strokeLinejoin="round" />
      <line x1="7" y1="7" x2="7.01" y2="7" strokeLinecap="round" />
    </svg>
  );
}
function IconSearch() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" /><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>);
}
function IconEdit({ light = false, size = 15 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={light ? '#fff' : 'currentColor'} strokeWidth="1.8"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" strokeLinejoin="round" /></svg>);
}
function IconTrash() {
  return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>);
}
function IconClose({ light = false }) {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={light ? '#fff' : 'currentColor'} strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" /></svg>);
}
function IconImagePlaceholder({ size = 32 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>);
}
function IconZoom() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>);
}
function IconChevron({ dir }) {
  const points = dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points={points} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
