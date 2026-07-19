import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbGet, dbSet } from '../db/indexedDB';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

const currency = (n) => `₹ ${parseFloat(n || 0).toFixed(2)}`;

function stockInfo(it) {
  if (!it) return null;
  if (it.trackStock === false) return { label: 'Stock not tracked', cls: 'in-stock' };
  const stock = it.stock || 0;
  if (stock <= 0) return { label: 'Out of Stock', cls: 'out-stock' };
  if (stock <= 5) return { label: `Low Stock — ${stock} left`, cls: 'low-stock' };
  return { label: `In Stock — ${stock} units`, cls: 'in-stock' };
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Stock() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [items, setItems] = useState([]);
  const [stockLog, setStockLog] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustType, setAdjustType] = useState('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustNoInventory, setAdjustNoInventory] = useState(false);

  const [detailItem, setDetailItem] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const touchXRef = useRef(0);

  useEffect(() => {
    Promise.all([dbGet('items'), dbGet('stockLog')]).then(([it, log]) => {
      setItems(Array.isArray(it) ? it : []);
      setStockLog(Array.isArray(log) ? log : []);
      setLoaded(true);
    });
  }, []);

  const recentLog = useMemo(() => stockLog.slice(0, 25), [stockLog]);

  // ---------- Adjust stock modal ----------
  const openAdjust = (it) => {
    if (it.trackStock === false) return;
    setAdjustItem(it);
    setAdjustType('add');
    setAdjustQty('');
    setAdjustNote('');
    setAdjustNoInventory(false);
  };
  const closeAdjust = () => setAdjustItem(null);

  const logMovement = (log, itemId, itemName, type, qty, reference) => {
    const entry = { id: Date.now() + Math.random(), date: new Date().toISOString(), itemId, itemName, type, qty, reference: reference || '-' };
    return [entry, ...log].slice(0, 200);
  };

  const applyAdjustment = async () => {
    const item = adjustItem;
    if (!item) return;
    const qty = parseFloat(adjustQty) || 0;
    const note = adjustNote.trim();

    if (adjustNoInventory) {
      const nextLog = logMovement(stockLog, item.id, item.name, 'Damaged (not added to inventory)', -Math.abs(qty), note || 'Damaged stock');
      setStockLog(nextLog);
      await dbSet('stockLog', nextLog);
      closeAdjust();
      showToast('Damaged stock logged');
      return;
    }

    if (qty <= 0 && adjustType !== 'set') {
      showToast('Enter a quantity greater than 0');
      return;
    }

    let newStock = item.stock || 0;
    let delta = 0;
    let typeLabel;
    if (adjustType === 'add') { newStock += qty; delta = qty; typeLabel = 'Manual Add'; }
    else if (adjustType === 'remove') { const before = newStock; newStock = Math.max(0, newStock - qty); delta = -(before - newStock); typeLabel = 'Manual Remove'; }
    else { delta = qty - newStock; newStock = qty; typeLabel = 'Adjustment (set)'; }

    const nextItems = items.map((it) => (it.id === item.id ? { ...it, stock: newStock } : it));
    const nextLog = logMovement(stockLog, item.id, item.name, typeLabel, delta, note || 'Manual adjustment');

    setItems(nextItems);
    setStockLog(nextLog);
    await dbSet('items', nextItems);
    await dbSet('stockLog', nextLog);
    closeAdjust();
    showToast('Stock updated');
  };

  // ---------- Item detail view (row click) ----------
  const openDetail = (it) => { setGalleryIndex(0); setDetailItem(it); };
  const closeDetail = () => setDetailItem(null);

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
      <h1 className="page-title">Stock</h1>
      <p className="page-subtitle">Track your inventory levels.</p>

      {!loaded ? null : items.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <IconStock size={40} />
            <p className="empty-state-text">Add items first to track their stock here.</p>
            <button className="action-btn btn-save" onClick={() => navigate('/items')}>+ Add Item</button>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Item</th><th>Tracking</th><th>Current Stock</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const tracked = it.trackStock !== false;
                const low = tracked && (it.stock || 0) <= 5;
                return (
                  <tr key={it.id} className="table-row-clickable" onClick={() => openDetail(it)}>
                    <td className="cell-strong">{it.name}</td>
                    <td className="cell-muted">{tracked ? 'Tracked' : 'Not tracked'}</td>
                    <td>{tracked ? (it.stock || 0) : '—'}</td>
                    <td>
                      {tracked
                        ? <span className={`status-pill ${low ? 'status-low' : 'status-ok'}`}>{low ? 'Low Stock' : 'In Stock'}</span>
                        : <span className="status-pill">N/A</span>}
                    </td>
                    <td className="cell-actions">
                      <button className="icon-btn" title="Adjust" disabled={!tracked} onClick={(e) => { e.stopPropagation(); openAdjust(it); }}>
                        <IconPlus />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loaded && items.length > 0 && (
        <div className="bill-section" style={{ marginTop: 16 }}>
          <div className="section-header">
            <IconHistory />
            <h2>Recent Stock Movements</h2>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Qty</th><th>Reference</th></tr></thead>
              <tbody>
                {recentLog.length === 0 ? (
                  <tr><td className="table-empty-row" colSpan={5}>No stock movements yet</td></tr>
                ) : recentLog.map((log) => (
                  <tr key={log.id}>
                    <td className="cell-muted">{formatDate(log.date)}</td>
                    <td className="cell-strong">{log.itemName}</td>
                    <td className="cell-muted">{log.type}</td>
                    <td style={log.qty < 0 ? { color: 'var(--accent-danger)', fontWeight: 700 } : { fontWeight: 700 }}>
                      {log.qty > 0 ? '+' : ''}{log.qty}
                    </td>
                    <td className="cell-muted">{log.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Adjust stock modal ---------- */}
      <Modal
        open={!!adjustItem}
        onClose={closeAdjust}
        title="Adjust Stock"
        footer={
          <>
            <button className="action-btn btn-save" onClick={applyAdjustment}>Apply</button>
            <button className="action-btn btn-outline" onClick={closeAdjust}>Cancel</button>
          </>
        }
      >
        {adjustItem && (
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Item: {adjustItem.name} (Current stock: {adjustItem.stock || 0})</label>
            </div>
            <div className="form-group">
              <label>Adjustment Type</label>
              <select value={adjustType} onChange={(e) => setAdjustType(e.target.value)} disabled={adjustNoInventory}>
                <option value="add">Add Stock (Purchase/Restock)</option>
                <option value="remove">Remove Stock (Damage/Correction)</option>
                <option value="set">Set Exact Quantity</option>
              </select>
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input type="number" min="0" step="1" placeholder="0" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
            </div>
            <div className="form-group full-width">
              <label>Note</label>
              <input type="text" placeholder="Optional note" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
            </div>
            <div className="form-group full-width">
              <label className="toggle-switch">
                <input type="checkbox" checked={adjustNoInventory} onChange={(e) => setAdjustNoInventory(e.target.checked)} />
                <span className="toggle-slider" />
                <span style={{ marginLeft: 8, fontSize: 13 }}>Don't add to inventory (log as damaged stock)</span>
              </label>
              <p className="stock-adjust-hint">When checked, this quantity is recorded in the stock log for reference but is NOT added to or removed from the item's stock count — use this for damaged/unsellable stock.</p>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- Item detail view ---------- */}
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
              {detailItem.trackStock !== false && (
                <div className="view-action-bar">
                  <button className="action-btn btn-save" onClick={() => { const it = detailItem; setDetailItem(null); openAdjust(it); }}>
                    <IconPlus size={14} /> Adjust Stock
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ---------- Icons ---------- */
function IconStock({ size = 22 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
function IconPlus({ size = 15 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
}
function IconHistory() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" strokeLinejoin="round" /></svg>);
}
function IconImagePlaceholder({ size = 32 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>);
}
function IconChevron({ dir }) {
  const points = dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6';
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points={points} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
