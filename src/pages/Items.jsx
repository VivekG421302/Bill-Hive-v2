import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiSet } from '../api/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import BrandFormModal from '../components/BrandFormModal';
import ImageZoomLightbox from '../components/ImageZoomLightbox';
import '../utils/imageEditor';

const ADD_NEW_BRAND = '__add_new_brand__';
const EMPTY_FORM = {
  name: '', sku: '', ean: '', itemNumber: '', brand: '',
  cost: '', price: '', discount: '', tax: '', stock: '',
  trackStock: true, images: []
};

const currency = (n) => `₹ ${parseFloat(n || 0).toFixed(2)}`;

function stockInfo(it) {
  if (!it) return null;
  if (it.trackStock === false) return { label: 'Stock not tracked', cls: 'in-stock' };
  const stock = it.stock || 0;
  if (stock <= 0) return { label: 'Out of Stock', cls: 'out-stock' };
  if (stock <= 5) return { label: `Low Stock — ${stock} left`, cls: 'low-stock' };
  return { label: `In Stock — ${stock} units`, cls: 'in-stock' };
}

export default function Items() {
  const { showToast } = useToast();

  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const fileRefs = useRef([]);

  const [brandFormOpen, setBrandFormOpen] = useState(false);
  const brandSelectRef = useRef(null);

  const [deleteId, setDeleteId] = useState(null);

  const [detailItem, setDetailItem] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const touchXRef = useRef(0);

  useEffect(() => {
    Promise.all([apiGet('items'), apiGet('brands')]).then(([it, br]) => {
      setItems(Array.isArray(it) ? it : []);
      setBrands(Array.isArray(br) ? br : []);
      setLoaded(true);
    });
  }, []);

  const refreshBrands = async () => {
    const data = await apiGet('brands');
    setBrands(Array.isArray(data) ? data : []);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, search]);

  const persist = async (next) => {
    setItems(next);
    await apiSet('items', next);
  };

  // ---------- Add / edit modal ----------
  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (it) => {
    setEditingId(it.id);
    setForm({
      name: it.name || '', sku: it.sku || '', ean: it.ean || '', itemNumber: it.itemNumber || '',
      brand: it.brand || '', cost: it.cost ?? '', price: it.price ?? '', discount: it.discount ?? '',
      tax: it.tax ?? '', stock: it.stock ?? '', trackStock: it.trackStock !== false,
      images: Array.isArray(it.images) ? it.images.slice(0, 4) : []
    });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleBrandSelect = (e) => {
    const val = e.target.value;
    if (val === ADD_NEW_BRAND) {
      setBrandFormOpen(true);
      e.target.value = form.brand; // keep showing previous selection underneath
      return;
    }
    setForm((f) => ({ ...f, brand: val }));
  };

  const handleBrandCreated = (savedBrand) => {
    refreshBrands();
    setForm((f) => ({ ...f, brand: savedBrand.name }));
  };

  const handleImageUpload = (slot, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      window.BHImageEditor.open(reader.result, { title: `Edit Product Image ${slot + 1}` })
        .then((dataUrl) => {
          setForm((f) => {
            const images = [...f.images];
            images[slot] = dataUrl;
            return { ...f, images };
          });
        })
        .catch(() => {});
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = (slot, e) => {
    e.stopPropagation();
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== slot) }));
  };

  const saveItem = async () => {
    const name = form.name.trim();
    if (!name) {
      showToast('Please enter an item name');
      return;
    }
    const data = {
      name,
      sku: form.sku.trim(),
      ean: form.ean.trim(),
      itemNumber: form.itemNumber.trim(),
      brand: form.brand.trim(),
      cost: parseFloat(form.cost) || 0,
      price: parseFloat(form.price) || 0,
      discount: parseFloat(form.discount) || 0,
      tax: parseFloat(form.tax) || 0,
      stock: parseFloat(form.stock) || 0,
      trackStock: form.trackStock,
      images: form.images.filter(Boolean).slice(0, 4)
    };

    if (editingId) {
      await persist(items.map((it) => (it.id === editingId ? { ...it, ...data } : it)));
      showToast('Item updated');
    } else {
      const id = items.reduce((max, it) => Math.max(max, it.id || 0), 0) + 1;
      await persist([...items, { id, ...data }]);
      showToast('Item added');
    }
    setModalOpen(false);
  };

  // ---------- Delete ----------
  const requestDelete = (id) => setDeleteId(id);
  const cancelDelete = () => setDeleteId(null);
  const confirmDeleteItem = async () => {
    const id = deleteId;
    setDeleteId(null);
    await persist(items.filter((it) => it.id !== id));
    if (detailItem?.id === id) setDetailItem(null);
    showToast('Item deleted');
  };

  // ---------- Product detail view ----------
  const openDetail = (it) => {
    setGalleryIndex(0);
    setDetailItem(it);
  };
  const closeDetail = () => setDetailItem(null);
  const editFromDetail = () => {
    const it = detailItem;
    setDetailItem(null);
    openEdit(it);
  };
  const deleteFromDetail = () => requestDelete(detailItem.id);

  const galleryImages = useMemo(
    () => (Array.isArray(detailItem?.images) ? detailItem.images.filter(Boolean) : []),
    [detailItem]
  );
  const moveGallery = (dir) => setGalleryIndex((i) => Math.max(0, Math.min(galleryImages.length - 1, i + dir)));
  const onGalleryTouchStart = (e) => { touchXRef.current = e.touches[0].clientX; };
  const onGalleryTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchXRef.current;
    if (Math.abs(dx) > 40) moveGallery(dx < 0 ? 1 : -1);
  };

  const si = stockInfo(detailItem);

  return (
    <div>
      <h1 className="page-title">Items</h1>
      <p className="page-subtitle">Manage your product catalog.</p>

      {!loaded ? null : items.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <IconItems size={40} />
            <p className="empty-state-text">No items yet. Add your first product or service.</p>
            <button className="action-btn btn-save" onClick={openAdd}>+ Add Item</button>
          </div>
        </div>
      ) : (
        <>
          <div className="brands-toolbar">
            <div className="search-box">
              <IconSearch />
              <input type="text" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="action-btn btn-save" onClick={openAdd}>+ Add Item</button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th><th>SKU</th><th>Brand</th><th>Price</th><th>Cost</th><th>Disc %</th><th>Tax %</th><th>Stock</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td className="table-empty-row" colSpan={9}>No items match your search.</td></tr>
                ) : filtered.map((it) => (
                  <tr key={it.id} className="table-row-clickable" onClick={() => openDetail(it)}>
                    <td className="cell-strong">{it.name}</td>
                    <td className="cell-muted">{it.sku || '—'}</td>
                    <td className="cell-muted">{it.brand || '—'}</td>
                    <td>{currency(it.price)}</td>
                    <td className="cell-muted">{it.cost ? currency(it.cost) : '—'}</td>
                    <td>{it.discount || 0}%</td>
                    <td>{it.tax || 0}%</td>
                    <td>{it.trackStock !== false ? (it.stock || 0) : '—'}</td>
                    <td className="cell-actions">
                      <button className="icon-btn" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(it); }}><IconEdit /></button>
                      <button className="icon-btn icon-btn-danger" title="Delete" onClick={(e) => { e.stopPropagation(); requestDelete(it.id); }}><IconTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---------- Add / Edit item modal ---------- */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Item' : 'Add Item'}
        footer={
          <>
            <button className="action-btn btn-save" onClick={saveItem}>Save Item</button>
            <button className="action-btn btn-outline" onClick={closeModal}>Cancel</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group full-width">
            <label>Item Name <span className="required">*</span></label>
            <input type="text" placeholder="e.g., Cotton T-Shirt" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>SKU Code</label>
            <input type="text" placeholder="e.g., SKU-001" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>EAN / Barcode</label>
            <input type="text" placeholder="e.g., 8901234567890" value={form.ean} onChange={(e) => setForm((f) => ({ ...f, ean: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Item Number</label>
            <input type="text" placeholder="e.g., ITM-2024-001" value={form.itemNumber} onChange={(e) => setForm((f) => ({ ...f, itemNumber: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Brand</label>
            <select ref={brandSelectRef} value={form.brand} onChange={handleBrandSelect}>
              <option value="">— No brand —</option>
              {brands.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              <option value={ADD_NEW_BRAND}>+ Add new brand…</option>
            </select>
          </div>
          <div className="form-group">
            <label>Cost (Purchase Price)</label>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Price (Selling Price)</label>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Discount %</label>
            <input type="number" min="0" max="100" step="0.01" placeholder="0" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Tax %</label>
            <input type="number" min="0" step="0.01" placeholder="0" value={form.tax} onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Opening Stock</label>
            <input type="number" min="0" step="1" placeholder="0" value={form.stock} disabled={!form.trackStock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} />
          </div>
          <div className="form-group full-width">
            <label className="toggle-switch">
              <input type="checkbox" checked={form.trackStock} onChange={(e) => setForm((f) => ({ ...f, trackStock: e.target.checked }))} />
              <span className="toggle-slider" />
              <span style={{ marginLeft: 8, fontSize: 13 }}>Track stock for this item</span>
            </label>
          </div>
          <div className="form-group full-width">
            <label>Product Images <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(up to 4, max 2MB each)</span></label>
            <div className="item-image-grid">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="item-image-slot" onClick={() => fileRefs.current[i]?.click()}>
                  <input
                    ref={(el) => (fileRefs.current[i] = el)}
                    type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => handleImageUpload(i, e)}
                  />
                  {form.images[i] ? (
                    <>
                      <img src={form.images[i]} alt={`Product ${i + 1}`} />
                      <button type="button" className="item-image-remove" title="Remove" onClick={(e) => removeImage(i, e)}>✕</button>
                    </>
                  ) : (
                    <div className="item-image-placeholder">
                      <IconAddImage />
                      <span>Add</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <BrandFormModal open={brandFormOpen} onClose={() => setBrandFormOpen(false)} brand={null} onSaved={handleBrandCreated} />

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Item"
        message="Delete this item? This will not affect past bills."
        onConfirm={confirmDeleteItem}
        onCancel={cancelDelete}
      />

      {/* ---------- Product detail view ---------- */}
      <Modal
        open={!!detailItem}
        onClose={closeDetail}
        title={detailItem?.name || ''}
        zIndex={1200}
        bodyClassName="product-page-modal-body"
      >
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
              <div className="view-action-bar">
                <button className="action-btn btn-save" onClick={editFromDetail}><IconEdit size={14} /> Edit</button>
                <button className="action-btn btn-danger" onClick={deleteFromDetail}><IconTrash /> Delete</button>
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
function IconItems({ size = 22 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeLinejoin="round" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" strokeLinejoin="round" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>);
}
function IconSearch() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" /><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>);
}
function IconEdit({ size = 15 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" strokeLinejoin="round" /></svg>);
}
function IconTrash() {
  return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>);
}
function IconAddImage() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>);
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
