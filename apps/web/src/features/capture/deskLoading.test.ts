/**
 * takt-054: `deskLoading` decides whether the Erfassung shows the skeleton instead of the empty
 * input form. The form may appear only once it is certain that the Wortmeldung has no Redebeitrag
 * yet; while the freshest read already knows one that the shown pair does not contain, the desk is
 * still loading (CI e2e-http run 37471605355, 046 E1).
 */
import { describe, expect, it } from 'vitest';
import { deskLoading } from './useCapture';

const c1 = { id: 'c1' };
const EMPTY_PAIR = { questions: [], contributions: [] };
const PAIR_C1 = { questions: [], contributions: [c1] };

describe('deskLoading', () => {
  it.each([
    // [row, contributionsSettled, landed, freshest, shown, expected]
    ['contributions not answered for this key (also: status still the previous key\'s)', false, EMPTY_PAIR, undefined, undefined, true],
    ['no pair landed yet', true, null, undefined, undefined, true],
    ['landed = empty pair, freshest = c1, shown = undefined', true, EMPTY_PAIR, c1, undefined, true],
    ['landed = empty pair, no Redebeitrag at all (speaker without contribution)', true, EMPTY_PAIR, undefined, undefined, false],
    ['landed = pair with c1, shown = c1', true, PAIR_C1, c1, c1, false],
    ['shown = c1 while a newer freshest c2 loads (old pair stays)', true, PAIR_C1, { id: 'c2' }, c1, false],
  ] as const)('%s', (_row, contributionsSettled, landed, freshest, shown, expected) => {
    expect(deskLoading({ contributionsSettled, landed, freshest, shown })).toBe(expected);
  });
});
