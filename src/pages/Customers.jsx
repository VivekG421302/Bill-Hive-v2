import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiSet } from '../api/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomerFormModal from '../components/CustomerFormModal';

const currency = (n, symbol = '₹') => `${symbol}${(parseFloat(n) || 0).toFixed(2)}`;
const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

function billBelongsTo(bill, customer) {
  if (bill.customerId) return bill.customerId === customer.id;
  return (bill.customerName || '').trim().toLowerCase() === customer.name.trim().toLowerCase();
}

export default function Customers() {
  const { showToast } = useToast();

  const [customers, setCustomers] = useState([]);
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({ currencySymbol: '₹' });
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [detailCustomer, setDetailCustomer] = useState(null);

  useEffect(() => {
    Promise.all([apiGet('customers'), apiGet('bills'), apiGet('settings')]).then(([c, b, s]) => {
      setCustomers(Array.isArray(c) ? c : []);
      setBills(Array.isArray(b) ? b : []);
      if (s) setSettings((prev) => ({ ...prev, ...s }));
      setLoaded(true);
    });
  }, []);

  const refreshCustomers = async () => {
    const data = await apiGet('customers');
    setCustomers(Array.isArray(data) ? data : []);
  };

  const statsFor = (customer) => {
    const custBills = bills.filter((b) => billBelongsTo(b, customer));
    const totalSpent = custBills.reduce((s, b) => s + (b.grandTotal || 0), 0);
    const outstanding = custBills.reduce((s, b) => s + (parseFloat(b.dueAmount) || 0), 0);
    const lastBill = custBills.length > 0 ? custBills.reduce((a, b) => (new Date(b.createdAt || b.invoiceDate) > new Date(a.createdAt || a.invoiceDate) ? b : a)) : null;
    return { bills: custBills, billCount: custBills.length, totalSpent, outstanding, lastDate: lastBill ? (lastBill.createdAt || lastBill.invoiceDate) : null };
  };

  const rows = useMemo(() => customers.map((c) => ({ customer: c, stats: statsFor(c) })), [customers, bills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ customer }) =>
      customer.name.toLowerCase().includes(q) ||
      (customer.phone || '').toLowerCase().includes(q) ||
      (customer.email || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => ({
    totalOutstanding: rows.reduce((s, r) => s + r.stats.outstanding, 0),
    totalCustomers: customers.length,
    totalSpentAll: rows.reduce((s, r) => s + r.stats.totalSpent, 0)
  }), [rows, customers]);

  // ---------- Add / edit ----------
  const openAdd = () => { setEditingCustomer(null); setModalOpen(true); };
  const openEdit = (c) => { setEditingCustomer(c); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  // ---------- Delete ----------
  const requestDelete = (id) => setDeleteId(id);
  const confirmDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    const next = customers.filter((c) => c.id !== id);
    setCustomers(next);
    await apiSet('customers', next);
    if (detailCustomer?.id === id) setDetailCustomer(null);
    showToast('Customer deleted');
  };

  const openDetail = (c) => setDetailCustomer(c);
  const closeDetail = () => setDetailCustomer(null);
  const editFromDetail = () => { const c = detailCustomer; setDetailCustomer(null); openEdit(c); };
  const deleteFromDetail = () => requestDelete(detailCustomer.id);

  return (
    <div>
      <h1 className="page-title">Customers</h1>
      <p className="page-subtitle">Track who you sell to, what they've bought, and what they still owe.</p>

      {!loaded ? null : customers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <IconCustomers size={40} />
            <p className="empty-state-text">No customers yet. Add customers to track their purchase history and dues here.</p>
            <button className="action-btn btn-save" onClick={openAdd}>+ Add Customer</button>
          </div>
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: 18 }}>
            <div className="stat-card"><span className="stat-label">Total Customers</span><span className="stat-value">{totals.totalCustomers}</span></div>
            <div className="stat-card"><span className="stat-label">Total Sales</span><span className="stat-value">{currency(totals.totalSpentAll, settings.currencySymbol)}</span></div>
            <div className="stat-card stat-card-highlight"><span className="stat-label">Total Outstanding</span><span className="stat-value">{currency(totals.totalOutstanding, settings.currencySymbol)}</span></div>
          </div>

          <div className="brands-toolbar">
            <div className="search-box">
              <IconSearch />
              <input type="text" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="action-btn btn-save" onClick={openAdd}>+ Add Customer</button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Bills</th><th>Total Spent</th><th>Outstanding</th><th></th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td className="table-empty-row" colSpan={6}>No customers match your search.</td></tr>
                ) : filtered.map(({ customer, stats }) => (
                  <tr key={customer.id} className="table-row-clickable" onClick={() => openDetail(customer)}>
                    <td className="cell-strong">{customer.name}</td>
                    <td className="cell-muted">{customer.phone || '—'}</td>
                    <td>{stats.billCount}</td>
                    <td>{currency(stats.totalSpent, settings.currencySymbol)}</td>
                    <td>
                      {stats.outstanding > 0
                        ? <span className="status-pill status-low">{currency(stats.outstanding, settings.currencySymbol)}</span>
                        : <span className="cell-muted">—</span>}
                    </td>
                    <td className="cell-actions">
                      <button className="icon-btn" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(customer); }}><IconEdit /></button>
                      <button className="icon-btn icon-btn-danger" title="Delete" onClick={(e) => { e.stopPropagation(); requestDelete(customer.id); }}><IconTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CustomerFormModal open={modalOpen} onClose={closeModal} customer={editingCustomer} onSaved={refreshCustomers} />

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Customer"
        message="Delete this customer? Their past bills will stay in Past Bills, just no longer linked to a saved profile."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* ---------- Detail view ---------- */}
      <Modal open={!!detailCustomer} onClose={closeDetail} title={detailCustomer?.name || ''}>
        {detailCustomer && (() => {
          const stats = statsFor(detailCustomer);
          return (
            <>
              <div className="view-detail-row"><span className="view-detail-label">Phone</span><span className="view-detail-value">{detailCustomer.phone || '—'}</span></div>
              <div className="view-detail-row"><span className="view-detail-label">Email</span><span className="view-detail-value">{detailCustomer.email || '—'}</span></div>
              <div className="view-detail-row"><span className="view-detail-label">Address</span><span className="view-detail-value">{detailCustomer.address || '—'}</span></div>
              <div className="view-detail-row"><span className="view-detail-label">Total Spent</span><span className="view-detail-value">{currency(stats.totalSpent, settings.currencySymbol)}</span></div>
              <div className="view-detail-row"><span className="view-detail-label">Outstanding Due</span><span className="view-detail-value">{currency(stats.outstanding, settings.currencySymbol)}</span></div>
              <div className="view-detail-row"><span className="view-detail-label">Last Purchase</span><span className="view-detail-value">{stats.lastDate ? formatDate(stats.lastDate) : '—'}</span></div>
              {detailCustomer.notes && <div className="view-detail-row"><span className="view-detail-label">Notes</span><span className="view-detail-value">{detailCustomer.notes}</span></div>}

              <div className="section-header" style={{ marginTop: 18 }}><IconBills /><h2>Purchase History</h2></div>
              {stats.bills.length === 0 ? (
                <p className="empty-state-text" style={{ margin: 0 }}>No bills yet for this customer.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Invoice</th><th>Date</th><th>Amount</th><th>Due</th></tr></thead>
                    <tbody>
                      {[...stats.bills].reverse().map((b) => (
                        <tr key={b.id}>
                          <td className="cell-strong">{b.invoiceNo}</td>
                          <td className="cell-muted">{formatDate(b.invoiceDate)}</td>
                          <td>{currency(b.grandTotal, settings.currencySymbol)}</td>
                          <td>{parseFloat(b.dueAmount) > 0 ? currency(b.dueAmount, settings.currencySymbol) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="view-action-bar">
                <button className="action-btn btn-save" onClick={editFromDetail}><IconEdit size={14} /> Edit</button>
                <button className="action-btn btn-danger" onClick={deleteFromDetail}><IconTrash /> Delete</button>
              </div>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}

/* ---------- Icons ---------- */
function IconCustomers({ size = 22 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>); }
function IconSearch() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" /><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>); }
function IconEdit({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" strokeLinejoin="round" /></svg>); }
function IconTrash({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>); }
function IconBills() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" strokeLinejoin="round" /></svg>); }
