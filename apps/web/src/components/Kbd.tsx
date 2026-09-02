/** A key cap. Shortcuts are only credible when they are printed where the action is. */
import type { ReactNode } from 'react';
import { cx } from './cx';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line-strong',
        'bg-sunken px-1 font-mono text-2xs font-medium text-ink-600',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
