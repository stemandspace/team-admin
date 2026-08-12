'use client';

import { useEffect, type FormEvent, type ReactNode } from 'react';

type FormModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void | Promise<void>;
  submitLabel?: string;
  saving?: boolean;
  error?: string;
  children: ReactNode;
  wide?: boolean;
};

export function FormModal({
  open,
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  saving = false,
  error,
  children,
  wide = false,
}: FormModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className={`modal-card form-modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="form-modal-header">
          <div>
            <h2 id="form-modal-title">{title}</h2>
            {subtitle ? <p className="muted form-modal-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="btn secondary form-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form
          className="form-modal-body"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit(e);
          }}
        >
          {error ? <div className="error">{error}</div> : null}
          {children}
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner light" style={{ marginRight: 8 }} />
                  Saving…
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
