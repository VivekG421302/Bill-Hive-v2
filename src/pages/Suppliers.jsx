import { useEffect, useMemo, useState } from 'react';
import { dbGet, dbSet } from '../db/indexedDB';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const EMPTY_FORM = { name: '', contactPerson: '', phone: '', email: '', address: '', itemsSupplied: '', notes: '', itemIds: [] };

export default function Suppliers() {
  const { showToast } = useToast();

  const [suppliers, setSuppliers] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [itemPicker, setItemPicker] = useState('');

  const [deleteId, setDeleteId] = useState(null);
  const [detailSupplier, setDetailSupplier] = useState(null);

  useEffect(() => {
    Promise.all([dbGet('suppliers'), dbGet('items')]).then(([s, it]) => {
      setSuppliers(Array.isArray(s) ? s : []);
      setCatalogItems(Array.isArray(it) ? it : []);
      setLoaded(true);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.contactPerson || '').toLowerCase().includes(q) ||
      (s.itemsSupplied || '').toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const persist = async (next) => {
    setSuppliers(next);
    await dbSet('suppliers', next);
  };

  // ---------- Add / edit modal ----------
  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setItemPicker('');
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      name: s.name || '', contactPerson: s.contactPerson || '', phone: s.phone || '', email: s.email || '',
      address: s.address || '', itemsSupplied: s.itemsSupplied || '', notes: s.notes || '', itemIds: [...(s.itemIds || [])]
    });
    setItemPicker('');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const addItemLink = () => {
    if (!itemPicker) return;
    const id = Number(itemPicker);
    if (form.itemIds.includes(id)) { showToast('Item already linked'); return; }
    setForm((f) => ({ ...f, itemIds: [...f.itemIds, id] }));
    setItemPicker('');
  };
  const removeItemLink = (id) => setForm((f) => ({ ...f, itemIds: f.itemIds.filter((x) => x !== id) }));

  const saveSupplier = async () => {
    const name = form.name.trim();
    if (!name) {
      showToast('Supplier name is required');
      return;
    }
    const data = {
      name,
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      itemsSupplied: form.itemsSupplied.trim(),
      notes: form.notes.trim(),
      itemIds: [...form.itemIds]
    };

    if (editingId) {
      await persist(suppliers.map((s) => (s.id === editingId ? { ...s, ...data } : s)));
    } else {
      const id = suppliers.reduce((max, s) => Math.max(max, s.id || 0), 0) + 1;
      await persist([...suppliers, { id, ...data }]);
    }
    setModalOpen(false);
    showToast('Supplier saved');
  };

  // ---------- Delete ----------
  const requestDelete = (id) => setDeleteId(id);
  const confirmDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    await persist(suppliers.filter((s) => s.id !== id));
    if (detailSupplier?.id === id) setDetailSupplier(null);
    showToast('Supplier deleted');
  };

  // ---------- View / print ----------
  const openDetail = (s) => setDetailSupplier(s);
  const closeDetail = () => setDetailSupplier(null);
  const editFromDetail = () => { const s = detailSupplier; setDetailSupplier(null); openEdit(s); };
  const deleteFromDetail = () => requestDelete(detailSupplier.id);

  const printSupplier = (s) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>${s.name} — Supplier</title>
      <style>body{font-family:'Courier New',monospace;font-weight:700;padding:24px;color:#000;}
      h2{border-bottom:2px solid #000;padding-bottom:8px;}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #999;font-size:13px;}</style></head>
      <body>
        <h2>${s.name}</h2>
        <div class="row"><span>Contact Person</span><span>${s.contactPerson || '—'}</span></div>
        <div class="row"><span>Phone</span><span>${s.phone || '—'}</span></div>
        <div class="row"><span>Email</span><span>${s.email || '—'}</span></div>
        <div class="row"><span>Address</span><span>${s.address || '—'}</span></div>
        <div class="row"><span>Items Supplied</span><span>${s.itemsSupplied || '—'}</span></div>
        <script>window.onload=function(){setTimeout(function(){window.print();},200);};</script>
      </body></html>
    `);
    win.document.close();
  };

  const linkedItemNames = (s) => (s.itemIds || []).map((id) => catalogItems.find((it) => it.id === id)?.name).filter(Boolean);

  return (
    <div>
      <h1 className="page-title">Suppliers</h1>
      <p className="page-subtitle">Manage the vendors you purchase stock from.</p>

      {!loaded ? null : suppliers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <IconSuppliers size={40} />
            <p className="empty-state-text">No suppliers yet. Add the vendors you buy stock from.</p>
            <button className="action-btn btn-save" onClick={openAdd}>+ Add Supplier</button>
          </div>
        </div>
      ) : (
        <>
          <div className="brands-toolbar">
            <div className="search-box">
              <IconSearch />
              <input type="text" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="action-btn btn-save" onClick={openAdd}>+ Add Supplier</button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Contact Person</th><th>Phone</th><th>Items Supplied</th><th></th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td className="table-empty-row" colSpan={5}>No suppliers match your search.</td></tr>
                ) : filtered.map((s) => (
                  <tr key={s.id} className="table-row-clickable" onClick={() => openDetail(s)}>
                    <td className="cell-strong">{s.name}</td>
                    <td className="cell-muted">{s.contactPerson || '—'}</td>
                    <td className="cell-muted">{s.phone || '—'}</td>
                    <td className="cell-muted">{s.itemsSupplied || '—'}</td>
                    <td className="cell-actions">
                      <button className="icon-btn" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(s); }}><IconEdit /></button>
                      <button className="icon-btn icon-btn-danger" title="Delete" onClick={(e) => { e.stopPropagation(); requestDelete(s.id); }}><IconTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---------- Add / Edit modal ---------- */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Supplier' : 'Add Supplier'}
        footer={
          <>
            <button className="action-btn btn-save" onClick={saveSupplier}>Save Supplier</button>
            <button className="action-btn btn-outline" onClick={closeModal}>Cancel</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group full-width">
            <label>Supplier / Company Name <span className="required">*</span></label>
            <input type="text" placeholder="e.g., Shree Textiles Pvt. Ltd." value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Contact Person</label>
            <input type="text" placeholder="e.g., Rajesh Kumar" value={form.contactPerson} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" placeholder="Contact number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="form-group full-width">
            <label>Email</label>
            <input type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group full-width">
            <label>Address</label>
            <textarea rows={2} placeholder="Supplier address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="form-group full-width">
            <label>Items Supplied <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(free text summary)</span></label>
            <input type="text" placeholder="e.g., Cotton fabric, buttons, thread" value={form.itemsSupplied} onChange={(e) => setForm((f) => ({ ...f, itemsSupplied: e.target.value }))} />
          </div>
          <div className="form-group full-width">
            <label>Linked Catalogue Items <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(what this supplier deals in, from your Items catalog)</span></label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select value={itemPicker} onChange={(e) => setItemPicker(e.target.value)} style={{ flex: 1 }}>
                <option value="">— Pick an item to link —</option>
                {catalogItems.filter((it) => !form.itemIds.includes(it.id)).map((it) => (
                  <option key={it.id} value={it.id}>{it.name}</option>
                ))}
              </select>
              <button type="button" className="action-btn btn-outline" style={{ flexShrink: 0 }} onClick={addItemLink}>Add</button>
            </div>
            <div className="linked-item-chips">
              {form.itemIds.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No catalogue items linked yet.</span>
              ) : form.itemIds.map((id) => {
                const it = catalogItems.find((i) => i.id === id);
                if (!it) return null;
                return (
                  <span className="linked-item-chip" key={id}>
                    {it.name}
                    <button type="button" onClick={() => removeItemLink(id)} title="Remove">✕</button>
                  </span>
                );
              })}
            </div>
          </div>
          <div className="form-group full-width">
            <label>Notes</label>
            <textarea rows={2} placeholder="Payment terms, lead times, etc. (optional)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Supplier"
        message="Delete this supplier? Existing purchase orders will keep their saved supplier name."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* ---------- Detail view ---------- */}
      <Modal open={!!detailSupplier} onClose={closeDetail} title={detailSupplier?.name || ''}>
        {detailSupplier && (
          <>
            <div className="view-detail-row"><span className="view-detail-label">Contact Person</span><span className="view-detail-value">{detailSupplier.contactPerson || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Phone</span><span className="view-detail-value">{detailSupplier.phone || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Email</span><span className="view-detail-value">{detailSupplier.email || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Address</span><span className="view-detail-value">{detailSupplier.address || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Items Supplied</span><span className="view-detail-value">{detailSupplier.itemsSupplied || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Notes</span><span className="view-detail-value">{detailSupplier.notes || '—'}</span></div>
            {linkedItemNames(detailSupplier).length > 0 && (
              <div className="view-detail-row"><span className="view-detail-label">Catalogue Items</span><span className="view-detail-value">{linkedItemNames(detailSupplier).join(', ')}</span></div>
            )}
            <div className="view-action-bar">
              <button className="action-btn btn-save" onClick={editFromDetail}><IconEdit size={14} /> Edit</button>
              <button className="action-btn btn-outline" onClick={() => printSupplier(detailSupplier)}><IconPrinter size={14} /> Print</button>
              <button className="action-btn btn-danger" onClick={deleteFromDetail}><IconTrash /> Delete</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ---------- Icons ---------- */
function IconSuppliers({ size = 22 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 3v5h-7V8z" strokeLinejoin="round" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>); }
function IconSearch() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" /><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>); }
function IconEdit({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" strokeLinejoin="round" /></svg>); }
function IconTrash({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>); }
function IconPrinter({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>); }
