/**
 * takt-037: the selection in the suggestion dialog belongs to the candidate texts, not to array identity
 * or to an effect that runs after the first render. The model is pure, so it is tested without a DOM.
 */
import { describe, expect, it } from 'vitest';
import {
  candidateKeys,
  checkedCount,
  initialSelection,
  isChecked,
  setAllChecked,
  setChecked,
} from './SuggestDialog';

const cand = (text: string, start = 0) => ({ text, start, end: start + text.length });
const A = 'Wie hoch ist die Dividende?';
const B = 'Warum sinkt der Umsatz?';
const C = 'Wann kommt die Prognose?';

describe('SuggestDialog selection', () => {
  it('(a) is all checked from the first render and the first click toggles', () => {
    const keys = candidateKeys([cand(A), cand(B)]);
    const selection = initialSelection();
    expect(keys.map((key) => isChecked(selection, key))).toEqual([true, true]);
    expect(checkedCount(selection, keys)).toBe(2);
    const after = setChecked(selection, keys, keys[0]!, false);
    expect(keys.map((key) => isChecked(after, key))).toEqual([false, true]);
  });

  it('(b) keeps an unchecked item unchecked when the candidates are rebuilt with equal texts', () => {
    const first = candidateKeys([cand(A), cand(B)]);
    const selection = setChecked(initialSelection(), first, first[1]!, false);
    const rebuilt = candidateKeys([cand(A), cand(B)]); // new arrays, same texts
    expect(rebuilt.map((key) => isChecked(selection, key))).toEqual([true, false]);
  });

  it('(c) keeps unchanged candidates on a content change and starts new ones checked', () => {
    const first = candidateKeys([cand(A), cand(B)]);
    const selection = setChecked(initialSelection(), first, first[0]!, false);
    const changed = candidateKeys([cand(A, 5), cand(C, 40)]); // positions move, B is gone, C is new
    expect(changed.map((key) => isChecked(selection, key))).toEqual([false, true]);
    expect(checkedCount(selection, changed)).toBe(1);
  });

  it('(d) starts fresh on reopening: all checked', () => {
    const keys = candidateKeys([cand(A), cand(B)]);
    const selection = setAllChecked(keys, false);
    expect(checkedCount(selection, keys)).toBe(0);
    const reopened = initialSelection();
    expect(keys.map((key) => isChecked(reopened, key))).toEqual([true, true]);
  });

  it('tells two identical sentences apart and "all" toggles every key', () => {
    const keys = candidateKeys([cand(A), cand(A, 40)]);
    expect(new Set(keys).size).toBe(2);
    const one = setChecked(initialSelection(), keys, keys[1]!, false);
    expect(keys.map((key) => isChecked(one, key))).toEqual([true, false]);
    expect(checkedCount(setAllChecked(keys, true), keys)).toBe(2);
  });
});
