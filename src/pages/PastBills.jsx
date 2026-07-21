import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbGet, dbSet } from '../db/indexedDB';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { buildPosBillHtml, printPosBill, buildPrintConfig } from '../utils/posReceipt';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom' }
];

const currency = (n, symbol = '₹') => `${symbol}${(parseFloat(n) || 0).toFixed(2)}`;
const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

function billDateLabel(bill) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfToday.getDate() - 1);
  const d = new Date(bill.createdAt || bill.invoiceDate);
  if (d >= startOfToday) return 'Today';
  if (d >= startOfYesterday) return 'Yesterday';
  return formatDate(bill.invoiceDate || (bill.createdAt || '').slice(0, 10));
}

export default function PastBills() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({ currencySymbol: '₹' });
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [detailBill, setDetailBill] = useState(null);
  const [previewBill, setPreviewBill] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    Promise.all([dbGet('bills'), dbGet('settings')]).then(([b, s]) => {
      setBills(Array.isArray(b) ? b : []);
      if (s) setSettings((prev) => ({ ...prev, ...s }));
      setLoaded(true);
    });
  }, []);

  const matchesDateFilter = (bill) => {
    if (dateFilter === 'all') return true;
    const d = new Date(bill.createdAt || bill.invoiceDate);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateFilter === 'today') return d >= startOfDay;
    if (dateFilter === 'week') {
      const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      return d >= startOfWeek;
    }
    if (dateFilter === 'month') return d >= new Date(now.getFullYear(), now.getMonth(), 1);
    if (dateFilter === 'year') return d >= new Date(now.getFullYear(), 0, 1);
    if (dateFilter === 'custom') {
      const dStr = bill.invoiceDate || (bill.createdAt || '').slice(0, 10);
      if (dateFrom && dStr < dateFrom) return false;
      if (dateTo && dStr > dateTo) return false;
      return true;
    }
    return true;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...bills].reverse().filter((b) => {
      const matchQuery = !q || (b.customerName || '').toLowerCase().includes(q) || (b.invoiceNo || '').toLowerCase().includes(q);
      return matchQuery && matchesDateFilter(b);
    });
  }, [bills, search, dateFilter, dateFrom, dateTo]);

  // group with date separators
  const rows = useMemo(() => {
    let lastLabel = null;
    const out = [];
    filtered.forEach((b) => {
      const label = billDateLabel(b);
      if (label !== lastLabel) { out.push({ type: 'sep', label, key: `sep-${label}-${b.id}` }); lastLabel = label; }
      out.push({ type: 'bill', bill: b, key: b.id });
    });
    return out;
  }, [filtered]);

  const findBill = (id) => bills.find((b) => b.id === id);

  const openDetail = (bill) => setDetailBill(bill);
  const closeDetail = () => setDetailBill(null);

  const openPreview = (bill) => setPreviewBill(bill);
  const closePreview = () => setPreviewBill(null);

  const reprint = (bill) => printPosBill(bill, buildPrintConfig(settings.print));

  const requestDelete = (id) => setDeleteId(id);
  const confirmDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    const next = bills.filter((b) => b.id !== id);
    setBills(next);
    await dbSet('bills', next);
    if (detailBill?.id === id) setDetailBill(null);
    showToast('Bill deleted');
  };

  return (
    <div>
      <h1 className="page-title">Past Bills</h1>
      <p className="page-subtitle">View and manage your previous invoices.</p>

      {!loaded ? null : bills.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <IconBills size={40} />
            <p className="empty-state-text">No bills saved yet. Bills you save will appear here.</p>
            <button className="action-btn btn-save" onClick={() => navigate('/create-bill')}>+ Create Bill</button>
          </div>
        </div>
      ) : (
        <>
          <div className="brands-toolbar">
            <div className="search-box">
              <IconSearch />
              <input type="text" placeholder="Search by customer or invoice no..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="bills-filter-bar">
            {FILTERS.map((f) => (
              <button key={f.id} className={`filter-btn${dateFilter === f.id ? ' active' : ''}`} onClick={() => setDateFilter(f.id)}>{f.label}</button>
            ))}
            {dateFilter === 'custom' && (
              <div className="filter-date-range">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>to</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            )}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Amount</th><th>Payment</th><th></th></tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td className="table-empty-row" colSpan={6}>No bills match your filters.</td></tr>
                ) : rows.map((r) => r.type === 'sep' ? (
                  <tr key={r.key} className="bills-date-separator"><td colSpan={6}>{r.label}</td></tr>
                ) : (
                  <tr key={r.key} className="table-row-clickable" onClick={() => openDetail(r.bill)}>
                    <td className="cell-strong">{r.bill.invoiceNo}</td>
                    <td className="cell-muted">{formatDate(r.bill.invoiceDate)}</td>
                    <td>{r.bill.customerName}</td>
                    <td>{currency(r.bill.grandTotal, settings.currencySymbol)}</td>
                    <td><span className="status-pill status-ok">{(r.bill.paymentMode || '').toUpperCase()}</span></td>
                    <td className="cell-actions">
                      <button className="icon-btn" title="Preview" onClick={(e) => { e.stopPropagation(); openPreview(r.bill); }}><IconEye /></button>
                      <button className="icon-btn" title="Print" onClick={(e) => { e.stopPropagation(); reprint(r.bill); }}><IconPrinter /></button>
                      <button className="icon-btn icon-btn-danger" title="Delete" onClick={(e) => { e.stopPropagation(); requestDelete(r.bill.id); }}><IconTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---------- Bill detail modal ---------- */}
      <Modal open={!!detailBill} onClose={closeDetail} title={detailBill ? `Invoice ${detailBill.invoiceNo}` : ''}>
        {detailBill && (
          <>
            <div className="view-detail-row"><span className="view-detail-label">Invoice No</span><span className="view-detail-value">{detailBill.invoiceNo}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Date</span><span className="view-detail-value">{formatDate(detailBill.invoiceDate)}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Customer</span><span className="view-detail-value">{detailBill.customerName || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Contact</span><span className="view-detail-value">{detailBill.customerContact || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Payment</span><span className="view-detail-value">{(detailBill.paymentMode || '—').toUpperCase()}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Grand Total</span><span className="view-detail-value">{currency(detailBill.grandTotal, settings.currencySymbol)}</span></div>
            {parseFloat(detailBill.dueAmount) > 0 && (
              <div className="view-detail-row"><span className="view-detail-label">Outstanding Due</span><span className="view-detail-value" style={{ color: 'var(--accent-danger)' }}>{currency(detailBill.dueAmount, settings.currencySymbol)}</span></div>
            )}
            <div className="view-detail-row"><span className="view-detail-label">Items</span><span className="view-detail-value">{(detailBill.lineItems || []).map((i) => `${i.name} × ${i.qty}`).join(', ')}</span></div>
            {detailBill.notes && <div className="view-detail-row"><span className="view-detail-label">Notes</span><span className="view-detail-value">{detailBill.notes}</span></div>}
            <div className="view-action-bar">
              <button className="action-btn btn-save" onClick={() => openPreview(detailBill)}><IconEye size={14} /> Preview</button>
              <button className="action-btn btn-outline" onClick={() => reprint(detailBill)}><IconPrinter size={14} /> Print</button>
              <button className="action-btn btn-danger" onClick={() => requestDelete(detailBill.id)}><IconTrash /> Delete</button>
            </div>
          </>
        )}
      </Modal>

      {/* ---------- Receipt preview ---------- */}
      <Modal
        open={!!previewBill}
        onClose={closePreview}
        title="Bill Preview"
        zIndex={1300}
        footer={
          <>
            <button className="action-btn btn-save" onClick={() => reprint(previewBill)}><IconPrinter /> Print</button>
            <button className="action-btn btn-outline" onClick={closePreview}>Close</button>
          </>
        }
      >
        {previewBill && (
          <div className="pos-preview-wrap">
            <div dangerouslySetInnerHTML={{ __html: buildPosBillHtml(previewBill, buildPrintConfig(settings.print)) }} />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Bill"
        message="Delete this bill permanently? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

/* ---------- Icons ---------- */
function IconBills({ size = 22 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" strokeLinejoin="round" /></svg>); }
function IconSearch() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" /><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>); }
function IconEye({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>); }
function IconPrinter({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>); }
function IconTrash({ size = 15 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>); }
