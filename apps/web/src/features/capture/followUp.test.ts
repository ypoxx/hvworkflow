/**
 * Scheibe 046, W1 and the reference rules of W3: the pure model behind the chip "Nachfrage zu F-…". The
 * reference rides only on the next capture with exactly one question (Alt+Q or free entry), never on taken-
 * over suggestions; it disappears after a successful call and stays after a failure (412, 422, network);
 * a change of the speech or of the person removes it. The shortcut and the search are modelled here too,
 * because the web package renders without a DOM in unit tests (the interaction itself is e2e E1/E3).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Question, QuestionCapture } from '@hv/domain';
import {
  FOLLOW_UP_SEARCH_DELAY_MS,
  captureItems,
  createFollowUpSearch,
  heldAfterCapture,
  heldFor,
  isFollowUpShortcut,
  moveActive,
  withReference,
  type FollowUpReference,
  type HeldReference,
  type SearchState,
} from './followUp';

const REF: FollowUpReference = { parentQuestionId: 'q-12', number: 'F-0012', relation: 'clarification' };
const held = (over: Partial<HeldReference> = {}): HeldReference => ({ actorId: 'cap', contributionId: 'c1', reference: REF, ...over });

describe('W1 withReference', () => {
  it('adds the reference to a single question', () => {
    expect(withReference([{ text: 'Warum?' }], REF)).toEqual([{ text: 'Warum?', parentQuestionId: 'q-12', relation: 'clarification' }]);
  });
  it('leaves several questions and "without reference" unchanged, and never changes its input', () => {
    const items: QuestionCapture[] = [{ text: 'A?' }, { text: 'B?', span: { start: 0, end: 2 } }];
    const frozen = Object.freeze(items.map((item) => Object.freeze({ ...item })));
    expect(withReference(frozen, REF)).toEqual(items);
    expect(withReference([{ text: 'A?' }], null)).toEqual([{ text: 'A?' }]);
    const single = Object.freeze([Object.freeze({ text: 'C?' })]);
    const out = withReference(single, REF);
    expect(out).not.toBe(single);
    expect(single[0]).toEqual({ text: 'C?' });
  });
});

describe('W3 the chip goes with the next single capture only', () => {
  it('single capture: sent with the reference; gone after success, kept after a failure', () => {
    const route = captureItems([{ text: 'Warum?' }], REF, 'single');
    expect(route.items[0]).toMatchObject({ parentQuestionId: 'q-12', relation: 'clarification' });
    expect(route.applied).toBe(true);
    expect(heldAfterCapture(held(), REF, route.applied, true)).toBeNull();
    expect(heldAfterCapture(held(), REF, route.applied, false)).toEqual(held());
    // Review 8: a reference set anew while the call ran is not the one that was sent; it stays.
    const newer = held({ reference: { ...REF, parentQuestionId: 'q-13', number: 'F-0013' } });
    expect(heldAfterCapture(newer, REF, route.applied, true)).toEqual(newer);
    expect(heldAfterCapture(null, REF, route.applied, true)).toBeNull();
  });
  it('taken-over suggestions are sent without the reference, also a single one; the chip stays', () => {
    for (const items of [[{ text: 'A?' }], [{ text: 'A?' }, { text: 'B?' }]] as QuestionCapture[][]) {
      const route = captureItems(items, REF, 'suggest');
      expect(route.items).toEqual(items);
      expect(route.applied).toBe(false);
      expect(heldAfterCapture(held(), REF, route.applied, true)).toEqual(held());
    }
  });
  it('a change of the speech or of the person removes it', () => {
    expect(heldFor(held(), 'cap', 'c1')).toEqual(held());
    expect(heldFor(held(), 'cap', 'c2')).toBeNull();
    expect(heldFor(held(), 'other', 'c1')).toBeNull();
    expect(heldFor(held(), 'cap', undefined)).toBeNull();
    expect(heldFor(null, 'cap', 'c1')).toBeNull();
  });
});

describe('W3 Alt+B (Alt+N is the navigation toggle of the shell)', () => {
  const key = (over: Partial<Parameters<typeof isFollowUpShortcut>[0]> = {}) =>
    ({ altKey: true, ctrlKey: false, metaKey: false, code: 'KeyB', target: { tagName: 'DIV', isContentEditable: false }, ...over });
  it('opens on Alt+B by the physical key, not with Ctrl or Meta', () => {
    expect(isFollowUpShortcut(key())).toBe(true);
    expect(isFollowUpShortcut(key({ code: 'KeyN' }))).toBe(false);
    expect(isFollowUpShortcut(key({ altKey: false }))).toBe(false);
    expect(isFollowUpShortcut(key({ ctrlKey: true }))).toBe(false);
    expect(isFollowUpShortcut(key({ metaKey: true }))).toBe(false);
  });
  it('review 7: not while a dialog is open, and not from inside a dialog', () => {
    expect(isFollowUpShortcut(key(), true)).toBe(false);
    const inDialog = { tagName: 'BUTTON', isContentEditable: false, closest: (selector: string) => (selector === '[role="dialog"]' ? {} : null) };
    expect(isFollowUpShortcut(key({ target: inDialog }))).toBe(false);
    const outside = { tagName: 'BUTTON', isContentEditable: false, closest: () => null };
    expect(isFollowUpShortcut(key({ target: outside }))).toBe(true);
  });
  it('not while the focus is in an editable field', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) expect(isFollowUpShortcut(key({ target: { tagName, isContentEditable: false } })), tagName).toBe(false);
    expect(isFollowUpShortcut(key({ target: { tagName: 'DIV', isContentEditable: true } }))).toBe(false);
    expect(isFollowUpShortcut(key({ target: null }))).toBe(true);
  });
});

describe('W2 search model: delayed, newest answer wins, retry; arrows', () => {
  afterEach(() => vi.useRealTimers());
  const question = (n: number): Question => ({ id: `q${n}`, number: `F-00${n}` } as Question);

  it('empty, loading after 250 ms, results, none, error with retry', async () => {
    vi.useFakeTimers();
    const states: SearchState[] = [];
    let reply: () => Promise<Question[]> = async () => [question(12)];
    const search = vi.fn((_: string) => reply());
    const runner = createFollowUpSearch(search, (state) => states.push(state));
    runner.update('   ');
    expect(states.at(-1)).toEqual({ kind: 'empty' });
    runner.update('F-0012');
    expect(states.at(-1)).toEqual({ kind: 'loading', query: 'F-0012' });
    await vi.advanceTimersByTimeAsync(FOLLOW_UP_SEARCH_DELAY_MS - 1);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledWith('F-0012');
    expect(states.at(-1)).toEqual({ kind: 'results', query: 'F-0012', items: [question(12)] });
    reply = async () => [];
    runner.update('Dividende');
    await vi.advanceTimersByTimeAsync(FOLLOW_UP_SEARCH_DELAY_MS);
    expect(states.at(-1)).toEqual({ kind: 'none', query: 'Dividende' });
    reply = async () => { throw new Error('offline'); };
    runner.update('Quote');
    await vi.advanceTimersByTimeAsync(FOLLOW_UP_SEARCH_DELAY_MS);
    expect(states.at(-1)).toEqual({ kind: 'error', query: 'Quote' });
    reply = async () => [question(3)];
    runner.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)).toEqual({ kind: 'results', query: 'Quote', items: [question(3)] });
    runner.dispose();
  });

  it('typing again within the delay searches once, and a late answer of an older query is dropped', async () => {
    vi.useFakeTimers();
    const states: SearchState[] = [];
    const resolvers: ((items: Question[]) => void)[] = [];
    const search = vi.fn(() => new Promise<Question[]>((resolve) => resolvers.push(resolve)));
    const runner = createFollowUpSearch(search, (state) => states.push(state));
    runner.update('F');
    runner.update('F-1');
    await vi.advanceTimersByTimeAsync(FOLLOW_UP_SEARCH_DELAY_MS);
    expect(search).toHaveBeenCalledTimes(1);
    runner.update('F-2');
    await vi.advanceTimersByTimeAsync(FOLLOW_UP_SEARCH_DELAY_MS);
    resolvers[1]!([question(2)]);
    resolvers[0]!([question(1)]);
    await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)).toEqual({ kind: 'results', query: 'F-2', items: [question(2)] });
  });

  it('arrows move the active row and wrap; without rows nothing is active', () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(0, 1, 3)).toBe(1);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
    expect(moveActive(-1, -1, 3)).toBe(2);
    expect(moveActive(1, 1, 0)).toBe(-1);
  });
});
