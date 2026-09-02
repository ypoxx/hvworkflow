/** One horizontal band for the controls of a view, so every screen puts its actions in one place. */
import type { ReactNode } from 'react';
import { cx } from './cx';

export function Toolbar({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="toolbar"
      {...(label !== undefined ? { 'aria-label': label } : {})}
      className={cx('flex min-h-9 flex-wrap items-center gap-2', className)}
    >
      {children}
    </div>
  );
}

export function ToolbarSpacer() {
  return <span className="flex-1" />;
}

export function ToolbarSeparator() {
  return <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line" />;
}
