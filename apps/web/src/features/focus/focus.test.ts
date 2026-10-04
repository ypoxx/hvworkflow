/**
 * Scheibe 054, Tests 1–4, 8 and 9: the pure helpers of the focus view. `myQuestions` reads `_actions` within the fixed
 * slice of statuses; `focusActions` reads only the list of rights and the two states of the interface — the same list
 * yields the same result in every status (R5), shown with real `Question` records (lesson of 053 review 6).
 */
import { describe, expect, it } from 'vitest';
import type { AnswerVersion, DomainEvent, Permission, Question, QuestionStatus } from '@hv/domain';
import {
  FOCUS_STATUSES,
  draftBase,
  focusActions,
  formatReading,
  isDirty,
  isSaveChord,
  lastForward,
  myQuestions,
  newDraft,
  nextSelection,
  readingSeconds,
  shouldLeaveWriting,
  writingOutcome,
} from './focus';
import type { FocusDraft } from './focus';

const EXPERT: Permission[] = ['answer.draft', 'question.submit_review', 'question.claim', 'question.read', 'history.read', 'question.forward'];

function question(over: Partial<Question> = {}): Question {
  return {
    id: 'q-1', number: 'F-0101', contributionId: 'c-1', speakerId: 's-1', speakerDisplayName: 'Redner 15',
    text: 'Wie hoch ist die Dividende?', status: 'assigned', unitId: 'unit-fin', answers: [], version: 3,
    createdAt: '2026-06-15T10:00:00.000Z', updatedAt: '2026-06-15T10:00:00.000Z', _actions: ['answer.draft', 'question.forward'],
    ...over,
  };
}

function version(n: number, over: Partial<AnswerVersion> = {}): AnswerVersion {
  return { version: n, text: `Antwort ${n}`, createdAt: '2026-06-15T10:05:00.000Z', createdBy: { id: 'u-1', role: 'expert' }, ...over };
}

const words = (n: number): string => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

describe('Test 1: myQuestions', () => {
  it('takes assigned and answer_drafted with answer.draft and question.forward, oldest first, ties by number', () => {
    const items = [
      question({ id: 'a', number: 'F-0003', createdAt: '2026-06-15T10:02:00.000Z' }),
      question({ id: 'b', number: 'F-0002', status: 'answer_drafted', createdAt: '2026-06-15T10:01:00.000Z' }),
      question({ id: 'c', number: 'F-0001', createdAt: '2026-06-15T10:02:00.000Z' }),
      question({ id: 'legal', number: 'F-0004', _actions: ['answer.draft', 'question.refuse.propose'] }),
      question({ id: 'coord', number: 'F-0005', _actions: ['question.forward'] }),
      question({ id: 'review', number: 'F-0006', status: 'in_review', _actions: ['answer.draft', 'question.forward'] }),
      question({ id: 'classified', number: 'F-0007', status: 'classified', _actions: ['answer.draft', 'question.forward'] }),
    ];
    const before = items.map((item) => item.id);
    expect(myQuestions(items).map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(items.map((item) => item.id)).toEqual(before);
  });

  it('a list only with answer.draft (legal) or only with question.forward (coordination) gives nothing', () => {
    expect(myQuestions([question({ _actions: ['answer.draft', 'question.refuse.propose'] })])).toEqual([]);
    expect(myQuestions([question({ _actions: ['question.forward', 'question.assign'] })])).toEqual([]);
    expect(FOCUS_STATUSES).toEqual(['assigned', 'answer_drafted']);
  });
});

describe('Test 2: focusActions', () => {
  const detail = { dirty: false, writing: false };
  it('assigned for the expert (draft, forward): write primary, forward secondary', () => {
    expect(focusActions(['answer.draft', 'question.forward', 'question.claim'], detail)).toEqual({ primary: 'write', secondary: ['forward'] });
  });
  it('answer_drafted (draft, submit, forward): Weiterleiten primary, write and forward secondary', () => {
    expect(focusActions(EXPERT, detail)).toEqual({ primary: 'submit', secondary: ['write', 'forward'] });
  });
  it('with unsaved text neither hand-over is offered; outside the writing mode write ("continue") is primary', () => {
    expect(focusActions(EXPERT, { dirty: true, writing: false })).toEqual({ primary: 'write', secondary: [] });
  });
  it('writing mode: save only there; primary with unsaved text, otherwise Weiterleiten', () => {
    expect(focusActions(EXPERT, { dirty: true, writing: true })).toEqual({ primary: 'save', secondary: [] });
    expect(focusActions(EXPERT, { dirty: false, writing: true })).toEqual({ primary: 'submit', secondary: ['save', 'forward'] });
    expect(focusActions(['answer.draft', 'question.forward'], { dirty: false, writing: true })).toEqual({ secondary: ['save', 'forward'] });
  });
  it('forward is never primary unless it is all there is', () => {
    expect(focusActions(['question.forward'], detail)).toEqual({ primary: 'forward', secondary: [] });
    expect(focusActions(['question.forward', 'question.submit_review'], detail).primary).toBe('submit');
  });
  it('ignores refuse.propose, claim, approve; an empty list gives nothing', () => {
    expect(focusActions(['question.refuse.propose', 'question.claim', 'question.approve'], detail)).toEqual({ secondary: [] });
    expect(focusActions([], { dirty: true, writing: true })).toEqual({ secondary: [] });
  });
  it('status independence: the same _actions in assigned, answer_drafted and in_review give the same result', () => {
    const statuses: QuestionStatus[] = ['assigned', 'answer_drafted', 'in_review'];
    for (const ui of [detail, { dirty: true, writing: false }, { dirty: false, writing: true }, { dirty: true, writing: true }]) {
      const results = statuses.map((status) => focusActions(question({ status, _actions: EXPERT })._actions, ui));
      expect(results[1]).toEqual(results[0]);
      expect(results[2]).toEqual(results[0]);
    }
  });
});

describe('Test 3: nextSelection and isSaveChord', () => {
  const mine = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('nothing chosen → first; present → stays; gone → same index, else last; empty → null', () => {
    expect(nextSelection(mine, null, 0)).toBe('a');
    expect(nextSelection(mine, 'b', 1)).toBe('b');
    expect(nextSelection([{ id: 'a' }, { id: 'c' }], 'b', 1)).toBe('c');
    expect(nextSelection([{ id: 'a' }, { id: 'b' }], 'c', 2)).toBe('b');
    expect(nextSelection([], 'a', 0)).toBeNull();
    expect(nextSelection([], null, 0)).toBeNull();
  });
  it('Ctrl+Enter and Meta+Enter save; not with Alt or Shift, not without a modifier, not while composing', () => {
    const base = { key: 'Enter', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };
    expect(isSaveChord({ ...base, ctrlKey: true })).toBe(true);
    expect(isSaveChord({ ...base, metaKey: true })).toBe(true);
    expect(isSaveChord({ ...base, ctrlKey: true, altKey: true })).toBe(false);
    expect(isSaveChord({ ...base, ctrlKey: true, shiftKey: true })).toBe(false);
    expect(isSaveChord(base)).toBe(false);
    expect(isSaveChord({ ...base, ctrlKey: true, isComposing: true })).toBe(false);
    expect(isSaveChord({ ...base, key: 'a', ctrlKey: true })).toBe(false);
  });
});

describe('Test 4: reading time, last forward, draft helpers', () => {
  it('readingSeconds and formatReading', () => {
    expect(readingSeconds('')).toBe(0);
    expect(readingSeconds('   ')).toBe(0);
    expect(formatReading(0)).toBe('0:00');
    expect(readingSeconds(words(130))).toBe(60);
    expect(readingSeconds(words(131))).toBe(61);
    expect(readingSeconds(words(260))).toBe(120);
    expect(readingSeconds(words(261))).toBeGreaterThan(120);
    expect(readingSeconds(words(13))).toBe(6);
    expect(readingSeconds('eins   zwei\n\n drei\t vier')).toBe(readingSeconds('eins zwei drei vier'));
    expect(formatReading(61)).toBe('1:01');
    expect(formatReading(120)).toBe('2:00');
  });

  it('lastForward: the last forward into the unit wins; other units and types are passed over', () => {
    const forwarded = (unitId: string, reasonCode: 'wrong_unit' | 'capacity', fromUnitId?: string): DomainEvent =>
      ({ type: 'QuestionForwarded', subjectId: 'q-1', payload: { unitId, reasonCode, ...(fromUnitId !== undefined ? { fromUnitId } : {}) } }) as unknown as DomainEvent;
    const other = { type: 'AnswerDrafted', subjectId: 'q-1', payload: {} } as unknown as DomainEvent;
    expect(lastForward([], 'unit-fin')).toBeUndefined();
    expect(lastForward([other], 'unit-fin')).toBeUndefined();
    expect(lastForward([forwarded('unit-fin', 'wrong_unit', 'unit-ops'), other, forwarded('unit-fin', 'capacity', 'unit-ar')], 'unit-fin'))
      .toEqual({ fromUnitId: 'unit-ar', reasonCode: 'capacity' });
    expect(lastForward([forwarded('unit-ar', 'capacity', 'unit-fin')], 'unit-fin')).toBeUndefined();
    const withoutFrom = lastForward([forwarded('unit-fin', 'wrong_unit')], 'unit-fin');
    expect(withoutFrom).toEqual({ reasonCode: 'wrong_unit' });
    expect(withoutFrom !== undefined && 'fromUnitId' in withoutFrom).toBe(false);
  });

  it('draftBase: the latest version; empty with a refusal as latest version and without a version', () => {
    expect(draftBase(question())).toEqual({ baseVersion: 0, baseText: '', baseSources: '' });
    expect(draftBase(question({ answers: [version(1), version(2, { sources: ['GB S. 4', 'Anhang'] })] })))
      .toEqual({ baseVersion: 2, baseText: 'Antwort 2', baseSources: 'GB S. 4; Anhang' });
    expect(draftBase(question({ answers: [version(1), version(2, { answerKind: 'refusal_no_claim' })] })))
      .toEqual({ baseVersion: 2, baseText: '', baseSources: '' });
  });

  it('isDirty compares the trimmed text and the sources', () => {
    const draft = newDraft('u-1', question({ answers: [version(1, { sources: ['A'] })] }));
    expect(isDirty(draft)).toBe(false);
    expect(isDirty({ ...draft, text: '  Antwort 1  ' })).toBe(false);
    expect(isDirty({ ...draft, text: 'Antwort 1 neu' })).toBe(true);
    expect(isDirty({ ...draft, sources: ' A ;' })).toBe(false);
    expect(isDirty({ ...draft, sources: 'A; B' })).toBe(true);
  });
});

describe('Test 8: writingOutcome', () => {
  const start = (): FocusDraft => newDraft('u-1', question({ answers: [version(1)] }));
  it('the question leaves "Meine Fragen": end, with notice only for unsaved text', () => {
    expect(writingOutcome(start(), undefined)).toEqual({ kind: 'end', discarded: false });
    expect(writingOutcome({ ...start(), text: 'neu' }, undefined)).toEqual({ kind: 'end', discarded: true });
    expect(writingOutcome({ ...start(), text: 'neu' }, question({ answers: [version(1)], _actions: ['question.forward'] })))
      .toEqual({ kind: 'end', discarded: true });
  });
  it('no newer version: keep', () => {
    expect(writingOutcome({ ...start(), text: 'neu' }, question({ answers: [version(1)] }))).toEqual({ kind: 'keep' });
  });
  it('a newer version over unchanged text: moved onto it silently', () => {
    const outcome = writingOutcome(start(), question({ answers: [version(1), version(2)] }));
    expect(outcome.kind).toBe('rebase');
    if (outcome.kind === 'rebase') {
      expect(outcome.draft.text).toBe('Antwort 2');
      expect(outcome.draft.baseVersion).toBe(2);
      expect(isDirty(outcome.draft)).toBe(false);
    }
  });
  it('a newer version that says what the text says (own save read first): silent as well', () => {
    expect(writingOutcome({ ...start(), text: 'Antwort 2 ' }, question({ answers: [version(1), version(2)] })).kind).toBe('rebase');
  });
  it('a newer version over changed text: the text stays, the notice is set once', () => {
    const outcome = writingOutcome({ ...start(), text: 'mein Text' }, question({ answers: [version(1), version(2)] }));
    expect(outcome.kind).toBe('notice');
    if (outcome.kind === 'notice') {
      expect(outcome.draft.text).toBe('mein Text');
      expect(outcome.draft.rebase).toBe(true);
      expect(writingOutcome(outcome.draft, question({ answers: [version(1), version(2)] }))).toEqual({ kind: 'keep' });
    }
  });
});

describe('Test 9: shouldLeaveWriting', () => {
  it('only Escape, not when a dialog took it first, not with a dialog open', () => {
    expect(shouldLeaveWriting({ key: 'Escape', defaultPrevented: false, dialogOpen: false })).toBe(true);
    expect(shouldLeaveWriting({ key: 'Enter', defaultPrevented: false, dialogOpen: false })).toBe(false);
    expect(shouldLeaveWriting({ key: 'Escape', defaultPrevented: true, dialogOpen: false })).toBe(false);
    expect(shouldLeaveWriting({ key: 'Escape', defaultPrevented: false, dialogOpen: true })).toBe(false);
  });
});
