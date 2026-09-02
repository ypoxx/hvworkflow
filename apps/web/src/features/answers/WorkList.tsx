/**
 * The work list of the afternoon: several hundred questions, scanned by number, status and age.
 *
 * Two things keep it fast at 800 rows (D9): the corpus is fetched once per version, and only the
 * rows inside the viewport are in the DOM — the scroller keeps its full height, so the scrollbar
 * never lies and nothing jumps (D8/"Nichts springt"). The columns that are only context (track,
 * answering unit) disappear when the pane is dragged narrow, measured on the element itself rather
 * than on the viewport.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import type { Question, QuestionStatus } from '@hv/domain';
import { QUESTION_STATUSES, TERMINAL_STATUSES, TRACKS } from '@hv/domain';
import { Badge, Button, EmptyState, Panel, StatusBadge, TrackBadge, cx } from '../../components';
import { statusLabel, trackShortLabel, useT } from '../../i18n';
import type { Translate } from '../../i18n';
import { ROW_HEIGHT, excerpt, relativeAge } from './lib';
import { ALL, EMPTY_FILTERS, isFiltered } from './useBacklog';
import type { Backlog, Filters, SortOrder } from './useBacklog';

/** Statuses a question can still move on from — the only ones worth filtering a backlog by. */
const OPEN_STATUSES: readonly QuestionStatus[] = QUESTION_STATUSES.filter(
  (status) => !TERMINAL_STATUSES.includes(status),
);

/** Rows rendered above and below the viewport so that fast scrolling never shows a gap. */
const OVERSCAN = 6;

/**
 * The row keeps number, question, status and age at every width. The answer track joins in as soon
 * as the pane can carry it, the answering unit last — context, not identity.
 */
const TRACK_FROM = 520;
const UNIT_FROM = 664;

interface WorkListProps {
  filters: Filters;
  onFilters: (next: Filters) => void;
  backlog: Backlog;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function Chip({
  active,
  label,
  count,
  testId,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-2xs font-medium',
        'transition-colors duration-100',
        active
          ? 'border-accent-600 bg-accent-50 text-accent-700'
          : 'border-line bg-surface text-ink-600 hover:border-ink-300 hover:bg-ink-50',
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cx('font-mono tabular-nums', active ? 'text-accent-600' : 'text-ink-400')}>
          {count}
        </span>
      )}
    </button>
  );
}

function Select({
  value,
  onChange,
  label,
  testId,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...(testId !== undefined ? { 'data-testid': testId } : {})}
      className={cx(
        'h-7 max-w-44 min-w-0 rounded-md border border-line bg-surface px-1.5 text-2xs',
        'text-ink-700 transition-colors duration-100 hover:border-ink-300',
      )}
    >
      {children}
    </select>
  );
}

function Row({
  question,
  selected,
  columns,
  showTrack,
  showUnit,
  unitName,
  now,
  t,
  onSelect,
}: {
  question: Question;
  selected: boolean;
  columns: string;
  showTrack: boolean;
  showUnit: boolean;
  unitName: string | undefined;
  now: number;
  t: Translate;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      id={`answers-row-${question.id}`}
      role="option"
      aria-selected={selected}
      data-testid="answers-row"
      data-number={question.number}
      data-status={question.status}
      onClick={() => onSelect(question.id)}
      style={{ height: ROW_HEIGHT, gridTemplateColumns: columns }}
      className={cx(
        'grid cursor-pointer items-center gap-2 border-b border-line px-3',
        'border-l-2 transition-colors duration-100',
        selected ? 'border-l-accent-600 bg-accent-50' : 'border-l-transparent hover:bg-ink-25',
      )}
    >
      <span
        className={cx(
          'font-mono text-2xs tabular-nums',
          selected ? 'text-accent-700' : 'text-ink-500',
        )}
      >
        {question.number}
      </span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="shrink-0 truncate text-2xs text-ink-500" style={{ maxWidth: 96 }}>
          {question.speakerDisplayName ?? t('common.none')}
        </span>
        <span className="truncate text-[13px] text-ink-800">{excerpt(question.text)}</span>
      </span>
      <StatusBadge status={question.status} />
      {showTrack && (
        <span>{question.track !== undefined && <TrackBadge track={question.track} />}</span>
      )}
      {showUnit && <span className="truncate text-2xs text-ink-500">{unitName ?? ''}</span>}
      <span className="truncate text-right font-mono text-2xs whitespace-nowrap tabular-nums text-ink-400">
        {relativeAge(t, question.createdAt, now)}
      </span>
    </div>
  );
}

/** number · question · status · [track] · [unit] · age */
function columnsFor(showTrack: boolean, showUnit: boolean): string {
  return [
    '58px',
    'minmax(0,1fr)',
    '116px',
    showTrack ? '56px' : null,
    showUnit ? '72px' : null,
    '74px',
  ]
    .filter((column): column is string => column !== null)
    .join(' ');
}

export function WorkList({ filters, onFilters, backlog, selectedId, onSelect }: WorkListProps) {
  const t = useT();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [box, setBox] = useState({ height: 600, width: 640 });
  const [now, setNow] = useState(() => Date.now());

  const { items, counts, total, listLoading, units } = backlog;

  // The age column is only honest if it moves on its own.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    const element = scrollerRef.current;
    if (element === null) return undefined;
    const observer = new ResizeObserver(() => {
      setBox({ height: element.clientHeight, width: element.clientWidth });
    });
    observer.observe(element);
    setBox({ height: element.clientHeight, width: element.clientWidth });
    return () => observer.disconnect();
  }, []);

  const unitNames = useMemo(
    () => new Map(units.map((unit) => [unit.id, unit.shortName ?? unit.name])),
    [units],
  );

  const showTrack = box.width >= TRACK_FROM;
  const showUnit = box.width >= UNIT_FROM;
  const columns = columnsFor(showTrack, showUnit);
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(items.length, Math.ceil((scrollTop + box.height) / ROW_HEIGHT) + OVERSCAN);
  const windowed = items.slice(start, end);

  const set = useCallback(
    (patch: Partial<Filters>) => onFilters({ ...filters, ...patch }),
    [filters, onFilters],
  );

  // Read by the reveal effect below, which must not run when the list is merely refetched.
  const itemsRef = useRef<readonly Question[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  /**
   * Keep the open question in sight when the person selects one or narrows the list. Deliberately
   * not bound to `items`: a refetch (every event causes one) must never yank the scroll position
   * away from somebody who is scanning.
   */
  useEffect(() => {
    const scroller = scrollerRef.current;
    const index = itemsRef.current.findIndex((question) => question.id === selectedId);
    if (scroller === null || index < 0) return;
    const top = index * ROW_HEIGHT;
    if (top < scroller.scrollTop || top + ROW_HEIGHT > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 2 + ROW_HEIGHT);
    }
  }, [selectedId, filters]);

  /** Arrow keys walk the list; the moved-to row is scrolled into view without a jump. */
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const current = items.findIndex((question) => question.id === selectedId);
      const next = Math.min(
        items.length - 1,
        Math.max(0, current === -1 ? 0 : current + (event.key === 'ArrowDown' ? 1 : -1)),
      );
      const question = items[next];
      if (question === undefined) return;
      onSelect(question.id);
      const scroller = scrollerRef.current;
      if (scroller === null) return;
      const top = next * ROW_HEIGHT;
      if (top < scroller.scrollTop) scroller.scrollTop = top;
      else if (top + ROW_HEIGHT > scroller.scrollTop + scroller.clientHeight) {
        scroller.scrollTop = top + ROW_HEIGHT - scroller.clientHeight;
      }
    },
    [items, onSelect, selectedId],
  );

  const activeRow =
    selectedId !== null && windowed.some((question) => question.id === selectedId)
      ? `answers-row-${selectedId}`
      : undefined;

  return (
    <Panel
      className="h-full"
      padded={false}
      bodyClassName="flex min-h-0 flex-col"
      title={t('answers.list.title')}
      description={t('answers.list.count', { shown: items.length, total })}
      actions={
        isFiltered(filters) ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<X size={14} strokeWidth={1.75} aria-hidden="true" />}
            onClick={() => onFilters(EMPTY_FILTERS)}
          >
            {t('answers.filter.reset')}
          </Button>
        ) : undefined
      }
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-line px-4 py-3">
        <div className="relative">
          <Search
            size={14}
            strokeWidth={1.75}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400"
          />
          <input
            type="search"
            data-testid="answers-search"
            aria-label={t('answers.search.label')}
            placeholder={t('answers.search.placeholder')}
            value={filters.q}
            onChange={(event) => set({ q: event.target.value })}
            className={cx(
              'h-8 w-full rounded-md border border-line bg-surface pr-2 pl-8 text-[13px]',
              'text-ink-900 transition-colors duration-100 placeholder:text-ink-400',
              'hover:border-ink-300',
            )}
          />
        </div>

        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={t('answers.filter.status.label')}
        >
          <Chip
            active={filters.status === ALL}
            label={t('answers.filter.status.all')}
            count={total}
            testId="answers-filter-status-all"
            onClick={() => set({ status: ALL })}
          />
          {OPEN_STATUSES.map((status) => (
            <Chip
              key={status}
              active={filters.status === status}
              label={statusLabel(t, status)}
              count={counts[status]}
              testId={`answers-filter-status-${status}`}
              onClick={() => set({ status: filters.status === status ? ALL : status })}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex gap-1.5" role="group" aria-label={t('answers.filter.track.label')}>
            <Chip
              active={filters.track === ALL}
              label={t('answers.filter.track.all')}
              testId="answers-filter-track-all"
              onClick={() => set({ track: ALL })}
            />
            {TRACKS.map((track) => (
              <Chip
                key={track}
                active={filters.track === track}
                label={trackShortLabel(t, track)}
                testId={`answers-filter-track-${track}`}
                onClick={() => set({ track: filters.track === track ? ALL : track })}
              />
            ))}
          </div>
          <span aria-hidden="true" className="h-5 w-px bg-line" />
          <Select
            value={filters.unitId}
            onChange={(unitId) => set({ unitId })}
            label={t('answers.filter.unit.label')}
            testId="answers-filter-unit"
          >
            <option value={ALL}>{t('answers.filter.unit.all')}</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.shortName ?? unit.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.agendaItemId}
            onChange={(agendaItemId) => set({ agendaItemId })}
            label={t('answers.filter.agenda.label')}
            testId="answers-filter-agenda"
          >
            <option value={ALL}>{t('answers.filter.agenda.all')}</option>
            {backlog.agendaItems.map((item) => (
              <option key={item.id} value={item.id}>
                {t('answers.filter.agenda.option', { number: item.number })}
              </option>
            ))}
          </Select>
          <Select
            value={filters.sort}
            onChange={(sort) => set({ sort: sort as SortOrder })}
            label={t('answers.sort.label')}
            testId="answers-sort"
          >
            <option value="number">{t('answers.sort.number')}</option>
            <option value="age">{t('answers.sort.age')}</option>
          </Select>
        </div>
      </div>

      <div
        style={{ gridTemplateColumns: columns }}
        className="grid shrink-0 items-center gap-2 border-b border-line bg-sunken px-3 py-1.5"
      >
        <span className="hv-label">{t('answers.col.number')}</span>
        <span className="hv-label">{t('answers.col.text')}</span>
        <span className="hv-label">{t('answers.col.status')}</span>
        {showTrack && <span className="hv-label">{t('answers.col.track')}</span>}
        {showUnit && <span className="hv-label">{t('answers.col.unit')}</span>}
        <span className="hv-label text-right">{t('answers.col.age')}</span>
      </div>

      <div
        ref={scrollerRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {items.length === 0 ? (
          <div className="p-4">
            {listLoading ? (
              <div className="space-y-1.5" aria-label={t('answers.list.loading')} aria-busy="true">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((line) => (
                  <div key={line} className="h-8 animate-pulse rounded-sm bg-ink-50" />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Search}
                title={t('answers.list.empty.title')}
                description={t('answers.list.empty.body')}
                action={
                  isFiltered(filters) ? (
                    <Button size="sm" onClick={() => onFilters(EMPTY_FILTERS)}>
                      {t('answers.filter.reset')}
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        ) : (
          <div style={{ height: items.length * ROW_HEIGHT }} className="relative">
            <div
              role="listbox"
              tabIndex={0}
              aria-label={t('answers.list.label')}
              {...(activeRow !== undefined ? { 'aria-activedescendant': activeRow } : {})}
              onKeyDown={onKeyDown}
              style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}
              className="absolute inset-x-0 top-0 rounded-sm focus-visible:outline-offset-[-2px]"
            >
              {windowed.map((question) => (
                <Row
                  key={question.id}
                  question={question}
                  selected={question.id === selectedId}
                  columns={columns}
                  showTrack={showTrack}
                  showUnit={showUnit}
                  unitName={
                    question.unitId === undefined ? undefined : unitNames.get(question.unitId)
                  }
                  now={now}
                  t={t}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-line bg-sunken px-4 py-1.5">
        <span className="text-2xs text-ink-500">
          {t('answers.list.count', { shown: items.length, total })}
        </span>
        {filters.status !== ALL && <Badge tone="accent">{statusLabel(t, filters.status)}</Badge>}
      </div>
    </Panel>
  );
}
