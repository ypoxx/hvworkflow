/**
 * Helpers of the podium. Deliberately tiny and local: the podium is a different device (design
 * principle 10) and must not start depending on the backlog's machinery.
 */
import { etagOf } from '@hv/domain';
import type { AnswerVersion, Permission, Question, StageView } from '@hv/domain';
import { refusalKindOf } from '../answers/refusal';

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
 * takt-039: the question a "Vorgelesen, weiter" was written against, as it was drawn. The lock belongs to that question
 * in that version and to nothing else: once the podium draws another question, or the same one in a newer version, it
 * no longer holds (Befund 1, Punkt 4).
 */
export interface DeliverLock {
  readonly id: string;
  readonly version: number;
}

/** The question on stage in a drawn stage (`null` after an actor change or a read refusal, Page.tsx). */
export function shownQuestion(stage: StageView | null): Question | null {
  return stage?.current ?? null;
}

/** Whether `lock` still holds for the question that is drawn. */
export function lockHolds(lock: DeliverLock | null, question: Question | null | undefined): boolean {
  return (
    lock !== null &&
    question !== null &&
    question !== undefined &&
    lock.id === question.id &&
    lock.version === question.version
  );
}

/**
 * takt-039: the one rule of "Vorgelesen, weiter". The button is drawn only where `_actions` offers the delivery (never
 * by role, AGENTS.md rule 4), and it is locked while a delivery of that very question in that version is on its way, or
 * while a return is written. Podium.tsx draws the button from it and `deliverTarget` (the handler of click and Space in
 * Page.tsx) writes by it, so what looks free always writes and what does not write always looks locked (Befund 1).
 */
export function nextButton(
  question: Question | null | undefined,
  lock: DeliverLock | null,
  returning: boolean,
): { drawn: boolean; locked: boolean } {
  const drawn = question?._actions.includes('question.deliver') ?? false;
  return { drawn, locked: returning || lockHolds(lock, question) };
}

/** The question a press writes to: the drawn one, exactly when `nextButton` shows a free button, else `null`. */
export function deliverTarget(
  question: Question | null | undefined,
  lock: DeliverLock | null,
  returning: boolean,
): Question | null {
  const button = nextButton(question, lock, returning);
  return button.drawn && !button.locked && question !== null && question !== undefined ? question : null;
}

/**
 * takt-039, review minor 7 (Recht/Audit): the question a return dialog was opened for (R or the button), captured at
 * that moment. The return is written for it alone; a question drawn later never takes its place.
 */
export interface ReturnTarget {
  readonly id: string;
  readonly version: number;
  readonly number: string;
}

/** The target of a return dialog opened on `question`: only where `_actions` offers the return (never by role). */
export function returnTargetOf(question: Question | null | undefined): ReturnTarget | null {
  if (question === null || question === undefined) return null;
  if (!question._actions.includes('question.return')) return null;
  return { id: question.id, version: question.version, number: question.number };
}

/**
 * The write of a return: for the captured question, with the captured version in `If-Match`. If that question has moved
 * on meanwhile, the service refuses (412/409) and the podium shows it and reads again; nothing is retargeted.
 */
export function returnWrite(
  target: ReturnTarget,
  reason: string,
): { questionId: string; reason: string; ifMatch: string } {
  return { questionId: target.id, reason, ifMatch: etagOf(target.version) };
}

/** Points #3/#9 (feedback, slice 020): a person who may only read out never has any of these. */
const WORK_ACTIONS: readonly Permission[] = [
  'question.capture',
  'question.classify',
  'answer.draft',
  'question.approve',
];

/**
 * Point #3/#9: "Nur Bühne" as the default of a role that only reads answers out. Derived the same
 * way `deskActions` is derived in `features/capture/Page.tsx` — from `_actions` of the Bühnenfragen
 * themselves (never from the role name, AGENTS.md rule 4): the rights bundle carries the read-out
 * permission and none of the drafting, classifying, capturing or approving ones. Moved unchanged
 * from `Page.tsx` in Scheibe 040a so it can be tested with synthetic action lists.
 */
export function stageOnlyByRights(actions: readonly Permission[]): boolean {
  return actions.includes('question.deliver') && !WORK_ACTIONS.some((a) => actions.includes(a));
}

/**
 * Scheibe 045 (decision 4, orchestrator 03.10.2026): the podium's return dialog warns at every refusal,
 * whatever its kind — when the version that may be read out (`approvedAnswer`) is a refusal. `getStage`
 * strips the justification for every reader (044a §6), so the rule of the answer view (a justification
 * in the record) would never fire here; whoever returns from the podium may know it from the answer view.
 */
export function stageReturnNeedsWarning(question: Question): boolean {
  return refusalKindOf(approvedAnswer(question)) !== 'answer';
}
