/**
 * Historie & Suche — the place where somebody asks "what happened to this question?" and gets an
 * answer that holds up in front of a lawyer.
 *
 * Everything shown here is read from the event log through `HvApi`: the search over the whole
 * corpus, the course of one question (`getQuestionHistory`), and the tail of the meeting
 * (`listEvents`). Nothing is derived, nothing is cached across a version change.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import type { AgendaItem, DomainEvent, Question, Unit } from '@hv/domain';
import { api } from '../../api';
import { useApiVersion } from '../../api/useApiVersion';
import {
  Button,
  EmptyState,
  Panel,
  PageHeader,
  SplitPane,
  StatusBadge,
  cx,
  showProblem,
} from '../../components';
import { getLang, translate, useT } from '../../i18n';
import { EventStream, HistoryKpiLine, Timeline } from './Timeline';
import type { SummaryContext } from './eventSummary';
import { RESULT_LIMIT, STREAM_LIMIT, excerpt, loadCurve } from './lib';

type Tab = 'question' | 'stream';

function problem(error: unknown): void {
  showProblem(error, translate(getLang(), 'toast.problem'));
}

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function TabButton({
  active,
  testId,
  controls,
  onClick,
  children,
}: {
  active: boolean;
  testId: string;
  controls: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      data-testid={testId}
      onClick={onClick}
      className={cx(
        'h-7 rounded-md border px-2.5 text-2xs font-medium transition-colors duration-100',
        active
          ? 'border-accent-600 bg-accent-50 text-accent-700'
          : 'border-line bg-surface text-ink-600 hover:border-ink-300 hover:bg-ink-50',
      )}
    >
      {children}
    </button>
  );
}

export function HistoryPage() {
  const t = useT();
  const version = useApiVersion();

  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim(), 150);
  const [tab, setTab] = useState<Tab>('question');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [results, setResults] = useState<readonly Question[]>([]);
  const [total, setTotal] = useState(0);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [corpus, setCorpus] = useState<readonly Question[]>([]);
  const [units, setUnits] = useState<readonly Unit[]>([]);
  const [agendaItems, setAgendaItems] = useState<readonly AgendaItem[]>([]);
  const [speakerNames, setSpeakerNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [history, setHistory] = useState<readonly DomainEvent[]>([]);
  const [stream, setStream] = useState<readonly DomainEvent[]>([]);
  const [curve, setCurve] = useState<readonly number[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.listUnits(),
      api.listAgendaItems(),
      api.listSpeakers(),
      api.listQuestions({ limit: 2000 }),
    ])
      .then(([nextUnits, nextAgenda, speakers, page]) => {
        if (cancelled) return;
        setUnits(nextUnits);
        setAgendaItems(nextAgenda);
        setSpeakerNames(new Map(speakers.map((speaker) => [speaker.id, speaker.displayName])));
        setCorpus(page.items);
      })
      .catch(problem);
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    let cancelled = false;
    setResultsLoading(true);
    api
      .listQuestions({ limit: RESULT_LIMIT, ...(search !== '' ? { q: search } : {}) })
      .then((page) => {
        if (cancelled) return;
        setResults([...page.items].sort((a, b) => a.number.localeCompare(b.number)));
        setTotal(page.total);
        setResultsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setResultsLoading(false);
        problem(error);
      });
    return () => {
      cancelled = true;
    };
  }, [version, search]);

  useEffect(() => {
    if (selectedId === null) {
      setHistory([]);
      return undefined;
    }
    let cancelled = false;
    api
      .getQuestionHistory(selectedId)
      .then((events) => {
        if (!cancelled) setHistory(events);
      })
      .catch(problem);
    return () => {
      cancelled = true;
    };
  }, [version, selectedId]);

  useEffect(() => {
    if (tab !== 'stream') return undefined;
    let cancelled = false;
    // The log is read from the end for the visible tail; the Lastkurve (point 9) needs the whole
    // log, since two real-time hours can hold far more than the tail the table shows.
    api
      .listEvents(0, 1)
      .then(({ lastSeq }) => api.listEvents(0, lastSeq))
      .then((page) => {
        if (cancelled) return;
        setStream(page.items.slice(-STREAM_LIMIT).reverse());
        setCurve(loadCurve(page.items, Date.now()));
      })
      .catch(problem);
    return () => {
      cancelled = true;
    };
  }, [version, tab]);

  const context = useMemo<SummaryContext>(
    () => ({
      unitNames: new Map(units.map((unit) => [unit.id, unit.shortName ?? unit.name])),
      agendaNumbers: new Map(agendaItems.map((item) => [item.id, item.number])),
      questionNumbers: new Map(corpus.map((question) => [question.id, question.number])),
      speakerNames,
    }),
    [units, agendaItems, corpus, speakerNames],
  );

  const selected = useMemo(
    () => corpus.find((question) => question.id === selectedId) ?? null,
    [corpus, selectedId],
  );

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setTab('question');
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title={t('page.history.title')} description={t('page.history.description')} />

      <SplitPane
        storageKey="hv-history-split-v1"
        initial={38}
        min={28}
        max={62}
        className="min-h-0 flex-1"
        left={
          <Panel
            className="h-full"
            padded={false}
            bodyClassName="flex min-h-0 flex-col"
            title={t('history.results.title')}
            description={t('history.results.count', { shown: results.length, total })}
          >
            <div className="shrink-0 border-b border-line px-4 py-3">
              <div className="relative">
                <Search
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400"
                />
                <input
                  type="search"
                  data-testid="history-search"
                  aria-label={t('history.search.label')}
                  placeholder={t('history.search.placeholder')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={cx(
                    'h-8 w-full rounded-md border border-line bg-surface pr-2 pl-8 text-[13px]',
                    'text-ink-900 transition-colors duration-100 placeholder:text-ink-400',
                    'hover:border-ink-300',
                  )}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {results.length === 0 ? (
                <div className="p-4">
                  {resultsLoading ? (
                    <div
                      className="space-y-1.5"
                      aria-busy="true"
                      aria-label={t('history.results.loading')}
                    >
                      {[0, 1, 2, 3, 4, 5].map((line) => (
                        <div key={line} className="h-10 animate-pulse rounded-sm bg-ink-50" />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Search}
                      title={t('history.results.empty.title')}
                      description={t('history.results.empty.body')}
                      {...(query !== ''
                        ? {
                            action: (
                              <Button size="sm" onClick={() => setQuery('')}>
                                {t('answers.filter.reset')}
                              </Button>
                            ),
                          }
                        : {})}
                    />
                  )}
                </div>
              ) : (
                <ul aria-label={t('history.results.label')}>
                  {results.map((question) => (
                    <li key={question.id}>
                      <button
                        type="button"
                        data-testid="history-result"
                        data-number={question.number}
                        aria-current={question.id === selectedId}
                        onClick={() => select(question.id)}
                        className={cx(
                          'flex w-full items-start gap-2.5 border-b border-line border-l-2 px-3 py-2 text-left',
                          'transition-colors duration-100',
                          question.id === selectedId
                            ? 'border-l-accent-600 bg-accent-50'
                            : 'border-l-transparent hover:bg-ink-25',
                        )}
                      >
                        <span className="mt-0.5 shrink-0 font-mono text-2xs tabular-nums text-ink-500">
                          {question.number}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-ink-800">
                            {excerpt(question.text, 120)}
                          </span>
                          <span className="mt-0.5 block truncate text-2xs text-ink-400">
                            {question.speakerDisplayName ?? t('common.none')}
                          </span>
                        </span>
                        <StatusBadge status={question.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {total > results.length && (
              <p className="shrink-0 border-t border-line bg-sunken px-4 py-1.5 text-2xs text-ink-500">
                {t('history.results.more')}
              </p>
            )}
          </Panel>
        }
        right={
          <Panel
            className="h-full"
            padded={false}
            bodyClassName="flex min-h-0 flex-col"
            title={
              tab === 'stream'
                ? t('history.stream.title')
                : selected === null
                  ? t('history.timeline.title')
                  : t('history.question.label', { number: selected.number })
            }
            description={
              tab === 'stream'
                ? t('history.stream.description', { n: stream.length })
                : selected === null
                  ? undefined
                  : excerpt(selected.text, 110)
            }
            actions={
              <div role="tablist" aria-label={t('history.tab.label')} className="flex gap-1.5">
                <TabButton
                  active={tab === 'question'}
                  testId="history-tab-question"
                  controls="history-panel"
                  onClick={() => setTab('question')}
                >
                  {t('history.tab.question')}
                </TabButton>
                <TabButton
                  active={tab === 'stream'}
                  testId="history-tab-stream"
                  controls="history-panel"
                  onClick={() => setTab('stream')}
                >
                  {t('history.tab.stream')}
                </TabButton>
              </div>
            }
          >
            <div id="history-panel" role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
              {tab === 'stream' ? (
                <EventStream events={stream} context={context} curve={curve} />
              ) : selected === null ? (
                <div className="p-4">
                  <EmptyState
                    icon={History}
                    title={t('history.timeline.empty.title')}
                    description={t('history.timeline.empty.body')}
                  />
                </div>
              ) : (
                <div className="px-4 py-4">
                  <HistoryKpiLine events={history} />
                  <Timeline
                    events={history}
                    context={context}
                    label={t('history.timeline.label', { number: selected.number })}
                  />
                </div>
              )}
            </div>
          </Panel>
        }
      />
    </div>
  );
}
