'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type LoadingMeta = {
  method: string;
  path: string;
  label?: string;
  overlay?: boolean;
};

type ModalState = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm?: () => void | Promise<void>;
};

type LoadingContextValue = {
  pending: number;
  busy: boolean;
  overlay: boolean;
  label: string;
  track: <T>(promise: Promise<T>, meta?: Partial<LoadingMeta>) => Promise<T>;
  showOverlay: (label?: string) => void;
  hideOverlay: () => void;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
  }) => void;
  closeModal: () => void;
  modal: ModalState;
};

type Listener = (state: {
  pending: number;
  overlay: boolean;
  label: string;
}) => void;

let pendingCount = 0;
let overlayCount = 0;
let currentLabel = '';
const listeners = new Set<Listener>();

function emit() {
  const snapshot = {
    pending: pendingCount,
    overlay: overlayCount > 0,
    label: currentLabel,
  };
  listeners.forEach((l) => l(snapshot));
}

export function subscribeApiLoading(listener: Listener) {
  listeners.add(listener);
  listener({
    pending: pendingCount,
    overlay: overlayCount > 0,
    label: currentLabel,
  });
  return () => {
    listeners.delete(listener);
  };
}

export function beginApiLoading(meta: LoadingMeta) {
  pendingCount += 1;
  if (meta.overlay || ['POST', 'PUT', 'PATCH', 'DELETE'].includes(meta.method.toUpperCase())) {
    overlayCount += 1;
    currentLabel = meta.label || defaultLabel(meta.method, meta.path);
  } else if (!currentLabel) {
    currentLabel = meta.label || 'Loading…';
  }
  emit();
}

export function endApiLoading(meta: LoadingMeta) {
  pendingCount = Math.max(0, pendingCount - 1);
  if (meta.overlay || ['POST', 'PUT', 'PATCH', 'DELETE'].includes(meta.method.toUpperCase())) {
    overlayCount = Math.max(0, overlayCount - 1);
  }
  if (pendingCount === 0) {
    currentLabel = '';
    overlayCount = 0;
  }
  emit();
}

function defaultLabel(method: string, path: string) {
  const m = method.toUpperCase();
  if (m === 'DELETE') return 'Deleting…';
  if (m === 'POST' || m === 'PUT' || m === 'PATCH') return 'Saving…';
  if (path.includes('login')) return 'Signing in…';
  return 'Loading…';
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

const closedModal: ModalState = {
  open: false,
  title: '',
  message: '',
  loading: false,
};

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(0);
  const [overlay, setOverlay] = useState(false);
  const [label, setLabel] = useState('');
  const [manualOverlay, setManualOverlay] = useState(0);
  const [manualLabel, setManualLabel] = useState('');
  const [modal, setModal] = useState<ModalState>(closedModal);
  const [routeBusy, setRouteBusy] = useState(false);

  useEffect(() => {
    return subscribeApiLoading((s) => {
      setPending(s.pending);
      setOverlay(s.overlay);
      setLabel(s.label);
    });
  }, []);

  const showOverlay = useCallback((text = 'Please wait…') => {
    setManualOverlay((n) => n + 1);
    setManualLabel(text);
  }, []);

  const hideOverlay = useCallback(() => {
    setManualOverlay((n) => Math.max(0, n - 1));
  }, []);

  const track = useCallback(async <T,>(promise: Promise<T>, meta?: Partial<LoadingMeta>) => {
    const full: LoadingMeta = {
      method: meta?.method || 'GET',
      path: meta?.path || '',
      label: meta?.label,
      overlay: meta?.overlay,
    };
    beginApiLoading(full);
    try {
      return await promise;
    } finally {
      endApiLoading(full);
    }
  }, []);

  const closeModal = useCallback(() => {
    setModal(closedModal);
  }, []);

  const confirm = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
      onConfirm: () => void | Promise<void>;
    }) => {
      setModal({
        open: true,
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel || 'Confirm',
        danger: opts.danger,
        loading: false,
        onConfirm: async () => {
          setModal((m) => ({ ...m, loading: true }));
          try {
            await opts.onConfirm();
            setModal(closedModal);
          } catch {
            setModal((m) => ({ ...m, loading: false }));
          }
        },
      });
    },
    [],
  );

  const value = useMemo<LoadingContextValue>(
    () => ({
      pending: pending + (routeBusy ? 1 : 0),
      busy: pending > 0 || manualOverlay > 0 || routeBusy,
      overlay: overlay || manualOverlay > 0,
      label: manualLabel || label || (routeBusy ? 'Loading page…' : 'Loading…'),
      track,
      showOverlay,
      hideOverlay,
      confirm,
      closeModal,
      modal,
    }),
    [
      pending,
      overlay,
      label,
      manualOverlay,
      manualLabel,
      routeBusy,
      track,
      showOverlay,
      hideOverlay,
      confirm,
      closeModal,
      modal,
    ],
  );

  // Expose route busy setter via custom event for AppShell
  useEffect(() => {
    const onStart = () => setRouteBusy(true);
    const onEnd = () => setRouteBusy(false);
    window.addEventListener('app:route-start', onStart);
    window.addEventListener('app:route-end', onEnd);
    return () => {
      window.removeEventListener('app:route-start', onStart);
      window.removeEventListener('app:route-end', onEnd);
    };
  }, []);

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <GlobalProgress visible={value.busy} />
      <GlobalOverlay visible={value.overlay} label={value.label} />
      <ConfirmModal
        state={modal}
        onCancel={closeModal}
        onConfirm={() => modal.onConfirm?.()}
      />
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading outside LoadingProvider');
  return ctx;
}

function GlobalProgress({ visible }: { visible: boolean }) {
  return (
    <div className={`top-progress ${visible ? 'active' : ''}`} aria-hidden={!visible}>
      <div className="top-progress-bar" />
    </div>
  );
}

function GlobalOverlay({ visible, label }: { visible: boolean; label: string }) {
  if (!visible) return null;
  return (
    <div className="global-overlay" role="alert" aria-live="assertive">
      <div className="global-overlay-card">
        <div className="loader-ring" />
        <p>{label}</p>
      </div>
    </div>
  );
}

function ConfirmModal({
  state,
  onCancel,
  onConfirm,
}: {
  state: ModalState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!state.open) return null;
  return (
    <div className="modal-backdrop" onClick={() => !state.loading && onCancel()}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title">{state.title}</h2>
        <p className="muted">{state.message}</p>
        <div className="modal-actions">
          <button className="btn secondary" disabled={state.loading} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${state.danger ? 'danger' : ''}`}
            disabled={state.loading}
            onClick={onConfirm}
          >
            {state.loading ? (
              <>
                <span className="spinner light" style={{ marginRight: 8 }} />
                Working…
              </>
            ) : (
              state.confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="page-loader">
      <div className="loader-ring" />
      <p className="muted">{label}</p>
      <div className="skeleton-stack">
        <div className="skeleton skeleton-line lg" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line md" />
      </div>
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card">
      <div className="skeleton-stack">
        <div className="skeleton skeleton-line lg" />
        {Array.from({ length: rows }).map((_, i) => (
          <div className="skeleton skeleton-line" key={i} />
        ))}
      </div>
    </div>
  );
}
