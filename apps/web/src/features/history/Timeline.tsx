/**
 * Two readings of the same append-only log (AGENTS.md rule 7): the course of one question from
 * capture to podium, and the tail of the whole meeting. Both show the same four facts per row —
 * time, who, what, and the payload in house wording — so that a person who has learnt one has
 * learnt the other.
 */
import type { DomainEvent } from '@hv/domain';
import { EmptyState, Sparkline, cx } from '../../components';
import { eventTypeLabel, useT } from '../../i18n';
import { eventSubject, eventSummary } from './eventSummary';
import type { SummaryContext } from './eventSummary';
import { clockTime, elapsedSpan, eventGap, historyKpi } from './lib';
import { History } from 'lucide-react';

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="hv-label">{label}</span>
      <span className="font-mono text-[13px] tabular-nums text-ink-800">{value}</span>
    </div>
  );
}

/**
 * The three numbers of point 8, above the timeline — every one of them read off the event log, none
 * of them a status (AGENTS.md rule 5): the run from capture to podium, how many versions it took,
 * how often it was sent back.
 */
export function HistoryKpiLine({ events }: { events: readonly DomainEvent[] }) {
  const t = useT();
  const kpi = historyKpi(events);
  const duration =
    kpi.capturedAt !== undefined && kpi.deliveredAt !== undefined
      ? elapsedSpan(kpi.capturedAt, kpi.deliveredAt, t)
      : t('history.kpi.running');
  return (
    <div
      data-testid="history-kpi"
      className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-line pb-3"
    >
      <Kpi label={t('history.kpi.captureToDelivery')} value={duration} />
      <Kpi label={t('history.kpi.versions')} value={String(kpi.versions)} />
      <Kpi label={t('history.kpi.returns')} value={String(kpi.returns)} />
    </div>
  );
}

export function Timeline({
  events,
  context,
  label,
}: {
  events: readonly DomainEvent[];
  context: SummaryContext;
  label: string;
}) {
  const t = useT();
  return (
    <ol data-testid="history-timeline" aria-label={label} className="space-y-0">
      {events.map((event, index) => {
        const summary = eventSummary(t, event, context);
        const last = index === events.length - 1;
        const previous = events[index - 1];
        return (
          <li
            key={event.id}
            data-testid="history-event"
            data-type={event.type}
            className="grid grid-cols-[64px_16px_minmax(0,1fr)] gap-2"
          >
            <time className="pt-2 text-right font-mono text-2xs tabular-nums text-ink-400">
              {clockTime(event.at)}
            </time>
            <span aria-hidden="true" className="relative flex h-full justify-center">
              <span className={cx('w-px bg-line-strong', last ? 'h-4' : 'h-full')} />
              <span className="absolute top-2.5 h-2 w-2 rounded-full border border-accent-300 bg-accent-500" />
            </span>
            <div className={cx('min-w-0 pt-1.5', last ? 'pb-1' : 'pb-4')}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-medium text-ink-900">
                  {eventTypeLabel(t, event.type)}
                </span>
                <span className="text-2xs text-ink-500">
                  {event.actor.displayName ?? event.actor.id}
                </span>
                {previous !== undefined && (
                  <span
                    data-testid="history-duration"
                    className="ml-auto font-mono text-2xs tabular-nums text-ink-400"
                  >
                    {eventGap(previous.at, event.at, t)}
                  </span>
                )}
              </div>
              {summary !== '' && (
                <p className="mt-0.5 text-[13px] leading-snug text-ink-600">{summary}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function EventStream({
  events,
  context,
  curve,
}: {
  events: readonly DomainEvent[];
  context: SummaryContext;
  /** Events per 5-minute bucket over the last two hours, oldest first — the "Lastkurve" (point 9). */
  curve: readonly number[];
}) {
  const t = useT();

  if (events.length === 0) {
    return (
      <EmptyState
        icon={History}
        title={t('history.stream.empty.title')}
        description={t('history.stream.empty.body')}
      />
    );
  }

  return (
    <div data-testid="history-stream">
      <div data-testid="history-sparkline" className="border-b border-line px-3 py-2">
        <Sparkline values={[...curve]} ariaLabel={t('history.sparkline.caption')} className="h-7 w-full" />
        <p className="mt-1 text-2xs text-ink-500">{t('history.sparkline.caption')}</p>
      </div>
      <div className="sticky top-0 z-10 grid grid-cols-[72px_84px_minmax(0,1.1fr)_minmax(0,1.4fr)] gap-3 border-b border-line bg-sunken px-3 py-1.5">
        <span className="hv-label">{t('history.col.time')}</span>
        <span className="hv-label">{t('history.col.subject')}</span>
        <span className="hv-label">{t('history.col.event')}</span>
        <span className="hv-label">{t('history.col.detail')}</span>
      </div>
      {events.map((event) => {
        const subject = eventSubject(event, context);
        return (
          <div
            key={event.id}
            data-testid="history-event"
            data-type={event.type}
            className="grid grid-cols-[72px_84px_minmax(0,1.1fr)_minmax(0,1.4fr)] items-baseline gap-3 border-b border-line px-3 py-1.5 last:border-b-0 hover:bg-ink-25"
          >
            <span className="font-mono text-2xs tabular-nums text-ink-400">
              {clockTime(event.at)}
            </span>
            <span className="truncate font-mono text-2xs tabular-nums text-ink-600">
              {subject ?? ''}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-ink-900">
                {eventTypeLabel(t, event.type)}
              </span>
              <span className="block truncate text-2xs text-ink-500">
                {event.actor.displayName ?? event.actor.id}
              </span>
            </span>
            <span className="truncate text-[13px] text-ink-600">
              {eventSummary(t, event, context)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
