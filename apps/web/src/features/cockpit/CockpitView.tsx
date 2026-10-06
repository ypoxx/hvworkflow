/**
 * Scheibe 061 (part B): the control desk (Leitstand) as one presentational view — everything the page shows for a
 * reading, a list and a thread, without hooks into the API, so every state renders in a static test.
 *
 * Layout (spec "Aufbau"): 12 columns at 16 px. Row one: the main reading over 5 columns and two card heights; to its
 * right the three cards and below them the inflow over 7 columns, the bottom edges flush. Below, full width: stations,
 * backlog, list, thread. Container queries, not viewport breakpoints, so the collapsed navigation counts: side by side
 * from 56rem of content, cards in a row from 36rem, six stations from 48rem; one column below (200 % zoom).
 */
import { FileQuestion } from 'lucide-react';
import type { Unit } from '@hv/domain';
import { COCKPIT_THRESHOLDS } from '../../api/cockpit';
import { Button, EmptyState, PageHeader, Panel, cx } from '../../components';
import { useT } from '../../i18n';
import { DrillList } from './DrillList';
import { Backlog, CARD, Cards, HeaderMeta, InflowCard, OldestPanel, Stations } from './Figures';
import type { OpenList } from './Figures';
import { hallTime } from './lib';
import type { CockpitRead, ListRead, Selection, ThreadRead } from './lib';
import { Thread } from './Thread';

export interface CockpitViewProps {
  read: CockpitRead;
  units: readonly Unit[];
  selection: Selection | null;
  list: ListRead | null;
  thread: ThreadRead | null;
  /** The text of the polite live region; empty while silent. */
  announcement: string;
  onOpenList: OpenList;
  onOpenThread: (id: string, trigger: string) => void;
  onCloseList: () => void;
  onCloseThread: () => void;
  onRetry: () => void;
}

/** Fixed heights while loading, so nothing jumps when the figures arrive (D8). */
function LoadingFrame() {
  const t = useT();
  return (
    <div data-testid="cockpit-loading" aria-busy="true" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-12">
        <div className={cx(CARD, 'flex min-h-[21rem] items-center justify-center @4xl:col-span-5')}>
          <p role="status" className="text-[13px] text-ink-600">{t('cockpit.loading')}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 @4xl:col-span-7 @4xl:grid-rows-2">
          <div className="grid grid-cols-1 gap-4 @xl:grid-cols-3">
            <div className={cx(CARD, 'min-h-[8.5rem]')} />
            <div className={cx(CARD, 'min-h-[8.5rem]')} />
            <div className={cx(CARD, 'min-h-[8.5rem]')} />
          </div>
          <div className={cx(CARD, 'min-h-[8.5rem]')} />
        </div>
      </div>
      <div className={cx(CARD, 'min-h-[7.75rem]')} />
      <div data-testid="cockpit-loading-backlog" className={cx(CARD, 'min-h-[18rem]')} />
    </div>
  );
}

export function CockpitView({
  read,
  units,
  selection,
  list,
  thread,
  announcement,
  onOpenList,
  onOpenThread,
  onCloseList,
  onCloseThread,
  onRetry,
}: CockpitViewProps) {
  const t = useT();
  const cockpit = read.status === 'ready' ? read.cockpit : null;
  const header = (
    <PageHeader
      title={t('page.cockpit.title')}
      description={t('page.cockpit.description')}
      actions={<HeaderMeta cockpit={cockpit} t={t} time={cockpit === null ? null : hallTime(cockpit.asOf, true)} />}
    />
  );
  // One polite region, present in every state, silent until a figure turns critical (spec decision 7).
  const live = (
    <p data-testid="cockpit-live" aria-live="polite" className="sr-only">
      {announcement}
    </p>
  );

  if (read.status === 'forbidden') {
    return (
      <div data-testid="cockpit-page" className="@container flex flex-col gap-4">
        {header}
        <div data-testid="cockpit-forbidden" role="status">
          <Panel bodyClassName="flex min-h-[21rem] items-center justify-center">
            <EmptyState icon={FileQuestion} title={t('cockpit.forbidden.title')} description={t('cockpit.forbidden.body')} />
          </Panel>
        </div>
        {live}
      </div>
    );
  }

  if (read.status === 'error') {
    return (
      <div data-testid="cockpit-page" className="@container flex flex-col gap-4">
        {header}
        <div data-testid="cockpit-error" role="alert">
          <Panel bodyClassName="flex min-h-[21rem] items-center justify-center">
            <EmptyState
              icon={FileQuestion}
              title={t('cockpit.error.title')}
              description={read.ruleId === undefined ? t('cockpit.error.body') : `${t('cockpit.error.body')} ${t('cockpit.error.rule', { rule: read.ruleId })}`}
              action={
                <Button data-testid="cockpit-error-retry" onClick={onRetry}>
                  {t('cockpit.error.retry')}
                </Button>
              }
            />
          </Panel>
        </div>
        {live}
      </div>
    );
  }

  return (
    <div data-testid="cockpit-page" className="@container flex flex-col gap-4">
      {header}
      {cockpit === null ? (
        <LoadingFrame />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-12">
            <OldestPanel cockpit={cockpit} units={units} onOpenThread={onOpenThread} className="@4xl:col-span-5" />
            <div className="grid grid-cols-1 gap-4 @4xl:col-span-7 @4xl:grid-rows-2">
              <Cards cockpit={cockpit} onOpenList={onOpenList} />
              <InflowCard cockpit={cockpit} onOpenList={onOpenList} />
            </div>
          </div>
          <Stations cockpit={cockpit} onOpenList={onOpenList} />
          <Backlog cockpit={cockpit} units={units} attention={COCKPIT_THRESHOLDS.unitBacklog.attention} onOpenList={onOpenList} />
          {selection !== null && list !== null && (
            <DrillList selection={selection} read={list} units={units} onOpenThread={onOpenThread} onClose={onCloseList} />
          )}
          {thread !== null && <Thread read={thread} units={units} onClose={onCloseThread} />}
        </>
      )}
      {live}
    </div>
  );
}
