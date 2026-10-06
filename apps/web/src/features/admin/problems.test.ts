/**
 * Scheibe 041, Test 5: which refusal of the service the open dialog shows, as a table (rule id → key, status → key).
 * 412 is "stale" (decision 6); everything else is the ordinary toast (`undefined`). Plus the outcome of one write and
 * what the tab does with it (Test 6c: stale closes, reloads and toasts; a refusal keeps the dialog with its inputs).
 */
import { describe, expect, it } from 'vitest';
import { ApiProblem } from '@hv/domain';
import { adminProblemKey, attempt, outcomeEffects } from './problems';

describe('adminProblemKey', () => {
  it.each([
    ['R-ADM-01', 'admin.problem.R-ADM-01'],
    ['R-ADM-02', 'admin.problem.R-ADM-02'],
    ['R-ADM-07', 'admin.problem.R-ADM-07'],
    ['R-ADM-08', 'admin.problem.R-ADM-08'],
  ])('409 with %s → its own key', (ruleId, key) => {
    expect(adminProblemKey(new ApiProblem(409, 'Conflict', 'x', ruleId))).toBe(key);
  });

  it('409 without a rule id, or with another one → conflict', () => {
    expect(adminProblemKey(new ApiProblem(409, 'Conflict', 'An active assignment already exists.'))).toBe('admin.problem.conflict');
    expect(adminProblemKey(new ApiProblem(409, 'Conflict', 'x', 'R-IDEM-01'))).toBe('admin.problem.conflict');
  });

  it('403, 404, 422 → their keys; 412 → stale', () => {
    expect(adminProblemKey(new ApiProblem(403, 'Forbidden', 'x', 'R-PERM-01'))).toBe('admin.problem.forbidden');
    expect(adminProblemKey(new ApiProblem(404, 'Not found', 'x'))).toBe('admin.problem.notFound');
    expect(adminProblemKey(new ApiProblem(422, 'Unprocessable', 'x'))).toBe('admin.problem.invalid');
    expect(adminProblemKey(new ApiProblem(412, 'Precondition failed', 'x'))).toBe('stale');
  });

  it('a plain problem object of the HTTP adapter counts the same as the domain class', () => {
    expect(adminProblemKey({ status: 409, title: 'Conflict', detail: 'x', ruleId: 'R-ADM-07' })).toBe('admin.problem.R-ADM-07');
  });

  it('500, a network error and anything else → undefined', () => {
    expect(adminProblemKey(new ApiProblem(500, 'Server error', 'x'))).toBeUndefined();
    expect(adminProblemKey(new TypeError('Failed to fetch'))).toBeUndefined();
    expect(adminProblemKey(undefined)).toBeUndefined();
    expect(adminProblemKey('409')).toBeUndefined();
  });
});

describe('attempt and outcomeEffects', () => {
  it('a write that succeeds is saved: the dialog closes and the tab reads again', async () => {
    const outcome = await attempt(() => Promise.resolve('ok'));
    expect(outcome).toEqual({ kind: 'saved' });
    expect(outcomeEffects(outcome)).toEqual({ close: true, reload: true });
  });

  it('412 is stale: the dialog closes, the toast admin.stale shows, the tab reads again', async () => {
    const outcome = await attempt(() => Promise.reject(new ApiProblem(412, 'Precondition failed', 'x')));
    expect(outcome).toEqual({ kind: 'stale' });
    expect(outcomeEffects(outcome)).toEqual({ close: true, reload: true, toast: 'admin.stale' });
  });

  it('a refusal keeps the dialog open with its message and rule id, and reads nothing', async () => {
    const outcome = await attempt(() => Promise.reject(new ApiProblem(409, 'Conflict', 'x', 'R-ADM-02')));
    expect(outcome).toEqual({ kind: 'problem', key: 'admin.problem.R-ADM-02', ruleId: 'R-ADM-02' });
    expect(outcomeEffects(outcome)).toEqual({ close: false, reload: false, problem: { key: 'admin.problem.R-ADM-02', ruleId: 'R-ADM-02' } });
  });

  it('a refusal without a rule id carries none', async () => {
    const outcome = await attempt(() => Promise.reject(new ApiProblem(422, 'Unprocessable', 'x')));
    expect(outcome).toEqual({ kind: 'problem', key: 'admin.problem.invalid' });
  });

  it('anything else is failed: the dialog stays, the error goes to the ordinary toast', async () => {
    const error = new ApiProblem(500, 'Server error', 'x');
    const outcome = await attempt(() => Promise.reject(error));
    expect(outcome).toEqual({ kind: 'failed', error });
    expect(outcomeEffects(outcome)).toEqual({ close: false, reload: false, error });
  });
});
