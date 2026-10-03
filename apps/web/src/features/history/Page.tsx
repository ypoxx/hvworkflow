/**
 * Historie & Suche — the place where somebody asks "what happened to this question?" and gets an
 * answer that holds up in front of a lawyer.
 *
 * Everything shown here is read from the event log through `HvApi`: the search over the whole
 * corpus, the course of one question (`getQuestionHistory`), and the tail of the meeting
 * (`listEvents`). Nothing is derived, nothing is cached across a version change.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { History, Lock, Search } from 'lucide-react';
import type { AgendaItem, DomainEvent, Question, ReadEvent, Unit } from '@hv/domain';
import { api } from '../../api';
import { getActor, useActor } from '../../api/actor';
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
import { refusalVersionsOf } from './eventSummary';
import type { SummaryContext } from './eventSummary';
import {
  RESULT_PAGE_MAX,
  advanceStream,
  createDetailProblemGate,
  excerpt,
  isCurrentLoad,
  isReadForbidden,
  keyBelongsTo,
  loadCurve,
  loadKey,
  mergeResultPages,
  NO_VERDICT,
  readResultPages,
  readVerdict,
  tableRows,
} from './lib';
import type { KeyedRead, PagedResults, ReadVerdict } from './lib';

type Tab = 'question' | 'stream';

const NO_QUESTIONS: readonly Question[] = [];
const NO_EVENTS: readonly DomainEvent[] = [];
const NO_READ_EVENTS: readonly ReadEvent[] = [];
const NO_PAGES: PagedResults = { pages: [], total: 0 };
const NO_CURVE: readonly number[] = [];
const NO_NAMES: ReadonlyMap<string, string> = new Map();

function problem(error: unknown): void {
  showProblem(error, translate(getLang(), 'toast.problem'));
}

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  // Slice 090: an emptied search is empty at once. Otherwise the previous actor's term would still
  // drive the next actor's first read for the length of the delay.
  if (value === '' && debounced !== '') setDebounced('');
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

  /**
   * Slice 010d, Ziel 1: every record of this view is kept with the key of the load that read it and
   * handed out only to that load's actor (`keyBelongsTo`, lib.ts) — the result rows, the corpus
   * (and with it the selected question), its Vorgangshistorie, the Ereignisstrom and the speaker
   * names. After a role switch nothing the previous role could read stands for the one response
   * time until the new role has answered; the panes show their skeleton instead. A newer `version`
   * of the same actor keeps them on screen while it loads (design principle 8).
   */
  /**
   * takt-038, Ziel 1: the result list is read page by page. `paging` is the actor and search the
   * loaded pages belong to (a new search or another actor starts at page 1 again, 010d);
   * `backToFirst` marks that freshly read pages did not fit together and only page 1 stands.
   */
  const [resultsState, setResultsState] = useState<{
    key: string;
    paging: string;
    paged: PagedResults;
    backToFirst: boolean;
  } | null>(null);
  const [resultsLoadingState, setResultsLoading] = useState(true);
  const [corpusState, setCorpusState] = useState<{
    key: string;
    items: readonly Question[];
    complete: boolean;
  } | null>(null);
  const [units, setUnits] = useState<readonly Unit[]>([]);
  const [agendaItems, setAgendaItems] = useState<readonly AgendaItem[]>([]);
  const [namesState, setNamesState] = useState<{
    key: string;
    names: ReadonlyMap<string, string>;
  } | null>(null);
  const [historyState, setHistory] = useState<{
    key: string;
    questionId: string;
    events: readonly DomainEvent[];
  } | null>(null);
  // The tail read for the "Ereignisstrom" tab: `window` is the bounded read itself (`stream`, the
  // reversed table slice, is derived from it); `curve`, the bucketed Lastkurve, is recomputed in
  // the same place the read happens, so it is bucketed once per fetched tail, keyed on `lastSeq` —
  // never on a render that leaves the tail untouched (R10, 007 rework). Slice 010d: `key` is the
  // load that read it.
  // takt-038, Ziel 2: `cursor` is the `seq` the window has been read up to; later counts read only
  // from there to the head (`advanceStream`, lib.ts).
  const [streamState, setStreamState] = useState<{
    key: string | null;
    cursor: number;
    window: readonly ReadEvent[];
    curve: readonly number[];
  }>({ key: null, cursor: 0, window: NO_READ_EVENTS, curve: NO_CURVE });
  // Ziel 1 (slice 010b): `listQuestions` is the Hauptabfrage of the Historie — set from the 403's
  // ruleId alone (AGENTS.md rule 4), e.g. podium, who holds neither `question.read` nor
  // `question.read.delivered` at all. observer never sets this: it holds the scoped
  // `question.read.delivered` and simply sees fewer rows (Ziel 3).
  //
  // Slice 010c: every read state carries the key of its load (actor and `version`, plus the
  // selected question for the Vorgangshistorie), and each "keine Leseberechtigung" is the verdict of
  // the current key (`readVerdict`, lib.ts). They used to be bare flags that only a successful read
  // cleared — after a switch from a refused role, a 500 on the new role's first read left the
  // refusal standing (Ziel 2). A refusal belongs to the actor: a plain failure of the same actor's
  // next load keeps it (review round 1, finding 4).
  const actorId = useActor().id;
  /**
   * Slice 090: the search is text the person typed, and it belongs to them. On an actor change it
   * is emptied in the same render (compared by `id`, never by role, AGENTS.md rule 4), so the next
   * person at the device neither sees the term nor gets results filtered by it. Tab and selection
   * are not typed text and stay (010d).
   */
  const [queryActorId, setQueryActorId] = useState(actorId);
  if (queryActorId !== actorId) {
    setQueryActorId(actorId);
    setQuery('');
  }
  const mainKey = loadKey(actorId, version);
  // takt-038: the loaded result pages and the table pages of the Ereignisstrom belong to one actor
  // (and, for the results, one search); for anyone else they count from page 1.
  const pagingKey = loadKey(actorId, search);
  const [moreResults, setMoreResults] = useState({ paging: '', count: 1 });
  const pageCount = moreResults.paging === pagingKey ? moreResults.count : 1;
  const [olderRows, setOlderRows] = useState({ actor: '', count: 1 });
  const tablePageCount = olderRows.actor === actorId ? olderRows.count : 1;
  const timelineKey = loadKey(actorId, `${version}:${selectedId ?? ''}`);
  const [corpusRead, setCorpusRead] = useState<KeyedRead | null>(null);
  const [resultsRead, setResultsRead] = useState<KeyedRead | null>(null);
  const [shownMainVerdict, setShownMainVerdict] = useState<ReadVerdict>(NO_VERDICT);
  const mainVerdict = readVerdict(
    shownMainVerdict,
    [
      { read: corpusRead, key: mainKey },
      { read: resultsRead, key: mainKey },
    ],
    actorId,
  );
  if (mainVerdict !== shownMainVerdict) setShownMainVerdict(mainVerdict);
  const mainForbidden = mainVerdict.forbidden;
  // Ziel 3: the "Vorgangshistorie" tab of one selected question (`getQuestionHistory`).
  const [timelineRead, setTimelineRead] = useState<KeyedRead | null>(null);
  const [shownTimelineVerdict, setShownTimelineVerdict] = useState<ReadVerdict>(NO_VERDICT);
  const timelineVerdict = readVerdict(
    shownTimelineVerdict,
    [{ read: timelineRead, key: timelineKey }],
    actorId,
  );
  if (timelineVerdict !== shownTimelineVerdict) setShownTimelineVerdict(timelineVerdict);
  const historyForbidden = timelineVerdict.forbidden;
  // Ziel 3: the "Ereignisstrom" tab (`listEvents`).
  const [streamRead, setStreamRead] = useState<KeyedRead | null>(null);
  const [shownStreamVerdict, setShownStreamVerdict] = useState<ReadVerdict>(NO_VERDICT);
  const streamVerdict = readVerdict(shownStreamVerdict, [{ read: streamRead, key: mainKey }], actorId);
  if (streamVerdict !== shownStreamVerdict) setShownStreamVerdict(streamVerdict);
  const streamForbidden = streamVerdict.forbidden;

  // Slice 010d, Ziel 1: what this actor may be shown of each record (see above).
  const resultsOwned = resultsState !== null && keyBelongsTo(resultsState.key, actorId);
  const paged = resultsOwned ? resultsState.paged : NO_PAGES;
  const results = useMemo(
    () => paged.pages.flat().sort((a, b) => a.number.localeCompare(b.number)),
    [paged],
  );
  const total = paged.total;
  const backToFirst = resultsOwned && resultsState.backToFirst;
  const resultsLoading = resultsLoadingState || !resultsOwned;
  const corpusOwned = corpusState !== null && keyBelongsTo(corpusState.key, actorId);
  const corpus = corpusOwned ? corpusState.items : NO_QUESTIONS;
  const speakerNames =
    namesState !== null && keyBelongsTo(namesState.key, actorId) ? namesState.names : NO_NAMES;
  const history =
    historyState !== null &&
    historyState.questionId === selectedId &&
    keyBelongsTo(historyState.key, actorId)
      ? historyState.events
      : null;
  const streamOwned = keyBelongsTo(streamState.key, actorId);
  const streamWindow = streamOwned ? streamState.window : NO_READ_EVENTS;
  const curve = streamOwned ? streamState.curve : NO_CURVE;
  /**
   * Slice 010d, review round 1, finding 3: the stream effect reads its own record through this ref
   * instead of depending on it. As a dependency (`streamOwned`, and before it `streamLastSeq`) every
   * answer of the effect ran it again — a failed read of the tail set the record, which started the
   * effect a second time: two reads, two toasts. Now only a new `version` or the tab starts it.
   * Kept after each commit, before any effect of that commit runs.
   */
  const streamRef = useRef(streamState);
  // takt-038: the results effect reads the pages shown so far the same way, to compare fresh pages
  // with them (`mergeResultPages`) without running again on its own answer.
  const resultsRef = useRef(resultsState);
  useLayoutEffect(() => {
    streamRef.current = streamState;
    resultsRef.current = resultsState;
  });

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
    // Slice 010c: the key this load answers for, and the view's key when the answer arrives — read
    // from the actor store at that moment, so an answer in the gap between an actor switch and the
    // `version` bump is dropped too.
    const requested = loadKey(getActor().id, version);
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, version));
    api
      .listQuestions({ limit: 2000 })
      .then((page) => {
        if (!isCurrentLoad(requested, current())) return;
        const complete = page.items.length >= page.total;
        const ids = new Set(page.items.map((question) => question.id));
        setCorpusState({ key: requested, items: page.items, complete });
        setCorpusRead({ key: requested, status: 'ready' });
        gate.settleMain(String(version), false, complete ? (id) => !ids.has(id) : undefined);
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, current())) return;
        if (isReadForbidden(error)) {
          setCorpusState({ key: requested, items: NO_QUESTIONS, complete: false });
          setCorpusRead({ key: requested, status: 'forbidden' });
          gate.settleMain(String(version), true);
          return;
        }
        setCorpusRead({ key: requested, status: 'error' });
        // Slice 010d: the same actor keeps what it had; a corpus another actor read gives way to none.
        setCorpusState((previous) =>
          previous !== null && keyBelongsTo(previous.key, getActor().id)
            ? previous
            : { key: requested, items: NO_QUESTIONS, complete: false },
        );
        problem(error);
        gate.settleMain(String(version), false);
      });
    return () => {
      cancelled = true;
    };
  }, [version, gate]);

  useEffect(() => {
    let cancelled = false;
    // Slice 010c: names of a previous actor that land in the gap before the `version` bump are
    // dropped like every other answer of an overtaken load.
    const requested = loadKey(getActor().id, version);
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, version));
    api
      .listSpeakers()
      .then((speakers) => {
        if (!isCurrentLoad(requested, current())) return;
        setNamesState({
          key: requested,
          names: new Map(speakers.map((speaker) => [speaker.id, speaker.displayName])),
        });
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, current())) return;
        // Ziel 2: a Nebenabfrage never blocks the view and never toasts for a read refusal — the
        // event summaries simply carry fewer names (`eventSubject`, eventSummary.ts). Nit 10
        // (review round 2): cleared, not left holding a previous, more privileged role's names —
        // `version` bumps on every actor switch (api/useApiVersion.ts), so a role that has just
        // lost `speaker.read` must not go on showing who it can no longer look up.
        setNamesState({ key: requested, names: NO_NAMES });
        if (isReadForbidden(error)) return;
        problem(error);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    let cancelled = false;
    const requested = loadKey(getActor().id, version);
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, version));
    const paging = loadKey(getActor().id, search);
    setResultsLoading(true);
    // takt-038, Ziel 1 (Codex P1): every loaded page is read again, not only the first; over the
    // live store (036a) that costs network only after a change of `questions`. The new pages replace
    // the old ones only once all of them are here.
    readResultPages(api, search !== '' ? { q: search } : {}, pageCount)
      .then((pages) => {
        if (!isCurrentLoad(requested, current())) return;
        const held = resultsRef.current;
        const sameList = held !== null && held.paging === paging;
        const merged = mergeResultPages(sameList ? held.paged : null, pages);
        if (merged === null) {
          // Pages that do not fit together: page 1 alone, with a notice — never a list silently
          // put together from different states.
          const first = pages[0];
          setResultsState({
            key: requested,
            paging,
            paged: first === undefined ? NO_PAGES : { pages: [first.items], total: first.total },
            backToFirst: true,
          });
          setMoreResults({ paging, count: 1 });
        } else {
          setResultsState({
            key: requested,
            paging,
            paged: merged,
            // The notice stays on page 1 until the person loads further pages again.
            backToFirst: pageCount === 1 && sameList && held.backToFirst,
          });
        }
        setResultsLoading(false);
        setResultsRead({ key: requested, status: 'ready' });
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, current())) return;
        setResultsLoading(false);
        if (isReadForbidden(error)) {
          setResultsState({ key: requested, paging, paged: NO_PAGES, backToFirst: false });
          setResultsRead({ key: requested, status: 'forbidden' });
          return;
        }
        setResultsRead({ key: requested, status: 'error' });
        setResultsState((previous) =>
          previous !== null && keyBelongsTo(previous.key, getActor().id)
            ? previous
            : { key: requested, paging, paged: NO_PAGES, backToFirst: false },
        );
        problem(error);
      });
    return () => {
      cancelled = true;
    };
  }, [version, search, pageCount]);

  // Codex P2-A on 948a721: only a complete corpus (nothing cut off by the limit) of this very actor
  // says that "not in the corpus" means "not readable".
  const corpusComplete = corpusOwned && corpusState.complete;

  /**
   * Codex P2-A on 948a721: no history read while the view cannot show the selection — the whole
   * view is refused (podium), or the complete corpus of this actor leaves the question out
   * (observer, and a question that has not been read out).
   */
  const selectionHidden =
    mainForbidden ||
    (selectedId !== null && corpusComplete && !corpus.some((question) => question.id === selectedId));

  // Nit 2 (review round 5): each change of the selection is a new pass for the gate's one toast.
  useEffect(() => {
    gate.select();
  }, [selectedId, gate]);

  useEffect(() => {
    const scope = `${version}:${selectedId ?? ''}`;
    const requested = loadKey(getActor().id, scope);
    if (selectedId === null || selectionHidden) {
      // Nothing to read is an answer too: no refusal stands for this key.
      setHistory(null);
      setTimelineRead({ key: requested, status: 'ready' });
      return undefined;
    }
    let cancelled = false;
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, scope));
    const load = String(version);
    api
      .getQuestionHistory(selectedId)
      .then((events) => {
        if (!isCurrentLoad(requested, current())) return;
        setHistory({ key: requested, questionId: selectedId, events });
        setTimelineRead({ key: requested, status: 'ready' });
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, current())) return;
        if (isReadForbidden(error)) {
          // Ziel 3: e.g. observer, who may find the question (`question.read.delivered`) but holds
          // no `history.read` — a gestalteter Zustand, not an error toast.
          setHistory({ key: requested, questionId: selectedId, events: NO_EVENTS });
          setTimelineRead({ key: requested, status: 'forbidden' });
          return;
        }
        setHistory({ key: requested, questionId: selectedId, events: NO_EVENTS });
        // Slice 010c, Ziel 2: the failure is this load's answer; it replaces a refusal given to
        // another actor (`readVerdict`).
        setTimelineRead({ key: requested, status: 'error' });
        gate.report(load, selectedId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [version, selectedId, selectionHidden, gate]);

  useEffect(() => {
    if (tab !== 'stream') return undefined;
    let cancelled = false;
    const requested = loadKey(getActor().id, version);
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, version));
    // The table and the Lastkurve (point 9) both read at most the last STREAM_SCAN_LIMIT events
    // rather than the whole log (R10, 007 rework). takt-038, Ziel 2: only the first load reads that
    // window; later counts read from the held cursor up to the head and extend it (`advanceStream`).
    // `version` bumps on every actor switch too (api/useApiVersion.ts), which never grows the log —
    // an unchanged head then costs one empty read and leaves the window as it is.
    // Slice 010d: only this actor's own window is extended; a window another actor read is not shown
    // (`streamOwned`) and is read afresh, once.
    const held = streamRef.current;
    const base = keyBelongsTo(held.key, getActor().id)
      ? { cursor: held.cursor, events: held.window }
      : null;
    advanceStream(api, base)
      .then((next) => {
        if (!isCurrentLoad(requested, current())) return;
        setStreamRead({ key: requested, status: 'ready' });
        if (next === base) return;
        setStreamState({
          key: requested,
          cursor: next.cursor,
          window: next.events,
          curve: loadCurve(next.events, Date.now()),
        });
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, current())) return;
        if (isReadForbidden(error)) {
          // Ziel 3: e.g. observer, who holds no `event.read` at all — a gestalteter Zustand, not
          // an error toast. Minor 3 (review round 2): clears the tail read too, and rewinds the
          // cursor to 0 — a role that regains `event.read` later reads its window afresh.
          setStreamRead({ key: requested, status: 'forbidden' });
          setStreamState({ key: requested, cursor: 0, window: NO_READ_EVENTS, curve: NO_CURVE });
          return;
        }
        // Slice 010c, Ziel 2: the failure is this load's answer; it replaces a refusal given to
        // another actor (`readVerdict`).
        setStreamRead({ key: requested, status: 'error' });
        setStreamState((previous) =>
          keyBelongsTo(previous.key, getActor().id)
            ? previous
            : { key: requested, cursor: 0, window: NO_READ_EVENTS, curve: NO_CURVE },
        );
        problem(error);
      });
    return () => {
      cancelled = true;
    };
  }, [version, tab]);

  // takt-038 (e): 200 rows per table page, "Ältere laden" within the window.
  const { rows: stream, hasOlder } = useMemo(
    () => tableRows(streamWindow, tablePageCount),
    [streamWindow, tablePageCount],
  );
  const canLoadMore = resultsOwned && total > results.length && pageCount < RESULT_PAGE_MAX;

  const context = useMemo<SummaryContext>(
    () => ({
      unitNames: new Map(units.map((unit) => [unit.id, unit.shortName ?? unit.name])),
      agendaNumbers: new Map(agendaItems.map((item) => [item.id, item.number])),
      questionNumbers: new Map(corpus.map((question) => [question.id, question.number])),
      speakerNames,
      // Scheibe 045: the refusal drafts among the loaded events of both readings.
      refusalVersions: refusalVersionsOf([...(history ?? []), ...stream]),
    }),
    [units, agendaItems, corpus, speakerNames, history, stream],
  );

  const selected = useMemo(
    () => corpus.find((question) => question.id === selectedId) ?? null,
    [corpus, selectedId],
  );

  /**
   * Slice 010d: the right pane's loading state, while this actor's own record is on its way — the
   * same skeleton the result list shows (design principle 8), under the wording the Bühne already
   * borrows from the Beantwortung for its own skeleton.
   */
  const paneLoading = (
    <div
      role="status"
      className="space-y-1.5 p-4"
      aria-busy="true"
      aria-label={t('answers.list.loading')}
    >
      {[0, 1, 2, 3, 4, 5].map((line) => (
        <div key={line} className="h-10 animate-pulse rounded-sm bg-ink-50" />
      ))}
    </div>
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
                      // Slice 010d: `role="status"` gives the label a role to name — on a bare
                      // div axe rejects `aria-label` (aria-prohibited-attr, serious).
                      <div
                        role="status"
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

              {backToFirst && (
                <p
                  role="status"
                  data-testid="history-results-back-to-first"
                  className="shrink-0 border-t border-line bg-sunken px-4 py-1.5 text-2xs text-ink-600"
                >
                  {t('history.results.backToFirst')}
                </p>
              )}
              {canLoadMore ? (
                <div className="shrink-0 border-t border-line px-4 py-2">
                  <Button
                    size="sm"
                    data-testid="history-results-load-more"
                    disabled={resultsLoadingState}
                    onClick={() => setMoreResults({ paging: pagingKey, count: pageCount + 1 })}
                  >
                    {t('history.results.loadMore')}
                  </Button>
                </div>
              ) : (
                total > results.length && (
                  <p className="shrink-0 border-t border-line bg-sunken px-4 py-1.5 text-2xs text-ink-600">
                    {t('history.results.more')}
                  </p>
                )
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
                  ? streamForbidden || !streamOwned
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
                  ) : !streamOwned ? (
                    paneLoading
                  ) : (
                    <>
                      <EventStream events={stream} context={context} curve={curve} />
                      {hasOlder && (
                        <div className="px-4 pb-4">
                          <Button
                            size="sm"
                            data-testid="history-stream-older"
                            onClick={() => setOlderRows({ actor: actorId, count: tablePageCount + 1 })}
                          >
                            {t('history.stream.older')}
                          </Button>
                        </div>
                      )}
                    </>
                  )
                ) : selected === null ? (
                  // Slice 010d: a selection whose record this actor has not read yet is loading,
                  // not "no question chosen".
                  selectedId !== null && !corpusOwned ? (
                    paneLoading
                  ) : (
                    <div className="p-4">
                      <EmptyState
                        icon={History}
                        title={t('history.timeline.empty.title')}
                        description={t('history.timeline.empty.body')}
                      />
                    </div>
                  )
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
                ) : history === null ? (
                  paneLoading
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
