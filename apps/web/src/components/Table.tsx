/**
 * Table primitives with a sticky head and 36px rows. Long lists are read by scanning columns, so the
 * head has to stay put and the row height has to be identical everywhere.
 */
import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cx } from './cx';

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <table className={cx('w-full border-collapse text-[13px]', className)}>{children}</table>
  );
}

export function THead({ children, className }: { children: ReactNode; className?: string }) {
  return <thead className={cx('sticky top-0 z-10 bg-sunken', className)}>{children}</thead>;
}

export function TBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={className}>{children}</tbody>;
}

export function TR({
  children,
  className,
  selected = false,
}: {
  children: ReactNode;
  className?: string;
  selected?: boolean;
}) {
  return (
    <tr
      {...(selected ? { 'aria-selected': true } : {})}
      className={cx(
        'h-9 border-b border-line last:border-b-0',
        selected ? 'bg-accent-50' : 'hover:bg-ink-25',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function TH({ numeric = false, className, children, ...rest }: THProps) {
  return (
    <th
      scope="col"
      className={cx(
        'hv-label h-8 border-b border-line px-3 text-left align-middle font-medium',
        numeric && 'text-right',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  mono?: boolean;
}

export function TD({ numeric = false, mono = false, className, children, ...rest }: TDProps) {
  return (
    <td
      className={cx(
        'px-3 align-middle text-ink-800',
        numeric && 'text-right',
        mono && 'font-mono tabular-nums',
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
