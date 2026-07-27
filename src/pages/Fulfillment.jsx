import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiSet } from '../api/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const LOW_STOCK_THRESHOLD = 5;
const DEFAULT_REORDER_QTY = 10;
const STATUS_STEPS = ['Pending', 'Ordered', 'Received'];

const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function Fulfillment() {
  const { showToast } = useToast();

  const [catalogItems, setCatalogItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [restockFilter, setRestockFilter] = useState('');
  const [restockChecked, setRestockChecked] = useState({});
  const [restockQty, setRestockQty] = useState({});
  const [poSupplierId, setPoSupplierId] = useState('');

  const [detailPO, setDetailPO] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [receiveConfirmId, setReceiveConfirmId] = useState(null);

  useEffect(() => {
    Promise.all([apiGet('items'), apiGet('suppliers'), apiGet('purchaseOrders')]).then(([it, sup, po]) => {
      setCatalogItems(Array.isArray(it) ? it : []);
      setSuppliers(Array.isArray(sup) ? sup : []);
      setPurchaseOrders(Array.isArray(po) ? po : []);
      setLoaded(true);
    });
  }, []);

  const lowStockItems = useMemo(
    () => catalogItems.filter((it) => it.trackStock !== false && (it.stock || 0) <= LOW_STOCK_THRESHOLD),
    [catalogItems]
  );

  const restockRows = useMemo(() => {
    if (!restockFilter) return lowStockItems;
    const supplier = suppliers.find((s) => String(s.id) === restockFilter);
    if (!supplier || !supplier.itemIds || supplier.itemIds.length === 0) return lowStockItems;
    const linked = supplier.itemIds.map(String);
    return lowStockItems.filter((it) => linked.includes(String(it.id)));
  }, [lowStockItems, restockFilter, suppliers]);

  const suggestedQty = (stock) => Math.max(DEFAULT_REORDER_QTY - stock, DEFAULT_REORDER_QTY);

  const onFilterChange = (value) => {
    setRestockFilter(value);
    if (value && !poSupplierId) setPoSupplierId(value);
  };

  const toggleCheck = (id) => setRestockChecked((c) => ({ ...c, [id]: !c[id] }));
  const setQty = (id, value) => setRestockQty((q) => ({ ...q, [id]: Math.max(1, parseInt(value, 10) || 1) }));

  const suppliersWithLinkedItems = useMemo(() => suppliers.filter((s) => s.itemIds && s.itemIds.length > 0), [suppliers]);

  const createPO = async () => {
    if (!poSupplierId) {
      showToast('Please select a supplier');
      return;
    }
    const supplier = suppliers.find((s) => String(s.id) === String(poSupplierId));
    if (!supplier) {
      showToast('Selected supplier not found');
      return;
    }

    const items = [];
    restockRows.forEach((it) => {
      if (!restockChecked[it.id]) return;
      const qty = restockQty[it.id] ?? suggestedQty(it.stock || 0);
      if (qty > 0) items.push({ itemId: it.id, name: it.name, qty });
    });

    if (items.length === 0) {
      showToast('Select at least one item to order');
      return;
    }

    const id = purchaseOrders.reduce((max, p) => Math.max(max, p.id || 0), 0) + 1;
    const po = {
      id, poNumber: `PO-${String(id).padStart(4, '0')}`, supplierId: supplier.id, supplierName: supplier.name,
      date: new Date().toISOString(), items, status: 'Pending'
    };

    const next = [po, ...purchaseOrders];
    setPurchaseOrders(next);
    await apiSet('purchaseOrders', next);
    setRestockChecked({});
    showToast(`Purchase order ${po.poNumber} created`);
  };

  const updatePOStatus = async (id, status, extra = {}) => {
    const next = purchaseOrders.map((p) => (p.id === id ? { ...p, status, ...extra } : p));
    setPurchaseOrders(next);
    await apiSet('purchaseOrders', next);
    if (detailPO?.id === id) setDetailPO({ ...detailPO, status, ...extra });
  };

  const markOrdered = async (id) => {
    await updatePOStatus(id, 'Ordered');
    showToast('Marked as ordered');
  };

  const requestReceive = (id) => setReceiveConfirmId(id);
  const confirmReceive = async () => {
    const id = receiveConfirmId;
    setReceiveConfirmId(null);
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return;

    const nextItems = [...catalogItems];
    const logEntries = [];
    po.items.forEach((line) => {
      const idx = nextItems.findIndex((it) => it.id === line.itemId);
      if (idx === -1) return;
      nextItems[idx] = { ...nextItems[idx], stock: (nextItems[idx].stock || 0) + line.qty };
      logEntries.push({ id: Date.now() + Math.random(), date: new Date().toISOString(), itemId: line.itemId, itemName: line.name, type: 'Purchase Received', qty: line.qty, reference: po.poNumber });
    });

    setCatalogItems(nextItems);
    await apiSet('items', nextItems);
    if (logEntries.length > 0) {
      const stockLog = (await apiGet('stockLog')) || [];
      await apiSet('stockLog', [...logEntries, ...stockLog].slice(0, 200));
    }
    await updatePOStatus(id, 'Received');
    showToast(`${po.poNumber} received — stock updated`);
  };

  const requestDelete = (id) => setDeleteId(id);
  const confirmDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    const next = purchaseOrders.filter((p) => p.id !== id);
    setPurchaseOrders(next);
    await apiSet('purchaseOrders', next);
    if (detailPO?.id === id) setDetailPO(null);
    showToast('Purchase order deleted');
  };

  return (
    <div>
      <h1 className="page-title">Fulfillment</h1>
      <p className="page-subtitle">Restock low-inventory items and track purchase orders.</p>

      <div className="bill-container">
        {/* Restock suggestions */}
        <div className="bill-section">
          <div className="section-header"><IconAlert /><h2>Restock Suggestions</h2></div>

          {!loaded ? null : lowStockItems.length === 0 ? (
            <p className="empty-state-text" style={{ margin: 0 }}>Nothing needs restocking right now — all tracked items are above {LOW_STOCK_THRESHOLD} units.</p>
          ) : (
            <>
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label>Filter by Supplier</label>
                  <select value={restockFilter} onChange={(e) => onFilterChange(e.target.value)}>
                    <option value="">All items</option>
                    {suppliersWithLinkedItems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th></th><th>Item</th><th>Stock</th><th>Status</th><th>Reorder Qty</th></tr></thead>
                  <tbody>
                    {restockRows.length === 0 ? (
                      <tr><td className="table-empty-row" colSpan={5}>No low-stock items for this supplier.</td></tr>
                    ) : restockRows.map((it) => {
                      const stock = it.stock || 0;
                      return (
                        <tr key={it.id}>
                          <td><input type="checkbox" checked={!!restockChecked[it.id]} onChange={() => toggleCheck(it.id)} /></td>
                          <td className="cell-strong">{it.name}</td>
                          <td>{stock}</td>
                          <td><span className="status-pill status-low">{stock === 0 ? 'Out of Stock' : 'Low Stock'}</span></td>
                          <td>
                            <input type="number" min="1" step="1" style={{ width: 90 }}
                              value={restockQty[it.id] ?? suggestedQty(stock)}
                              onChange={(e) => setQty(it.id, e.target.value)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="form-grid" style={{ marginTop: 14 }}>
                <div className="form-group">
                  <label>Supplier for this Order</label>
                  <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}>
                    <option value="">-- Select a supplier --</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <button className="action-btn btn-save" style={{ marginTop: 10 }} onClick={createPO}><IconPlusCircle /> Create Purchase Order</button>
            </>
          )}
        </div>

        {/* Purchase orders */}
        <div className="bill-section">
          <div className="section-header"><IconClipboard /><h2>Purchase Orders</h2></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>PO Number</th><th>Date</th><th>Supplier</th><th>Items</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {!loaded || purchaseOrders.length === 0 ? (
                  <tr><td className="table-empty-row" colSpan={6}>No purchase orders yet.</td></tr>
                ) : purchaseOrders.map((po) => (
                  <tr key={po.id} className="table-row-clickable" onClick={() => setDetailPO(po)}>
                    <td className="cell-strong">{po.poNumber}</td>
                    <td className="cell-muted">{formatDate(po.date)}</td>
                    <td>{po.supplierName}</td>
                    <td className="cell-muted" style={{ maxWidth: 220, whiteSpace: 'normal' }}>{po.items.map((i) => `${i.name} (${i.qty})`).join(', ')}</td>
                    <td><span className={`status-pill ${po.status === 'Received' ? 'status-ok' : 'status-low'}`}>{po.status}</span></td>
                    <td className="cell-actions">
                      {po.status === 'Pending' && <button className="icon-btn" title="Mark Ordered" onClick={(e) => { e.stopPropagation(); markOrdered(po.id); }}><IconArrowRight /></button>}
                      {po.status === 'Ordered' && <button className="icon-btn" title="Mark Received" onClick={(e) => { e.stopPropagation(); requestReceive(po.id); }}><IconCheck /></button>}
                      <button className="icon-btn icon-btn-danger" title="Delete" onClick={(e) => { e.stopPropagation(); requestDelete(po.id); }}><IconTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---------- PO detail ---------- */}
      <Modal open={!!detailPO} onClose={() => setDetailPO(null)} title={detailPO?.poNumber || ''}>
        {detailPO && (
          <>
            <div className="po-journey">
              {STATUS_STEPS.map((step, idx) => {
                const currentIndex = STATUS_STEPS.indexOf(detailPO.status);
                const cls = idx === currentIndex ? 'po-journey-step-active' : idx < currentIndex ? 'po-journey-step-completed' : '';
                return (
                  <div key={step} className={`po-journey-step ${cls}`}>
                    <div className="po-journey-step-circle">{idx < currentIndex ? '✓' : idx + 1}</div>
                    <span className="po-journey-step-label">{step}</span>
                  </div>
                );
              })}
            </div>
            <div className="view-detail-row"><span className="view-detail-label">Supplier</span><span className="view-detail-value">{detailPO.supplierName}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Date</span><span className="view-detail-value">{formatDate(detailPO.date)}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Items</span><span className="view-detail-value">{detailPO.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</span></div>
            <div className="view-action-bar">
              {detailPO.status === 'Pending' && <button className="action-btn btn-save" onClick={() => markOrdered(detailPO.id)}><IconArrowRight size={14} /> Mark Ordered</button>}
              {detailPO.status === 'Ordered' && <button className="action-btn btn-save" onClick={() => requestReceive(detailPO.id)}><IconCheck size={14} /> Mark Received</button>}
              <button className="action-btn btn-danger" onClick={() => requestDelete(detailPO.id)}><IconTrash /> Delete</button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={receiveConfirmId !== null}
        title="Mark Received"
        message="Mark this purchase order as received? This will add the ordered quantities to stock."
        confirmLabel="Mark Received"
        onConfirm={confirmReceive}
        onCancel={() => setReceiveConfirmId(null)}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Purchase Order"
        message="Delete this purchase order? This does not reverse any stock already received."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

/* ---------- Icons ---------- */
function IconAlert() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>); }
function IconClipboard() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>); }
function IconPlusCircle() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>); }
function IconArrowRight({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>); }
function IconCheck({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>); }
function IconTrash({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>); }
