/** Label above value. The reading order of a control room: what it is, then what it says. */
import type { ReactNode } from 'react';
import { cx } from './cx';

export function KeyValueList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cx('grid gap-3', className)}>{children}</dl>;
}

export interface KeyValueProps {
  label: string;
  /** Numbers, identifiers and question numbers are set in the mono face. */
  mono?: boolean;
  className?: string;
  children: ReactNode;
}

export function KeyValue({ label, mono = false, className, children }: KeyValueProps) {
  return (
    <div className={cx('min-w-0', className)}>
      <dt className="hv-label">{label}</dt>
      <dd className={cx('mt-0.5 text-[13px] text-ink-800', mono && 'font-mono tabular-nums')}>
        {children}
      </dd>
    </div>
  );
}
