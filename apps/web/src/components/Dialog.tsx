/**
 * A modal that behaves: role=dialog, aria-modal, focus moved in and returned, Tab trapped inside,
 * Esc closes. Nothing in this tool may steal the keyboard from the person at the podium.
 */
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useT } from '../i18n';
import { Button } from './Button';
import { cx } from './cx';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const SIZE: Readonly<Record<'sm' | 'md' | 'lg', string>> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  children,
}: DialogProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || panel === null) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const firstEl = focusable[0]!;
      const lastEl = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/25 p-6 pt-[12vh]">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...(description !== undefined ? { 'aria-describedby': descriptionId } : {})}
        tabIndex={-1}
        className={cx(
          'relative w-full rounded-lg border border-line bg-surface',
          'shadow-[0_16px_40px_-12px_rgba(31,30,28,0.28)]',
          SIZE[size],
        )}
      >
        {/* Slice 013 (axe finding, goal 1): a `<header>` element is an implicit "banner" landmark
         * whenever it is not scoped inside article/aside/main/nav/section — `role="dialog"` does not
         * count as such a scope, so this used to register as a second banner next to the app's own
         * `<header role="banner">` (axe `landmark-no-duplicate-banner`/`landmark-unique`, "moderate",
         * flagged as open in slice 020's review). A plain `<div>` keeps the exact same layout with no
         * landmark semantics at all — a dialog's own head bar is not one of the page's landmarks. */}
        <div className="flex items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[14px] font-semibold text-ink-900">
              {title}
            </h2>
            {description !== undefined && (
              <p id={descriptionId} className="mt-1 text-[13px] text-ink-600">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={t('common.close')}
            onClick={onClose}
            icon={<X size={16} strokeWidth={1.75} aria-hidden="true" />}
          />
        </div>
        {children !== undefined && <div className="px-4 py-4">{children}</div>}
        {footer !== undefined && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-sunken px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
