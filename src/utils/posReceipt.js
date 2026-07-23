// Shared receipt HTML builder, used by the in-app preview (CreateBill,
// PastBills, Settings' dummy bill) and the print window. Fully data-driven
// off settings.print so Settings can offer real customization: column
// order, section order, line height, text style, weight, and paper size.

export const SECTION_DEFS = [
  { key: 'header', label: 'Company Header (logo, name, GST, address, contact)' },
  { key: 'meta', label: 'Bill Number, Date & Time' },
  { key: 'customer', label: 'Customer Details' },
  { key: 'items', label: 'Item List' },
  { key: 'totals', label: 'Totals (bill amount, discount, tax, net)' },
  { key: 'payment', label: 'Payment Mode' },
  { key: 'thankyou', label: 'Thank-You Message' },
  { key: 'terms', label: 'Terms & Conditions' }
];
export const DEFAULT_SECTION_ORDER = SECTION_DEFS.map((s) => s.key);

export const COLUMN_DEFS = [
  { key: 'sno', label: '#' },
  { key: 'item', label: 'Item' },
  { key: 'qty', label: 'Qty' },
  { key: 'rate', label: 'Rate' },
  { key: 'disc', label: 'Discount', showKey: 'discount' },
  { key: 'tax', label: 'Tax', showKey: 'tax' },
  { key: 'amt', label: 'Amount' }
];
export const DEFAULT_COLUMN_ORDER = COLUMN_DEFS.map((c) => c.key);

export const PAPER_PRESETS = {
  '58mm': { label: '2" / 58mm — Narrow thermal', maxWidth: 220 },
  '80mm': { label: '3" / 80mm — Standard thermal', maxWidth: 300 },
  '112mm': { label: '4" / 112mm — Wide thermal', maxWidth: 420 },
  a5: { label: 'A5', maxWidth: 550 },
  a4: { label: 'A4 — Full page', maxWidth: 700 },
  letter: { label: 'Letter — Full page', maxWidth: 720 },
  custom: { label: 'Custom width', maxWidth: 300 }
};

export const DEFAULT_PRINT_CONFIG = {
  weights: { base: 700, strong: 800 },
  fontFamily: "'Courier New', 'Courier', 'Lucida Console', monospace",
  textStyle: 'normal',
  lineHeight: 1.45,
  size: { maxWidth: 300, baseFont: 12 },
  margins: '8mm',
  show: { logo: true, gst: true, address: true, contact: true, discount: true, tax: true, thankyou: true, terms: true },
  sectionOrder: DEFAULT_SECTION_ORDER,
  columnOrder: DEFAULT_COLUMN_ORDER
};

const FONT_FAMILY_MAP = {
  typewriter: "'Courier New', 'Courier', 'Lucida Console', monospace",
  mono: "'Consolas', 'Monaco', 'Menlo', monospace",
  receipt: "'OCR A Std', 'Courier New', monospace",
  sans: "'Helvetica Neue', Arial, sans-serif",
  slab: "'Roboto Slab', Georgia, serif"
};
const FONT_WEIGHT_MAP = {
  normal: { base: 400, strong: 600 },
  bold: { base: 700, strong: 800 },
  black: { base: 800, strong: 900 }
};
const MARGINS_MAP = { none: '0mm', narrow: '4mm', normal: '8mm', wide: '16mm' };
const MM_TO_PX = 3.78;

/** Turns Settings' Print Setup form values (settings.print) into a real print config, falling back to sensible defaults for anything unset. */
export function buildPrintConfig(printSettings) {
  const p = printSettings || {};
  const paperKey = p.paperSize && PAPER_PRESETS[p.paperSize] ? p.paperSize : '80mm';
  const maxWidth = paperKey === 'custom'
    ? Math.round((p.customWidthMm || 80) * MM_TO_PX)
    : PAPER_PRESETS[paperKey].maxWidth;

  return {
    weights: FONT_WEIGHT_MAP[p.fontWeight] || DEFAULT_PRINT_CONFIG.weights,
    fontFamily: FONT_FAMILY_MAP[p.fontFamily] || DEFAULT_PRINT_CONFIG.fontFamily,
    textStyle: p.textStyle === 'italic' ? 'italic' : 'normal',
    lineHeight: p.lineHeight || DEFAULT_PRINT_CONFIG.lineHeight,
    size: { maxWidth, baseFont: p.fontSize ?? DEFAULT_PRINT_CONFIG.size.baseFont },
    margins: MARGINS_MAP[p.margins] || DEFAULT_PRINT_CONFIG.margins,
    show: { ...DEFAULT_PRINT_CONFIG.show, ...(p.show || {}) },
    sectionOrder: Array.isArray(p.sectionOrder) && p.sectionOrder.length === SECTION_DEFS.length ? p.sectionOrder : DEFAULT_SECTION_ORDER,
    columnOrder: Array.isArray(p.columnOrder) && p.columnOrder.length === COLUMN_DEFS.length ? p.columnOrder : DEFAULT_COLUMN_ORDER
  };
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const ALIGN = { sno: 'left', item: 'left', qty: 'center', rate: 'right', disc: 'center', tax: 'center', amt: 'right' };

function renderCell(colKey, item, idx, symbol) {
  switch (colKey) {
    case 'sno': return String(idx + 1);
    case 'item': return escapeHtml(item.name) || 'Item';
    case 'qty': return String(item.qty);
    case 'rate': return `${symbol}${Number(item.price).toFixed(2)}`;
    case 'disc': return item.discount > 0 ? `${item.discount}%` : '-';
    case 'tax': return item.tax > 0 ? `${item.tax}%` : '-';
    case 'amt': return `${symbol}${Number(item.total).toFixed(2)}`;
    default: return '';
  }
}

function buildPosStyleRules(printCfg) {
  return `
    .pos-bill { max-width: ${printCfg.size.maxWidth}px; margin: 0 auto; padding: 8px; font-size: ${printCfg.size.baseFont}px; font-family: ${printCfg.fontFamily}; font-style: ${printCfg.textStyle}; font-weight: ${printCfg.weights.base}; line-height: ${printCfg.lineHeight}; color: #000; background: #fff; }
    .pos-header { text-align: center; padding-bottom: 6px; border-bottom: 2px dashed #000; margin-bottom: 6px; }
    .pos-logo { width: 100%; max-width: 160px; height: auto; aspect-ratio: 4/1; object-fit: contain; margin: 0 auto 4px; display: block; filter: grayscale(100%) contrast(1.15); }
    .pos-company-name { font-size: 1.15em; font-weight: ${printCfg.weights.strong}; }
    .pos-gst, .pos-address, .pos-contact { font-size: .82em; font-weight: ${printCfg.weights.base}; line-height: ${printCfg.lineHeight}; }
    .pos-divider { border: none; border-top: 2px dashed #000; margin: 5px 0; }
    .pos-meta { display: flex; justify-content: space-between; font-size: .85em; font-weight: ${printCfg.weights.base}; margin-bottom: 2px; }
    .pos-meta-label { font-weight: ${printCfg.weights.strong}; }
    .pos-customer-label { font-weight: ${printCfg.weights.strong}; font-size: .9em; }
    .pos-table { width: 100%; border-collapse: collapse; font-size: .9em; font-weight: ${printCfg.weights.base}; margin: 4px 0; }
    .pos-table th { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 3px 2px; text-align: left; font-weight: ${printCfg.weights.strong}; }
    .pos-table td { padding: 2px 2px; vertical-align: top; font-weight: ${printCfg.weights.base}; }
    .pos-td-right { text-align: right; } .pos-td-center { text-align: center; } .pos-td-left { text-align: left; }
    .pos-totals { border-top: 2px solid #000; padding-top: 3px; font-size: .9em; font-weight: ${printCfg.weights.base}; }
    .pos-total-row { display: flex; justify-content: space-between; margin-bottom: 1px; }
    .pos-total-row.grand { font-weight: ${printCfg.weights.strong}; font-size: 1.1em; border-top: 2px solid #000; padding-top: 3px; margin-top: 2px; }
    .pos-saved { text-align: center; font-size: .9em; font-weight: ${printCfg.weights.base}; margin: 4px 0; font-style: italic; }
    .pos-payment { font-size: .9em; font-weight: ${printCfg.weights.base}; margin: 3px 0; }
    .pos-thankyou { text-align: center; font-size: 1em; font-weight: ${printCfg.weights.strong}; margin: 4px 0; }
    .pos-terms { font-size: .82em; font-weight: ${printCfg.weights.base}; text-align: center; line-height: ${printCfg.lineHeight}; margin-top: 3px; padding-top: 3px; border-top: 2px dashed #000; }
    .pos-footer-credit { text-align: center; font-size: 9px; font-weight: 700; margin-top: 6px; color: #444; }
  `;
}

function activeColumns(cfg) {
  return cfg.columnOrder.filter((key) => {
    const def = COLUMN_DEFS.find((c) => c.key === key);
    return def && (!def.showKey || cfg.show[def.showKey] !== false);
  });
}

/**
 * billData: { invoiceNo, invoiceDate, customerName, customerContact, lineItems,
 *   billAmount, discountAmount, taxAmount, grandTotal, paymentMode, notes,
 *   companyData: {name,gst,address,phone,email,logo}, settings: {currencySymbol,thankYouMessages,termsConditions} }
 */
export function buildPosBillHtml(billData, printCfg = DEFAULT_PRINT_CONFIG) {
  const company = billData.companyData || {};
  const settings = billData.settings || {};
  const symbol = settings.currencySymbol || '₹';
  const show = printCfg.show || {};
  const cols = activeColumns(printCfg);

  const thankYouList = (settings.thankYouMessages || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const thankYouMsg = thankYouList.length > 0 ? thankYouList[Math.floor(Math.random() * thankYouList.length)] : 'Thank you!';

  const now = new Date();
  const dateStr = formatDate(billData.invoiceDate || now);
  const timeStr = formatTime(now);
  const totalQty = billData.lineItems.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);

  const SECTIONS = {
    header: () => `
      <div class="pos-header">
        ${(company.logo && show.logo !== false) ? `<img src="${company.logo}" class="pos-logo" alt="Logo">` : ''}
        <div class="pos-company-name">${escapeHtml(company.name) || 'Your Company'}</div>
        ${(company.gst && show.gst !== false) ? `<div class="pos-gst">GSTIN: ${escapeHtml(company.gst)}</div>` : ''}
        ${(company.address && show.address !== false) ? `<div class="pos-address">${escapeHtml(company.address).replace(/\n/g, '<br>')}</div>` : ''}
        ${(company.phone && show.contact !== false) ? `<div class="pos-contact">Ph: ${escapeHtml(company.phone)}</div>` : ''}
        ${(company.email && show.contact !== false) ? `<div class="pos-contact">${escapeHtml(company.email)}</div>` : ''}
      </div>
      <hr class="pos-divider">`,
    meta: () => `
      <div class="pos-meta"><span><span class="pos-meta-label">Bill No:</span> ${billData.invoiceNo || '---'}</span><span><span class="pos-meta-label">Date:</span> ${dateStr}</span></div>
      <div class="pos-meta"><span><span class="pos-meta-label">Time:</span> ${timeStr}</span></div>
      <hr class="pos-divider">`,
    customer: () => `
      <div class="pos-customer">
        <div class="pos-customer-label">To: ${escapeHtml(billData.customerName) || 'Customer'}</div>
        ${billData.customerContact ? `<div style="font-size:9px;">Ph: ${escapeHtml(billData.customerContact)}</div>` : ''}
      </div>`,
    items: () => `
      <table class="pos-table">
        <thead><tr>${cols.map((k) => `<th class="pos-td-${ALIGN[k]}">${COLUMN_DEFS.find((c) => c.key === k).label}</th>`).join('')}</tr></thead>
        <tbody>
          ${billData.lineItems.map((item, idx) => `<tr>${cols.map((k) => `<td class="pos-td-${ALIGN[k]}">${renderCell(k, item, idx, symbol)}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      <hr class="pos-divider">
      <div style="font-size:9px;text-align:right;margin-bottom:4px;">Total Qty: ${totalQty}</div>`,
    totals: () => `
      <div class="pos-totals">
        <div class="pos-total-row"><span>Bill Amount</span><span>${symbol}${billData.billAmount.toFixed(2)}</span></div>
        ${show.discount !== false ? `<div class="pos-total-row"><span>Item Discount</span><span>${symbol}${billData.discountAmount.toFixed(2)}</span></div>` : ''}
        ${show.tax !== false ? `<div class="pos-total-row"><span>GST/Tax</span><span>${symbol}${billData.taxAmount.toFixed(2)}</span></div>` : ''}
        <div class="pos-total-row grand"><span>Net Amount</span><span>${symbol}${billData.grandTotal.toFixed(2)}</span></div>
      </div>
      ${billData.discountAmount > 0 ? `<div class="pos-saved">You have saved ${symbol}${billData.discountAmount.toFixed(2)}</div>` : ''}
      <hr class="pos-divider">`,
    payment: () => `<div class="pos-payment"><span class="pos-meta-label">Payment Mode:</span> ${(billData.paymentMode || 'cash').toUpperCase()}</div>`,
    thankyou: () => show.thankyou !== false ? `<div class="pos-thankyou">${escapeHtml(billData.notes && billData.notes.trim() ? billData.notes : thankYouMsg)}</div>` : '',
    terms: () => (settings.termsConditions && show.terms !== false) ? `<div class="pos-terms">${escapeHtml(settings.termsConditions).replace(/\n/g, '<br>')}</div>` : ''
  };

  const orderedHtml = printCfg.sectionOrder.map((key) => SECTIONS[key] ? SECTIONS[key]() : '').join('');

  return `
    <style>${buildPosStyleRules(printCfg)}</style>
    <div class="pos-bill">
      ${orderedHtml}
      <div class="pos-footer-credit">Powered by Bill Hive</div>
    </div>
  `;
}

export function printPosBill(billData, printCfg = DEFAULT_PRINT_CONFIG) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const posHtml = buildPosBillHtml(billData, printCfg);
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Bill ${billData.invoiceNo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { margin: ${printCfg.margins || '8mm'}; }
        body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      ${posHtml}
      <script>
        window.onload = function () {
          setTimeout(function () {
            window.print();
            setTimeout(function () { window.close(); }, 500);
          }, 200);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
