import { useEffect, useState } from 'react';
import { dbGet, dbSet, dbClearAll, exportAllData, importAllData } from '../db/indexedDB';
import { useTheme, ACCENT_PRESETS } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

const DEFAULT_SETTINGS = {
  thankYouMessages: 'Thank you for your business!\nVisit again soon!',
  termsConditions: 'Goods once sold will not be taken back.',
  currencySymbol: '₹',
  screensaver: { enabled: false, seconds: 30 }
};

export default function SettingsPage() {
  const { accentColor, updateAccentColor, sidebarSide, updateSidebarSide } = useTheme();
  const { showToast } = useToast();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [eraseInput, setEraseInput] = useState('');
  const [eraseOpen, setEraseOpen] = useState(false);

  useEffect(() => {
    dbGet('settings').then((s) => {
      if (s) setSettings((prev) => ({ ...prev, ...s, screensaver: s.screensaver || DEFAULT_SETTINGS.screensaver }));
    });
  }, []);

  const persist = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await dbSet('settings', { ...(await dbGet('settings')), ...next });
    window.dispatchEvent(new Event('billhive:settings-updated'));
  };

  const saveGeneral = async () => {
    await dbSet('settings', { ...(await dbGet('settings')), ...settings });
    window.dispatchEvent(new Event('billhive:settings-updated'));
    showToast('Settings saved');
  };

  const handleExport = async () => {
    const dump = await exportAllData();
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
        await importAllData(dump);
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
    await dbClearAll();
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
          <label>Thank-you messages (one per line — picked at random per bill)</label>
          <textarea rows={3} value={settings.thankYouMessages}
            onChange={(e) => setSettings((s) => ({ ...s, thankYouMessages: e.target.value }))} />
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
    </div>
  );
}
