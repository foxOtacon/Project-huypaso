export default function AdminConfirmDialog({ open, title, message, confirmLabel = 'ยืนยัน', busy = false, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="admin-confirm-backdrop" role="presentation" onMouseDown={busy ? undefined : onCancel}>
      <section
        className="admin-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby="admin-confirm-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-confirm-icon" aria-hidden="true">!</div>
        <p className="admin-confirm-eyebrow">กรุณายืนยันรายการ</p>
        <h2 id="admin-confirm-title">{title}</h2>
        <p id="admin-confirm-message">{message}</p>
        <div className="admin-confirm-actions">
          <button type="button" className="admin-confirm-cancel" disabled={busy} onClick={onCancel}>ยกเลิก</button>
          <button type="button" className="admin-confirm-submit" disabled={busy} onClick={onConfirm}>{busy ? 'กำลังดำเนินการ...' : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
