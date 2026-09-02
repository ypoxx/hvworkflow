/**
 * Renders the messages of `toastStore`. A refused write must be visible without hiding the list the
 * person is working in, so the stack sits in the bottom right and never blocks the work area.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { useT } from '../i18n';
import { cx } from './cx';
import { dismissToast, useToasts } from './toastStore';
import type { ToastMessage, ToastTone } from './toastStore';

const TONE: Readonly<Record<ToastTone, string>> = {
  neutral: 'tone-neutral',
  success: 'tone-success',
  danger: 'tone-danger',
};

const ICON: Readonly<Record<ToastTone, typeof Info>> = {
  neutral: Info,
  success: Check,
  danger: AlertTriangle,
};

const DISMISS_AFTER_MS = 9000;

function Toast({ toast }: { toast: ToastMessage }) {
  const t = useT();
  const Icon = ICON[toast.tone];

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(toast.id), DISMISS_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id]);

  return (
    <div
      role="status"
      className={cx(
        'pointer-events-auto flex w-90 items-start gap-2.5 rounded-md border p-3',
        'bg-surface shadow-[0_8px_24px_-8px_rgba(31,30,28,0.25)]',
        toast.tone === 'danger' ? 'border-tone-danger-bd' : 'border-line',
      )}
    >
      <span className={cx('hv-badge mt-px h-5 w-5 justify-center px-0', TONE[toast.tone])}>
        <Icon size={12} strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink-900">{toast.title}</p>
        {toast.detail !== undefined && (
          <p className="mt-0.5 text-[13px] text-ink-600">{toast.detail}</p>
        )}
        {toast.ruleId !== undefined && (
          <p className="mt-1.5 font-mono text-2xs text-ink-500">
            {t('toast.rule')} {toast.ruleId}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label={t('toast.close')}
        onClick={() => dismissToast(toast.id)}
        className="-m-1 rounded-sm p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
      >
        <X size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Wraps the app and renders the message stack above it. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const toasts = useToasts();
  return (
    <>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-60 flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </div>
    </>
  );
}
