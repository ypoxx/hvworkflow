/**
 * Scheibe 061 (part B): the figures of the control desk (Leitstand) — the main reading (oldest open question), the
 * three cards, the inflow, the stations and the backlog per unit. A console, not a dashboard: calm while all is calm;
 * colour only above a threshold, then always with symbol, word and threshold (D4, spec decision 4). Every number is mono
 * with tabular figures (D5); every clickable figure carries the one accessible name pattern of decision 4.
 */
import { useId } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { QuestionStatus, Unit } from '@hv/domain';
import type { Cockpit } from '../../api/cockpit';
import { Badge, Button, cx } from '../../components';
import { useT } from '../../i18n';
import type { TKey, Translate } from '../../i18n';
import {
  backlogScale,
  durationParts,
  formatDuration,
  INFLOW_GEOMETRY,
  inflowBars,
  levelText,
  listName,
  STATIONS,
  stationLabel,
  sum,
  unitName,
  unitRows,
} from './lib';
import type { LevelText, Selection, StationStatus } from './lib';

/** The one surface of this page: the kit's panel look (border, radius, hairline shadow), here also for buttons. */
export const CARD = 'rounded-lg border border-line bg-surface shadow-[0_1px_2px_rgba(31,30,28,0.04)]';
/** A clickable card: quiet hover, the product's focus ring (index.css), no movement (D8). */
const CARD_BUTTON = cx(CARD, 'text-left transition-colors duration-100 hover:border-ink-300 hover:bg-ink-25');
/** The caps label of a figure: 12 px, weight 500, grey 600 (spec decision 3; grey 600 for the wall screen). */
export const LABEL = 'text-xs font-medium uppercase tracking-[0.06em] text-ink-600';

export type OpenList = (selection: Selection, trigger: string) => void;

/** The level as a badge: warning tone with a triangle, danger tone with an octagon; calm renders nothing (D4). */
export function LevelBadge({ level, testId = 'cockpit-level' }: { level: LevelText | undefined; testId?: string }) {
  if (level === undefined) return null;
  const Icon = level.level === 'critical' ? OctagonAlert : TriangleAlert;
  return (
    <span data-testid={testId} data-level={level.level} className="inline-flex shrink-0">
      <Badge tone={level.level === 'critical' ? 'danger' : 'warning'}>
        <Icon size={12} strokeWidth={2} aria-hidden="true" />
        {level.text}
      </Badge>
    </span>
  );
}

/** A duration with big digits and small units ("50 min", "1 h 40 min"); the main reading's 44 px figure. */
function BigDuration({ seconds }: { seconds: number }) {
  const t = useT();
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      {durationParts(seconds).map((part) => (
        <span key={part.unit} className="inline-flex items-baseline gap-1">
          <span className="font-mono text-[44px] leading-[48px] font-medium tracking-[-0.02em] text-ink-900 tabular-nums">
            {part.value}
          </span>
          <span className="font-mono text-base text-ink-600">{t(part.unit === 'h' ? 'time.unit.h' : 'time.unit.min')}</span>
        </span>
      ))}
    </span>
  );
}

/** "F-0125 · zugewiesen · Finanzen": number mono, station from `status.*`, unit by short name. */
function RefLine({ number, status, unitId, units }: { number: string; status: QuestionStatus; unitId?: string; units: readonly Unit[] }) {
  const t = useT();
  return (
    <>
      <span className="font-mono text-ink-900">{number}</span>
      <span aria-hidden="true" className="text-ink-400"> · </span>
      {stationLabel(t, status)}
      <span aria-hidden="true" className="text-ink-400"> · </span>
      {unitName(units, unitId) ?? t('cockpit.noUnit')}
    </>
  );
}

/* ---------- main reading: the oldest open question (Z10) ---------- */

export function OldestPanel({
  cockpit,
  units,
  onOpenThread,
  className,
}: {
  cockpit: Cockpit;
  units: readonly Unit[];
  onOpenThread: (id: string, trigger: string) => void;
  className?: string;
}) {
  const t = useT();
  const titleId = useId();
  const { ageSeconds, items } = cockpit.oldestOpen;
  const open = cockpit.totals.open > 0;
  // 8a (review R5): the first readable reference is the main reference only if it is the oldest itself; otherwise the
  // age stands alone and every readable reference goes to "Danach die ältesten".
  const head = items[0];
  const first = head !== undefined && head.ageSeconds === ageSeconds ? head : undefined;
  const rest = first === undefined ? items : items.slice(1);
  const level = open ? levelText(t, 'oldestOpen', ageSeconds) : undefined;

  return (
    <section aria-labelledby={titleId} data-testid="cockpit-oldest" className={cx(CARD, 'flex min-h-[21rem] flex-col p-4', className)}>
      <h2 id={titleId} className={LABEL}>
        {t('cockpit.label.oldest')}
      </h2>
      <div className="mt-3 flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2">
        <p data-testid="cockpit-oldest-age" data-seconds={open ? ageSeconds : 0}>
          {open ? <BigDuration seconds={ageSeconds} /> : <span className="font-mono text-[44px] leading-[48px] text-ink-600">—</span>}
        </p>
        <LevelBadge level={level} />
      </div>
      {!open && <p className="mt-3 text-[13px] text-ink-600">{t('cockpit.oldest.none')}</p>}
      {first !== undefined && (
        <>
          <p data-testid="cockpit-oldest-ref" className="mt-3 text-[13px] text-ink-800">
            <RefLine number={first.number} status={first.status} {...(first.unitId !== undefined ? { unitId: first.unitId } : {})} units={units} />
          </p>
          <p className="mt-1 text-[13px] text-ink-600">
            {t('cockpit.oldest.inStatus', { duration: formatDuration(t, first.statusAgeSeconds) })}
          </p>
          <div className="mt-4">
            <Button
              variant="primary"
              data-testid="cockpit-oldest-open"
              data-primary="true"
              data-cockpit-trigger="oldest-main"
              onClick={() => onOpenThread(first.id, 'oldest-main')}
            >
              {t('cockpit.oldest.thread')}
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>
        </>
      )}
      {rest.length > 0 && (
        <div className="mt-auto pt-4">
          <div className="border-t border-line pt-4">
            <h3 className={LABEL}>{t('cockpit.label.next')}</h3>
            <ul className="mt-2 -mx-2">
              {rest.map((item) => {
                const unit = unitName(units, item.unitId) ?? t('cockpit.noUnit');
                const station = stationLabel(t, item.status);
                const age = formatDuration(t, item.ageSeconds);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid="cockpit-oldest-next"
                      data-id={item.id}
                      data-cockpit-trigger={`oldest-next:${item.id}`}
                      aria-label={t('cockpit.oldest.next', { number: item.number, station, unit, age })}
                      onClick={() => onOpenThread(item.id, `oldest-next:${item.id}`)}
                      className="grid h-9 w-full grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 text-left text-[13px] transition-colors duration-100 hover:bg-ink-50"
                    >
                      <span className="font-mono text-ink-900">{item.number}</span>
                      <span className="truncate text-ink-700">
                        {station}
                        <span aria-hidden="true" className="text-ink-400"> · </span>
                        {unit}
                      </span>
                      <span className="text-right font-mono text-ink-800 tabular-nums">{age}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- the three cards and the inflow ---------- */

function FigureCard({
  testId,
  label,
  count,
  level,
  sub,
  onClick,
}: {
  testId: string;
  label: string;
  count: number;
  level?: LevelText;
  sub: ReactNode;
  onClick: () => void;
}) {
  const t = useT();
  const subId = useId();
  return (
    <button
      type="button"
      data-testid={testId}
      data-count={count}
      data-cockpit-trigger={testId}
      // One string for the visible label and the name (WCAG 2.5.3); the sub-line describes the figure.
      aria-label={listName(t, label, count, level)}
      aria-describedby={subId}
      onClick={onClick}
      className={cx(CARD_BUTTON, '@container flex min-h-[8.5rem] flex-col items-start p-4')}
    >
      {/* Narrow cards (wall screen) keep two label lines in each card, so the numbers of the row stay on one line (D3). */}
      <span className={cx(LABEL, 'min-h-8 @[15rem]:min-h-0')}>{label}</span>
      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[28px] leading-9 font-medium text-ink-900 tabular-nums">{count}</span>
        <LevelBadge level={level} />
      </span>
      <span id={subId} className="mt-1 text-[13px] text-ink-600">{sub}</span>
    </button>
  );
}

export function Cards({ cockpit, onOpenList }: { cockpit: Cockpit; onOpenList: OpenList }) {
  const t = useT();
  const debateClosed = cockpit.debateClosedAt !== undefined;
  return (
    <div className="grid grid-cols-1 gap-4 @xl:grid-cols-3">
      <FigureCard
        testId="cockpit-card-open"
        label={t('cockpit.label.open')}
        count={cockpit.totals.open}
        {...optionalLevel(levelText(t, 'openTotal', cockpit.totals.open, { debateClosed }))}
        sub={debateClosed ? t('cockpit.open.afterClose') : t('cockpit.open.of', { captured: cockpit.totals.captured })}
        onClick={() => onOpenList({ list: 'open' }, 'cockpit-card-open')}
      />
      <FigureCard
        testId="cockpit-card-legal"
        label={t('cockpit.label.legal')}
        count={cockpit.legalReview.over10m}
        {...optionalLevel(levelText(t, 'legalReviewOver10m', cockpit.legalReview.over10m))}
        sub={t('cockpit.legal.of', { n: cockpit.openByStatus.in_review })}
        onClick={() => onOpenList({ list: 'legal' }, 'cockpit-card-legal')}
      />
      <FigureCard
        testId="cockpit-card-stage"
        label={t('cockpit.label.stage')}
        count={cockpit.totals.staged}
        sub={t('cockpit.stage.answered', { n: cockpit.totals.answered })}
        onClick={() => onOpenList({ list: 'stage' }, 'cockpit-card-stage')}
      />
    </div>
  );
}

const optionalLevel = (level: LevelText | undefined): { level?: LevelText } => (level === undefined ? {} : { level });

/** Twelve bars of 18 px in 280 × 48, one colour; position carries the meaning, the newest window in the accent. */
export function InflowChart({ bins }: { bins: readonly number[] }) {
  const t = useT();
  const { bars } = inflowBars(bins);
  const { width, height } = INFLOW_GEOMETRY;
  return (
    <span className="flex flex-col gap-1">
      <svg
        data-testid="cockpit-inflow-chart"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('cockpit.inflow.chart', { values: bins.join(', '), last: bins[bins.length - 1] ?? 0 })}
        className="block overflow-visible"
      >
        {bars.map((bar, i) => (
          <rect
            key={i}
            data-testid="cockpit-inflow-bar"
            data-value={bar.value}
            data-latest={bar.latest}
            data-empty={bar.empty}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            rx={bar.empty ? 0 : 1.5}
            // Grey 500 holds 3.9:1 on the card, also as the 1 px stroke of an empty window (orchestrator decision, spec 5).
            className={bar.latest && !bar.empty ? 'fill-accent-500' : 'fill-ink-500'}
          />
        ))}
      </svg>
      <span aria-hidden="true" className="flex justify-between font-mono text-[11px] leading-4 text-ink-600" style={{ width }}>
        <span>{t('cockpit.inflow.axisStart')}</span>
        <span>{t('cockpit.inflow.axisEnd')}</span>
      </span>
    </span>
  );
}

export function InflowCard({ cockpit, onOpenList }: { cockpit: Cockpit; onOpenList: OpenList }) {
  const t = useT();
  const subId = useId();
  const label = t('cockpit.label.inflow');
  const count = cockpit.inflow.last5m;
  return (
    <button
      type="button"
      data-testid="cockpit-card-inflow"
      data-count={count}
      data-cockpit-trigger="cockpit-card-inflow"
      aria-label={listName(t, label, count)}
      aria-describedby={subId}
      onClick={() => onOpenList({ list: 'inflow' }, 'cockpit-card-inflow')}
      className={cx(CARD_BUTTON, 'flex min-h-[8.5rem] flex-col items-start p-4')}
    >
      <span className={LABEL}>{label}</span>
      {/* As in the sketch: number, chart and the hour's sum on one line, the axis under the chart. */}
      <span className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-2">
        <span className="font-mono text-[28px] leading-[48px] font-medium text-ink-900 tabular-nums">{count}</span>
        <InflowChart bins={cockpit.inflow.bins} />
        <span id={subId} className="text-[13px] leading-[48px] text-ink-600">
          {t('cockpit.inflow.hour', { n: sum(cockpit.inflow.bins) })}
        </span>
      </span>
    </button>
  );
}

/* ---------- stations ---------- */

/** The 3 px top edge of a station in its status tint (named exception to D4: the tint never fills an area). */
const STATION_EDGE: Readonly<Record<StationStatus, string>> = {
  captured: 'border-t-status-captured-fg',
  classified: 'border-t-status-classified-fg',
  assigned: 'border-t-status-assigned-fg',
  answer_drafted: 'border-t-status-answer-drafted-fg',
  in_review: 'border-t-status-in-review-fg',
  approved: 'border-t-status-approved-fg',
};

export function Stations({ cockpit, onOpenList }: { cockpit: Cockpit; onOpenList: OpenList }) {
  const t = useT();
  const titleId = useId();
  const legal = levelText(t, 'legalReviewOver10m', cockpit.legalReview.over10m);
  return (
    <section aria-labelledby={titleId} className={cx(CARD, 'overflow-hidden')}>
      <h2 id={titleId} className={cx(LABEL, 'px-4 pt-3 pb-2')}>
        {t('cockpit.label.stations')}
      </h2>
      <ul className="grid grid-cols-3 gap-px border-t border-line bg-line @3xl:grid-cols-6">
        {STATIONS.map((status) => {
          const count = cockpit.openByStatus[status];
          const label = stationLabel(t, status);
          const bottleneck = status === 'in_review' ? legal : undefined;
          return (
            <li key={status} className="flex bg-surface">
              <button
                type="button"
                data-testid="cockpit-station"
                data-status={status}
                data-count={count}
                data-cockpit-trigger={`station:${status}`}
                // The station names its bottleneck, not the threshold of the card it comes from (review minor 2).
                aria-label={listName(t, label, count, bottleneck === undefined ? undefined : t('cockpit.bottleneck'))}
                onClick={() => onOpenList({ list: 'open', station: status }, `station:${status}`)}
                className={cx(
                  'flex min-h-[5.25rem] w-full flex-col items-start gap-2 border-t-[3px] px-4 pt-3 pb-3 text-left',
                  'transition-colors duration-100 hover:bg-ink-25 focus-visible:-outline-offset-2',
                  STATION_EDGE[status],
                )}
              >
                <span className={LABEL}>{label}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={cx('font-mono text-xl leading-7 font-medium tabular-nums', count === 0 ? 'text-ink-600' : 'text-ink-900')}>
                    {count}
                  </span>
                  {bottleneck !== undefined && (
                    <span data-testid="cockpit-bottleneck" data-level={bottleneck.level} className="inline-flex">
                      <Badge tone={bottleneck.level === 'critical' ? 'danger' : 'warning'}>
                        {bottleneck.level === 'critical' ? (
                          <OctagonAlert size={12} strokeWidth={2} aria-hidden="true" />
                        ) : (
                          <TriangleAlert size={12} strokeWidth={2} aria-hidden="true" />
                        )}
                        {t('cockpit.bottleneck')}
                      </Badge>
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- backlog per unit ---------- */

const FILL: Readonly<Record<'calm' | 'attention' | 'critical', string>> = {
  calm: 'bg-ink-400',
  attention: 'bg-tone-warning-fg',
  critical: 'bg-tone-danger-fg',
};

const BACKLOG_FIGURE = { unit: 'unitBacklog', none: 'unassignedBacklog' } as const;

export function Backlog({
  cockpit,
  units,
  attention,
  onOpenList,
}: {
  cockpit: Cockpit;
  units: readonly Unit[];
  /** The threshold "erhöht" of the backlog, for the legend and the marker. */
  attention: number;
  onOpenList: OpenList;
}) {
  const t = useT();
  const titleId = useId();
  const rows = unitRows(cockpit, units);
  const scale = backlogScale(rows);
  const marker = `${(attention / scale) * 100}%`;
  return (
    <section aria-labelledby={titleId} data-testid="cockpit-backlog" className={CARD}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-3 pb-2">
        <h2 id={titleId} className={LABEL}>
          {t('cockpit.label.backlog')}
        </h2>
        <p className="flex items-center gap-2 text-[11px] leading-4 text-ink-600">
          <span aria-hidden="true" className="inline-block h-3 w-px bg-ink-500" />
          {t('cockpit.backlog.legend', { n: attention })}
        </p>
      </header>
      <ul className="px-2 pb-2">
        {rows.map((row) => {
          const label = row.unassigned ? t('cockpit.backlog.noUnit') : row.name;
          const level = levelText(t, row.unassigned ? BACKLOG_FIGURE.none : BACKLOG_FIGURE.unit, row.count);
          const width = `${(row.count / scale) * 100}%`;
          return (
            <li key={row.id}>
              <button
                type="button"
                data-testid="cockpit-unit-row"
                data-unit={row.id}
                data-count={row.count}
                data-level={row.level}
                data-cockpit-trigger={`unit:${row.id}`}
                aria-label={listName(t, label, row.count, level)}
                onClick={() => onOpenList({ list: 'unit', unit: row.id }, `unit:${row.id}`)}
                className="grid min-h-9 w-full grid-cols-[minmax(6rem,11rem)_minmax(4rem,1fr)_3rem] items-center gap-x-4 rounded-md px-2 py-1 text-left transition-colors duration-100 hover:bg-ink-50 @2xl:grid-cols-[11rem_minmax(0,1fr)_3rem_11rem]"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] text-ink-800">{label}</span>
                  {row.unassigned && <span className="truncate text-[11px] leading-4 text-ink-600">{t('cockpit.backlog.noUnitHint')}</span>}
                </span>
                <span className="relative h-2 rounded-sm bg-ink-100">
                  <span
                    data-testid="cockpit-unit-bar"
                    className={cx('absolute inset-y-0 left-0 rounded-sm', FILL[row.level])}
                    style={row.count > 0 ? { width, minWidth: '2px' } : { width: '0%' }}
                  />
                  <span
                    data-testid="cockpit-unit-marker"
                    aria-hidden="true"
                    className="absolute -top-1.5 -bottom-1.5 w-px bg-ink-500"
                    style={{ left: marker }}
                  />
                </span>
                <span className={cx('text-right font-mono text-[13px] tabular-nums', row.count === 0 ? 'text-ink-600' : 'text-ink-900')}>
                  {row.count}
                </span>
                <span className="col-span-3 flex min-h-5 justify-start @2xl:col-span-1">
                  <LevelBadge level={level} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- head of the page ---------- */

/** The place of the canary question (086 fills it); quiet, not focusable (spec decision 9). */
export function CanaryLine({ status }: { status?: undefined }) {
  const t = useT();
  void status;
  return (
    <span data-testid="cockpit-canary" className="text-[13px] text-ink-600">
      {t('cockpit.canary')}
    </span>
  );
}

const MEETING_KEYS: Readonly<Record<'preparation' | 'closed', TKey>> = {
  preparation: 'cockpit.meeting.preparation',
  closed: 'cockpit.meeting.closed',
};

export function HeaderMeta({ cockpit, t, time }: { cockpit: Cockpit | null; t: Translate; time: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {cockpit !== null && cockpit.meetingStatus !== 'running' && (
        <span data-testid="cockpit-meeting-status" className="inline-flex">
          <Badge tone="neutral">{t(MEETING_KEYS[cockpit.meetingStatus])}</Badge>
        </span>
      )}
      {time !== null && (
        <span data-testid="cockpit-asof" className="font-mono text-[13px] text-ink-700 tabular-nums">
          {t('cockpit.asOf', { time })}
        </span>
      )}
      {time !== null && <span aria-hidden="true" className="text-ink-400">·</span>}
      <CanaryLine />
    </div>
  );
}
