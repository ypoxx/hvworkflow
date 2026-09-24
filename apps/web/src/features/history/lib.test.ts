/**
 * `isReadForbidden` — the sole thing that decides between the "keine Leseberechtigung" state and a
 * generic error toast (slice 010b, Ziel 1/4). Test gap 8c (review round 2): every copy of this
 * function (`speakers/useSpeakers.ts`, `capture/useCapture.ts`, `answers/lib.ts`, `stage/lib.ts`)
 * carries the same table, so a change to one that silently drifts from the others fails loudly
 * here.
 */
import { describe, expect, it } from 'vitest';
import { createDetailProblemGate, isReadForbidden } from './lib';

describe('isReadForbidden', () => {
  it('R-PERM-02 (no read permission): true', () => {
    expect(isReadForbidden({ status: 403, ruleId: 'R-PERM-02' })).toBe(true);
  });

  it('R-PERM-03 (read scope exceeded): true', () => {
    expect(isReadForbidden({ status: 403, ruleId: 'R-PERM-03' })).toBe(true);
  });

  it('R-PERM-01 (no write permission, a 403 too): false — a denied write is not a denied read', () => {
    expect(isReadForbidden({ status: 403, ruleId: 'R-PERM-01' })).toBe(false);
  });

  it('404 (Festlegung 3\'s masked "not found"): false — never confused with a 403', () => {
    expect(isReadForbidden({ status: 404 })).toBe(false);
  });

  it('500 (a real fault, not a rule): false — still becomes an error toast', () => {
    expect(isReadForbidden({ status: 500 })).toBe(false);
  });
});

/** Codex (b) on 7f542b6, Codex P2-2 on 4f0d231, nit C of review round 4 — the same table in
 *  `answers/lib.test.ts` and `history/lib.test.ts`. */
describe('createDetailProblemGate', () => {
  const setup = () => {
    const shown: unknown[] = [];
    return { shown, gate: createDetailProblemGate((error) => shown.push(error)) };
  };

  it('main refused, detail failed first: nothing shown (masked 404 after a role switch)', () => {
    const { shown, gate } = setup();
    gate.report('2', '2:q1', { status: 404 });
    gate.settleMain('2', true);
    expect(shown).toEqual([]);
  });

  it('main refused first, detail failed after: nothing shown', () => {
    const { shown, gate } = setup();
    gate.settleMain('2', true);
    gate.report('2', '2:q1', { status: 404 });
    expect(shown).toEqual([]);
  });

  it('main answered, detail failed: shown once, a second failure of the same selection is not', () => {
    const { shown, gate } = setup();
    gate.settleMain('2', false);
    gate.report('2', '2:q1', 'a');
    gate.report('2', '2:q1', 'b');
    expect(shown).toEqual(['a']);
  });

  it('detail failed before main answered (not refused): shown when main answers', () => {
    const { shown, gate } = setup();
    gate.report('3', '3:q1', 'a');
    expect(shown).toEqual([]);
    gate.settleMain('3', false);
    expect(shown).toEqual(['a']);
  });

  it('an overtaken load never reports, the next selection still does', () => {
    const { shown, gate } = setup();
    gate.settleMain('1', false);
    gate.report('2', '2:q1', 'old');
    gate.report('3', '3:q2', 'new');
    gate.settleMain('3', false);
    expect(shown).toEqual(['new']);
  });
});
