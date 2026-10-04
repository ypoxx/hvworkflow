/**
 * Scheibe 053, Test 4: `steeringActions` — which steering steps the detail offers, read from `_actions` alone
 * (AGENTS.md R4, R5). Never from the status: the same list yields the same result in every status.
 */
import { describe, expect, it } from 'vitest';
import type { Permission, Question, QuestionStatus } from '@hv/domain';
import { mayMoveFocus, steeringActions } from './steering';

const list = (...actions: Permission[]): readonly Permission[] => actions;

describe('steeringActions (Test 4)', () => {
  it('ranks forward before assign before classify for the primary action', () => {
    expect(steeringActions(list('question.classify')).primary).toBe('classify');
    expect(steeringActions(list('question.classify', 'question.assign')).primary).toBe('assign');
    expect(steeringActions(list('question.forward', 'question.classify')).primary).toBe('forward');
  });

  it('offers no assign where forward is allowed, neither primary nor secondary', () => {
    const result = steeringActions(list('question.assign', 'question.forward', 'question.refuse.propose', 'question.read'));
    expect(result.primary).toBe('forward');
    expect(result.secondary).toEqual(['refuse']);
    expect([result.primary, ...result.secondary]).not.toContain('assign');
  });

  it('classified text track: assign primary, classify and refuse secondary', () => {
    expect(steeringActions(list('question.classify', 'question.assign', 'question.refuse.propose', 'question.read'))).toEqual({
      primary: 'assign',
      secondary: ['classify', 'refuse'],
    });
  });

  it('refuse alone is never primary', () => {
    expect(steeringActions(list('question.refuse.propose'))).toEqual({ secondary: ['refuse'] });
  });

  it('an empty list offers nothing', () => {
    expect(steeringActions(list())).toEqual({ secondary: [] });
  });

  it('ignores rights that are not steering steps', () => {
    expect(steeringActions(list('answer.draft', 'question.approve', 'question.read', 'question.stage'))).toEqual({ secondary: [] });
    expect(steeringActions(list('answer.draft', 'question.classify', 'question.approve'))).toEqual({
      primary: 'classify',
      secondary: [],
    });
  });

  it('is independent of the status: the same list gives the same result in classified, assigned and in_review', () => {
    const actions = list('question.forward', 'question.refuse.propose', 'question.read');
    const record = (status: QuestionStatus) => ({ status, _actions: [...actions] }) as unknown as Question;
    const results = (['classified', 'assigned', 'in_review'] as const).map((status) => steeringActions(record(status)._actions));
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(results[0]).toEqual({ primary: 'forward', secondary: ['refuse'] });
  });
});

describe('mayMoveFocus (review 053, minor 3a)', () => {
  const body = { id: 'body' };
  const search = { id: 'search' };
  const inDetail = { id: 'primary' };
  const detail = { contains: (node: { id: string }) => node === inDetail };

  it('moves from nothing: the body, or no active element (the closed dialog took the focus along)', () => {
    expect(mayMoveFocus(body, body, detail)).toBe(true);
    expect(mayMoveFocus(null, body, detail)).toBe(true);
  });

  it('moves within the detail', () => {
    expect(mayMoveFocus(inDetail, body, detail)).toBe(true);
  });

  it('never pulls the focus out of the search field or another control', () => {
    expect(mayMoveFocus(search, body, detail)).toBe(false);
    expect(mayMoveFocus(search, body, null)).toBe(false);
  });
});
