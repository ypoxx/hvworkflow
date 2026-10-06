/**
 * Scheibe 046: the follow-up reference of the capture desk (Bezug zur Bezugsfrage). A pure model, so the rules
 * stand in one place and are testable without a DOM: the reference rides only on the next capture with exactly
 * one question (Alt+Q or free entry), never on taken-over suggestions (Lesebefund M7: a reference cannot be
 * changed, R-LINK-02, so attaching it silently to several questions would multiply a slip); it disappears after a
 * successful call, stays after a failure, and a change of the speech or of the person removes it.
 */
import type { Question, QuestionCapture, QuestionRelation } from '@hv/domain';

/** What the chip shows and the capture sends: the referenced question's id and number, and the relation. */
export interface FollowUpReference {
  readonly parentQuestionId: string;
  readonly number: string;
  readonly relation: QuestionRelation;
}
/** A reference together with the person and the speech it was set for. */
export interface HeldReference {
  readonly actorId: string;
  readonly contributionId: string;
  readonly reference: FollowUpReference;
}

/** Adds the reference to a single question; several questions or no reference: an unchanged copy. */
export function withReference(items: readonly QuestionCapture[], reference: FollowUpReference | null): QuestionCapture[] {
  if (reference === null || items.length !== 1) return items.map((item) => ({ ...item }));
  return [{ ...items[0]!, parentQuestionId: reference.parentQuestionId, relation: reference.relation }];
}

/**
 * The one place the desk decides what a capture sends. `single`: marking with Alt+Q or the free entry;
 * `suggest`: the suggestion dialog, which never takes the reference, also not for one checked sentence.
 */
export function captureItems(items: readonly QuestionCapture[], reference: FollowUpReference | null, route: 'single' | 'suggest'): { items: QuestionCapture[]; applied: boolean } {
  if (route === 'suggest') return { items: withReference(items, null), applied: false };
  const applied = reference !== null && items.length === 1;
  return { items: withReference(items, reference), applied };
}

/**
 * After a capture: the reference that went out with a successful call is used up; otherwise it stays. Only the very
 * reference that was sent is cleared — one set anew while the call ran stays (review 8).
 */
export function heldAfterCapture(held: HeldReference | null, sent: FollowUpReference | null, applied: boolean, ok: boolean): HeldReference | null {
  return ok && applied && held !== null && held.reference === sent ? null : held;
}

/** The reference only while the same person works on the same speech (compared by id, never by role). */
export function heldFor(held: HeldReference | null, actorId: string, contributionId: string | undefined): HeldReference | null {
  return held !== null && held.actorId === actorId && held.contributionId === contributionId ? held : null;
}

interface KeyTarget { readonly tagName?: string; readonly isContentEditable?: boolean; readonly closest?: (selector: string) => unknown }
/** An element where a typed character belongs to the text (inputs, text areas, selects, editable content). */
export function isEditableTarget(target: unknown): boolean {
  if (target === null || typeof target !== 'object') return false;
  const element = target as KeyTarget;
  return element.isContentEditable === true || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName ?? '');
}
/**
 * Alt+B opens "Bezug setzen". Alt+N, which the spec proposed, is the shell's navigation toggle (AppShell,
 * pre-build check 6), so the free key B ("Bezug") is taken. By the physical key (`code`, layout-proof like Alt+Q),
 * without Ctrl or Meta, and never while typing, so a special character on Alt+B (macOS) reaches the text.
 */
export function isFollowUpShortcut(
  event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; code: string; target: unknown },
  dialogOpen = false,
): boolean {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== 'KeyB' || isEditableTarget(event.target)) return false;
  // Review 7: never over another dialog (suggestions, classification) and never from inside one.
  if (dialogOpen) return false;
  const target = event.target as KeyTarget | null;
  return !(target !== null && typeof target === 'object' && typeof target.closest === 'function' && target.closest('[role="dialog"]') != null);
}

export const FOLLOW_UP_SEARCH_DELAY_MS = 250;
export const FOLLOW_UP_SEARCH_LIMIT = 8;

export type SearchState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'loading'; readonly query: string }
  | { readonly kind: 'results'; readonly query: string; readonly items: readonly Question[] }
  | { readonly kind: 'none'; readonly query: string }
  | { readonly kind: 'error'; readonly query: string };

/**
 * The delayed search of the dialog: a query waits 250 ms; typing again within that time searches once; an answer
 * that arrives for an older query is dropped (the newest one wins).
 */
export function createFollowUpSearch(
  search: (query: string) => Promise<readonly Question[]>,
  onState: (state: SearchState) => void,
): { update: (query: string) => void; retry: () => void; dispose: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let last = '';
  const run = (query: string): void => {
    const mine = ++generation;
    search(query).then(
      (items) => { if (mine === generation) onState(items.length > 0 ? { kind: 'results', query, items } : { kind: 'none', query }); },
      () => { if (mine === generation) onState({ kind: 'error', query }); },
    );
  };
  const cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    update(raw) {
      cancel();
      generation += 1; // an answer still on its way belongs to an older query
      const query = raw.trim();
      last = query;
      if (query === '') {
        onState({ kind: 'empty' });
        return;
      }
      onState({ kind: 'loading', query });
      timer = setTimeout(() => { timer = undefined; run(query); }, FOLLOW_UP_SEARCH_DELAY_MS);
    },
    retry() {
      cancel();
      if (last === '') return;
      onState({ kind: 'loading', query: last });
      run(last);
    },
    dispose() {
      cancel();
      generation += 1;
    },
  };
}

/** The next active row for an arrow key; wraps around; -1 without rows. */
export function moveActive(active: number, delta: number, length: number): number {
  if (length === 0) return -1;
  if (active < 0) return delta > 0 ? 0 : length - 1;
  return (active + delta + length) % length;
}
