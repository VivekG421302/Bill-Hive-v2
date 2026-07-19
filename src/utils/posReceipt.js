// Ported from v1's generatePOSBillHTML/getPrintConfig. v2 doesn't have a
// "Print Setup" section in Settings yet, so this uses the same defaults v1
// ships with (80mm paper, bold typewriter font) rather than reading
// per-user print preferences. Once a Print Setup UI exists this can read
// overrides from settings the same way v1's getPrintConfig() does.
export const DEFAULT_PRINT_CONFIG = {
  weights: { base: 700, strong: 800 },
  fontFamily: "'Courier New', 'Courier', 'Lucida Console', monospace",
  size: { maxWidth: 300, baseFont: 12 },
  margins: '8mm',
  show: { logo: true, gst: true, address: true, contact: true, discount: true, tax: true, thankyou: true, terms: true }
};

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

  const thankYouList = (settings.thankYouMessages || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const thankYouMsg = thankYouList.length > 0 ? thankYouList[Math.floor(Math.random() * thankYouList.length)] : 'Thank you!';

  const now = new Date();
  const dateStr = formatDate(billData.invoiceDate || now);
  const timeStr = formatTime(now);

  let logoHtml = '';
  if (company.logo && show.logo !== false) {
    logoHtml = `<img src="${company.logo}" class="pos-logo" alt="Logo">`;
  }

  const showDisc = show.discount !== false;
  const showTax = show.tax !== false;

  const itemsHtml = billData.lineItems.map((item, idx) => {
    const discStr = item.discount > 0 ? `${item.discount}%` : '-';
    const taxStr = item.tax > 0 ? `${item.tax}%` : '-';
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(item.name) || 'Item'}</td>
        <td class="pos-td-center">${item.qty}</td>
        <td class="pos-td-right">${symbol}${Number(item.price).toFixed(2)}</td>
        ${showDisc ? `<td class="pos-td-center">${discStr}</td>` : ''}
        ${showTax ? `<td class="pos-td-center">${taxStr}</td>` : ''}
        <td class="pos-td-right">${symbol}${Number(item.total).toFixed(2)}</td>
      </tr>`;
  }).join('');

  const totalQty = billData.lineItems.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);

  return `
    <div class="pos-bill" style="max-width:${printCfg.size.maxWidth}px;">
      <div class="pos-header">
        ${logoHtml}
        <div class="pos-company-name">${escapeHtml(company.name) || 'Your Company'}</div>
        ${(company.gst && show.gst !== false) ? `<div class="pos-gst">GSTIN: ${escapeHtml(company.gst)}</div>` : ''}
        ${(company.address && show.address !== false) ? `<div class="pos-address">${escapeHtml(company.address).replace(/\n/g, '<br>')}</div>` : ''}
        ${(company.phone && show.contact !== false) ? `<div class="pos-contact">Ph: ${escapeHtml(company.phone)}</div>` : ''}
        ${(company.email && show.contact !== false) ? `<div class="pos-contact">${escapeHtml(company.email)}</div>` : ''}
      </div>
      <hr class="pos-divider">
      <div class="pos-meta"><span><span class="pos-meta-label">Bill No:</span> ${billData.invoiceNo || '---'}</span><span><span class="pos-meta-label">Date:</span> ${dateStr}</span></div>
      <div class="pos-meta"><span><span class="pos-meta-label">Time:</span> ${timeStr}</span></div>
      <hr class="pos-divider">
      <div class="pos-customer">
        <div class="pos-customer-label">To: ${escapeHtml(billData.customerName) || 'Customer'}</div>
        ${billData.customerContact ? `<div style="font-size:9px;">Ph: ${escapeHtml(billData.customerContact)}</div>` : ''}
      </div>
      <table class="pos-table">
        <thead>
          <tr>
            <th>#</th><th>Item</th><th class="pos-td-center">Qty</th><th class="pos-td-right">Rate</th>
            ${showDisc ? '<th class="pos-td-center">Disc</th>' : ''}
            ${showTax ? '<th class="pos-td-center">Tax</th>' : ''}
            <th class="pos-td-right">Amt</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <hr class="pos-divider">
      <div style="font-size:9px;text-align:right;margin-bottom:4px;">Total Qty: ${totalQty}</div>
      <div class="pos-totals">
        <div class="pos-total-row"><span>Bill Amount</span><span>${symbol}${billData.billAmount.toFixed(2)}</span></div>
        ${showDisc ? `<div class="pos-total-row"><span>Item Discount</span><span>${symbol}${billData.discountAmount.toFixed(2)}</span></div>` : ''}
        ${showTax ? `<div class="pos-total-row"><span>GST/Tax</span><span>${symbol}${billData.taxAmount.toFixed(2)}</span></div>` : ''}
        <div class="pos-total-row grand"><span>Net Amount</span><span>${symbol}${billData.grandTotal.toFixed(2)}</span></div>
      </div>
      ${billData.discountAmount > 0 ? `<div class="pos-saved">You have saved ${symbol}${billData.discountAmount.toFixed(2)}</div>` : ''}
      <div class="pos-payment"><span class="pos-meta-label">Payment Mode:</span> ${(billData.paymentMode || 'cash').toUpperCase()}</div>
      <hr class="pos-divider">
      ${show.thankyou !== false ? `<div class="pos-thankyou">${escapeHtml(billData.notes && billData.notes.trim() ? billData.notes : thankYouMsg)}</div>` : ''}
      ${(settings.termsConditions && show.terms !== false) ? `<div class="pos-terms">${escapeHtml(settings.termsConditions).replace(/\n/g, '<br>')}</div>` : ''}
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
        body { font-family: ${printCfg.fontFamily}; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .pos-bill { max-width: ${printCfg.size.maxWidth}px; margin: 0 auto; padding: 8px; font-size: ${printCfg.size.baseFont}px; font-weight: ${printCfg.weights.base}; line-height: 1.45; }
        .pos-header { text-align: center; padding-bottom: 6px; border-bottom: 2px dashed #000; margin-bottom: 6px; }
        .pos-logo { width: 100%; max-width: 160px; height: auto; aspect-ratio: 4/1; object-fit: contain; margin: 0 auto 4px; display: block; filter: grayscale(100%) contrast(1.15); }
        .pos-company-name { font-size: 1.15em; font-weight: ${printCfg.weights.strong}; }
        .pos-gst, .pos-address, .pos-contact { font-size: .82em; font-weight: ${printCfg.weights.base}; line-height: 1.35; }
        .pos-divider { border: none; border-top: 2px dashed #000; margin: 5px 0; }
        .pos-meta { display: flex; justify-content: space-between; font-size: .85em; font-weight: ${printCfg.weights.base}; margin-bottom: 2px; }
        .pos-meta-label { font-weight: ${printCfg.weights.strong}; }
        .pos-customer-label { font-weight: ${printCfg.weights.strong}; font-size: .9em; }
        .pos-table { width: 100%; border-collapse: collapse; font-size: .9em; font-weight: ${printCfg.weights.base}; margin: 4px 0; }
        .pos-table th { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 3px 2px; text-align: left; font-weight: ${printCfg.weights.strong}; }
        .pos-table td { padding: 2px 2px; vertical-align: top; font-weight: ${printCfg.weights.base}; }
        .pos-td-right { text-align: right; } .pos-td-center { text-align: center; }
        .pos-totals { border-top: 2px solid #000; padding-top: 3px; font-size: .9em; font-weight: ${printCfg.weights.base}; }
        .pos-total-row { display: flex; justify-content: space-between; margin-bottom: 1px; }
        .pos-total-row.grand { font-weight: ${printCfg.weights.strong}; font-size: 1.1em; border-top: 2px solid #000; padding-top: 3px; margin-top: 2px; }
        .pos-saved { text-align: center; font-size: .9em; font-weight: ${printCfg.weights.base}; margin: 4px 0; font-style: italic; }
        .pos-payment { font-size: .9em; font-weight: ${printCfg.weights.base}; margin: 3px 0; }
        .pos-thankyou { text-align: center; font-size: 1em; font-weight: ${printCfg.weights.strong}; margin: 4px 0; }
        .pos-terms { font-size: .82em; font-weight: ${printCfg.weights.base}; text-align: center; line-height: 1.35; margin-top: 3px; padding-top: 3px; border-top: 2px dashed #000; }
        .pos-footer-credit { text-align: center; font-size: 9px; font-weight: 700; margin-top: 6px; color: #444; }
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
