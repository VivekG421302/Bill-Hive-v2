import { useEffect, useRef, useState } from 'react';
import { apiGet, apiSet } from '../api/api';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';
import '../utils/imageEditor';

export const BRAND_COLORS = ['#228be6', '#e03131', '#2f9e44', '#e67700', '#9c36b5', '#1098ad', '#f06595', '#1a1a2e'];
const EMPTY_FORM = { name: '', description: '', color: BRAND_COLORS[0], logo: '' };

/**
 * Add/Edit brand modal. Self-contained: reads/writes the 'brands' store
 * itself, so it can be dropped in anywhere (Your Brands page, or the
 * item form's "+ Add new brand" shortcut) without the caller having to
 * manage the brands list. Calls onSaved(brand) after a successful save
 * so the caller can e.g. auto-select the new brand.
 */
export default function BrandFormModal({ open, onClose, brand, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm(brand ? { name: brand.name || '', description: brand.description || '', color: brand.color || BRAND_COLORS[0], logo: brand.logo || '' } : EMPTY_FORM);
  }, [open, brand]);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      window.BHImageEditor.open(reader.result, { title: 'Edit Brand Logo' })
        .then((editedDataUrl) => setForm((f) => ({ ...f, logo: editedDataUrl })))
        .catch(() => {});
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeLogo = (e) => {
    e.stopPropagation();
    setForm((f) => ({ ...f, logo: '' }));
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      showToast('Brand name is required');
      return;
    }
    const description = form.description.trim();
    const color = form.color || BRAND_COLORS[0];
    const current = (await apiGet('brands')) || [];

    let saved;
    let next;
    if (brand?.id) {
      saved = { ...brand, name, description, color, logo: form.logo };
      next = current.map((b) => (b.id === brand.id ? saved : b));
    } else {
      const id = current.reduce((max, b) => Math.max(max, b.id || 0), 0) + 1;
      saved = { id, name, description, color, logo: form.logo };
      next = [...current, saved];
    }
    await apiSet('brands', next);
    showToast('Brand saved');
    onSaved?.(saved);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={brand ? 'Edit Brand' : 'Add Brand'}
      zIndex={1400}
      footer={
        <>
          <button className="action-btn btn-save" onClick={save}>Save Brand</button>
          <button className="action-btn btn-outline" onClick={onClose}>Cancel</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-group full-width">
          <label>Brand Name <span className="required">*</span></label>
          <input type="text" placeholder="e.g., Northline Apparel" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group full-width">
          <label>Description</label>
          <textarea rows={2} placeholder="What this brand covers (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="form-group full-width">
          <label>Brand Logo</label>
          <div className="logo-drop" onClick={() => fileRef.current?.click()}>
            {form.logo ? (
              <>
                <img src={form.logo} alt="Logo preview" />
                <button type="button" className="logo-edit-btn" onClick={removeLogo} title="Remove logo">✕ Remove</button>
              </>
            ) : (
              <span>Click to upload logo · 4:1 ratio recommended · max 2MB</span>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        </div>
        <div className="form-group full-width">
          <label>Brand Colour</label>
          <div className="swatch-row">
            {BRAND_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                className={`swatch${form.color === hex ? ' active' : ''}`}
                style={{ background: hex }}
                onClick={() => setForm((f) => ({ ...f, color: hex }))}
              />
            ))}
          </div>
          <div className="brand-color-custom-row" onClick={() => document.getElementById('brand-color-input')?.click()}>
            <div className="brand-color-preview-dot" style={{ background: form.color }} />
            <span className="brand-color-custom-label">Custom colour</span>
            <span className="brand-color-hex mono">{form.color}</span>
            <input
              id="brand-color-input"
              type="color"
              value={form.color}
              className="brand-color-input"
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
