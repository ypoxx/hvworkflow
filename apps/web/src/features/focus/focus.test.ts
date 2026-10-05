/**
 * Scheibe 054, Tests 1–4, 8 and 9, and takt-043 Test 10: the pure helpers of the focus view. `myQuestions` reads `_actions` within the fixed
 * slice of statuses; `focusActions` reads only the list of rights and the two states of the interface — the same list
 * yields the same result in every status (R5), shown with real `Question` records (lesson of 053 review 6).
 */
import { describe, expect, it } from 'vitest';
import type { AnswerBody, AnswerBodyInput, AnswerMark, AnswerVersion, DomainEvent, Permission, Question, QuestionStatus } from '@hv/domain';
import { answerBodyOf, previewText } from '../../api/answerFormat';
import {
  FOCUS_STATUSES,
  disarmFocus,
  draftBase,
  focusActions,
  focusDue,
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
import type { FocusDraft, PendingFocus, ShownForFocus } from './focus';

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

  it('draftBase: the body of the latest version (L without one); empty with a refusal as latest version and without a version', () => {
    expect(draftBase(question())).toEqual({ baseVersion: 0, baseBody: null, baseSources: '' });
    expect(draftBase(question({ answers: [version(1), version(2, { sources: ['GB S. 4', 'Anhang'] })] })))
      .toEqual({ baseVersion: 2, baseBody: doc('Antwort 2'), baseSources: 'GB S. 4; Anhang' });
    const bold = doc('Antwort 2', ['bold']);
    expect(draftBase(question({ answers: [version(1), version(2, { body: bold })] })).baseBody).toBe(bold);
    expect(draftBase(question({ answers: [version(1), version(2, { answerKind: 'refusal_no_claim' })] })))
      .toEqual({ baseVersion: 2, baseBody: null, baseSources: '' });
  });

  it('newDraft starts from the base with generation 0 (or the one given)', () => {
    const q = question({ answers: [version(1)] });
    const draft = newDraft('u-1', q);
    expect(draft.body).toEqual(doc('Antwort 1'));
    expect(draft.baseBody).toEqual(doc('Antwort 1'));
    expect(draft.generation).toBe(0);
    expect(draft.rebase).toBe(false);
    expect(newDraft('u-1', q, 4).generation).toBe(4);
  });

  it('isDirty: a mark alone is a change (055 decision 7), white space alone is not, sources as in 054', () => {
    const draft = newDraft('u-1', question({ answers: [version(1, { sources: ['A'] })] }));
    expect(isDirty(draft)).toBe(false);
    expect(isDirty({ ...draft, body: input([{ text: '  Antwort ' }, { text: '\u00A01  ' }]) })).toBe(false);
    expect(isDirty({ ...draft, body: input([{ text: 'Antwort 1', marks: ['bold'] }]) })).toBe(true);
    expect(isDirty({ ...draft, body: input([{ text: 'Antwort 1', marks: ['underline'] }]) })).toBe(false);
    expect(isDirty({ ...draft, body: input([{ text: 'Antwort 1 neu' }]) })).toBe(true);
    expect(isDirty({ ...draft, body: null })).toBe(true);
    expect(isDirty({ ...draft, sources: ' A ;' })).toBe(false);
    expect(isDirty({ ...draft, sources: 'A; B' })).toBe(true);
    const fresh = newDraft('u-1', question());
    expect(isDirty(fresh)).toBe(false);
    expect(isDirty({ ...fresh, body: input([{ text: '   ' }]) })).toBe(false);
  });

  it('the reading time of the preview counts no bullet', () => {
    const list: AnswerBodyInput = { blocks: [{ type: 'list', items: [[{ text: 'eins zwei' }], [{ text: 'drei', marks: ['bold'] }]] }] };
    expect(previewText(list)).toBe('eins zwei\ndrei');
    expect(readingSeconds(previewText(list))).toBe(readingSeconds('eins zwei drei'));
  });
});

/** A stored document of one paragraph. */
function doc(text: string, marks?: AnswerMark[]): AnswerBody {
  return { language: 'de', blocks: [{ type: 'paragraph', content: [marks !== undefined ? { text, marks } : { text }] }] };
}
/** An input form of one paragraph. */
function input(content: NonNullable<AnswerBodyInput['blocks'][number]['content']>): AnswerBodyInput {
  return { blocks: [{ type: 'paragraph', content }] };
}

describe('Test 8: writingOutcome', () => {
  const start = (): FocusDraft => newDraft('u-1', question({ answers: [version(1)] }));
  it('the question leaves "Meine Fragen": end, with notice only for unsaved text', () => {
    expect(writingOutcome(start(), undefined)).toEqual({ kind: 'end', discarded: false });
    expect(writingOutcome({ ...start(), body: input([{ text: 'neu' }]) }, undefined)).toEqual({ kind: 'end', discarded: true });
    expect(writingOutcome({ ...start(), body: input([{ text: 'neu' }]) }, question({ answers: [version(1)], _actions: ['question.forward'] })))
      .toEqual({ kind: 'end', discarded: true });
  });
  it('no newer version: keep', () => {
    expect(writingOutcome({ ...start(), body: input([{ text: 'neu' }]) }, question({ answers: [version(1)] }))).toEqual({ kind: 'keep' });
  });
  it('a foreign newer version over an unchanged draft: moved onto it, reseed with generation + 1', () => {
    const outcome = writingOutcome(start(), question({ answers: [version(1), version(2)] }));
    expect(outcome.kind).toBe('rebase');
    if (outcome.kind === 'rebase') {
      expect(outcome.reseed).toBe(true);
      expect(outcome.draft.body).toEqual(doc('Antwort 2'));
      expect(outcome.draft.baseVersion).toBe(2);
      expect(outcome.draft.generation).toBe(1);
      expect(isDirty(outcome.draft)).toBe(false);
    }
  });
  it('one\'s own version (same document) before the write answered: rebase without reseed, body and generation stay', () => {
    const mine = { ...start(), body: input([{ text: 'Antwort ' }, { text: 'zwei', marks: ['bold'] }, { text: ' ' }]), generation: 3 };
    const saved = version(2, { text: 'Antwort zwei', body: { language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'Antwort ' }, { text: 'zwei', marks: ['bold'] }] }] } });
    const outcome = writingOutcome(mine, question({ answers: [version(1), saved] }));
    expect(outcome.kind).toBe('rebase');
    if (outcome.kind === 'rebase') {
      expect(outcome.reseed).toBe(false);
      expect(outcome.draft.body).toBe(mine.body);
      expect(outcome.draft.generation).toBe(3);
      expect(outcome.draft.baseVersion).toBe(2);
      expect(isDirty(outcome.draft)).toBe(false);
    }
  });
  it('one\'s own version after the write answered: keep when the base already moved; rebase without reseed when it did not', () => {
    const saved = version(2, { body: doc('Antwort 2', ['italic']) });
    const answered = { ...start(), body: input([{ text: 'Antwort 2', marks: ['italic'] }]), baseBody: doc('Antwort 2', ['italic']), baseVersion: 2 };
    expect(writingOutcome(answered, question({ answers: [version(1), saved] }))).toEqual({ kind: 'keep' });
    const lagging = { ...answered, baseVersion: 1 };
    const outcome = writingOutcome(lagging, question({ answers: [version(1), saved] }));
    expect(outcome.kind === 'rebase' && outcome.reseed).toBe(false);
    expect(outcome.kind === 'rebase' && outcome.draft.generation).toBe(0);
  });
  it('a foreign newer version over a changed draft: the draft stays, the notice is set once', () => {
    const outcome = writingOutcome({ ...start(), body: input([{ text: 'mein Text' }]) }, question({ answers: [version(1), version(2)] }));
    expect(outcome.kind).toBe('notice');
    if (outcome.kind === 'notice') {
      expect(outcome.draft.body).toEqual(input([{ text: 'mein Text' }]));
      expect(outcome.draft.rebase).toBe(true);
      expect(outcome.draft.generation).toBe(0);
      expect(writingOutcome(outcome.draft, question({ answers: [version(1), version(2)] }))).toEqual({ kind: 'keep' });
    }
  });
  it('a mark alone in the newer version counts as different from an unmarked draft', () => {
    const changed = { ...start(), body: input([{ text: 'Antwort 2' }, { text: ' mehr' }]) };
    const outcome = writingOutcome(changed, question({ answers: [version(1), version(2, { body: doc('Antwort 2 mehr', ['bold']) })] }));
    expect(outcome.kind).toBe('notice');
  });
  it('answerBodyOf of a version without body is the base of a draft (L)', () => {
    expect(newDraft('u-1', question({ answers: [version(1)] })).baseBody).toEqual(answerBodyOf(version(1)));
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

describe('Test 10: focusDue and disarmFocus (takt-043)', () => {
  // X was handed over in version 3; Y is the next of "Meine Fragen". Only id and version matter to the decision.
  const X3 = { id: 'q-x', version: 3 };
  const X4 = { id: 'q-x', version: 4 };
  const Y = { id: 'q-y', version: 1 };
  const shown = (question: ShownForFocus['question'], selectedId: string | null, mine: ShownForFocus['mine'], listSettled = true): ShownForFocus =>
    ({ question, selectedId, mine, listSettled });

  /** Sends the shown states through `focusDue` in order and drops the pending focus on `clear` and `move`, as the page does. */
  function replay(start: PendingFocus | null, states: readonly ShownForFocus[]): string[] {
    let pending = start;
    return states.map((state) => {
      const due = focusDue(pending, state);
      if (due !== 'wait') pending = null;
      return due;
    });
  }

  // HTTP mode: the detail read and the list read answer separately; the detail can show X v4 while the old list holds X.
  const orderA = [
    shown(X3, 'q-x', [X3, Y]),
    shown(X4, 'q-x', [X3, Y], false),
    shown(null, 'q-y', [Y]),
    shown(Y, 'q-y', [Y]),
  ];

  it('A: the detail of X v4 before the list: wait until Y stands there', () => {
    expect(replay(X3, orderA)).toEqual(['wait', 'wait', 'wait', 'move']);
  });

  it('A with a settled but older list: X v4 over the row X v3 still waits', () => {
    expect(focusDue(X3, shown(X4, 'q-x', [X3, Y], true))).toBe('wait');
  });

  it('B: the list first, then Y', () => {
    expect(replay(X3, [shown(X3, 'q-x', [X3, Y]), shown(null, 'q-y', [Y]), shown(Y, 'q-y', [Y])])).toEqual(['wait', 'wait', 'move']);
  });

  it('C: the stream ahead; the write answers on X v4 (call from handedOver): no move before Y', () => {
    const states = [orderA[0]!, orderA[1]!, orderA[1]!, orderA[2]!, orderA[3]!];
    expect(replay(X3, states)).toEqual(['wait', 'wait', 'wait', 'wait', 'move']);
  });

  it('D: the whole refresh before the write answers: one move at the first Y, the call from handedOver waits', () => {
    const states = [shown(X3, 'q-x', [X3, Y]), shown(null, 'q-y', [Y]), shown(Y, 'q-y', [Y]), shown(Y, 'q-y', [Y])];
    expect(replay(X3, states)).toEqual(['wait', 'wait', 'move', 'wait']);
  });

  it('E: as A, the move is due at the first Y (whether it happens is mayMoveFocus, steering.test.ts)', () => {
    expect(replay(X3, orderA).indexOf('move')).toBe(3);
  });

  it('empty: the last question left: clear once the list is settled', () => {
    expect(replay(X3, [shown(X3, 'q-x', [X3]), shown(X4, 'q-x', [X3], false), shown(null, null, [])])).toEqual(['wait', 'wait', 'clear']);
  });

  it('empty, not settled: wait', () => {
    expect(focusDue(X3, shown(null, null, [], false))).toBe('wait');
  });

  it('stays: X v4 still in "Meine Fragen" with a settled list: move', () => {
    expect(focusDue(X3, shown(X4, 'q-x', [X4, Y], true))).toBe('move');
  });

  it('not settled: X v4 in the list while it still loads: wait', () => {
    expect(focusDue(X3, shown(X4, 'q-x', [X4, Y], false))).toBe('wait');
  });

  it('actor change: nothing pending (the page drops it), so Y does not move the focus', () => {
    expect(focusDue(null, shown(Y, 'q-y', [Y]))).toBe('wait');
  });

  it('refusal: disarmFocus drops exactly its own pending focus', () => {
    expect(disarmFocus(X3, X3)).toBeNull();
    expect(disarmFocus(X3, { id: 'q-x', version: 2 })).toEqual(X3);
    expect(disarmFocus({ id: 'q-y', version: 1 }, X3)).toEqual({ id: 'q-y', version: 1 });
    expect(disarmFocus(null, X3)).toBeNull();
  });
});
