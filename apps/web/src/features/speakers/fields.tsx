/**
 * Form controls for the dialogs of this screen. The component kit has no input, select or textarea
 * yet; until it has, the feature folder carries its own, built from the same tokens as the kit so
 * that they cannot drift visually.
 */
import type { ReactNode } from 'react';
import { cx } from '../../components';

export const FIELD_CONTROL =
  'h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink-900 ' +
  'transition-colors duration-100 placeholder:text-ink-400 hover:border-ink-300 focus:border-accent-500';

export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={htmlFor} className="hv-label block">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint !== undefined && <p className="mt-1 text-2xs text-ink-500">{hint}</p>}
    </div>
  );
}
