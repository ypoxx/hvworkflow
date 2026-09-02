/**
 * Form controls of the capture desk. Same reason as in the speakers folder: the component kit has
 * no input, select or textarea yet, so the feature composes them from the kit's tokens.
 */
import type { ReactNode } from 'react';
import { cx } from '../../components';

export const FIELD_CONTROL =
  'h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink-900 ' +
  'transition-colors duration-100 placeholder:text-ink-400 hover:border-ink-300 focus:border-accent-500';

export const FIELD_TEXTAREA =
  'w-full resize-none rounded-md border border-line-strong bg-surface p-3 text-[13px] leading-6 ' +
  'text-ink-900 transition-colors duration-100 placeholder:text-ink-400 focus:border-accent-500';

export function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={htmlFor} className="hv-label block">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
