/**
 * Helpers of the podium. Deliberately tiny and local: the podium is a different device (design
 * principle 10) and must not start depending on the backlog's machinery.
 */
import type { AnswerVersion, Question } from '@hv/domain';

/** Wall clock of the hall, 24 hours, zero padded — the form an approval is quoted in. */
export function clockTime(iso: string): string {
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/**
 * The text that may be read out: the answer version the approval is bound to, and nothing else.
 * If the record carries no approval, or a newer version has already voided it, the podium gets no
 * text — that is a fact of the record, not a decision of this view (R-GUARD-04).
 */
export function approvedAnswer(question: Question): AnswerVersion | undefined {
  const approval = question.approval;
  if (approval === undefined) return undefined;
  if (question.answers.length > approval.answerVersion) return undefined;
  return question.answers.find((answer) => answer.version === approval.answerVersion);
}

/** Space and R must never fire while somebody is typing a reason or tabbing over a button. */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)
  );
}

/**
 * A denied read (R-PERM-02 "no read permission" or R-PERM-03 "read scope exceeded", slice 010).
 * Structural, not `instanceof`: the interface talks to `HvApi`, and an HTTP adapter hands out a
 * plain problem object rather than the domain's error class. Read by ruleId alone, never by role
 * name (AGENTS.md rule 4, docs/slices/010b-lesepfade-oberflaeche.md Ziel 4) — e.g. expert, who
 * holds `question.read` but no `stage.read`.
 *
 * Test gap 8c (review round 2): identical in `speakers/useSpeakers.ts`, `capture/useCapture.ts`,
 * `answers/lib.ts` and `history/lib.ts` — see `speakers/useSpeakers.ts`'s copy for why this stays
 * five small local copies rather than one shared module. Covered by its own test here
 * (`lib.test.ts`).
 */
export function isReadForbidden(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = 'status' in error ? (error as { status: unknown }).status : undefined;
  const ruleId = 'ruleId' in error ? (error as { ruleId: unknown }).ruleId : undefined;
  return status === 403 && (ruleId === 'R-PERM-02' || ruleId === 'R-PERM-03');
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
