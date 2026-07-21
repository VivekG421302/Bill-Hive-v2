import { useEffect, useState } from 'react';
import { dbGet, dbSet } from '../db/indexedDB';
import { useToast } from '../context/ToastContext';
import Modal from './Modal';

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '' };

/**
 * Add/Edit customer modal. Self-contained like BrandFormModal: reads/writes
 * the 'customers' store itself so it can be dropped in from the Customers
 * page or opened inline from Create Bill's customer field.
 */
export default function CustomerFormModal({ open, onClose, customer, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    setForm(customer ? { name: customer.name || '', phone: customer.phone || '', email: customer.email || '', address: customer.address || '', notes: customer.notes || '' } : EMPTY_FORM);
  }, [open, customer]);

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      showToast('Customer name is required');
      return;
    }
    const data = { name, phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim(), notes: form.notes.trim() };
    const current = (await dbGet('customers')) || [];

    let saved;
    let next;
    if (customer?.id) {
      saved = { ...customer, ...data };
      next = current.map((c) => (c.id === customer.id ? saved : c));
    } else {
      const id = current.reduce((max, c) => Math.max(max, c.id || 0), 0) + 1;
      saved = { id, ...data };
      next = [...current, saved];
    }
    await dbSet('customers', next);
    showToast('Customer saved');
    onSaved?.(saved);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Edit Customer' : 'Add Customer'}
      zIndex={1400}
      footer={
        <>
          <button className="action-btn btn-save" onClick={save}>Save Customer</button>
          <button className="action-btn btn-outline" onClick={onClose}>Cancel</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-group full-width">
          <label>Customer Name <span className="required">*</span></label>
          <input type="text" placeholder="e.g., John Doe" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input type="tel" placeholder="Contact number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="form-group full-width">
          <label>Address</label>
          <textarea rows={2} placeholder="Delivery / billing address (optional)" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
        <div className="form-group full-width">
          <label>Notes</label>
          <textarea rows={2} placeholder="Preferences, credit terms, etc. (optional)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
    </Modal>
  );
}
