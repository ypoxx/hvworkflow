/**
 * Scheibe 041: the small building blocks of the Verwaltung — form fields (the kit has no input yet; same tokens as the
 * other feature folders), the refusal inside a dialog, the list states (loading, failed, empty) and the frame of a tab
 * with its one primary action on the right (D2).
 */
import type { ReactNode } from 'react';
import { Button, EmptyState, Panel, cx } from '../../components';
import { useT } from '../../i18n';
import type { DialogProblem } from './problems';

const CONTROL =
  'w-full rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink-900 ' +
  'transition-colors duration-100 placeholder:text-ink-400 hover:border-ink-300 focus:border-accent-500';
export const FIELD_CONTROL = `h-8 ${CONTROL}`;
export const TEXTAREA_CONTROL = `h-20 py-1.5 ${CONTROL}`;

export function Field({
  label,
  htmlFor,
  hint,
  hintId,
  optional = false,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  hintId?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="hv-label block">
        {label}
        {optional && <span className="ml-1 font-normal normal-case text-ink-600">({t('admin.optional')})</span>}
      </label>
      <div className="mt-1">{children}</div>
      {hint !== undefined && (
        <p {...(hintId !== undefined ? { id: hintId } : {})} className="mt-1 text-2xs text-ink-600">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A refusal of the service inside the open dialog: the sentence and, when named, the rule id in mono (D5). */
export function ProblemNote({ problem }: { problem: DialogProblem }) {
  const t = useT();
  return (
    <p
      role="alert"
      data-testid="admin-problem"
      data-rule={problem.ruleId ?? ''}
      className="rounded-md border border-line-strong px-3 py-2 text-[13px]"
      style={{ backgroundColor: 'var(--color-tone-danger-bg)', color: 'var(--color-tone-danger-fg)' }}
    >
      {t(problem.key)}
      {problem.ruleId !== undefined && (
        <span className="ml-1 whitespace-nowrap">
          ({t('toast.rule')} <span className="font-mono text-2xs">{problem.ruleId}</span>)
        </span>
      )}
    </p>
  );
}

/** The frame of one tab: its name as heading and, where it has one, its primary action on the right. */
export function TabFrame({
  title,
  action,
  toolbar,
  children,
}: {
  title: string;
  action?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel title={title} actions={toolbar !== undefined || action !== undefined ? <>{toolbar}{action}</> : undefined} padded={false} className="h-full" bodyClassName="overflow-auto">
      {children}
    </Panel>
  );
}

/** Row skeletons at row height while a list loads (D6); the text is for screen readers. */
export function LoadingRows({ rows = 6 }: { rows?: number }) {
  const t = useT();
  return (
    <div role="status" data-testid="admin-loading" className="px-3 py-1">
      <span className="sr-only">{t('admin.loading')}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="flex h-9 items-center border-b border-line last:border-b-0">
          <div className="h-3 w-full max-w-[60%] rounded bg-ink-100" />
        </div>
      ))}
    </div>
  );
}

/** A read error of one tab, with "Erneut laden" (D6). */
export function ReadFailed({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div role="status" data-testid="admin-failed" className="p-4">
      <EmptyState
        title={t('admin.failed')}
        action={
          <Button variant="secondary" onClick={onRetry}>
            {t('admin.retry')}
          </Button>
        }
      />
    </div>
  );
}

/** An empty list says what to do next (D6). */
export function EmptyList({ text }: { text: string }) {
  return (
    <div data-testid="admin-empty" className="p-4">
      <EmptyState title={text} />
    </div>
  );
}

/** A secondary action in a row: a text button, named with its row for screen readers. */
export function RowAction({
  label,
  name,
  testId,
  focusKey,
  onClick,
  className,
}: {
  label: string;
  name: string;
  testId: string;
  focusKey: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      data-testid={testId}
      data-focus-key={focusKey}
      aria-label={name}
      onClick={onClick}
      className={cx('text-accent-700', className)}
    >
      {label}
    </Button>
  );
}
