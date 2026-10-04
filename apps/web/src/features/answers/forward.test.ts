/**
 * Scheibe 053, Test 5: the pure helpers of the dialog "An anderen Fachbereich weiterleiten" (forward to another
 * answering unit). They decide which units are offered, what is sent (exactly `unitId` and `reasonCode`, a closed
 * code, never free text, 048 decision 4) and which refusals of the service the dialog reports itself.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ForwardReasonCode, Unit } from '@hv/domain';
import {
  EMPTY_FORWARD_FORM,
  FORWARD_REASONS,
  buildForwardRequest,
  forwardProblemHandler,
  forwardProblemKey,
  forwardTargets,
} from './forward';

const UNITS: readonly Unit[] = [
  { id: 'unit-fin', name: 'Finanzen und Controlling', shortName: 'Finanzen' },
  { id: 'unit-ops', name: 'Operations und Technik', shortName: 'Operations' },
  { id: 'unit-ar', name: 'Büro des Aufsichtsrats', shortName: 'AR-Büro' },
];

const problem = (status: number, ruleId?: string) => ({ status, title: 't', ...(ruleId !== undefined ? { ruleId } : {}) });

describe('forwardTargets', () => {
  it('leaves out the current unit and keeps the order of the master data', () => {
    expect(forwardTargets(UNITS, 'unit-ops').map((unit) => unit.id)).toEqual(['unit-fin', 'unit-ar']);
  });

  it('offers every unit when the question has none yet', () => {
    expect(forwardTargets(UNITS, undefined).map((unit) => unit.id)).toEqual(['unit-fin', 'unit-ops', 'unit-ar']);
  });
});

describe('FORWARD_REASONS', () => {
  it('are exactly the four closed codes of the contract, in its order', () => {
    const expected: readonly ForwardReasonCode[] = ['wrong_unit', 'expertise_elsewhere', 'capacity', 'other'];
    expect(FORWARD_REASONS).toEqual(expected);
  });
});

describe('buildForwardRequest', () => {
  it('needs both a target and a reason', () => {
    expect(buildForwardRequest(EMPTY_FORWARD_FORM)).toBeUndefined();
    expect(buildForwardRequest({ unitId: 'unit-ar', reasonCode: undefined })).toBeUndefined();
    expect(buildForwardRequest({ unitId: undefined, reasonCode: 'capacity' })).toBeUndefined();
  });

  it('sends exactly the keys unitId and reasonCode, none with undefined', () => {
    const request = buildForwardRequest({ unitId: 'unit-ar', reasonCode: 'expertise_elsewhere' });
    expect(request).toEqual({ unitId: 'unit-ar', reasonCode: 'expertise_elsewhere' });
    expect(Object.keys(request ?? {}).sort()).toEqual(['reasonCode', 'unitId']);
    expect(Object.values(request ?? {})).not.toContain(undefined);
  });

  it('carries no text from the form, even when the form object holds more', () => {
    const form = { unitId: 'unit-ar', reasonCode: 'other' as const, note: 'frei' } as unknown as Parameters<typeof buildForwardRequest>[0];
    expect(Object.keys(buildForwardRequest(form) ?? {}).sort()).toEqual(['reasonCode', 'unitId']);
  });
});

describe('forwardProblemKey', () => {
  it('names the refusals the dialog reports itself', () => {
    expect(forwardProblemKey(problem(409, 'R-GUARD-15'))).toBe('guard15');
    expect(forwardProblemKey(problem(422))).toBe('invalid');
    expect(forwardProblemKey(problem(404))).toBe('gone');
  });

  it('leaves every other refusal to its usual way', () => {
    expect(forwardProblemKey(problem(409, 'R-TRANS-00'))).toBeUndefined();
    expect(forwardProblemKey(problem(412))).toBeUndefined();
    expect(forwardProblemKey(problem(403, 'R-PERM-01'))).toBeUndefined();
    expect(forwardProblemKey(new Error('x'))).toBeUndefined();
    expect(forwardProblemKey(undefined)).toBeUndefined();
  });
});

describe('forwardProblemHandler', () => {
  const setup = () => {
    const show = vi.fn();
    const close = vi.fn();
    const gone = vi.fn();
    return { show, close, gone, handle: forwardProblemHandler(show, close, gone) };
  };

  it('guard15 and invalid: shown in the dialog, handled, the dialog stays open', () => {
    for (const [error, key] of [[problem(409, 'R-GUARD-15'), 'guard15'], [problem(422), 'invalid']] as const) {
      const { show, close, gone, handle } = setup();
      expect(handle(error, () => true)).toBe(true);
      expect(show).toHaveBeenCalledWith(key);
      expect(close).not.toHaveBeenCalled();
      expect(gone).not.toHaveBeenCalled();
    }
  });

  it('gone (404): closes the dialog and reports, handled — no "Stand veraltet"', () => {
    const { show, close, gone, handle } = setup();
    expect(handle(problem(404), () => true)).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(gone).toHaveBeenCalledTimes(1);
    expect(show).not.toHaveBeenCalled();
  });

  it('gone (404) for a question no longer shown: the dialog stays, the toast still appears', () => {
    const { show, close, gone, handle } = setup();
    expect(handle(problem(404), () => false)).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(gone).toHaveBeenCalledTimes(1);
    expect(show).not.toHaveBeenCalled();
  });

  it('412: closes only while its question is still shown, and is not handled', () => {
    const shown = setup();
    expect(shown.handle(problem(412), () => true)).toBe(false);
    expect(shown.close).toHaveBeenCalledTimes(1);
    const moved = setup();
    expect(moved.handle(problem(412), () => false)).toBe(false);
    expect(moved.close).not.toHaveBeenCalled();
  });

  it('anything else: not handled, nothing closed', () => {
    const { show, close, gone, handle } = setup();
    expect(handle(problem(409, 'R-TRANS-00'), () => true)).toBe(false);
    expect(handle(problem(500), () => true)).toBe(false);
    expect(show).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(gone).not.toHaveBeenCalled();
  });
});
