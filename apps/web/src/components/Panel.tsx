/** A bordered work surface. Dense rows need generous panel padding to stay calm; this sets both. */
import type { ReactNode } from 'react';
import { cx } from './cx';

export interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Buttons on the right of the panel head. */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Off for panels that hold their own scroller or a table. */
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

export function Panel({
  title,
  description,
  actions,
  footer,
  padded = true,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  return (
    <section
      className={cx(
        'flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface',
        'shadow-[0_1px_2px_rgba(31,30,28,0.04)]',
        className,
      )}
    >
      {(title !== undefined || actions !== undefined) && (
        <header className="flex min-h-11 shrink-0 items-center gap-3 border-b border-line px-4 py-2">
          <div className="min-w-0 flex-1">
            {title !== undefined && (
              <h2 className="truncate text-[13px] font-semibold text-ink-900">{title}</h2>
            )}
            {description !== undefined && (
              <p className="truncate text-2xs text-ink-500">{description}</p>
            )}
          </div>
          {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('min-h-0 flex-1', padded && 'p-4', bodyClassName)}>{children}</div>
      {footer !== undefined && (
        <footer className="shrink-0 border-t border-line bg-sunken px-4 py-2 text-2xs text-ink-500">
          {footer}
        </footer>
      )}
    </section>
  );
}
