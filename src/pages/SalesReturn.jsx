import { useEffect, useMemo, useState } from 'react';
import { dbGet, dbSet } from '../db/indexedDB';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

const currency = (n, symbol = '₹') => `${symbol}${(parseFloat(n) || 0).toFixed(2)}`;
const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function SalesReturn() {
  const { showToast } = useToast();

  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [settings, setSettings] = useState({ currencySymbol: '₹' });
  const [loaded, setLoaded] = useState(false);

  const [selectedBillId, setSelectedBillId] = useState('');
  const [checked, setChecked] = useState({});
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState('');
  const [damagedStock, setDamagedStock] = useState(false);

  const [viewReturn, setViewReturn] = useState(null);

  useEffect(() => {
    Promise.all([dbGet('bills'), dbGet('returns'), dbGet('items'), dbGet('settings')]).then(([b, r, it, s]) => {
      setBills(Array.isArray(b) ? b : []);
      setReturns(Array.isArray(r) ? r : []);
      setCatalogItems(Array.isArray(it) ? it : []);
      if (s) setSettings((prev) => ({ ...prev, ...s }));
      setLoaded(true);
    });
  }, []);

  const getReturnedQtyMap = (billId) => {
    const map = {};
    returns.filter((r) => r.billId === billId).forEach((r) => {
      r.items.forEach((i) => { map[i.name] = (map[i.name] || 0) + (parseFloat(i.qty) || 0); });
    });
    return map;
  };

  const isBillFullyReturned = (bill) => {
    const map = getReturnedQtyMap(bill.id);
    return bill.lineItems.every((item) => (map[item.name] || 0) >= (parseFloat(item.qty) || 0) - 1e-9);
  };

  const selectableBills = useMemo(
    () => [...bills].reverse().filter((b) => !isBillFullyReturned(b)),
    [bills, returns]
  );

  const selectedBill = useMemo(() => bills.find((b) => b.id === Number(selectedBillId)), [bills, selectedBillId]);

  const returnableRows = useMemo(() => {
    if (!selectedBill) return [];
    const returnedMap = getReturnedQtyMap(selectedBill.id);
    return selectedBill.lineItems
      .map((item, idx) => {
        const already = returnedMap[item.name] || 0;
        const remaining = Math.max(0, (parseFloat(item.qty) || 0) - already);
        return { item, idx, remaining };
      })
      .filter((r) => r.remaining > 0);
  }, [selectedBill, returns]);

  const selectBill = (id) => {
    setSelectedBillId(id);
    setChecked({});
    setQty({});
    setReason('');
    setDamagedStock(false);
    if (id) {
      const bill = bills.find((b) => b.id === Number(id));
      if (bill) {
        const returnedMap = getReturnedQtyMap(bill.id);
        const initialQty = {};
        bill.lineItems.forEach((item, idx) => {
          const remaining = Math.max(0, (parseFloat(item.qty) || 0) - (returnedMap[item.name] || 0));
          if (remaining > 0) initialQty[idx] = remaining;
        });
        setQty(initialQty);
      }
    }
  };

  const toggleCheck = (idx) => setChecked((c) => ({ ...c, [idx]: !c[idx] }));
  const setRowQty = (idx, value, max) => setQty((q) => ({ ...q, [idx]: Math.min(parseFloat(value) || 0, max) }));

  const refundAmount = useMemo(() => {
    if (!selectedBill) return 0;
    let refund = 0;
    returnableRows.forEach(({ item, idx }) => {
      if (!checked[idx]) return;
      const returnQty = Math.min(qty[idx] || 0, item.qty);
      const perUnit = item.total / (parseFloat(item.qty) || 1);
      refund += perUnit * returnQty;
    });
    return refund;
  }, [checked, qty, returnableRows, selectedBill]);

  const processReturn = async () => {
    if (!selectedBill) return;
    const returnedItems = [];
    let refund = 0;
    const nextItems = [...catalogItems];
    const newLogEntries = [];

    returnableRows.forEach(({ item, idx }) => {
      if (!checked[idx]) return;
      const returnQty = Math.min(qty[idx] || 0, item.qty);
      if (returnQty <= 0) return;
      const perUnit = item.total / (parseFloat(item.qty) || 1);
      const amount = perUnit * returnQty;
      refund += amount;
      returnedItems.push({ name: item.name, qty: returnQty, amount, itemId: item.itemId || null });

      if (item.itemId) {
        const ci = nextItems.find((it) => it.id === item.itemId);
        if (ci && ci.trackStock !== false) {
          if (!damagedStock) {
            ci.stock = (ci.stock || 0) + returnQty;
            newLogEntries.push({ id: Date.now() + Math.random(), date: new Date().toISOString(), itemId: ci.id, itemName: ci.name, type: 'Sales Return', qty: returnQty, reference: selectedBill.invoiceNo });
          } else {
            newLogEntries.push({ id: Date.now() + Math.random(), date: new Date().toISOString(), itemId: ci.id, itemName: ci.name, type: 'Sales Return', qty: returnQty, reference: selectedBill.invoiceNo });
            newLogEntries.push({ id: Date.now() + Math.random(), date: new Date().toISOString(), itemId: ci.id, itemName: ci.name, type: 'Damaged (not added to inventory)', qty: -returnQty, reference: 'Damaged stock from return' });
          }
        }
      }
    });

    if (returnedItems.length === 0) {
      showToast('Select at least one item to return');
      return;
    }

    const returnRecord = {
      id: Date.now(),
      date: new Date().toISOString(),
      billId: selectedBill.id,
      invoiceNo: selectedBill.invoiceNo,
      customerName: selectedBill.customerName,
      items: returnedItems,
      refundAmount: refund,
      reason: reason.trim(),
      damagedStock: !!damagedStock
    };

    const nextReturns = [...returns, returnRecord];
    setReturns(nextReturns);
    await dbSet('returns', nextReturns);

    if (newLogEntries.length > 0) {
      setCatalogItems(nextItems);
      await dbSet('items', nextItems);
      const stockLog = (await dbGet('stockLog')) || [];
      await dbSet('stockLog', [...newLogEntries, ...stockLog].slice(0, 200));
    }

    showToast(`Return processed — refund ${currency(refund, settings.currencySymbol)}${damagedStock ? ' (logged as damaged)' : ''}`);
    selectBill('');
  };

  const reversedReturns = useMemo(() => [...returns].reverse(), [returns]);

  return (
    <div>
      <h1 className="page-title">Sales Return</h1>
      <p className="page-subtitle">Process returns and refunds against a saved bill.</p>

      <div className="bill-container">
        <div className="bill-section">
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Select Bill</label>
              <select value={selectedBillId} onChange={(e) => selectBill(e.target.value)}>
                <option value="">-- Select an invoice --</option>
                {selectableBills.map((b) => (
                  <option key={b.id} value={b.id}>{b.invoiceNo} — {b.customerName} — {currency(b.grandTotal, settings.currencySymbol)}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedBill && returnableRows.length > 0 && (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Return</th><th>Item</th><th>Remaining Qty</th><th>Return Qty</th><th>Amount</th></tr></thead>
                  <tbody>
                    {returnableRows.map(({ item, idx, remaining }) => (
                      <tr key={idx}>
                        <td><input type="checkbox" checked={!!checked[idx]} onChange={() => toggleCheck(idx)} /></td>
                        <td className="cell-strong">{item.name}</td>
                        <td className="cell-muted">{remaining}</td>
                        <td>
                          <input
                            type="number" min="0" max={remaining} step="0.01" style={{ width: 80 }}
                            value={qty[idx] ?? remaining}
                            onChange={(e) => setRowQty(idx, e.target.value, remaining)}
                          />
                        </td>
                        <td>{currency(item.total, settings.currencySymbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="totals-grid" style={{ marginTop: 14 }}>
                <div className="total-row grand-total">
                  <span className="total-label">Refund Amount</span>
                  <span className="total-value">{currency(refundAmount, settings.currencySymbol)}</span>
                </div>
              </div>

              <div className="form-group full-width" style={{ marginTop: 12 }}>
                <label>Reason</label>
                <textarea rows={2} placeholder="Reason for return (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>

              <label className="return-damaged-row">
                <input type="checkbox" checked={damagedStock} onChange={(e) => setDamagedStock(e.target.checked)} />
                <span>Don't add to inventory (log as damaged stock)</span>
              </label>

              <button className="action-btn btn-save" style={{ marginTop: 14 }} onClick={processReturn}>
                <IconReturn /> Process Return
              </button>
            </>
          )}
        </div>

        <div className="bill-section">
          <div className="section-header"><IconReturn /><h2>Past Returns</h2></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Refund</th></tr></thead>
              <tbody>
                {!loaded || reversedReturns.length === 0 ? (
                  <tr><td className="table-empty-row" colSpan={4}>No returns yet</td></tr>
                ) : reversedReturns.map((r) => (
                  <tr key={r.id} className="table-row-clickable" onClick={() => setViewReturn(r)}>
                    <td className="cell-muted">{formatDate(r.date)}</td>
                    <td className="cell-strong">{r.invoiceNo}</td>
                    <td>{r.customerName}</td>
                    <td>{currency(r.refundAmount, settings.currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={!!viewReturn} onClose={() => setViewReturn(null)} title={viewReturn ? `Return — ${viewReturn.invoiceNo}` : ''}>
        {viewReturn && (
          <>
            <div className="view-detail-row"><span className="view-detail-label">Date</span><span className="view-detail-value">{formatDate(viewReturn.date)}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Invoice</span><span className="view-detail-value">{viewReturn.invoiceNo}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Customer</span><span className="view-detail-value">{viewReturn.customerName || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Items</span><span className="view-detail-value">{viewReturn.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Refund</span><span className="view-detail-value">{currency(viewReturn.refundAmount, settings.currencySymbol)}</span></div>
            {viewReturn.damagedStock && <div className="view-detail-row"><span className="view-detail-label">Damaged Stock</span><span className="view-detail-value">Yes — not restocked</span></div>}
            {viewReturn.reason && <div className="view-detail-row"><span className="view-detail-label">Reason</span><span className="view-detail-value">{viewReturn.reason}</span></div>}
          </>
        )}
      </Modal>
    </div>
  );
}

function IconReturn() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>);
}
