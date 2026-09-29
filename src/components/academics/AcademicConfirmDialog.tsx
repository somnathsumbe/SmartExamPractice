"use client";

import Toast from "@/components/common/Toast";

export default function AcademicConfirmDialog({
  title,
  description,
  confirmLabel = "Deactivate",
  submitting = false,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  submitting?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="academic-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onCancel(); }}>
      <section className="academic-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="academic-confirm-title" aria-describedby="academic-confirm-description">
        <span className="academic-confirm-icon"><i className="bi bi-exclamation-triangle" aria-hidden="true" /></span>
        <h2 id="academic-confirm-title">{title}</h2>
        <p id="academic-confirm-description">{description}</p>
        {error && <Toast message={error} />}
        <footer>
          <button className="btn btn-outline-secondary" type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button className="btn btn-danger" type="button" onClick={onConfirm} disabled={submitting}>{submitting ? "Deactivating..." : confirmLabel}</button>
        </footer>
      </section>
    </div>
  );
}