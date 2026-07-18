import Modal from './Modal';

export default function ConfirmDialog({ open, title = 'Are you sure?', message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      zIndex={1300}
      footer={
        <>
          <button type="button" className="action-btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
          <button type="button" className="action-btn btn-outline" onClick={onCancel}>Cancel</button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>{message}</p>
    </Modal>
  );
}
