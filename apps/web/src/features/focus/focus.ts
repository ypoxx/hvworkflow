/**
 * Scheibe 054: the pure helpers of the focus view (Fokusansicht, "Meine Fragen"), without React.
 *
 * Which questions the page lists is a reading of `_actions` within a fixed slice of statuses (`myQuestions`); which
 * buttons it offers is a reading of `_actions` and two states of the interface, never of a role (AGENTS.md R4) and
 * never of the status (R5, `focusActions`). Whether a step may actually happen is decided by the server.
 */
import type { DomainEvent, ForwardReasonCode, Permission, Question, QuestionStatus } from '@hv/domain';
import { latestIsRefusal } from '../answers/refusal';

/**
 * Assigned and not yet handed to the legal clearing; a returned question stands in `answer_drafted` again. A slice of
 * the list like the status chip of the Beantwortung, not a decision about an action.
 */
export const FOCUS_STATUSES = ['assigned', 'answer_drafted'] as const satisfies readonly QuestionStatus[];

const inFocusStatus = (status: QuestionStatus): boolean => (FOCUS_STATUSES as readonly QuestionStatus[]).includes(status);

/**
 * "Meine Fragen": the questions of the list in `FOCUS_STATUSES` whose `_actions` hold both `answer.draft` and
 * `question.forward` — in today's bundles exactly the work of one answering unit (legal drafts but does not forward, the
 * coordination forwards but does not draft); for a bound expert the service binds both to the unit (R-PERM-03).
 * Oldest first, ties by number; the input stays as it is.
 */
export function myQuestions(items: readonly Question[]): Question[] {
  return items
    .filter(
      (question) =>
        inFocusStatus(question.status) &&
        question._actions.includes('answer.draft') &&
        question._actions.includes('question.forward'),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.number.localeCompare(b.number));
}

export type FocusAction = 'save' | 'submit' | 'write' | 'forward';

export interface FocusActions {
  primary?: FocusAction;
  secondary: FocusAction[];
}

/** The order of the secondary actions in the bar. */
const ORDER: readonly FocusAction[] = ['save', 'write', 'submit', 'forward'];

/**
 * The actions of the detail (`writing: false`) and of the writing mode (`writing: true`), from the list of rights alone.
 * `submit` is "Weiterleiten" (the next step, `question.submit_review`, E5) and primary unless unsaved text is there; then
 * saving is primary, and neither hand-over is offered (D9: absent, not greyed out) — nobody passes on an older version
 * while the new text lives only in the browser. Forwarding to another unit is never primary unless it is all there is.
 */
export function focusActions(actions: readonly Permission[], ui: { dirty: boolean; writing: boolean }): FocusActions {
  const has = (permission: Permission): boolean => actions.includes(permission);
  const offered = new Set<FocusAction>();
  if (ui.writing && has('answer.draft')) offered.add('save');
  if (!ui.writing && has('answer.draft')) offered.add('write');
  if (!ui.dirty && has('question.submit_review')) offered.add('submit');
  if (!ui.dirty && has('question.forward')) offered.add('forward');

  let primary: FocusAction | undefined;
  if (offered.has('save') && ui.dirty) primary = 'save';
  else if (offered.has('submit')) primary = 'submit';
  else if (offered.has('write')) primary = 'write';
  else if (offered.size === 1 && offered.has('forward')) primary = 'forward';

  const secondary = ORDER.filter((action) => offered.has(action) && action !== primary);
  return primary === undefined ? { secondary } : { primary, secondary };
}

/**
 * The selection follows the list: nothing chosen → the oldest; the chosen one still there → it stays; gone → the
 * question now at its remembered index, else the last; an empty list → none.
 */
export function nextSelection(mine: readonly Pick<Question, 'id'>[], selectedId: string | null, lastIndex: number): string | null {
  if (mine.length === 0) return null;
  if (selectedId === null) return mine[0]!.id;
  if (mine.some((question) => question.id === selectedId)) return selectedId;
  return mine[Math.min(Math.max(0, lastIndex), mine.length - 1)]!.id;
}

/** Ctrl+Enter (macOS: Cmd+Enter) saves; never with Alt or Shift, never while an input method composes. */
export function isSaveChord(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
}): boolean {
  return (
    event.key === 'Enter' &&
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.isComposing !== true
  );
}

/** Escape leaves the writing mode — unless a dialog took it first (`defaultPrevented`) or a dialog of the page is open. */
export function shouldLeaveWriting(event: { key: string; defaultPrevented: boolean; dialogOpen: boolean }): boolean {
  return event.key === 'Escape' && !event.defaultPrevented && !event.dialogOpen;
}

/** Feedback Z5: words read per minute on the podium, and the target length of an answer. */
export const WORDS_PER_MINUTE = 130;
export const READING_TARGET_SECONDS = 120;

/** Seconds to read the text aloud at 130 words per minute; words are the parts between white space. */
export function readingSeconds(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  const words = trimmed.split(/\s+/).length;
  // Integer arithmetic first: `words / 130 * 60` is not exact in floating point (13 words would give 6.000…01 → 7 s).
  return Math.ceil((words * 60) / WORDS_PER_MINUTE);
}

/** "m:ss" (D5). */
export function formatReading(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export interface LastForward {
  fromUnitId?: string;
  reasonCode: ForwardReasonCode;
}

/**
 * The last forward into `unitId`, read off the history by event type (never by status). The reason stands only in the
 * event `QuestionForwarded` (048), not on the question.
 */
export function lastForward(history: readonly DomainEvent[], unitId: string | undefined): LastForward | undefined {
  if (unitId === undefined) return undefined;
  let found: LastForward | undefined;
  for (const event of history) {
    if (event.type !== 'QuestionForwarded' || event.payload.unitId !== unitId) continue;
    const { fromUnitId, reasonCode } = event.payload;
    found = fromUnitId !== undefined ? { fromUnitId, reasonCode } : { reasonCode };
  }
  return found;
}

/** The text of the writing mode for one question, kept by the page per actor and question while the page lives. */
export interface FocusDraft {
  /** `${actorId}:${questionId}` — a draft never reaches another actor (090). */
  key: string;
  questionId: string;
  /** The number the person knows the question by, for the notice when unsaved text is discarded. */
  number: string;
  text: string;
  sources: string;
  /** The answer version the text started from (0 without one). */
  baseVersion: number;
  baseText: string;
  baseSources: string;
  /** A newer answer version arrived while the text was changed; the writing mode says so. */
  rebase: boolean;
}

export const draftKey = (actorId: string, questionId: string): string => `${actorId}:${questionId}`;

/** Sources are typed as one line, separated by semicolons, and stored as a list. */
export function joinSources(sources: readonly string[] | undefined): string {
  return (sources ?? []).join('; ');
}

function normalSources(input: string): string {
  return input
    .split(';')
    .map((source) => source.trim())
    .filter((source) => source !== '')
    .join('; ');
}

/**
 * What the writing mode starts from: the latest answer version (text and sources) — empty without one, and empty when
 * the latest version is a refusal (a draft displaces the refusal, 045; its wording is not the start of an answer).
 */
export function draftBase(question: Pick<Question, 'answers'>): { baseVersion: number; baseText: string; baseSources: string } {
  const latest = question.answers[question.answers.length - 1];
  if (latest === undefined) return { baseVersion: 0, baseText: '', baseSources: '' };
  if (latestIsRefusal(question)) return { baseVersion: latest.version, baseText: '', baseSources: '' };
  return { baseVersion: latest.version, baseText: latest.text, baseSources: joinSources(latest.sources) };
}

/** A fresh draft for a question, started from its latest version. */
export function newDraft(actorId: string, question: Pick<Question, 'id' | 'number' | 'answers'>): FocusDraft {
  const base = draftBase(question);
  return {
    key: draftKey(actorId, question.id),
    questionId: question.id,
    number: question.number,
    text: base.baseText,
    sources: base.baseSources,
    ...base,
    rebase: false,
  };
}

/** Unsaved text: the trimmed text or the sources differ from what the draft started from. */
export function isDirty(draft: Pick<FocusDraft, 'text' | 'sources' | 'baseText' | 'baseSources'>): boolean {
  return draft.text.trim() !== draft.baseText.trim() || normalSources(draft.sources) !== normalSources(draft.baseSources);
}

export type WritingOutcome =
  | { kind: 'keep' }
  /** The question is no longer "mine" or no longer offers drafting; `discarded` when unsaved text goes with it. */
  | { kind: 'end'; discarded: boolean }
  /** A newer version arrived and nothing is lost: the draft moves onto it silently. */
  | { kind: 'rebase'; draft: FocusDraft }
  /** A newer version arrived over changed text: the text stays, the writing mode says so. */
  | { kind: 'notice'; draft: FocusDraft };

/**
 * What happens to a draft when the record of its question changes. `question` is the newest record of it among
 * "Meine Fragen", or `undefined` when it has left them.
 */
export function writingOutcome(draft: FocusDraft, question: Pick<Question, 'id' | 'answers' | '_actions'> | undefined): WritingOutcome {
  if (question === undefined || !question._actions.includes('answer.draft')) {
    return { kind: 'end', discarded: isDirty(draft) };
  }
  const base = draftBase(question);
  if (base.baseVersion <= draft.baseVersion) return { kind: 'keep' };
  // The new version says what the text already says (one's own save, read before the write answered): nothing is lost.
  const same = draft.text.trim() === base.baseText.trim() && normalSources(draft.sources) === normalSources(base.baseSources);
  if (!isDirty(draft) || same) {
    return { kind: 'rebase', draft: { ...draft, text: base.baseText, sources: base.baseSources, ...base, rebase: false } };
  }
  if (draft.rebase) return { kind: 'keep' };
  return { kind: 'notice', draft: { ...draft, rebase: true } };
}

/** The question a hand-over was made against, to move the focus once the next one is on screen (takt-008, takt-043). */
export interface PendingFocus {
  id: string;
  version: number;
}

/** What the page shows at one moment, as far as the focus after a hand-over is concerned. */
export interface ShownForFocus {
  question: Pick<Question, 'id' | 'version'> | null;
  selectedId: string | null;
  mine: readonly Pick<Question, 'id' | 'version'>[];
  listSettled: boolean;
}

/**
 * takt-043: whether the focus armed by a hand-over is due now (`move`), no longer has a target (`clear`), or must wait.
 * The DOM part (detail root, `mayMoveFocus`, the target) stays with the page.
 */
export function focusDue(pending: PendingFocus | null, shown: ShownForFocus): 'wait' | 'clear' | 'move' {
  if (pending === null) return 'wait';
  const { question, selectedId, mine, listSettled } = shown;
  if (mine.length === 0 && listSettled) return 'clear';
  if (question === null || question.id !== selectedId) return 'wait';
  const row = mine.find((entry) => entry.id === question.id);
  if (row === undefined) return 'wait';
  if (question.id !== pending.id) return 'move';
  // The handed-over question itself counts only once the settled list agrees that it stays: in HTTP mode the detail
  // read can bring its new version (already out of "Meine Fragen") before the list read drops it (A, C).
  return question.version > pending.version && listSettled && row.version >= question.version ? 'move' : 'wait';
}

/** takt-043: a refused hand-over drops its own pending focus, and only that one (a later one stays). */
export function disarmFocus(pending: PendingFocus | null, question: Pick<Question, 'id' | 'version'>): PendingFocus | null {
  return pending !== null && pending.id === question.id && pending.version === question.version ? null : pending;
}
