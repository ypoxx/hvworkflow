/**
 * Scheibe 061 (part B, spec decision 6): the list behind a figure, full width under the backlog. Number, station, unit,
 * one time column where the reading has one, "offen seit" — never question text, speaker or request to speak in a row.
 * One row is in the tab order (roving focus); arrows move within, Enter opens the thread. The list carries its own
 * number: it may differ from the card, because list and figure are read at different moments (the next reading aligns).
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import type { Unit } from '@hv/domain';
import { Badge, Button, cx } from '../../components';
import { useT } from '../../i18n';
import type { TKey } from '../../i18n';
import { CARD } from './Figures';
import { formatDuration, groupByStation, stationLabel, unitName } from './lib';
import type { ListRead, ListRow, Selection } from './lib';

const NO_ROWS: readonly ListRow[] = [];
const COLUMNS = 'grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)_6.5rem] items-center gap-x-4 @3xl:grid-cols-[5.5rem_12rem_minmax(0,1fr)_8rem_7rem]';
const COLUMNS_NO_TIME = 'grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)_6.5rem] items-center gap-x-4 @3xl:grid-cols-[5.5rem_12rem_minmax(0,1fr)_7rem]';

function titleOf(t: ReturnType<typeof useT>, selection: Selection, units: readonly Unit[]): string {
  switch (selection.list) {
    case 'oldest': return t('cockpit.list.oldest');
    case 'legal': return t('cockpit.list.legal');
    case 'stage': return t('cockpit.list.stage');
    case 'inflow': return t('cockpit.list.inflow');
    case 'open': return selection.station === undefined ? t('cockpit.list.open') : stationLabel(t, selection.station);
    case 'unit':
      return selection.unit === 'none' ? t('cockpit.list.noUnit') : t('cockpit.list.unit', { unit: unitName(units, selection.unit) ?? '' });
  }
}

/** The time column of a list: "in diesem Status" for the oldest, "wartet seit" for legal clearing, none elsewhere. */
function timeColumn(selection: Selection): TKey | undefined {
  if (selection.list === 'oldest') return 'cockpit.col.inStatus';
  if (selection.list === 'legal') return 'cockpit.col.waiting';
  return undefined;
}

export function DrillList({
  selection,
  read,
  units,
  onOpenThread,
  onClose,
}: {
  selection: Selection;
  read: ListRead;
  units: readonly Unit[];
  onOpenThread: (id: string, trigger: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const root = useRef<HTMLElement>(null);
  const lastFocused = useRef<string | null>(null);
  const timeKey = timeColumn(selection);
  const columns = timeKey === undefined ? COLUMNS_NO_TIME : COLUMNS;
  const rows = read.status === 'ready' ? read.rows : NO_ROWS;
  const grouped = selection.list === 'open' && selection.station === undefined;
  const ordered = grouped ? groupByStation(rows).flatMap((group) => group.rows) : rows;
  const [active, setActive] = useState<string | null>(null);
  const tabStop = ordered.some((row) => row.id === selection.q) ? selection.q : ordered.some((row) => row.id === active) ? active : ordered[0]?.id;

  // A row that left the list while it held the focus hands the focus to the list's heading (spec decision 7).
  useEffect(() => {
    const gone = lastFocused.current;
    if (gone === null || rows.some((row) => row.id === gone)) return;
    lastFocused.current = null;
    if (document.activeElement === null || document.activeElement === document.body) {
      root.current?.querySelector<HTMLElement>('[data-testid="cockpit-list-title"]')?.focus({ preventScroll: true });
    }
  }, [rows]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>('[data-testid="cockpit-list-row"]') ?? [])];
    const index = buttons.indexOf(event.currentTarget);
    const next =
      event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1);
    const target = buttons[Math.max(0, Math.min(buttons.length - 1, next))];
    if (target === undefined) return;
    event.preventDefault();
    target.focus();
  };

  const renderRow = (row: ListRow) => {
    const station = stationLabel(t, row.status);
    const unit = unitName(units, row.unitId) ?? t('cockpit.noUnit');
    const age = formatDuration(t, row.ageSeconds);
    const time = row.timeSeconds === undefined ? undefined : formatDuration(t, row.timeSeconds);
    const selected = row.id === selection.q;
    const name = timeKey !== undefined && time !== undefined
      ? t('cockpit.row.nameTime', { number: row.number, station, unit, timeLabel: t(timeKey), time, age })
      : t('cockpit.row.name', { number: row.number, station, unit, age });
    return (
      <li key={row.id}>
        <button
          type="button"
          data-testid="cockpit-list-row"
          data-id={row.id}
          data-number={row.number}
          data-status={row.status}
          data-cockpit-trigger={`row:${row.id}`}
          tabIndex={row.id === tabStop ? 0 : -1}
          aria-label={name}
          {...(selected ? { 'aria-current': 'true' as const } : {})}
          onFocus={() => {
            lastFocused.current = row.id;
            setActive(row.id);
          }}
          onBlur={(event) => {
            // The focus went elsewhere on purpose: a later removal of this row must not pull it back (review R7).
            const next = event.relatedTarget;
            if (next instanceof Node && root.current?.contains(next) !== true) lastFocused.current = null;
          }}
          onKeyDown={onKeyDown}
          onClick={() => onOpenThread(row.id, `row:${row.id}`)}
          className={cx(
            columns,
            'relative h-9 w-full border-b border-line px-4 text-left text-[13px] transition-colors duration-100',
            // The list scrolls inside its panel: the focus ring sits inside the row, so the scroller cannot clip it.
            'focus-visible:-outline-offset-2',
            // Selected: the list pattern of the house — accent 50 and a left bar; the text keeps its colour.
            selected ? 'bg-accent-50 text-ink-800' : 'text-ink-800 hover:bg-ink-50',
          )}
        >
          {selected && <span aria-hidden="true" className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full bg-accent-600" />}
          <span className="font-mono text-ink-900">{row.number}</span>
          <span className="truncate">{station}</span>
          <span className="truncate">{unit}</span>
          {timeKey !== undefined && <span className="hidden text-right font-mono tabular-nums @3xl:block">{time}</span>}
          <span className="text-right font-mono tabular-nums">{age}</span>
        </button>
      </li>
    );
  };

  let body;
  if (read.status === 'loading') {
    body = <p className="flex min-h-24 items-center px-4 text-[13px] text-ink-600">{t('cockpit.list.loading')}</p>;
  } else if (read.status === 'failed') {
    body = <p role="status" className="flex min-h-24 items-center px-4 text-[13px] text-ink-600">{t('cockpit.list.failed')}</p>;
  } else if (rows.length === 0) {
    body = <p data-testid="cockpit-list-empty" className="flex min-h-24 items-center px-4 text-[13px] text-ink-600">{t('cockpit.list.empty')}</p>;
  } else if (grouped) {
    body = (
      <ul aria-labelledby={titleId}>
        {groupByStation(rows).map((group) => (
          <li key={group.status}>
            <h3 className="flex h-8 items-center gap-2 border-b border-line bg-sunken px-4 text-xs font-medium text-ink-700">
              {stationLabel(t, group.status)}
              <span className="font-mono text-ink-600 tabular-nums">{group.rows.length}</span>
            </h3>
            <ul>{group.rows.map(renderRow)}</ul>
          </li>
        ))}
      </ul>
    );
  } else {
    body = <ul aria-labelledby={titleId}>{rows.map(renderRow)}</ul>;
  }

  const capped = read.status === 'ready' && read.total !== undefined && read.total > rows.length;
  return (
    <section ref={root} aria-labelledby={titleId} data-testid="cockpit-list" data-list={selection.list} className={cx(CARD, 'overflow-hidden')}>
      <header className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2">
        <h2 id={titleId} tabIndex={-1} data-testid="cockpit-list-title" className="text-[13px] font-semibold text-ink-900">
          {titleOf(t, selection, units)}
        </h2>
        {read.status === 'ready' && (
          <span data-testid="cockpit-list-count" data-count={rows.length} className="inline-flex">
            <Badge>
              <span aria-hidden="true" className="font-mono">{rows.length}</span>
              <span className="sr-only">{t('cockpit.list.count', { n: rows.length })}</span>
            </Badge>
          </span>
        )}
        {capped && <span className="text-2xs text-ink-600">{t('cockpit.list.legalCapped', { shown: rows.length, total: read.total ?? 0 })}</span>}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          data-testid="cockpit-list-close"
          aria-label={t('cockpit.list.close')}
          onClick={onClose}
          className="ml-auto"
          icon={<X size={14} strokeWidth={2} aria-hidden="true" />}
        />
      </header>
      {read.status === 'ready' && rows.length > 0 && (
        <div aria-hidden="true" className={cx(timeKey === undefined ? COLUMNS_NO_TIME : COLUMNS, 'h-8 border-b border-line bg-sunken px-4 text-2xs font-medium tracking-[0.04em] text-ink-600 uppercase')}>
          <span>{t('cockpit.col.number')}</span>
          <span>{t('cockpit.col.station')}</span>
          <span>{t('cockpit.col.unit')}</span>
          {timeKey !== undefined && <span className="hidden text-right @3xl:block">{t(timeKey)}</span>}
          <span className="text-right">{t('cockpit.col.openSince')}</span>
        </div>
      )}
      <div className="max-h-[26rem] overflow-y-auto">{body}</div>
    </section>
  );
}
