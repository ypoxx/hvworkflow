/**
 * Scheibe 061 (part B, spec decision 6, Z13 in part): the thread (Faden) of one question, horizontal and full width
 * under the list. The stations it went through in time order with the hall time, the current one with its time in this
 * station, then the stations not yet reached up to "vorgelesen" — three shapes, so the line reads without colour.
 * Returns are entries of their own; after eight entries the line breaks. No actor, no return reason, no answer text.
 */
import { useId } from 'react';
import { X } from 'lucide-react';
import type { Unit } from '@hv/domain';
import { Badge, Button, cx } from '../../components';
import { stageAssignmentLabel, useT } from '../../i18n';
import { CARD } from './Figures';
import { chunks, formatDuration, hallTime, stationLabel, THREAD_ROW, unitName } from './lib';
import type { ThreadEntry, ThreadRead } from './lib';

const MARK: Readonly<Record<ThreadEntry['state'], { shape: string; className: string }>> = {
  past: { shape: 'filled', className: 'h-2 w-2 bg-ink-600' },
  current: { shape: 'ring', className: 'h-4 w-4 border-2 border-accent-500 bg-accent-50' },
  future: { shape: 'hollow', className: 'h-2 w-2 border border-ink-300 bg-surface' },
};

function Entry({ entry, next }: { entry: ThreadEntry; next: ThreadEntry | undefined }) {
  const t = useT();
  const station = stationLabel(t, entry.status);
  const time = entry.at === undefined ? undefined : hallTime(entry.at);
  const since = entry.sinceSeconds === undefined ? undefined : t('cockpit.thread.since', { duration: formatDuration(t, entry.sinceSeconds) });
  const name =
    entry.state === 'future'
      ? t('cockpit.thread.future', { station })
      : entry.state === 'current'
        ? since === undefined
          ? t('cockpit.thread.currentOnly', { station })
          : t('cockpit.thread.current', { station, duration: formatDuration(t, entry.sinceSeconds ?? 0) })
        : t('cockpit.thread.past', { station, time: time ?? '' });
  const mark = MARK[entry.state];
  return (
    <li
      data-testid="cockpit-thread-entry"
      data-status={entry.status}
      data-state={entry.state}
      aria-label={name}
      {...(entry.state === 'current' ? { 'aria-current': 'step' as const } : {})}
      className="min-w-0"
    >
      <span aria-hidden="true" className="flex h-4 items-center">
        <span data-testid="cockpit-thread-mark" data-shape={mark.shape} className={cx('shrink-0 rounded-full', mark.className)} />
        {next !== undefined && (
          <span className={cx('mx-2 h-px flex-1', next.state === 'future' ? 'bg-ink-200' : 'bg-ink-600')} />
        )}
      </span>
      <span aria-hidden="true" className="mt-2 block pr-3">
        <span className={cx('block truncate text-[13px]', entry.state === 'current' ? 'font-medium text-ink-900' : entry.state === 'past' ? 'text-ink-800' : 'text-ink-600')}>
          {station}
        </span>
        {time !== undefined && <span className="block truncate font-mono text-[11px] leading-4 text-ink-600 tabular-nums">{time}</span>}
        {/* Its own line, wrapping if it must: "seit 5 h 5 min" is never cut off (design critique 3, 15). */}
        {since !== undefined && (
          <span data-testid="cockpit-thread-since" className="block font-mono text-[11px] leading-4 text-ink-600 tabular-nums">
            {since}
          </span>
        )}
      </span>
    </li>
  );
}

export function Thread({ read, units, onClose, onRetry }: { read: ThreadRead; units: readonly Unit[]; onClose: () => void; onRetry: () => void }) {
  const t = useT();
  const titleId = useId();
  const unit = read.status === 'ready' ? unitName(units, read.unitId) : undefined;
  return (
    <section aria-labelledby={titleId} data-testid="cockpit-thread" data-id={read.id} className={cx(CARD, 'overflow-hidden')}>
      <header className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2">
        <h2 id={titleId} tabIndex={-1} data-testid="cockpit-thread-title" className="text-[13px] font-semibold text-ink-900">
          {t('cockpit.thread.title', { number: read.number })}
        </h2>
        {unit !== undefined && <Badge tone="outline">{unit}</Badge>}
        {read.status === 'ready' && read.stageAssignment !== undefined && (
          <Badge tone="outline">{t('cockpit.thread.seat', { seat: stageAssignmentLabel(t, read.stageAssignment) })}</Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          data-testid="cockpit-thread-close"
          aria-label={t('cockpit.thread.close')}
          onClick={onClose}
          className="ml-auto"
          icon={<X size={14} strokeWidth={2} aria-hidden="true" />}
        />
      </header>
      <div className="min-h-[7.5rem] px-4 pt-3 pb-4">
        {read.status === 'loading' && <p className="text-[13px] text-ink-600">{t('cockpit.thread.loading')}</p>}
        {read.status === 'failed' && (
          // An incomplete thread says so, with its rule, and is read again on request (Codex P2).
          <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[13px] text-ink-600">
              {t('cockpit.thread.failed')}
              {read.ruleId !== undefined && ` ${t('cockpit.error.rule', { rule: read.ruleId })}`}
            </p>
            <Button size="sm" data-testid="cockpit-thread-retry" onClick={onRetry}>
              {t('cockpit.error.retry')}
            </Button>
          </div>
        )}
        {read.status === 'ready' && (
          <>
            {read.text !== undefined && <p className="max-w-4xl text-sm leading-6 text-ink-800">{read.text}</p>}
            <div className="mt-4 space-y-4" role="group" aria-label={t('cockpit.thread.label', { number: read.number })}>
              {chunks(read.entries, THREAD_ROW).map((row, r) => (
                <ol key={r} data-testid="cockpit-thread-row" className="grid grid-cols-4 gap-y-4 @3xl:grid-cols-8">
                  {row.map((entry, i) => (
                    <Entry key={`${r}:${i}`} entry={entry} next={row[i + 1]} />
                  ))}
                </ol>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
