import { useEffect, useState } from 'react';
import { apiGet, apiSet, apiClearAll, apiExportAllData, apiImportAllData, getApiMode, setApiMode } from '../api/api';
import { useTheme, ACCENT_PRESETS } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import { buildPosBillHtml, printPosBill, buildPrintConfig, SECTION_DEFS, DEFAULT_SECTION_ORDER, COLUMN_DEFS, DEFAULT_COLUMN_ORDER, PAPER_PRESETS } from '../utils/posReceipt';

const IS_DEV = import.meta.env.DEV;

const DEFAULT_SETTINGS = {
  thankYouMessages: 'Thank you for your business!\nVisit again soon!',
  termsConditions: 'Goods once sold will not be taken back.',
  currencySymbol: '₹',
  screensaver: { enabled: false, seconds: 30 },
  print: {
    fontFamily: 'typewriter',
    fontWeight: 'bold',
    textStyle: 'normal',
    lineHeight: 1.45,
    paperSize: '80mm',
    customWidthMm: 80,
    fontSize: 12,
    margins: 'normal',
    show: { logo: true, gst: true, address: true, contact: true, discount: true, tax: true, thankyou: true, terms: true },
    sectionOrder: DEFAULT_SECTION_ORDER,
    columnOrder: DEFAULT_COLUMN_ORDER
  },
  dbConfig: { provider: 'none', apiUrl: '', apiKey: '' }
};

const DUMMY_BILL_BASE = {
  invoiceNo: '260701', invoiceDate: new Date().toISOString().slice(0, 10), dueDate: '', customerName: 'Sample Customer', customerContact: '98765 43210',
  lineItems: [
    { name: 'Sample Item A', qty: 2, price: 150, discount: 10, tax: 5, total: 283.5 },
    { name: 'Sample Item B', qty: 1, price: 499, discount: 0, tax: 5, total: 523.95 }
  ],
  billAmount: 799, discountAmount: 30, taxAmount: 38.45, grandTotal: 807.45,
  paymentMode: 'cash', notes: ''
};

export default function SettingsPage() {
  const { accentColor, updateAccentColor, sidebarSide, updateSidebarSide } = useTheme();
  const { showToast } = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [eraseInput, setEraseInput] = useState('');
  const [eraseOpen, setEraseOpen] = useState(false);
  const [dummyPreviewOpen, setDummyPreviewOpen] = useState(false);
  const [company, setCompany] = useState({});
  const [apiMode, setApiModeState] = useState(() => (IS_DEV ? getApiMode() : 'internal'));

  const toggleApiMode = () => {
    const next = apiMode === 'external' ? 'internal' : 'external';
    setApiMode(next);
    setApiModeState(next);
    showToast(`Switched to ${next} data — reloading…`);
    setTimeout(() => window.location.reload(), 700);
  };

  useEffect(() => {
    apiGet('settings').then((s) => {
      if (s) {
        setSettings((prev) => ({
          ...prev,
          ...s,
          thankYouMessages: Array.isArray(s.thankYouMessages) ? s.thankYouMessages.join('\n') : (s.thankYouMessages ?? DEFAULT_SETTINGS.thankYouMessages),
          screensaver: s.screensaver || DEFAULT_SETTINGS.screensaver,
          print: (() => {
            const dp = DEFAULT_SETTINGS.print;
            const sp = s.print || {};
            return {
              ...dp,
              ...sp,
              show: { ...dp.show, ...(sp.show || {}) },
              lineHeight: sp.lineHeight != null ? sp.lineHeight : dp.lineHeight,
              textStyle: sp.textStyle ?? dp.textStyle,
              customWidthMm: sp.customWidthMm != null ? sp.customWidthMm : dp.customWidthMm,
              sectionOrder: Array.isArray(sp.sectionOrder) && sp.sectionOrder.length === dp.sectionOrder.length ? sp.sectionOrder : dp.sectionOrder,
              columnOrder: Array.isArray(sp.columnOrder) && sp.columnOrder.length === dp.columnOrder.length ? sp.columnOrder : dp.columnOrder,
            };
          })(),
          dbConfig: { ...DEFAULT_SETTINGS.dbConfig, ...(s.dbConfig || {}) }
        }));
      }
    });
    apiGet('company').then((c) => setCompany(c || {}));
  }, []);

  const persist = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await apiSet('settings', { ...(await apiGet('settings')), ...next });
    window.dispatchEvent(new Event('billhive:settings-updated'));
  };

  const saveGeneral = async () => {
    await apiSet('settings', { ...(await apiGet('settings')), ...settings });
    window.dispatchEvent(new Event('billhive:settings-updated'));
    showToast('Settings saved');
  };

  const saveConfig = async () => {
    await apiSet('settings', { ...(await apiGet('settings')), dbConfig: settings.dbConfig });
    showToast('Configuration saved');
  };

  // ---------- Thank-you messages (stored as a single newline-joined string; edited as a list) ----------
  const messages = Array.isArray(settings.thankYouMessages) ? settings.thankYouMessages : (settings.thankYouMessages ? String(settings.thankYouMessages).split('\n') : []);
  const setMessages = (next) => setSettings((s) => ({ ...s, thankYouMessages: next.join('\n') }));
  const updateMessage = (idx, value) => { const next = [...messages]; next[idx] = value; setMessages(next); };
  const removeMessage = (idx) => setMessages(messages.filter((_, i) => i !== idx));
  const addMessage = () => setMessages([...messages, '']);

  // ---------- Print setup ----------
  const setPrint = (patch) => setSettings((s) => ({ ...s, print: { ...s.print, ...patch } }));
  const setPrintShow = (key, value) => setSettings((s) => ({ ...s, print: { ...s.print, show: { ...s.print.show, [key]: value } } }));

  const moveInOrder = (orderKey, index, dir) => {
    setSettings((s) => {
      const order = [...s.print[orderKey]];
      const target = index + dir;
      if (target < 0 || target >= order.length) return s;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...s, print: { ...s.print, [orderKey]: order } };
    });
  };

  const dummyBillData = () => ({
    ...DUMMY_BILL_BASE,
    companyData: { ...company },
    settings: { currencySymbol: settings.currencySymbol, thankYouMessages: settings.thankYouMessages, termsConditions: settings.termsConditions }
  });
  const previewDummyBill = () => setDummyPreviewOpen(true);
  const printDummyBill = () => printPosBill(dummyBillData(), buildPrintConfig(settings.print));

  const handleExport = async () => {
    const dump = await apiExportAllData();
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `billhive-export-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export downloaded');
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dump = JSON.parse(reader.result);
        await apiImportAllData(dump);
        showToast('Data imported — reloading…');
        setTimeout(() => window.location.reload(), 900);
      } catch {
        showToast('Import failed — invalid file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmErase = async () => {
    await apiClearAll();
    showToast('All data erased');
    setEraseOpen(false);
    setEraseInput('');
    setTimeout(() => window.location.reload(), 900);
  };

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Configure invoice defaults, appearance, and manage your data.</p>

      {/* Invoice defaults */}
      <div className="card">
        <div className="card-header">
          <div><h2 className="card-title">Invoice Defaults</h2><p className="card-desc">Applied to every new bill.</p></div>
        </div>
        <div className="form-group">
          <label>Thank-you messages (one picked at random per bill)</label>
          <div className="settings-list">
            {messages.length === 0 && <p className="empty-state-text" style={{ margin: '4px 0' }}>No messages yet.</p>}
            {messages.map((msg, idx) => (
              <div className="settings-list-item" key={idx}>
                <input type="text" value={msg} onChange={(e) => updateMessage(idx, e.target.value)} placeholder="e.g., Thank you for your business!" />
                <button type="button" className="icon-btn icon-btn-danger" title="Remove" onClick={() => removeMessage(idx)}><IconX /></button>
              </div>
            ))}
          </div>
          <button type="button" className="add-item-btn" style={{ marginTop: 8 }} onClick={addMessage}><IconPlusCircle /> Add Message</button>
        </div>
        <div className="form-group">
          <label>Terms &amp; Conditions (printed footer)</label>
          <textarea rows={2} value={settings.termsConditions}
            onChange={(e) => setSettings((s) => ({ ...s, termsConditions: e.target.value }))} />
        </div>
        <div className="form-group" style={{ maxWidth: 160 }}>
          <label>Currency symbol</label>
          <input value={settings.currencySymbol}
            onChange={(e) => setSettings((s) => ({ ...s, currencySymbol: e.target.value }))} />
        </div>
        <div className="btn-row">
          <button className="action-btn btn-save" onClick={saveGeneral}>Save Settings</button>
        </div>
      </div>

      {/* Print Setup */}
      <div className="card">
        <div className="card-header">
          <div><h2 className="card-title">Print Setup</h2><p className="card-desc">Fine-tune how your bills are printed — font, paper width, and which sections to include.</p></div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Font Family</label>
            <select value={settings.print.fontFamily} onChange={(e) => setPrint({ fontFamily: e.target.value })}>
              <option value="typewriter">Typewriter — Classic receipt</option>
              <option value="mono">Monospace — Code-style</option>
              <option value="receipt">Receipt / OCR — Scannable</option>
              <option value="sans">Clean Sans — Modern</option>
              <option value="slab">Slab Serif — Bold &amp; sturdy</option>
            </select>
          </div>
          <div className="form-group">
            <label>Font Weight</label>
            <select value={settings.print.fontWeight} onChange={(e) => setPrint({ fontWeight: e.target.value })}>
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
              <option value="black">Extra Bold</option>
            </select>
          </div>
          <div className="form-group">
            <label>Text Style</label>
            <select value={settings.print.textStyle} onChange={(e) => setPrint({ textStyle: e.target.value })}>
              <option value="normal">Normal</option>
              <option value="italic">Italic</option>
            </select>
          </div>
          <div className="form-group">
            <label>Paper Size</label>
            <select value={settings.print.paperSize} onChange={(e) => setPrint({ paperSize: e.target.value })}>
              {Object.entries(PAPER_PRESETS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
            </select>
          </div>
          {settings.print.paperSize === 'custom' && (
            <div className="form-group">
              <label>Custom Width <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{settings.print.customWidthMm}mm</span></label>
              <input type="number" min={30} max={300} step={1} value={settings.print.customWidthMm} onChange={(e) => setPrint({ customWidthMm: Number(e.target.value) })} />
            </div>
          )}
          <div className="form-group">
            <label>Font Size <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{settings.print.fontSize}px</span></label>
            <div className="font-size-row">
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>8px</span>
              <input type="range" min={8} max={18} step={1} value={settings.print.fontSize} onChange={(e) => setPrint({ fontSize: Number(e.target.value) })} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>18px</span>
            </div>
          </div>
          <div className="form-group">
            <label>Line Height <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{(settings.print.lineHeight ?? 1.45).toFixed(2)}</span></label>
            <div className="font-size-row">
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tight</span>
              <input type="range" min={1.0} max={2.2} step={0.05} value={settings.print.lineHeight} onChange={(e) => setPrint({ lineHeight: Number(e.target.value) })} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loose</span>
            </div>
          </div>
          <div className="form-group">
            <label>Page Margins</label>
            <select value={settings.print.margins} onChange={(e) => setPrint({ margins: e.target.value })}>
              <option value="none">None — Edge to edge</option>
              <option value="narrow">Narrow — 4mm</option>
              <option value="normal">Normal — 8mm</option>
              <option value="wide">Wide — 16mm</option>
            </select>
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label>Include in Print</label>
          <div className="print-content-toggles">
            {[
              ['logo', 'Company Logo'], ['gst', 'GST / Tax No.'], ['address', 'Address'], ['contact', 'Phone / Email'],
              ['discount', 'Discount Column'], ['tax', 'Tax Column'], ['thankyou', 'Thank-You Message'], ['terms', 'Terms & Conditions']
            ].map(([key, label]) => (
              <label className="print-toggle-chip" key={key}>
                <input type="checkbox" checked={settings.print.show[key] !== false} onChange={(e) => setPrintShow(key, e.target.checked)} /> {label}
              </label>
            ))}
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label>Bill Section Order <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(move blocks up/down)</span></label>
            <div className="reorder-list">
              {settings.print.sectionOrder.map((key, idx) => {
                const def = SECTION_DEFS.find((s) => s.key === key);
                return (
                  <div className="reorder-list-item" key={key}>
                    <span>{def?.label || key}</span>
                    <div className="reorder-list-arrows">
                      <button type="button" disabled={idx === 0} onClick={() => moveInOrder('sectionOrder', idx, -1)} title="Move up"><IconArrowUp /></button>
                      <button type="button" disabled={idx === settings.print.sectionOrder.length - 1} onClick={() => moveInOrder('sectionOrder', idx, 1)} title="Move down"><IconArrowDown /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="form-group">
            <label>Item Table Column Order <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(move columns left/right)</span></label>
            <div className="reorder-list">
              {settings.print.columnOrder.map((key, idx) => {
                const def = COLUMN_DEFS.find((c) => c.key === key);
                const hidden = def?.showKey && settings.print.show[def.showKey] === false;
                return (
                  <div className={`reorder-list-item${hidden ? ' reorder-list-item-hidden' : ''}`} key={key}>
                    <span>{def?.label || key}{hidden ? ' (hidden)' : ''}</span>
                    <div className="reorder-list-arrows">
                      <button type="button" disabled={idx === 0} onClick={() => moveInOrder('columnOrder', idx, -1)} title="Move left"><IconArrowUp /></button>
                      <button type="button" disabled={idx === settings.print.columnOrder.length - 1} onClick={() => moveInOrder('columnOrder', idx, 1)} title="Move right"><IconArrowDown /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="btn-row">
          <button className="action-btn btn-outline" onClick={previewDummyBill}><IconEye size={14} /> Preview Dummy Bill</button>
          <button className="action-btn btn-save" onClick={printDummyBill}><IconPrinter size={14} /> Print Dummy Bill</button>
        </div>
      </div>

      {/* Appearance */}
      <div className="card">
        <div className="card-header">
          <div><h2 className="card-title">Theme &amp; Accent Colour</h2><p className="card-desc">Re-tints buttons, links, and the app logo mark.</p></div>
        </div>
        <div className="swatch-row">
          {ACCENT_PRESETS.map((p) => (
            <span
              key={p.name}
              className={`swatch${(accentColor || '') === (p.hex || '') ? ' active' : ''}`}
              style={{ background: p.hex || 'linear-gradient(135deg,#DB9327,#F0AC3D)' }}
              title={p.name}
              onClick={() => updateAccentColor(p.hex || '')}
            />
          ))}
          <input
            type="color"
            value={accentColor || '#DB9327'}
            onChange={(e) => updateAccentColor(e.target.value)}
            style={{ width: 36, height: 36, padding: 0, border: 'none', borderRadius: '50%', cursor: 'pointer' }}
            title="Custom colour"
          />
        </div>
      </div>

      {/* Menu position */}
      <div className="card">
        <div className="card-header">
          <div><h2 className="card-title">Menu Position</h2><p className="card-desc">Move the sidebar to the left or right of the screen.</p></div>
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button
            className={`action-btn ${sidebarSide === 'left' ? 'btn-save' : 'btn-outline'}`}
            onClick={() => updateSidebarSide('left')}
          >Left</button>
          <button
            className={`action-btn ${sidebarSide !== 'left' ? 'btn-save' : 'btn-outline'}`}
            onClick={() => updateSidebarSide('right')}
          >Right</button>
        </div>
      </div>

      {/* Screen saver */}
      <div className="card">
        <div className="card-header">
          <div><h2 className="card-title">Screen Saver</h2><p className="card-desc">Show an idle overlay after inactivity. Any click or key press exits it.</p></div>
        </div>
        <div className="toggle-row">
          <span>Enable screen saver</span>
          <label className="switch">
            <input type="checkbox" checked={settings.screensaver.enabled}
              onChange={(e) => persist({ screensaver: { ...settings.screensaver, enabled: e.target.checked } })} />
            <span className="switch-track" />
          </label>
        </div>
        {settings.screensaver.enabled && (
          <div className="form-group" style={{ maxWidth: 160, marginTop: 10 }}>
            <label>Idle timeout (seconds)</label>
            <input type="number" min={5} max={3600} value={settings.screensaver.seconds}
              onChange={(e) => persist({ screensaver: { ...settings.screensaver, seconds: Number(e.target.value) } })} />
          </div>
        )}
      </div>

      {/* Data management */}
      <div className="card">
        <div className="card-header">
          <div><h2 className="card-title">Data Management</h2><p className="card-desc">Back up or restore everything stored in this browser.</p></div>
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="action-btn btn-save" onClick={handleExport}>Export All Data (JSON)</button>
          <label className="action-btn btn-outline" style={{ cursor: 'pointer' }}>
            Import Data
            <input type="file" accept="application/json" hidden onChange={handleImport} />
          </label>
        </div>
      </div>

      {/* Database Configuration (placeholder — not connected to anything yet) */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Database Configuration <span className="soon-badge">Coming soon</span></h2>
            <p className="card-desc">Bill Hive currently runs fully offline using your browser's local storage. These fields are saved for when cloud/database sync becomes available — they don't connect to anything yet.</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Provider</label>
            <select value={settings.dbConfig.provider} onChange={(e) => setSettings((s) => ({ ...s, dbConfig: { ...s.dbConfig, provider: e.target.value } }))}>
              <option value="none">None (Local storage only)</option>
              <option value="firebase">Firebase</option>
              <option value="supabase">Supabase</option>
              <option value="rest">Custom REST API</option>
            </select>
          </div>
          <div className="form-group">
            <label>API URL</label>
            <input type="text" placeholder="https://api.example.com" value={settings.dbConfig.apiUrl} onChange={(e) => setSettings((s) => ({ ...s, dbConfig: { ...s.dbConfig, apiUrl: e.target.value } }))} />
          </div>
          <div className="form-group">
            <label>API Key</label>
            <input type="password" placeholder="Enter API key" value={settings.dbConfig.apiKey} onChange={(e) => setSettings((s) => ({ ...s, dbConfig: { ...s.dbConfig, apiKey: e.target.value } }))} />
          </div>
          <div className="form-group">
            <label>Sync</label>
            <div className="toggle-row" style={{ padding: 0 }}>
              <label className="switch">
                <input type="checkbox" disabled />
                <span className="switch-track" />
              </label>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Disabled until a provider is connected</span>
            </div>
          </div>
        </div>
        <div className="btn-row">
          <button className="action-btn btn-save" onClick={saveConfig}>Save Configuration</button>
        </div>
      </div>

      {/* Developer — data source toggle (dev builds only, never shown in production) */}
      {IS_DEV && (
        <div className="card" style={{ borderColor: 'var(--accent-warning, #d97706)' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Developer <span className="soon-badge">Dev only</span></h2>
              <p className="card-desc">Switch where the app reads/writes data. Internal uses this browser's storage (default). External calls the REST API configured via VITE_API_BASE_URL. This card only renders in dev builds.</p>
            </div>
          </div>
          <div className="toggle-row">
            <span>Use external API ({apiMode === 'external' ? 'on' : 'off'})</span>
            <label className="switch">
              <input type="checkbox" checked={apiMode === 'external'} onChange={toggleApiMode} />
              <span className="switch-track" />
            </label>
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="card" style={{ borderColor: 'var(--accent-danger)' }}>
        <div className="card-header">
          <div><h2 className="card-title" style={{ color: 'var(--accent-danger)' }}>Danger Zone</h2><p className="card-desc">This cannot be undone. Export a backup first if you need one.</p></div>
        </div>
        {!eraseOpen ? (
          <button className="action-btn btn-danger" onClick={() => setEraseOpen(true)}>Erase All Data</button>
        ) : (
          <div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              Type <strong>delete</strong> below to confirm you want to erase everything.
            </p>
            <input
              value={eraseInput}
              onChange={(e) => setEraseInput(e.target.value)}
              placeholder="delete"
              style={{ maxWidth: 220 }}
            />
            <div className="btn-row">
              <button
                className="action-btn btn-danger"
                disabled={eraseInput.trim().toLowerCase() !== 'delete'}
                style={{ opacity: eraseInput.trim().toLowerCase() !== 'delete' ? 0.5 : 1 }}
                onClick={confirmErase}
              >Erase Everything</button>
              <button className="action-btn btn-outline" onClick={() => { setEraseOpen(false); setEraseInput(''); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <Modal
        open={dummyPreviewOpen}
        onClose={() => setDummyPreviewOpen(false)}
        title="Dummy Bill Preview"
        footer={
          <>
            <button className="action-btn btn-save" onClick={printDummyBill}><IconPrinter size={14} /> Print</button>
            <button className="action-btn btn-outline" onClick={() => setDummyPreviewOpen(false)}>Close</button>
          </>
        }
      >
        <div className="pos-preview-wrap">
          <div dangerouslySetInnerHTML={{ __html: buildPosBillHtml(dummyBillData(), buildPrintConfig(settings.print)) }} />
        </div>
      </Modal>
    </div>
  );
}

function IconX() {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" /><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" /></svg>);
}
function IconPlusCircle() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>);
}
function IconEye({ size = 15 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>);
}
function IconPrinter({ size = 15 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>);
}
function IconArrowUp() {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>);
}
function IconArrowDown() {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>);
}

