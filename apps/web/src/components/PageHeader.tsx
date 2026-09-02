/** The one heading pattern of a view: what this place is, what it is for, what can be done here. */
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[17px] leading-6 font-semibold tracking-[-0.01em] text-ink-900">
          {title}
        </h1>
        {description !== undefined && (
          <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>
        )}
      </div>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
