/**
 * Historie & Suche — the place where somebody asks "what happened to this question?" and gets an
 * answer that holds up in front of a lawyer.
 *
 * Everything shown here is read from the event log through `HvApi`: the search over the whole
 * corpus, the course of one question (`getQuestionHistory`), and the tail of the meeting
 * (`listEvents`). Nothing is derived, nothing is cached across a version change.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Lock, Search } from 'lucide-react';
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
import {
  RESULT_LIMIT,
  STREAM_LIMIT,
  STREAM_SCAN_LIMIT,
  createDetailProblemGate,
  excerpt,
  isReadForbidden,
  loadCurve,
} from './lib';

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
  // The tail read for the "Ereignisstrom" tab: `streamWindow` is the bounded read itself (`stream`,
  // the reversed table slice, is derived from it); `curve`, the bucketed Lastkurve, is recomputed
  // in the same place the read happens, so it is bucketed once per fetched tail, keyed on
  // `streamLastSeq` — never on a render that leaves the tail untouched (R10, 007 rework).
  const [streamWindow, setStreamWindow] = useState<readonly DomainEvent[]>([]);
  const [streamLastSeq, setStreamLastSeq] = useState(0);
  const [curve, setCurve] = useState<readonly number[]>([]);
  // Ziel 1 (slice 010b): `listQuestions` is the Hauptabfrage of the Historie — set from the 403's
  // ruleId alone (AGENTS.md rule 4), e.g. podium, who holds neither `question.read` nor
  // `question.read.delivered` at all. observer never sets this: it holds the scoped
  // `question.read.delivered` and simply sees fewer rows (Ziel 3).
  const [mainForbidden, setMainForbidden] = useState(false);
  // Ziel 3: the "Vorgangshistorie" tab of one selected question (`getQuestionHistory`).
  const [historyForbidden, setHistoryForbidden] = useState(false);
  // Ziel 3: the "Ereignisstrom" tab (`listEvents`).
  const [streamForbidden, setStreamForbidden] = useState(false);

  /**
   * Codex P2-2 on 4f0d231 (the same class as Codex (b) on 7f542b6 in the Beantwortung, see
   * `createDetailProblemGate` in lib.ts): the selected question's `getQuestionHistory` runs next
   * to the Hauptabfrage `listQuestions`. After a switch to a role without any question read, the
   * list is refused with R-PERM-02 while the history read answers with the masked 404 — a failure
   * of the detail read is therefore shown only once the corpus read of the same `version` has
   * answered and was not refused. The history read itself does not wait (nit C, review round 4);
   * it only stops while the view is known to be refused (`mainForbidden`).
   */
  const gate = useMemo(() => createDetailProblemGate(problem), []);

  // Ziel 2 (Nebenabfragen, Regression from slice 010): `listSpeakers` used to share this effect's
  // `Promise.all` with units/agendaItems/corpus — a denied `listSpeakers` (expert, legal, approver
  // hold no `speaker.read`) rejected the whole group, so `corpus` never populated and `selected`
  // below stayed `null` forever: the timeline could never open, even though the actor could read
  // every question fine. Split apart, a denied Nebenabfrage now only costs the names it feeds
  // `eventSummary`'s subject column (Ereignisstrom) — the rest of the view stands.
  //
  // Nit 9 (review round 2): `listUnits`/`listAgendaItems` (Stammdaten, Festlegung 1 of
  // docs/slices/010-lesepfade-leserechte.md — every signed-in role may read them, no `can()` check
  // at all) stayed bundled with `listQuestions` here, which is exactly the same shape of bug in
  // reverse: the Hauptabfrage's own 403 (podium, neither `question.read` nor
  // `question.read.delivered`) used to reject a `Promise.all` that also held two reads which can
  // never fail — `units`/`agendaItems` never populated either, for no reason of their own.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listUnits(), api.listAgendaItems()])
      .then(([nextUnits, nextAgenda]) => {
        if (cancelled) return;
        setUnits(nextUnits);
        setAgendaItems(nextAgenda);
      })
      .catch(problem);
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    let cancelled = false;
    api
      .listQuestions({ limit: 2000 })
      .then((page) => {
        if (cancelled) return;
        setCorpus(page.items);
        setMainForbidden(false);
        gate.settleMain(String(version), false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isReadForbidden(error)) {
          setCorpus([]);
          setMainForbidden(true);
          gate.settleMain(String(version), true);
          return;
        }
        problem(error);
        gate.settleMain(String(version), false);
      });
    return () => {
      cancelled = true;
    };
  }, [version, gate]);

  useEffect(() => {
    let cancelled = false;
    api
      .listSpeakers()
      .then((speakers) => {
        if (cancelled) return;
        setSpeakerNames(new Map(speakers.map((speaker) => [speaker.id, speaker.displayName])));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Ziel 2: a Nebenabfrage never blocks the view and never toasts for a read refusal — the
        // event summaries simply carry fewer names (`eventSubject`, eventSummary.ts). Nit 10
        // (review round 2): cleared, not left holding a previous, more privileged role's names —
        // `version` bumps on every actor switch (api/useApiVersion.ts), so a role that has just
        // lost `speaker.read` must not go on showing who it can no longer look up.
        setSpeakerNames(new Map());
        if (isReadForbidden(error)) return;
        problem(error);
      });
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
        setMainForbidden(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setResultsLoading(false);
        if (isReadForbidden(error)) {
          setResults([]);
          setTotal(0);
          setMainForbidden(true);
          return;
        }
        problem(error);
      });
    return () => {
      cancelled = true;
    };
  }, [version, search]);

  useEffect(() => {
    if (selectedId === null || mainForbidden) {
      setHistory([]);
      setHistoryForbidden(false);
      return undefined;
    }
    let cancelled = false;
    const load = String(version);
    api
      .getQuestionHistory(selectedId)
      .then((events) => {
        if (cancelled) return;
        setHistory(events);
        setHistoryForbidden(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isReadForbidden(error)) {
          // Ziel 3: e.g. observer, who may find the question (`question.read.delivered`) but holds
          // no `history.read` — a gestalteter Zustand, not an error toast.
          setHistory([]);
          setHistoryForbidden(true);
          return;
        }
        gate.report(load, `${load}:${selectedId}`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [version, selectedId, mainForbidden, gate]);

  useEffect(() => {
    if (tab !== 'stream') return undefined;
    let cancelled = false;
    // `version` bumps on every actor switch too (api/useApiVersion.ts), which never grows the log
    // — a cheap read of just the tail `seq` first, and skipping the bounded read below when it has
    // not moved, means switching roles while this tab is open no longer re-reads the log at all
    // (R10, 007 rework). The table and the Lastkurve (point 9) both read the last STREAM_SCAN_LIMIT
    // events rather than the whole log, which at seed volume is already several thousand events.
    api
      .listEvents(0, 1)
      .then(({ lastSeq }) => {
        if (cancelled) return undefined;
        setStreamForbidden(false);
        if (lastSeq === streamLastSeq) return undefined;
        return api
          .listEvents(Math.max(0, lastSeq - STREAM_SCAN_LIMIT), STREAM_SCAN_LIMIT)
          .then((page) => {
            if (cancelled) return;
            setStreamLastSeq(lastSeq);
            setStreamWindow(page.items);
            setCurve(loadCurve(page.items, Date.now()));
          });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isReadForbidden(error)) {
          // Ziel 3: e.g. observer, who holds no `event.read` at all — a gestalteter Zustand, not
          // an error toast. Minor 3 (review round 2): clears the tail read too, and rewinds
          // `streamLastSeq` to 0 — a role that regains `event.read` later must not see the
          // `lastSeq === streamLastSeq` short-circuit above skip its own first, honest read back.
          setStreamForbidden(true);
          setStreamWindow([]);
          setCurve([]);
          setStreamLastSeq(0);
          return;
        }
        problem(error);
      });
    return () => {
      cancelled = true;
    };
  }, [version, tab, streamLastSeq]);

  const stream = useMemo(() => streamWindow.slice(-STREAM_LIMIT).reverse(), [streamWindow]);

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

      {mainForbidden ? (
        // Minor 5 (review round 2): `role="status"` marks the refusal as a status message. Nit 6
        // (review round 3): a live region mounted together with its content is often not announced,
        // so this is a hint to assistive technology, not a guaranteed announcement.
        <div data-testid="history-forbidden" role="status" className="grid min-h-0 flex-1">
          <Panel bodyClassName="grid place-items-center">
            <EmptyState
              icon={Lock}
              title={t('history.forbidden.title')}
              description={t('history.forbidden.body')}
              className="w-full max-w-xl"
            />
          </Panel>
        </div>
      ) : (
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
                          {/* Slice 013 (axe, goal 1): ink-500/-400 fell to 3.54:1/2.23:1 on the
                           * selected row's accent-50 background — below 4.5:1. ink-600 is an existing
                           * token and clears WCAG AA on both the resting and the selected background. */}
                          <span className="mt-0.5 shrink-0 font-mono text-2xs tabular-nums text-ink-600">
                            {question.number}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] text-ink-800">
                              {excerpt(question.text, 120)}
                            </span>
                            <span className="mt-0.5 block truncate text-2xs text-ink-600">
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
                <p className="shrink-0 border-t border-line bg-sunken px-4 py-1.5 text-2xs text-ink-600">
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
                // Minor 3 (review round 2): a stale "letzte n Ereignisse" from before the role
                // switched must not linger next to the refused state — `stream` is cleared to `[]`
                // the moment `streamForbidden` is set, but the count line itself has to go too.
                tab === 'stream'
                  ? streamForbidden
                    ? undefined
                    : t('history.stream.description', { n: stream.length })
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
              {/* Slice 013 (axe, goal 1): axe's scrollable-region-focusable — this scrollable panel has
               * no focusable descendant on its own (the event stream and timeline are plain text, no
               * buttons), so it was unreachable by keyboard; tabIndex makes the region itself a stop. */}
              <div
                id="history-panel"
                role="tabpanel"
                tabIndex={0}
                className="min-h-0 flex-1 overflow-y-auto"
              >
                {tab === 'stream' ? (
                  streamForbidden ? (
                    // Minor 5 (review round 2): `role="status"` marks the refusal as a status
                    // message. Nit 6 (review round 3): a live region mounted together with its
                    // content is often not announced, so this is a hint to assistive technology,
                    // not a guaranteed announcement.
                    <div className="p-4" data-testid="history-stream-forbidden" role="status">
                      <EmptyState
                        icon={Lock}
                        title={t('history.stream.forbidden.title')}
                        description={t('history.stream.forbidden.body')}
                      />
                    </div>
                  ) : (
                    <EventStream events={stream} context={context} curve={curve} />
                  )
                ) : selected === null ? (
                  <div className="p-4">
                    <EmptyState
                      icon={History}
                      title={t('history.timeline.empty.title')}
                      description={t('history.timeline.empty.body')}
                    />
                  </div>
                ) : historyForbidden ? (
                  // Minor 5 (review round 2): `role="status"` marks the refusal as a status
                  // message. Nit 6 (review round 3): a live region mounted together with its
                  // content is often not announced, so this is a hint to assistive technology, not
                  // a guaranteed announcement.
                  <div className="p-4" data-testid="history-timeline-forbidden" role="status">
                    <EmptyState
                      icon={Lock}
                      title={t('history.timeline.forbidden.title')}
                      description={t('history.timeline.forbidden.body')}
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
      )}
    </div>
  );
}
