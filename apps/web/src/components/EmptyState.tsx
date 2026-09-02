/** The honest answer when a list has nothing in it: what this place is for, and the way forward. */
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 rounded-md border border-dashed',
        'border-line-strong bg-sunken px-6 py-12 text-center',
        className,
      )}
    >
      {Icon !== undefined && (
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-ink-400">
          <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
      )}
      <div className="max-w-md space-y-1">
        <p className="text-[13px] font-semibold text-ink-800">{title}</p>
        {description !== undefined && <p className="text-[13px] text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
