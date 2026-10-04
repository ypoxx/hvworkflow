/**
 * Scheibe 054 (decision 4): the list of "Meine Fragen" — small by nature (one unit's open work), so no windowing, no
 * filter, no search, no order to choose. Oldest first (Z1), the wording over two lines, the age relative ("vor 12 min");
 * never the agenda item, never a clock time of the capture (#28), never a speaker's name beside the text.
 *
 * A listbox like the work list of the Beantwortung (`WorkList.tsx`): arrow keys choose, Enter opens the writing mode of
 * the chosen row, a double click chooses and opens it. Rows carry `select-none` so that the double click marks no word.
 */
import { useEffect, useState } from 'react';
import type { KeyboardEvent, Ref } from 'react';
import { FileQuestion, TriangleAlert } from 'lucide-react';
import type { Question } from '@hv/domain';
import { Badge, Button, EmptyState, Panel, StatusBadge, cx } from '../../components';
import { useT } from '../../i18n';
import { relativeAge } from '../answers/lib';
import { latestIsRefusal } from '../answers/refusal';

export type FocusListState = 'loading' | 'ready' | 'failed';

const focusRowId = (questionId: string): string => `focus-row-${questionId}`;

export function FocusList({
  items,
  state,
  selectedId,
  now: nowProp,
  listRef,
  onSelect,
  onOpen,
  onRetry,
}: {
  items: readonly Question[];
  state: FocusListState;
  selectedId: string | null;
  /** For the static test only; the page lets the list keep its own clock. */
  now?: number;
  listRef?: Ref<HTMLDivElement>;
  onSelect: (id: string) => void;
  /** Open the writing mode of this question (Enter, double click). */
  onOpen: (id: string) => void;
  onRetry: () => void;
}) {
  const t = useT();
  const [clock, setClock] = useState(() => nowProp ?? Date.now());
  const now = nowProp ?? clock;

  // The age is only honest if it moves on its own (as in the work list).
  useEffect(() => {
    if (nowProp !== undefined) return undefined;
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [nowProp]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter') {
      if (selectedId !== null) {
        event.preventDefault();
        onOpen(selectedId);
      }
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const current = items.findIndex((question) => question.id === selectedId);
    const next = Math.min(items.length - 1, Math.max(0, current === -1 ? 0 : current + (event.key === 'ArrowDown' ? 1 : -1)));
    const question = items[next];
    if (question === undefined) return;
    onSelect(question.id);
    document.getElementById(focusRowId(question.id))?.scrollIntoView({ block: 'nearest' });
  };

  if (state === 'ready' && items.length === 0) {
    return (
      <div data-testid="focus-empty" role="status" className="h-full">
        <Panel className="h-full" bodyClassName="grid place-items-center">
          <EmptyState icon={FileQuestion} title={t('focus.empty.title')} description={t('focus.empty.body')} className="w-full max-w-xl" />
        </Panel>
      </div>
    );
  }

  const activeRow = selectedId !== null && items.some((question) => question.id === selectedId) ? focusRowId(selectedId) : undefined;

  return (
    <Panel
      className="h-full"
      padded={false}
      bodyClassName="flex min-h-0 flex-col"
      footer={state === 'ready' ? <span>{t('focus.list.count', { n: items.length })}</span> : undefined}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state === 'loading' ? (
          // The skeleton has the height of the list, so nothing jumps when the rows arrive.
          <div
            data-testid="focus-list"
            data-state="loading"
            role="status"
            aria-busy="true"
            aria-label={t('answers.list.loading')}
            className="space-y-1.5 p-3"
          >
            {[0, 1, 2, 3, 4, 5].map((line) => (
              <div key={line} className="h-14 animate-pulse rounded-sm bg-ink-50" />
            ))}
          </div>
        ) : state === 'failed' ? (
          <div data-testid="focus-list" data-state="failed" className="p-4">
            <EmptyState
              icon={TriangleAlert}
              title={t('answers.list.error.title')}
              description={t('answers.list.error.body')}
              action={
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  {t('common.retry')}
                </Button>
              }
            />
          </div>
        ) : (
          <div
            ref={listRef}
            data-testid="focus-list"
            data-state="ready"
            role="listbox"
            tabIndex={0}
            aria-label={t('focus.list.label')}
            {...(activeRow !== undefined ? { 'aria-activedescendant': activeRow } : {})}
            onKeyDown={onKeyDown}
            className="rounded-sm focus-visible:outline-offset-[-2px]"
          >
            {items.map((question) => {
              const selected = question.id === selectedId;
              return (
                <div
                  key={question.id}
                  id={focusRowId(question.id)}
                  role="option"
                  aria-selected={selected}
                  data-testid="focus-row"
                  data-number={question.number}
                  data-status={question.status}
                  data-unit={question.unitId ?? ''}
                  data-created={question.createdAt}
                  {...(question.returnReason !== undefined ? { 'data-returned': 'true' } : {})}
                  onClick={() => onSelect(question.id)}
                  onDoubleClick={() => onOpen(question.id)}
                  className={cx(
                    'cursor-pointer border-b border-l-2 border-line px-4 py-2 select-none',
                    'transition-colors duration-100',
                    selected ? 'border-l-accent-600 bg-accent-50' : 'border-l-transparent hover:bg-ink-25',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cx('font-mono text-2xs tabular-nums', selected ? 'text-accent-700' : 'text-ink-600')}>
                      {question.number}
                    </span>
                    <StatusBadge status={question.status} />
                    {question.returnReason !== undefined && (
                      <span data-testid="focus-row-returned">
                        <Badge tone="warning">{t('answers.detail.returned')}</Badge>
                      </span>
                    )}
                    {latestIsRefusal(question) && (
                      <span data-testid="focus-row-refusal">
                        <Badge tone="danger">{t('answers.refusal.badge')}</Badge>
                      </span>
                    )}
                    <span
                      data-testid="focus-row-age"
                      className="ml-auto font-mono text-2xs whitespace-nowrap tabular-nums text-ink-600"
                    >
                      {relativeAge(t, question.createdAt, now)}
                    </span>
                  </div>
                  <p data-testid="focus-row-text" className="mt-1 line-clamp-2 text-[13px] leading-5 text-ink-800">
                    {question.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
