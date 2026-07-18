import { useEffect, useRef, useState } from 'react';
import { dbGet, dbSet } from '../db/indexedDB';
import { useToast } from '../context/ToastContext';
import '../utils/imageEditor';

const EMPTY = { name: '', gst: '', address: '', phone: '', email: '', logo: '' };

export default function YourData() {
  const { showToast } = useToast();
  const [data, setData] = useState(EMPTY);
  const [draft, setDraft] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [hasData, setHasData] = useState(true); // assume yes until we've checked, to avoid a create-button flash
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    dbGet('company').then((c) => {
      const val = c || EMPTY;
      setData(val);
      setDraft(val);
      setHasData(!!c);
      setLoaded(true);
    });
  }, []);

  const update = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      window.BHImageEditor.open(reader.result, { title: 'Edit Company Logo' })
        .then((editedDataUrl) => {
          setDraft((d) => ({ ...d, logo: editedDataUrl }));
          showToast('Logo updated');
        })
        .catch(() => {});
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleEditExistingLogo = (e) => {
    e.stopPropagation();
    if (!draft.logo) return;
    window.BHImageEditor.open(draft.logo, { title: 'Edit Company Logo' })
      .then((editedDataUrl) => {
        setDraft((d) => ({ ...d, logo: editedDataUrl }));
        showToast('Logo updated');
      })
      .catch(() => {});
  };

  const save = async () => {
    await dbSet('company', draft);
    setData(draft);
    setHasData(true);
    setEditing(false);
    window.dispatchEvent(new Event('billhive:company-updated'));
    showToast('Company details saved');
  };

  const cancel = () => {
    setDraft(data);
    setEditing(false);
  };

  return (
    <div>
      <h1 className="page-title">Your Data</h1>
      <p className="page-subtitle">Your company profile — shown in the app header and on every printed bill.</p>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Company Profile</h2>
            <p className="card-desc">This information appears centered in the app header and on printed receipts.</p>
          </div>
          {!editing && hasData && (
            <button className="action-btn btn-outline" onClick={() => setEditing(true)}>
              ✎ Edit
            </button>
          )}
        </div>

        {!loaded ? null : !hasData && !editing ? (
          <div className="empty-state">
            <p className="empty-state-text">No company details yet. Add your profile to show it on the app header and printed bills.</p>
            <button className="action-btn btn-save" onClick={() => setEditing(true)}>
              + Create company profile
            </button>
          </div>
        ) : editing ? (
          <>
            <div className="form-group">
              <label>Company Logo (4:1 recommended)</label>
              <div className="logo-drop" onClick={() => fileRef.current?.click()}>
                {draft.logo ? (
                  <>
                    <img src={draft.logo} alt="Logo preview" />
                    <button
                      type="button"
                      className="logo-edit-btn"
                      onClick={handleEditExistingLogo}
                      title="Edit image"
                    >
                      ✎ Edit image
                    </button>
                  </>
                ) : (
                  <span>Click to upload logo</span>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Company Name</label>
                <input value={draft.name} onChange={update('name')} placeholder="Your Company Pvt. Ltd." />
              </div>
              <div className="form-group">
                <label>GST Number</label>
                <input value={draft.gst} onChange={update('gst')} placeholder="22AAAAA0000A1Z5" />
              </div>
              <div className="form-group full-width">
                <label>Address</label>
                <textarea rows={2} value={draft.address} onChange={update('address')} placeholder="Street, City, State, PIN" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={draft.phone} onChange={update('phone')} placeholder="+91 90000 00000" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input value={draft.email} onChange={update('email')} placeholder="hello@company.com" />
              </div>
            </div>

            <div className="btn-row">
              <button className="action-btn btn-save" onClick={save}>Save changes</button>
              <button className="action-btn btn-outline" onClick={cancel}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            {data.logo && <img src={data.logo} alt="Company logo" style={{ maxHeight: 60, marginBottom: 16 }} />}
            <div className="view-detail-row"><span className="view-detail-label">Company Name</span><span className="view-detail-value">{data.name || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">GST Number</span><span className="view-detail-value">{data.gst || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Address</span><span className="view-detail-value">{data.address || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Phone</span><span className="view-detail-value">{data.phone || '—'}</span></div>
            <div className="view-detail-row"><span className="view-detail-label">Email</span><span className="view-detail-value">{data.email || '—'}</span></div>
          </>
        )}
      </div>
    </div>
  );
}
