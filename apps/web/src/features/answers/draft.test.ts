/**
 * takt-048: the Beantwortung starts with the latest answer version. Its draft is the focus view's `FocusDraft`, built by
 * the same helpers (parity by construction); `draft.ts` adds the steps of its own: when saving is offered (`canSave`),
 * what a new record of the same question does to the draft (`onRecord`), what a saved version does (`afterSave`) and
 * "Verwerfen" (`discard`).
 */
import { describe, expect, it } from 'vitest';
import type { AnswerBody, AnswerBodyInput, AnswerMark, AnswerVersion, Permission, Question } from '@hv/domain';
import { previewAnswer } from '../../api/answerFormat';
import { isDirty, newDraft } from '../focus/focus';
import type { FocusDraft } from '../focus/focus';
import { afterSave, canSave, discard, onRecord, startDraft } from './draft';

const DRAFTING: Permission[] = ['answer.draft', 'question.submit_review', 'question.read'];

function question(over: Partial<Question> = {}): Question {
  return {
    id: 'q-1', number: 'F-0101', contributionId: 'c-1', speakerId: 's-1', text: 'Wie hoch ist die Dividende?',
    status: 'answer_drafted', answers: [], version: 3, createdAt: '2026-06-15T10:00:00.000Z',
    updatedAt: '2026-06-15T10:00:00.000Z', _actions: DRAFTING, ...over,
  };
}

function version(n: number, over: Partial<AnswerVersion> = {}): AnswerVersion {
  return { version: n, text: `Antwort ${n}`, createdAt: '2026-06-15T10:05:00.000Z', createdBy: { id: 'u-2', role: 'expert' }, ...over };
}

function doc(text: string, marks?: AnswerMark[]): AnswerBody {
  return { language: 'de', blocks: [{ type: 'paragraph', content: [marks !== undefined ? { text, marks } : { text }] }] };
}

function input(content: NonNullable<AnswerBodyInput['blocks'][number]['content']>): AnswerBodyInput {
  return { blocks: [{ type: 'paragraph', content }] };
}

const REFUSAL = version(2, {
  text: 'Zu dieser Frage gibt der Vorstand keine Auskunft.',
  answerKind: 'refusal_no_claim',
  createdBy: { id: 'u-legal-1', role: 'legal' },
});

const pick = (draft: FocusDraft) => ({
  body: draft.body, sources: draft.sources, baseVersion: draft.baseVersion, baseBody: draft.baseBody,
});

describe('U2: the start of the Beantwortung equals the focus view (parity)', () => {
  const cases: Array<[string, Question]> = [
    ['no version', question({ status: 'assigned' })],
    ['latest version with a mark and two sources', question({
      answers: [version(1), version(2, { text: 'Die Dividende steigt.', body: doc('Die Dividende steigt.', ['bold']), sources: ['a', 'b'] })],
    })],
    ['latest version a refusal', question({ answers: [version(1), REFUSAL] })],
  ];
  for (const [name, record] of cases) {
    it(name, () => {
      expect(pick(startDraft('u-1', record))).toEqual(pick(newDraft('u-1', record)));
    });
  }

  it('the values: empty and 0; the document and "a; b"; empty and the number of the refusal', () => {
    const [none, marked, refused] = cases.map(([, record]) => startDraft('u-1', record));
    expect(pick(none!)).toEqual({ body: null, sources: '', baseVersion: 0, baseBody: null });
    expect(marked!.body).toEqual(doc('Die Dividende steigt.', ['bold']));
    expect(marked!.sources).toBe('a; b');
    expect(marked!.baseVersion).toBe(2);
    expect(pick(refused!)).toEqual({ body: null, sources: '', baseVersion: 2, baseBody: null });
  });
});

describe('U3: canSave', () => {
  const record = question({ answers: [version(1, { sources: ['Bericht'] })] });
  const start = (): FocusDraft => startDraft('u-1', record);
  const open = { mayDraft: true, busy: false };

  it('unchanged → false', () => {
    expect(canSave(start(), open)).toBe(false);
  });
  it('only white space appended → false', () => {
    expect(canSave({ ...start(), body: input([{ text: 'Antwort 1   ' }]) }, open)).toBe(false);
    expect(canSave({ ...start(), sources: ' Bericht ; ' }, open)).toBe(false);
  });
  it('only a mark → true', () => {
    expect(canSave({ ...start(), body: input([{ text: 'Antwort 1', marks: ['bold'] }]) }, open)).toBe(true);
  });
  it('only the sources → true', () => {
    expect(canSave({ ...start(), sources: 'Bericht; Anhang' }, open)).toBe(true);
  });
  it('the field emptied → false', () => {
    expect(canSave({ ...start(), body: null }, open)).toBe(false);
    expect(canSave({ ...start(), body: input([{ text: '  ' }]) }, open)).toBe(false);
  });
  it('busy → false', () => {
    expect(canSave({ ...start(), body: input([{ text: 'Antwort 1 neu' }]) }, { mayDraft: true, busy: true })).toBe(false);
  });
  it('without answer.draft → false', () => {
    expect(canSave({ ...start(), body: input([{ text: 'Antwort 1 neu' }]) }, { mayDraft: false, busy: false })).toBe(false);
  });
  it('a changed draft → true', () => {
    expect(canSave({ ...start(), body: input([{ text: 'Antwort 1 neu' }]) }, open)).toBe(true);
  });
});

describe('U4: onRecord', () => {
  const start = (): FocusDraft => startDraft('u-1', question({ answers: [version(1)] }));

  it('one\'s own version of the same content: no rebuild, unchanged, no notice', () => {
    const mine = { ...start(), body: input([{ text: 'Antwort ' }, { text: 'zwei', marks: ['bold'] }]), generation: 3 };
    const saved = version(2, { text: 'Antwort zwei', body: previewAnswer(mine.body)! });
    const result = onRecord(mine, question({ answers: [version(1), saved] }));
    expect(result.notice).toBe(false);
    expect(result.draft.generation).toBe(3);
    expect(result.draft.body).toBe(mine.body);
    expect(result.draft.baseVersion).toBe(2);
    expect(isDirty(result.draft)).toBe(false);
  });

  it('a foreign version over an unchanged draft: generation + 1, the field shows the new version', () => {
    const result = onRecord(start(), question({ answers: [version(1), version(2)] }));
    expect(result.notice).toBe(false);
    expect(result.draft.generation).toBe(1);
    expect(result.draft.body).toEqual(doc('Antwort 2'));
    expect(result.draft.baseVersion).toBe(2);
    expect(isDirty(result.draft)).toBe(false);
  });

  it('a foreign version over a changed draft: the text stays, the notice stands', () => {
    const changed = { ...start(), body: input([{ text: 'mein Text' }]) };
    const result = onRecord(changed, question({ answers: [version(1), version(2)] }));
    expect(result.notice).toBe(true);
    expect(result.draft.body).toBe(changed.body);
    expect(result.draft.generation).toBe(changed.generation);
    expect(result.draft.baseVersion).toBe(1);
  });

  it('a second foreign version while the notice stands: it stays', () => {
    const changed = { ...start(), body: input([{ text: 'mein Text' }]) };
    const first = onRecord(changed, question({ answers: [version(1), version(2)] }));
    const second = onRecord(first.draft, question({ answers: [version(1), version(2), version(3)] }));
    expect(second.notice).toBe(true);
    expect(second.draft).toBe(first.draft);
  });

  it('without answer.draft: the draft stays unchanged', () => {
    const changed = { ...start(), body: input([{ text: 'mein Text' }]) };
    const result = onRecord(changed, question({ answers: [version(1), version(2)], _actions: ['question.read'] }));
    expect(result.draft).toBe(changed);
    expect(result.notice).toBe(false);
  });

  it('the same record again: keep', () => {
    const draft = start();
    expect(onRecord(draft, question({ answers: [version(1)] })).draft).toBe(draft);
  });
});

describe('U5: afterSave', () => {
  const record = question({ answers: [version(1)] });
  const start = (): FocusDraft => startDraft('u-1', record);
  const typed = input([{ text: 'Antwort ' }, { text: 'zwei', marks: ['bold'] }, { text: ' ' }]);

  it('the base becomes what was sent, baseVersion the maximum, the field is not rebuilt', () => {
    const draft = { ...start(), body: typed, sources: ' a ;b; ', generation: 4 };
    const after = afterSave(draft, { body: typed, sources: ' a ;b; ' }, 2);
    expect(after.baseBody).toEqual(previewAnswer(typed));
    expect(after.baseSources).toBe('a; b');
    expect(after.baseVersion).toBe(2);
    expect(after.generation).toBe(4);
    expect(after.body).toBe(typed);
    expect(isDirty(after)).toBe(false);
    expect(afterSave({ ...draft, baseVersion: 5 }, { body: typed, sources: '' }, 2).baseVersion).toBe(5);
  });

  it('what was typed while saving stays changed', () => {
    const more = input([{ text: 'Antwort ' }, { text: 'zwei', marks: ['bold'] }, { text: ' und mehr' }]);
    const after = afterSave({ ...start(), body: more }, { body: typed, sources: '' }, 2);
    expect(after.body).toBe(more);
    expect(isDirty(after)).toBe(true);
  });

  it('afterSave then onRecord with one\'s own version, and the other way round, end in the same draft', () => {
    const draft = { ...start(), body: typed };
    const saved = question({ answers: [version(1), version(2, { text: 'Antwort zwei', body: previewAnswer(typed)! })] });
    const sent = { body: typed, sources: '' };
    const tokenFirst = onRecord(afterSave(draft, sent, 2), saved).draft;
    const recordFirst = afterSave(onRecord(draft, saved).draft, sent, 2);
    expect(pick(tokenFirst)).toEqual(pick(recordFirst));
    expect(tokenFirst.generation).toBe(recordFirst.generation);
    expect(tokenFirst.rebase).toBe(recordFirst.rebase);
    expect(tokenFirst.baseSources).toBe(recordFirst.baseSources);
    expect(isDirty(tokenFirst)).toBe(false);
  });

  it('both orders also agree when text was typed while saving', () => {
    const more = input([{ text: 'Antwort zwei und mehr' }]);
    const draft = { ...start(), body: more };
    const saved = question({ answers: [version(1), version(2, { text: 'Antwort zwei', body: previewAnswer(typed)! })] });
    const sent = { body: typed, sources: '' };
    const tokenFirst = onRecord(afterSave(draft, sent, 2), saved).draft;
    const recordFirst = afterSave(onRecord(draft, saved).draft, sent, 2);
    expect(pick(tokenFirst)).toEqual(pick(recordFirst));
    expect(tokenFirst.rebase).toBe(false);
    expect(recordFirst.rebase).toBe(false);
  });
});

describe('discard', () => {
  it('restores the base (document and sources), generation + 1', () => {
    const record = question({ answers: [version(1, { sources: ['Bericht'] })] });
    const start = startDraft('u-1', record);
    const back = discard({ ...start, body: input([{ text: 'anders' }]), sources: 'x' }, record);
    expect(back.body).toEqual(doc('Antwort 1'));
    expect(back.sources).toBe('Bericht');
    expect(back.generation).toBe(1);
    expect(isDirty(back)).toBe(false);
  });

  it('with the notice standing, discard moves onto the newer version', () => {
    const start = startDraft('u-1', question({ answers: [version(1)] }));
    const newer = question({ answers: [version(1), version(2)] });
    const noticed = onRecord({ ...start, body: input([{ text: 'mein Text' }]) }, newer).draft;
    const back = discard(noticed, newer);
    expect(back.body).toEqual(doc('Antwort 2'));
    expect(back.baseVersion).toBe(2);
    expect(back.rebase).toBe(false);
    expect(isDirty(back)).toBe(false);
  });
});
