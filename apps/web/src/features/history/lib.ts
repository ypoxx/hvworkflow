/**
 * Helpers of the history view. Local to the feature: how a time is printed and how much of a text a
 * row can carry is a decision of this view, not of the component kit.
 */
import { hasPermission } from '@hv/domain';
import type { DomainEvent, HvApi, Question, QuestionFilter, ReadEvent, Role } from '@hv/domain';
import type { Translate } from '../../i18n';

/**
 * Scheibe 040a (Rechtekonzept §4: every administrative action on content is highlighted in the
 * course of the question): whether an event's role is a role-managing one, read from the rights data
 * (`admin.roles.manage` in its bundle), never from a role name (AGENTS.md R4). For display only; it
 * decides nothing about what anybody may do.
 */
export function isAdministrativeRole(role: Role): boolean {
  return hasPermission({ id: 'history-display', role }, 'admin.roles.manage').allow;
}

/** How many results are rendered before the person is asked to narrow the search. */
export const RESULT_LIMIT = 200;

/** How many events the "Ereignisstrom" tab shows — the tail of the meeting, not its whole log. */
export const STREAM_LIMIT = 200;

/**
 * How many trailing events the stream tab reads at most. Bounds both the tail table and the
 * Lastkurve to a fixed, documented cap instead of the whole log (R10, 007 rework): at 800 seeded
 * questions that log is already several thousand events, and over the HTTP adapter fetching all of
 * it on every refetch is a multi-megabyte response.
 */
export const STREAM_SCAN_LIMIT = 5000;

/**
 * takt-038: at most this many result pages are loaded — 10 × `RESULT_LIMIT` = 2000, the contract's
 * upper bound for `listQuestions`. Beyond it the person is asked to narrow the search.
 */
export const RESULT_PAGE_MAX = 10;

/** One answer of `listQuestions` as the result list reads it. */
export interface ResultPage<T extends { id: string } = Question> {
  readonly items: readonly T[];
  readonly total: number;
}

/** The pages the result list shows, in the order the service returned them. */
export interface PagedResults<T extends { id: string } = Question> {
  readonly pages: readonly (readonly T[])[];
  readonly total: number;
}

/**
 * takt-038, Ziel 1 (Codex P1): reads every loaded page again, not only the first — pages `0..count-1`
 * by `offset`. Over the live store (036a) only a change of `questions` costs network; otherwise every
 * page comes from its buffer, so no later page can keep an object that has changed since.
 */
export function readResultPages(
  api: Pick<HvApi, 'listQuestions'>,
  filter: Omit<QuestionFilter, 'limit' | 'offset'>,
  count: number,
  pageSize: number = RESULT_LIMIT,
): Promise<ResultPage[]> {
  return Promise.all(
    Array.from({ length: count }, (_, index) =>
      api.listQuestions({ ...filter, limit: pageSize, offset: index * pageSize }),
    ),
  );
}

/**
 * takt-038, Ziel 1: pieces freshly read pages together — or refuses to (`null`). The caller then
 * falls back to the first page with a notice ("zurück auf Seite 1"), never to a list silently put
 * together from pages of different states. Refused when more than one page is read and
 * - the pages report different totals, or the total shrank against `previous`;
 * - the first page's ids differ from `previous`'s first page (the order shifted);
 * - an id appears twice, or a page is shorter than its place requires (an id went missing at a
 *   boundary).
 * The first page alone is always consistent with itself. `previous` is the state shown before, of
 * the same actor and search only (010d).
 */
export function mergeResultPages<T extends { id: string }>(
  previous: PagedResults<T> | null,
  fresh: readonly ResultPage<T>[],
  pageSize: number = RESULT_LIMIT,
): PagedResults<T> | null {
  const [first] = fresh;
  if (first === undefined) return null;
  if (fresh.length === 1) return { pages: [first.items], total: first.total };
  const total = first.total;
  if (fresh.some((one) => one.total !== total)) return null;
  if (previous !== null) {
    if (total < previous.total) return null;
    const before = previous.pages[0] ?? [];
    if (before.length !== first.items.length) return null;
    if (before.some((item, index) => item.id !== first.items[index]?.id)) return null;
  }
  const seen = new Set<string>();
  for (const [index, one] of fresh.entries()) {
    const expected = Math.min(pageSize, total - index * pageSize);
    if (expected <= 0 || one.items.length !== expected) return null;
    for (const item of one.items) {
      if (seen.has(item.id)) return null;
      seen.add(item.id);
    }
  }
  return { pages: fresh.map((one) => one.items), total };
}

/** The Ereignisstrom tab's held read: the bounded window and the `seq` it has read up to. */
export interface StreamWindowState {
  readonly cursor: number;
  readonly events: readonly ReadEvent[];
}

/** Page size of one `listEvents` read and the cap of the window; both `STREAM_SCAN_LIMIT` in the view. */
export interface StreamReadOptions {
  readonly pageSize?: number;
  readonly windowLimit?: number;
}

/** takt-038, Ziel 2: appends new events and keeps the newest `limit`; the oldest fall out. */
export function extendWindow(
  held: readonly ReadEvent[],
  fresh: readonly ReadEvent[],
  limit: number = STREAM_SCAN_LIMIT,
): readonly ReadEvent[] {
  const last = held.at(-1)?.seq ?? 0;
  const next = [...held, ...fresh.filter((event) => event.seq > last)];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** Pages from `from` (exclusive) up to `head`; the collected events and the last `seq` reached. */
async function pageToHead(
  api: Pick<HvApi, 'listEvents'>,
  from: number,
  head: number,
  pageSize: number,
): Promise<{ events: ReadEvent[]; reached: number }> {
  const events: ReadEvent[] = [];
  let cursor = from;
  while (cursor < head) {
    const page = await api.listEvents(cursor, pageSize);
    events.push(...page.items);
    const last = page.items.at(-1)?.seq;
    // No progress (nothing more readable up to the head) ends the walk, never an endless loop.
    if (last === undefined || last <= cursor) break;
    cursor = last;
    if (page.items.length < pageSize) break;
  }
  return { events, reached: Math.max(cursor, head) };
}

/** The first load (or a reload after a reset): the trailing window of at most `windowLimit` events. */
async function readFreshWindow(
  api: Pick<HvApi, 'listEvents'>,
  pageSize: number,
  windowLimit: number,
): Promise<StreamWindowState> {
  // A cheap read of just the head first: the window starts `windowLimit` before it.
  const { lastSeq } = await api.listEvents(0, 1);
  const { events, reached } = await pageToHead(api, Math.max(0, lastSeq - windowLimit), lastSeq, pageSize);
  return { cursor: reached, events: extendWindow([], events, windowLimit) };
}

/**
 * takt-038, Ziel 2 (Codex P2): brings the Ereignisstrom window up to the head. First load: the
 * trailing window as before. Later counts: `listEvents(cursor, pageSize)` and onward from the last
 * `seq` received, until an answer is short or the head of the first answer is reached; the window is
 * extended and capped. A head more than `windowLimit` ahead makes the walk start at
 * `head − windowLimit`, and the window is replaced rather than extended. A head below the cursor (a
 * restore, 035b `reset`) drops the window and reads it afresh.
 *
 * Nothing is written until every page has answered: a failing page rejects, and the caller keeps its
 * old cursor and window (no half-advanced state). An unchanged head returns `held` itself, so the
 * caller can skip recomputing what it derives from the window.
 */
export async function advanceStream(
  api: Pick<HvApi, 'listEvents'>,
  held: StreamWindowState | null,
  options: StreamReadOptions = {},
): Promise<StreamWindowState> {
  const pageSize = options.pageSize ?? STREAM_SCAN_LIMIT;
  const windowLimit = options.windowLimit ?? pageSize;
  if (held === null) return readFreshWindow(api, pageSize, windowLimit);
  const first = await api.listEvents(held.cursor, pageSize);
  const head = first.lastSeq;
  if (head < held.cursor) return readFreshWindow(api, pageSize, windowLimit);
  if (head - held.cursor > windowLimit) {
    const { events, reached } = await pageToHead(api, head - windowLimit, head, pageSize);
    return { cursor: reached, events: extendWindow([], events, windowLimit) };
  }
  const last = first.items.at(-1)?.seq;
  if (last === undefined) return head === held.cursor ? held : { cursor: head, events: held.events };
  const rest =
    first.items.length < pageSize ? { events: [], reached: Math.max(last, head) } : await pageToHead(api, last, head, pageSize);
  return {
    cursor: rest.reached,
    events: extendWindow(held.events, [...first.items, ...rest.events], windowLimit),
  };
}

/** takt-038 (e): the table of the Ereignisstrom, newest first, `size` rows per page within the window. */
export function tableRows<E>(
  window: readonly E[],
  pages: number,
  size: number = STREAM_LIMIT,
): { rows: E[]; hasOlder: boolean } {
  const shown = Math.max(1, pages) * size;
  return { rows: window.slice(-shown).reverse(), hasOlder: window.length > shown };
}

/** Wall clock with seconds: two events of the same minute must stay distinguishable. */
export function clockTime(iso: string): string {
  const at = new Date(iso);
  return [at.getHours(), at.getMinutes(), at.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function excerpt(text: string, max = 80): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/**
 * A denied read (R-PERM-02 "no read permission" or R-PERM-03 "read scope exceeded", slice 010).
 * Structural, not `instanceof`: the interface talks to `HvApi`, and an HTTP adapter hands out a
 * plain problem object rather than the domain's error class. Read by ruleId alone, never by role
 * name (AGENTS.md rule 4, docs/slices/010b-lesepfade-oberflaeche.md Ziel 4).
 *
 * Test gap 8c (review round 2): identical in `speakers/useSpeakers.ts`, `capture/useCapture.ts`,
 * `answers/lib.ts` and `stage/lib.ts` — see `speakers/useSpeakers.ts`'s copy for why this stays
 * five small local copies rather than one shared module. Covered by its own test here
 * (`lib.test.ts`).
 */
export function isReadForbidden(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = 'status' in error ? (error as { status: unknown }).status : undefined;
  const ruleId = 'ruleId' in error ? (error as { ruleId: unknown }).ruleId : undefined;
  return status === 403 && (ruleId === 'R-PERM-02' || ruleId === 'R-PERM-03');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * "1 h 12 min", "2 min 10 s", "9 s" — the coarsest two units that matter at each scale. The unit
 * words go through i18n like every other visible string (`time.unit.h/min/s`, R12 of the 007
 * rework); `t` is passed in rather than imported so this stays a pure function of its arguments.
 */
function formatSpan(ms: number, t: Translate): string {
  const totalSeconds = Math.round(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} ${t('time.unit.h')} ${pad2(minutes)} ${t('time.unit.min')}`;
  if (minutes > 0) return `${minutes} ${t('time.unit.min')} ${pad2(seconds)} ${t('time.unit.s')}`;
  return `${seconds} ${t('time.unit.s')}`;
}

/** Durchlaufzeit between two consecutive events on the timeline ("+9 s", "+1 h 05 min", point 8). */
export function eventGap(fromIso: string, toIso: string, t: Translate): string {
  return `+${formatSpan(Date.parse(toIso) - Date.parse(fromIso), t)}`;
}

/** A total elapsed span for the KPI line — the same scale rule, without the "+" of a gap. */
export function elapsedSpan(fromIso: string, toIso: string, t: Translate): string {
  return formatSpan(Date.parse(toIso) - Date.parse(fromIso), t);
}

/** The three KPI numbers of point 8, read from the event log alone (AGENTS.md rule 5). */
export interface HistoryKpi {
  capturedAt: string | undefined;
  deliveredAt: string | undefined;
  versions: number;
  returns: number;
}

export function historyKpi(events: readonly DomainEvent[]): HistoryKpi {
  let capturedAt: string | undefined;
  let deliveredAt: string | undefined;
  let versions = 0;
  let returns = 0;
  for (const event of events) {
    switch (event.type) {
      case 'QuestionCaptured':
        capturedAt = event.at;
        break;
      case 'QuestionDelivered':
        deliveredAt = event.at;
        break;
      case 'AnswerDrafted':
        versions += 1;
        break;
      case 'QuestionReturned':
        returns += 1;
        break;
      default:
        break;
    }
  }
  return { capturedAt, deliveredAt, versions, returns };
}

/** Width of one bucket and how many make up the "Lastkurve" window (point 9). */
const BUCKET_MS = 5 * 60_000;
const BUCKET_COUNT = 24; // two hours

/** Event counts in 5-minute buckets over the last two hours, oldest first — the "Lastkurve". */
export function loadCurve(events: readonly DomainEvent[], now: number): number[] {
  const start = now - BUCKET_COUNT * BUCKET_MS;
  const counts = new Array<number>(BUCKET_COUNT).fill(0);
  for (const event of events) {
    const at = Date.parse(event.at);
    if (at < start || at > now) continue;
    const index = Math.min(BUCKET_COUNT - 1, Math.floor((at - start) / BUCKET_MS));
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}

/**
 * Codex (b) on 7f542b6, Codex P2-2 on 4f0d231 and Codex P2-A on 948a721 — one class of bug: a
 * detail read (the one selected question) runs next to the view's Hauptabfrage (the list). After
 * a role switch the selected question may no longer be readable, and its detail read then answers
 * with the masked 404 (Festlegung 3 of docs/slices/010-lesepfade-leserechte.md), which
 * `isReadForbidden` rightly does not treat as a read refusal — so it used to become an error toast.
 * Two shapes: the list itself is refused (podium, R-PERM-02), or the list succeeds but, scoped,
 * no longer contains the question (observer, `question.read.delivered`, and an undelivered one).
 *
 * The gate holds a detail read's failure back until the Hauptabfrage of the same load (`load`,
 * e.g. the API version) has answered. It is dropped when that answer was a refusal or is known to
 * leave the question out (`omits`); otherwise it is shown — once per selection pass, however many
 * detail reads of it fail (minor 2, review round 3). Nit 2 (review round 5): a pass starts with
 * every `select()`, so A (failed, shown), B, then A again reports A's failure afresh. A load the
 * next one overtakes never reports: its successor reads again. Nothing here holds the reads
 * themselves back (nit C, review round 4) — only the toast waits.
 *
 * Kept as a small local copy per feature that has a detail read (`answers/lib.ts`,
 * `history/lib.ts`), like `isReadForbidden` (test gap 8c, review round 2); covered by the same test
 * table in each feature's `lib.test.ts`.
 */
export interface DetailProblemGate {
  /** The selection changed: a new pass begins. */
  select(): void;
  /**
   * The Hauptabfrage of `load` has answered. `refused`: a read refusal. `omits(id, error)`: its
   * answer is known to leave `id` out, so that this failure of its detail read says nothing new —
   * only a complete, unfiltered list can know that for any failure; a filtered one says nothing
   * about what it does not show (slice 010c, Ziel 5: see `listOmits` in answers/lib.ts for the one
   * narrow exception, which looks at the failure itself).
   */
  settleMain(
    load: string,
    refused: boolean,
    omits?: (id: string, error: unknown) => boolean,
  ): void;
  /** A detail read of `id` in `load` failed with something other than a read refusal. */
  report(load: string, id: string, error: unknown): void;
}

export function createDetailProblemGate(show: (error: unknown) => void): DetailProblemGate {
  let verdict: {
    load: string;
    refused: boolean;
    omits: (id: string, error: unknown) => boolean;
  } | null = null;
  let pass = 0;
  // Slice 010c, review round 3 (R3-1): every failure of the pass is kept, not only the first one.
  // Since `omits` looks at the failure itself, their order must not decide the outcome — a masked
  // 404 of one detail read that arrives first must not hide a 5xx of the other.
  let pending: {
    load: string;
    pass: number;
    failures: { id: string; error: unknown }[];
  } | null = null;
  let shown: string | null = null;
  const flush = (): void => {
    if (pending === null || verdict === null || pending.load !== verdict.load) return;
    const { load, failures } = pending;
    const key = `${load}:${pending.pass}`;
    pending = null;
    if (verdict.refused || key === shown) return;
    const omits = verdict.omits;
    const first = failures.find(({ id, error }) => !omits(id, error));
    if (first === undefined) return;
    shown = key;
    show(first.error);
  };
  return {
    select() {
      pass += 1;
      pending = null;
    },
    settleMain(load, refused, omits = () => false) {
      verdict = { load, refused, omits };
      flush();
    },
    report(load, id, error) {
      const key = `${load}:${pass}`;
      if (key === shown) return;
      if (pending === null || `${pending.load}:${pending.pass}` !== key) {
        pending = { load, pass, failures: [] };
      }
      pending.failures.push({ id, error });
      flush();
    },
  };
}

/**
 * Slice 010c (Lesezustand je Ladevorgang): a read state — ready, refused, failed — belongs to the
 * load that produced it, and a load is keyed by the actor who asked and the `version` it asked at.
 * Two rules follow, and every view keeps both:
 * - An answer counts only for its own load (`isCurrentLoad`). One that was overtaken — a newer
 *   `version`, or another actor in the gap before the `version` bump that follows every actor
 *   switch (api/useApiVersion.ts) — never reports.
 * - The view's verdict ("keine Leseberechtigung" or not) changes only once every read it depends on
 *   has answered for the current key (`readVerdict`). Until then the previous verdict stands, so
 *   nothing flickers while a load is on its way (design principle 8; review round 1, finding 7).
 *   A refusal belongs to the actor it was given to (review round 1, finding 4): a ready answer or a
 *   refusal replaces it, and so does a failure of another actor's load — but a plain failure of the
 *   same actor's next load says nothing new about that actor's rights, and the refusal stands.
 *
 * Kept as a small local copy per feature (`speakers/useSpeakers.ts`, `capture/useCapture.ts`,
 * `answers/lib.ts`, `stage/lib.ts`, `history/lib.ts`) — the spec allows no shared folder outside the
 * features — and covered by the same test table in each.
 */
export type ReadStatus = 'ready' | 'forbidden' | 'error';

/** What one load answered, and which load that was. */
export interface KeyedRead {
  readonly key: string;
  readonly status: ReadStatus;
}

/** The verdict a view shows, and the actor it was reached for (`null` before any). */
export interface ReadVerdict {
  readonly actor: string | null;
  readonly forbidden: boolean;
}

export const NO_VERDICT: ReadVerdict = { actor: null, forbidden: false };

/** The key of one load: who asked, and at which `version` (plus, where needed, what was asked). */
export function loadKey(actorId: string, version: number | string): string {
  return JSON.stringify([actorId, String(version)]);
}

/**
 * Whether an answer asked under `requested` still speaks for the view. `current` is the view's key
 * at the moment the answer arrives, or `null` once the view has moved on (its effect was cleaned up).
 */
export function isCurrentLoad(requested: string, current: string | null): boolean {
  return current !== null && requested === current;
}

/**
 * The verdict a view shows for `actorId`: `previous` until every read has answered for its own
 * current key, then "refused" if one of those answers is a refusal — or if every one of them failed
 * and the previous refusal was this very actor's. An unchanged verdict is returned as the same
 * object, so a caller may store it during render without looping.
 */
export function readVerdict(
  previous: ReadVerdict,
  reads: readonly { read: KeyedRead | null; key: string }[],
  actorId: string,
): ReadVerdict {
  const answers: ReadStatus[] = [];
  for (const { read, key } of reads) {
    if (read === null || read.key !== key) return previous;
    answers.push(read.status);
  }
  const keepsRefusal =
    previous.forbidden &&
    previous.actor === actorId &&
    answers.every((status) => status === 'error');
  const forbidden = answers.includes('forbidden') || keepsRefusal;
  return previous.actor === actorId && previous.forbidden === forbidden
    ? previous
    : { actor: actorId, forbidden };
}

/**
 * Slice 010d (Ansichtsdaten gehören dem Schlüssel des Akteurs): whether data loaded under `key` may
 * be offered to `actorId` — only data of that very actor, at any `version`. Data of another actor
 * (the previous role, until the new one has answered) carries that actor's `_actions` and read
 * scope; it is not offered (design principle 9), and the view shows its loading state instead.
 * `null`: nothing loaded yet. The actor is read from the key as a whole (`loadKey` is JSON), so
 * one id that is a prefix of another never matches.
 *
 * Kept as a small local copy per feature that holds such data (`speakers/useSpeakers.ts`,
 * `capture/useCapture.ts`, `answers/lib.ts`, `history/lib.ts`), next to the 010c pattern above, and
 * covered by the same test table in each.
 */
export function keyBelongsTo(key: string | null, actorId: string): boolean {
  if (key === null) return false;
  const [owner] = JSON.parse(key) as unknown[];
  return owner === actorId;
}
