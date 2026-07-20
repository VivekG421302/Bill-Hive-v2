import { useEffect, useMemo, useRef, useState } from 'react';
import { dbGet, dbSet } from '../db/indexedDB';
import { useToast } from '../context/ToastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { buildPosBillHtml, printPosBill, buildPrintConfig } from '../utils/posReceipt';

const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash', icon: IconCash },
  { id: 'card', label: 'Card', icon: IconCard },
  { id: 'bank', label: 'Bank', icon: IconBank },
  { id: 'upi', label: 'UPI', icon: IconUpi }
];

function calcLine(item) {
  const qty = parseFloat(item.qty) || 0;
  const price = parseFloat(item.price) || 0;
  const discount = parseFloat(item.discount) || 0;
  const tax = parseFloat(item.tax) || 0;
  const amountBeforeDiscount = qty * price;
  const discountAmount = amountBeforeDiscount * (discount / 100);
  const amountAfterDiscount = amountBeforeDiscount - discountAmount;
  const taxAmount = amountAfterDiscount * (tax / 100);
  return { ...item, amountBeforeDiscount, discountAmount, taxAmount, total: amountAfterDiscount + taxAmount };
}

let lineIdCounter = 0;
function newLine(data = null) {
  lineIdCounter += 1;
  return calcLine({
    id: lineIdCounter,
    name: data?.name || '',
    qty: data?.qty ?? 1,
    price: data?.price ?? 0,
    discount: data?.discount ?? 0,
    tax: data?.tax ?? 0,
    itemId: data?.itemId ?? null
  });
}

async function generateInvoiceNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const key = yy + mm;
  const meta = (await dbGet('invoiceMeta')) || {};
  meta[key] = (meta[key] || 0) + 1;
  await dbSet('invoiceMeta', meta);
  return key + String(meta[key]).padStart(2, '0');
}

const today = () => new Date().toISOString().split('T')[0];
const currency = (n, symbol = '₹') => `${symbol}${(parseFloat(n) || 0).toFixed(2)}`;

export default function CreateBill() {
  const { showToast } = useToast();

  const [catalogItems, setCatalogItems] = useState([]);
  const [company, setCompany] = useState({});
  const [settings, setSettings] = useState({ currencySymbol: '₹', thankYouMessages: '', termsConditions: '' });

  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [dueAmount, setDueAmount] = useState('');
  const [dueAmountManual, setDueAmountManual] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [lineItems, setLineItems] = useState([]);

  const [suggestFor, setSuggestFor] = useState(null); // line id whose dropdown is open
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const blurTimer = useRef(null);

  useEffect(() => {
    Promise.all([dbGet('items'), dbGet('company'), dbGet('settings')]).then(([it, co, se]) => {
      setCatalogItems(Array.isArray(it) ? it : []);
      setCompany(co || {});
      setSettings((s) => ({ ...s, ...(se || {}) }));
    });
    generateInvoiceNumber().then(setInvoiceNo);
    setLineItems([newLine()]);
  }, []);

  const totals = useMemo(() => {
    const billAmount = lineItems.reduce((s, i) => s + (i.amountBeforeDiscount || 0), 0);
    const discountAmount = lineItems.reduce((s, i) => s + (i.discountAmount || 0), 0);
    const taxAmount = lineItems.reduce((s, i) => s + (i.taxAmount || 0), 0);
    return { billAmount, discountAmount, taxAmount, grandTotal: billAmount - discountAmount + taxAmount };
  }, [lineItems]);

  useEffect(() => {
    if (!dueAmountManual) setDueAmount(totals.grandTotal.toFixed(2));
  }, [totals.grandTotal, dueAmountManual]);

  // ---------- Line items ----------
  const addLineItem = () => setLineItems((li) => [...li, newLine()]);
  const removeLineItem = (id) => setLineItems((li) => li.filter((i) => i.id !== id));
  const updateLineField = (id, field, value) => {
    setLineItems((li) => li.map((i) => (i.id === id ? calcLine({ ...i, [field]: value }) : i)));
  };

  const handleNameInput = (id, value) => {
    setLineItems((li) => li.map((i) => (i.id === id ? { ...i, name: value, itemId: null } : i)));
    setSuggestFor(id);
  };

  const applySuggestion = (id, catalogItem) => {
    setLineItems((li) => li.map((i) => (i.id === id
      ? calcLine({ ...i, name: catalogItem.name, price: catalogItem.price, discount: catalogItem.discount, tax: catalogItem.tax, itemId: catalogItem.id })
      : i)));
    setSuggestFor(null);
  };

  const handleNameBlur = () => {
    blurTimer.current = setTimeout(() => setSuggestFor(null), 150);
  };
  const cancelBlur = () => { if (blurTimer.current) clearTimeout(blurTimer.current); };

  const suggestionsForLine = (line) => {
    const q = (line.name || '').trim().toLowerCase();
    const matches = (q ? catalogItems.filter((it) => it.name.toLowerCase().includes(q)) : catalogItems).slice(0, 8);
    return matches;
  };

  // ---------- Payment ----------
  // (paymentMode state set directly by buttons)

  // ---------- Validation / assembly ----------
  const validate = () => {
    if (!customerName.trim()) {
      showToast('Please enter customer name');
      return false;
    }
    if (lineItems.length === 0) {
      showToast('Please add at least one item');
      return false;
    }
    for (const item of lineItems) {
      if (!item.name.trim()) {
        showToast('Please enter item names for all line items');
        return false;
      }
    }
    return true;
  };

  const getBillData = () => ({
    invoiceNo, invoiceDate, dueDate, customerName, customerContact, deliveryAddress,
    lineItems: [...lineItems],
    billAmount: totals.billAmount, discountAmount: totals.discountAmount, taxAmount: totals.taxAmount, grandTotal: totals.grandTotal,
    paymentMode, notes,
    companyData: { ...company }, settings: { ...settings }
  });

  // ---------- Reset / clear ----------
  const resetForNext = async () => {
    setLineItems([newLine()]);
    setCustomerName('');
    setCustomerContact('');
    setDueDate(today());
    setDueAmount('');
    setDueAmountManual(false);
    setDeliveryAddress('');
    setNotes('');
    setPaymentMode('cash');
    setInvoiceNo(await generateInvoiceNumber());
  };

  const doClear = async () => {
    setClearConfirmOpen(false);
    setLineItems([]);
    setCustomerName('');
    setCustomerContact('');
    setDueDate('');
    setDueAmount('');
    setDueAmountManual(false);
    setDeliveryAddress('');
    setNotes('');
    setInvoiceNo(await generateInvoiceNumber());
    showToast('Bill cleared');
  };
  const clearBill = () => {
    if (lineItems.length > 0) setClearConfirmOpen(true);
    else doClear();
  };

  // ---------- Save ----------
  const saveBill = async () => {
    if (!validate()) return null;

    const billData = getBillData();
    billData.id = Date.now();
    billData.createdAt = new Date().toISOString();

    const bills = (await dbGet('bills')) || [];
    await dbSet('bills', [...bills, billData]);

    // Decrement stock for catalog-linked, tracked items + log the movement
    const nextItems = [...catalogItems];
    const stockLog = (await dbGet('stockLog')) || [];
    const newLogEntries = [];
    billData.lineItems.forEach((li) => {
      if (!li.itemId) return;
      const idx = nextItems.findIndex((it) => it.id === li.itemId);
      if (idx === -1) return;
      const catalogItem = nextItems[idx];
      if (catalogItem.trackStock === false) return;
      const qty = parseFloat(li.qty) || 0;
      const newStock = Math.max(0, (catalogItem.stock || 0) - qty);
      nextItems[idx] = { ...catalogItem, stock: newStock };
      newLogEntries.push({ id: Date.now() + Math.random(), date: new Date().toISOString(), itemId: catalogItem.id, itemName: catalogItem.name, type: 'Sale', qty: -qty, reference: billData.invoiceNo });
    });
    if (newLogEntries.length > 0) {
      setCatalogItems(nextItems);
      await dbSet('items', nextItems);
      const nextLog = [...newLogEntries, ...stockLog].slice(0, 200);
      await dbSet('stockLog', nextLog);
    }

    showToast('Bill saved successfully!');
    await resetForNext();
    return billData;
  };

  const saveAndPrint = async () => {
    const billData = await saveBill();
    if (!billData) return;
    setTimeout(() => printPosBill(billData, buildPrintConfig(settings.print)), 300);
  };

  const previewBill = () => {
    if (!validate()) return;
    setPreviewData(getBillData());
  };

  const closePreview = () => setPreviewData(null);
  const printFromPreview = () => {
    if (previewData) printPosBill(previewData, buildPrintConfig(settings.print));
    closePreview();
  };

  return (
    <div>
      <h1 className="page-title">Create Bill</h1>
      <p className="page-subtitle">Build an invoice and save, print, or preview it.</p>

      <div className="bill-container">
        {/* Bill To */}
        <div className="bill-section">
          <div className="section-header"><IconUser /><h2>Bill To</h2></div>
          <div className="form-grid">
            <div className="form-group">
              <label>Customer Name <span className="required">*</span></label>
              <input type="text" placeholder="Enter customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Contact Number</label>
              <input type="tel" placeholder="Enter contact number" value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Invoice No. <span className="required">*</span></label>
              <input type="text" readOnly value={invoiceNo} />
            </div>
            <div className="form-group">
              <label>Invoice Date <span className="required">*</span></label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Due Amount</label>
              <input type="number" step="0.01" placeholder="Auto-filled from total" value={dueAmount}
                onChange={(e) => { setDueAmount(e.target.value); setDueAmountManual(true); }} />
            </div>
            <div className="form-group full-width">
              <label>Delivery Address</label>
              <textarea rows={2} placeholder="Enter delivery address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bill-section">
          <div className="section-header"><IconClipboard /><h2>Line Items</h2></div>
          <div className="line-items-container">
            {lineItems.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <IconClipboard size={32} />
                <p className="empty-state-text">No items added yet. Click "Add Item" to start.</p>
              </div>
            ) : lineItems.map((item, index) => (
              <div key={item.id} className="line-item">
                <div className="line-item-header">
                  <span className="line-item-number">{index + 1}</span>
                  <div className="line-item-name-wrap">
                    <input
                      type="text" placeholder="Search or type item name" autoComplete="off"
                      value={item.name}
                      onChange={(e) => handleNameInput(item.id, e.target.value)}
                      onFocus={() => setSuggestFor(item.id)}
                      onBlur={handleNameBlur}
                    />
                    {suggestFor === item.id && (
                      <div className="item-suggestions show">
                        {catalogItems.length === 0 ? null : suggestionsForLine(item).length === 0 ? (
                          <div className="item-suggestion-empty">No matching items — will be saved as a custom item</div>
                        ) : suggestionsForLine(item).map((ci) => (
                          <div key={ci.id} className="item-suggestion-row" onMouseDown={() => { cancelBlur(); applySuggestion(item.id, ci); }}>
                            <span className="item-suggestion-name">{ci.name}</span>
                            <span className="item-suggestion-price">{currency(ci.price, settings.currencySymbol)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="line-item-delete" title="Remove item" onClick={() => removeLineItem(item.id)}><IconTrash /></button>
                </div>
                <div className="line-item-fields">
                  <div className="form-group">
                    <label>Qty</label>
                    <input type="number" min="0.01" step="0.01" value={item.qty} onChange={(e) => updateLineField(item.id, 'qty', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Price</label>
                    <input type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateLineField(item.id, 'price', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Disc. %</label>
                    <input type="number" min="0" max="100" step="0.01" value={item.discount} onChange={(e) => updateLineField(item.id, 'discount', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Tax %</label>
                    <input type="number" min="0" step="0.01" value={item.tax} onChange={(e) => updateLineField(item.id, 'tax', e.target.value)} />
                  </div>
                </div>
                <div className="line-item-total">
                  <span className="line-item-total-label">Total</span>
                  <span className="line-item-total-value">{currency(item.total, settings.currencySymbol)}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="add-item-btn" onClick={addLineItem}><IconPlusCircle /> Add Item</button>
        </div>

        {/* Totals */}
        <div className="bill-section totals-section">
          <div className="section-header"><IconDollar /><h2>Totals</h2></div>
          <div className="totals-grid">
            <div className="total-row"><span className="total-label">Bill Amount</span><span className="total-value">{currency(totals.billAmount, settings.currencySymbol)}</span></div>
            <div className="total-row"><span className="total-label">Discount Amount</span><span className="total-value discount">-{currency(totals.discountAmount, settings.currencySymbol)}</span></div>
            <div className="total-row"><span className="total-label">Tax Amount</span><span className="total-value tax">+{currency(totals.taxAmount, settings.currencySymbol)}</span></div>
            <div className="total-row grand-total"><span className="total-label">Grand Total</span><span className="total-value">{currency(totals.grandTotal, settings.currencySymbol)}</span></div>
          </div>
        </div>

        {/* Notes & Payment */}
        <div className="bill-section">
          <div className="section-header"><IconNote /><h2>Notes & Payment</h2></div>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Payment Mode</label>
              <div className="payment-modes">
                {PAYMENT_MODES.map((m) => (
                  <button key={m.id} type="button" className={`payment-mode-btn${paymentMode === m.id ? ' active' : ''}`} onClick={() => setPaymentMode(m.id)}>
                    <m.icon /> {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group full-width">
              <label>Notes</label>
              <textarea rows={2} placeholder="Add any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="action-buttons">
          <button className="action-btn btn-save-print" onClick={saveAndPrint}><IconPrinter /> Save & Print</button>
          <button className="action-btn btn-save" onClick={saveBill}><IconSave /> Save</button>
          <button className="action-btn btn-outline" onClick={clearBill}><IconTrash /> Clear</button>
          <button className="action-btn btn-preview-mode" onClick={previewBill}><IconEye /> Preview</button>
        </div>
      </div>

      <ConfirmDialog
        open={clearConfirmOpen}
        title="Clear Bill"
        message="Clear this bill? All items will be removed."
        confirmLabel="Clear"
        onConfirm={doClear}
        onCancel={() => setClearConfirmOpen(false)}
      />

      <Modal
        open={!!previewData}
        onClose={closePreview}
        title="Bill Preview"
        footer={
          <>
            <button className="action-btn btn-save" onClick={printFromPreview}><IconPrinter /> Print</button>
            <button className="action-btn btn-outline" onClick={closePreview}>Close</button>
          </>
        }
      >
        {previewData && (
          <div className="pos-preview-wrap">
            <div dangerouslySetInnerHTML={{ __html: buildPosBillHtml(previewData, buildPrintConfig(settings.print)) }} />
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------- Icons ---------- */
function IconUser() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>); }
function IconClipboard({ size = 20 }) { return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>); }
function IconDollar() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>); }
function IconNote() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>); }
function IconTrash() { return (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>); }
function IconPlusCircle() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>); }
function IconPrinter() { return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>); }
function IconSave() { return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>); }
function IconEye() { return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>); }
function IconCash() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></svg>); }
function IconCard() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>); }
function IconBank() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6" /></svg>); }
function IconUpi() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>); }
