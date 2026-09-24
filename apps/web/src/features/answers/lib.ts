/**
 * Small helpers of the answer backlog (Beantwortung). They live in the feature, not in the component
 * kit: the kit owns look and behaviour, not the wording of an age or the shape of a refused call.
 */
import type { Approval, DomainEvent, Question } from '@hv/domain';
import type { Translate } from '../../i18n';

/** One fetch per version carries the whole corpus; filtering and windowing happen in the client. */
export const LIST_LIMIT = 2000;

/** Row height of the work list. Fixed, because the windowing arithmetic depends on it. */
export const ROW_HEIGHT = 36;

/** How long a question has been in the house, in the house wording ("vor 12 min"). */
export function relativeAge(t: Translate, iso: string, now: number): string {
  const minutes = Math.floor(Math.max(0, now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return t('time.now');
  if (minutes < 60) return t('time.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hours', { n: hours });
  return t('time.days', { n: Math.floor(hours / 24) });
}

/** Wall clock of the hall, 24 hours, zero padded — the form an approval is quoted in. */
export function clockTime(iso: string): string {
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/**
 * The status of a refused call. Structural instead of `instanceof`: the interface talks to `HvApi`,
 * and the HTTP adapter hands out a plain problem object rather than the domain's error class.
 */
export function problemStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

/**
 * A denied read (R-PERM-02 "no read permission" or R-PERM-03 "read scope exceeded", slice 010).
 * Read by ruleId alone, never by role name (AGENTS.md rule 4, slice 010b Ziel 4) — the interface
 * renders a gestalteter Zustand for it instead of an error toast (slice 010b Ziel 1).
 *
 * Test gap 8c (review round 2): identical in `speakers/useSpeakers.ts`, `capture/useCapture.ts`,
 * `stage/lib.ts` and `history/lib.ts` — see `speakers/useSpeakers.ts`'s copy for why this stays
 * five small local copies rather than one shared module. Covered by its own test here
 * (`lib.test.ts`).
 */
export function isReadForbidden(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const ruleId = 'ruleId' in error ? (error as { ruleId: unknown }).ruleId : undefined;
  return problemStatus(error) === 403 && (ruleId === 'R-PERM-02' || ruleId === 'R-PERM-03');
}

/** The first 90 characters, the amount a 36px row can carry without shouting. */
export function excerpt(text: string, max = 90): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/**
 * The approval as a seal, or nothing. An approval is bound to a text version (R-GUARD-04); the
 * moment a newer version exists the seal is gone. The record decides that, not this function — it
 * only refuses to show a seal that the record itself has already outgrown.
 */
export function sealedApproval(question: Question): Approval | undefined {
  const approval = question.approval;
  if (approval === undefined) return undefined;
  return question.answers.length > approval.answerVersion ? undefined : approval;
}

/** The version "Freigeben" acts on: always the newest text. */
export function latestVersion(question: Question): number | undefined {
  return question.answers[question.answers.length - 1]?.version;
}

/** A lapsed approval, read off the event log (never inferred from the status). */
export interface LapsedApproval {
  /** The version that had been approved. */
  previous: number;
  /** The version that voided it. */
  current: number;
}

/**
 * "Freigabe erloschen": the record has no approval any more, but the log says there was one — an
 * `AnswerDrafted` event that carries `invalidatedApprovalOfVersion` (the domain writes it in
 * `draftAnswer`, R-GUARD-04). A later `QuestionApproved` ends the state again. Both facts come from
 * the event log; nothing here is derived from the status.
 */
export function lapsedApproval(
  question: Question,
  history: readonly DomainEvent[],
): LapsedApproval | undefined {
  if (question.approval !== undefined) return undefined;
  let lapsed: LapsedApproval | undefined;
  for (const event of history) {
    if (
      event.type === 'AnswerDrafted' &&
      event.payload.invalidatedApprovalOfVersion !== undefined
    ) {
      lapsed = {
        previous: event.payload.invalidatedApprovalOfVersion,
        current: event.payload.answer.version,
      };
    } else if (event.type === 'QuestionApproved') {
      lapsed = undefined;
    }
  }
  return lapsed;
}

/** Sources are typed as one line and stored as a list. */
export function splitSources(input: string): string[] {
  return input
    .split(';')
    .map((source) => source.trim())
    .filter((source) => source.length > 0);
}

/**
 * Urgency of an open row, from the age of the question alone (no status logic, AGENTS.md rule 5):
 * 0 under 15 minutes, 1 from 15 to 45, 2 beyond that. The caller decides whether a terminal status
 * shows it at all.
 */
export function urgencyLevel(createdAt: string, now: number): 0 | 1 | 2 {
  const minutes = (now - Date.parse(createdAt)) / 60_000;
  if (minutes < 15) return 0;
  if (minutes < 45) return 1;
  return 2;
}

/** One token of a word-level diff: kept, taken out, or put in. */
export interface DiffPart {
  type: 'equal' | 'removed' | 'added';
  text: string;
}

/**
 * A word-level diff between two answer texts, so that "Änderung gegenüber Version n-1" can be read
 * at a glance instead of re-read in full. LCS over whitespace tokens — plenty for a few hundred words
 * of house prose, and simple enough to keep without pulling in a diff library.
 */
export function wordDiff(a: string, b: string): DiffPart[] {
  const left = a.split(/\s+/).filter((word) => word.length > 0);
  const right = b.split(/\s+/).filter((word) => word.length > 0);
  const n = left.length;
  const m = right.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        left[i] === right[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string): void => {
    const last = parts[parts.length - 1];
    if (last !== undefined && last.type === type) last.text = `${last.text} ${text}`;
    else parts.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      push('equal', left[i]!);
      i += 1;
      j += 1;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      push('removed', left[i]!);
      i += 1;
    } else {
      push('added', right[j]!);
      j += 1;
    }
  }
  while (i < n) {
    push('removed', left[i]!);
    i += 1;
  }
  while (j < m) {
    push('added', right[j]!);
    j += 1;
  }
  return parts;
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
   * The Hauptabfrage of `load` has answered. `refused`: a read refusal. `omits(id)`: its answer is
   * known to leave `id` out — only a complete, unfiltered list can know that; a filtered one says
   * nothing about what it does not show.
   */
  settleMain(load: string, refused: boolean, omits?: (id: string) => boolean): void;
  /** A detail read of `id` in `load` failed with something other than a read refusal. */
  report(load: string, id: string, error: unknown): void;
}

/**
 * Slice 010c, Ziel 5 (Serverfilter-Toast, round 5 of 010b): what the list's answer can say it
 * leaves out, for `DetailProblemGate.settleMain`. A complete list knows (Codex P2-A on 948a721). A
 * filtered list knows nothing about what it does not show — unless the selection was made by
 * another actor: right after a role switch, a selection the new actor's list does not contain is
 * taken as unreadable, and the detail read's masked 404 is swallowed rather than toasted. Without a
 * role switch a filtered-out selection is ordinary, and a real fault of its detail read still shows.
 */
export function listOmits(
  ids: ReadonlySet<string>,
  complete: boolean,
  selectedByOther: boolean,
): ((id: string) => boolean) | undefined {
  return complete || selectedByOther ? (id) => !ids.has(id) : undefined;
}

export function createDetailProblemGate(show: (error: unknown) => void): DetailProblemGate {
  let verdict: { load: string; refused: boolean; omits: (id: string) => boolean } | null = null;
  let pass = 0;
  let pending: { load: string; pass: number; id: string; error: unknown } | null = null;
  let shown: string | null = null;
  const flush = (): void => {
    if (pending === null || verdict === null || pending.load !== verdict.load) return;
    const { load, id, error } = pending;
    const key = `${load}:${pending.pass}`;
    pending = null;
    if (verdict.refused || verdict.omits(id) || key === shown) return;
    shown = key;
    show(error);
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
      if (key === shown || (pending !== null && `${pending.load}:${pending.pass}` === key)) return;
      pending = { load, pass, id, error };
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
 *   has answered for the current key (`readVerdict`), and then whatever those answers say replaces
 *   it: a refusal of an earlier load never outlives a failure of the current one. Until then the
 *   previous verdict stands, so nothing flickers while a load is on its way (design principle 8).
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

/** Whether `read` has answered for `key` — a read of an earlier key has not. */
export function settledFor(read: KeyedRead | null, key: string): boolean {
  return read !== null && read.key === key;
}

/**
 * The verdict a view shows: `previous` until every read has answered for its own current key, then
 * "refused" exactly if one of those answers is a refusal.
 */
export function readVerdict(
  previous: boolean,
  reads: readonly { read: KeyedRead | null; key: string }[],
): boolean {
  if (!reads.every(({ read, key }) => settledFor(read, key))) return previous;
  return reads.some(({ read }) => read?.status === 'forbidden');
}
