/**
 * takt-048: the Beantwortung starts with the latest answer version. Its draft is the focus view's `FocusDraft`, built by
 * the same helpers (parity by construction); `draft.ts` adds the steps of its own: when saving is offered (`canSave`),
 * what a new record of the same question does to the draft (`onRecord`), what a saved version does (`afterSave`) and
 * "Verwerfen" (`discard`).
 */
import { describe, expect, it } from 'vitest';
import type { AnswerBody, AnswerBodyInput, AnswerMark, AnswerVersion, Permission, Question } from '@hv/domain';
import { previewAnswer } from '../../api/answerFormat';
import { translate } from '../../i18n';
import { isDirty, newDraft } from '../focus/focus';
import type { FocusDraft } from '../focus/focus';
import type { BufferedDraft } from '../../api/draftBuffer';
import {
  afterSave, baseAt, bufferStep, canSave, conflictAfterRefusal, discard, keepMine, lateRestore, onRecord, restoreDraft, saveDecision,
  startDraft, takeTheirs,
} from './draft';

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
    const resetFirst = onRecord(afterSave(draft, sent, 2), saved).draft;
    const recordFirst = afterSave(onRecord(draft, saved).draft, sent, 2);
    expect(pick(resetFirst)).toEqual(pick(recordFirst));
    expect(resetFirst.generation).toBe(recordFirst.generation);
    expect(resetFirst.rebase).toBe(recordFirst.rebase);
    expect(resetFirst.baseSources).toBe(recordFirst.baseSources);
    expect(isDirty(resetFirst)).toBe(false);
  });

  it('both orders also agree when text was typed while saving', () => {
    const more = input([{ text: 'Antwort zwei und mehr' }]);
    const draft = { ...start(), body: more };
    const saved = question({ answers: [version(1), version(2, { text: 'Antwort zwei', body: previewAnswer(typed)! })] });
    const sent = { body: typed, sources: '' };
    const resetFirst = onRecord(afterSave(draft, sent, 2), saved).draft;
    const recordFirst = afterSave(onRecord(draft, saved).draft, sent, 2);
    expect(pick(resetFirst)).toEqual(pick(recordFirst));
    expect(resetFirst.rebase).toBe(false);
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

/**
 * Scheibe 060, U2–U4: the buffered draft restored (`restoreDraft`, base always from the record, never from the entry),
 * the 412 sorted (`conflictAfterRefusal`), "Mit meiner Fassung weiter" (`keepMine`), "Version n übernehmen"
 * (`takeTheirs`), the save step with a standing notice (`saveDecision`) and the buffer step of an input (`bufferStep`).
 */
describe('Scheibe 060', () => {
  const M = 'm-1';
  const plain = (text: string): AnswerBodyInput => ({ blocks: [{ type: 'paragraph', content: [{ text }] }] });
  const withMeeting = (over: Partial<Question> = {}): Question => question({ meetingId: M, ...over });
  const v1 = version(1, { text: 'Antwort eins.', sources: ['GB S. 4'] });
  const v2 = version(2, { text: 'Antwort zwei.', createdBy: { id: 'u-legal-1', role: 'legal' } });
  function stored(over: Partial<BufferedDraft> = {}): BufferedDraft {
    return { ownerId: 'u-1', meetingId: M, questionId: 'q-1', body: plain('Antwort eins. Mein Zusatz.'), sources: 'GB S. 4', baseVersion: 1, changedAt: 1_000, ...over };
  }

  describe('U2 restoreDraft', () => {
    it('an entry goes before the prefill: restored, changed, generation as given', () => {
      const r = restoreDraft(stored(), 'u-1', withMeeting({ answers: [v1] }), 4);
      expect(r.restored).toBe(true);
      expect(r.drop).toBe(false);
      expect(r.changedAt).toBe(1_000);
      expect(r.draft.body).toEqual(plain('Antwort eins. Mein Zusatz.'));
      expect(r.draft.generation).toBe(4);
      expect(isDirty(r.draft)).toBe(true);
      expect(r.draft.rebase).toBe(false);
    });

    it('an entry equal to its base: not restored, dropped; the prefill stands', () => {
      const r = restoreDraft(stored({ body: plain('Antwort eins.') }), 'u-1', withMeeting({ answers: [v1] }), 0);
      expect(r.restored).toBe(false);
      expect(r.drop).toBe(true);
      expect(pick(r.draft)).toEqual(pick(startDraft('u-1', withMeeting({ answers: [v1] }))));
    });

    it('base from the record: an entry with the wording of version 1 stays locked for canSave (takt-048)', () => {
      const r = restoreDraft(stored({ body: plain('Antwort eins.'), sources: 'GB S. 4' }), 'u-1', withMeeting({ answers: [v1] }), 0);
      expect(r.restored).toBe(false);
      expect(canSave(r.draft, { mayDraft: true, busy: false })).toBe(false);
    });

    it('a manipulated entry is restored against the base of version 1 from the record, never a base of its own', () => {
      const raw = { ...stored({ body: plain('Ganz anders.') }), baseBody: doc('Ganz anders.'), baseSources: 'GB S. 4' } as BufferedDraft;
      const r = restoreDraft(raw, 'u-1', withMeeting({ answers: [v1] }), 0);
      expect(r.restored).toBe(true);
      expect(r.draft.baseBody).toEqual(doc('Antwort eins.'));
      expect(isDirty(r.draft)).toBe(true);
    });

    it('baseVersion above the newest version, or a version missing in the record: rejected and dropped', () => {
      const future = restoreDraft(stored({ baseVersion: 6 }), 'u-1', withMeeting({ answers: [v1] }), 0);
      expect(future).toMatchObject({ restored: false, drop: true });
      const missing = restoreDraft(stored({ baseVersion: 1 }), 'u-1', withMeeting({ answers: [version(2)] }), 0);
      expect(missing).toMatchObject({ restored: false, drop: true });
    });

    it('baseVersion at a refusal: the base is empty as with draftBase', () => {
      const record = withMeeting({ answers: [v1, REFUSAL] });
      const r = restoreDraft(stored({ baseVersion: 2, sources: '' }), 'u-1', record, 0);
      expect(r.restored).toBe(true);
      expect(r.draft.baseVersion).toBe(2);
      expect(r.draft.baseBody).toBeNull();
      expect(r.draft.baseSources).toBe('');
      expect(baseAt(record, 2)).toEqual({ baseVersion: 2, baseBody: null, baseSources: '' });
      expect(baseAt(record, 0)).toEqual({ baseVersion: 0, baseBody: null, baseSources: '' });
      expect(baseAt(record, 3)).toBeUndefined();
    });

    it('a newer version saying what the entry says: base moved, unchanged, dropped', () => {
      const v2same = version(2, { text: 'Antwort eins. Mein Zusatz.', sources: ['GB S. 4'] });
      const r = restoreDraft(stored(), 'u-1', withMeeting({ answers: [v1, v2same] }), 0);
      expect(r.restored).toBe(false);
      expect(r.drop).toBe(true);
      expect(r.draft.baseVersion).toBe(2);
      expect(isDirty(r.draft)).toBe(false);
    });

    it('a newer version over a changed entry: restored with rebase', () => {
      const r = restoreDraft(stored(), 'u-1', withMeeting({ answers: [v1, v2] }), 0);
      expect(r.restored).toBe(true);
      expect(r.draft.rebase).toBe(true);
      expect(r.draft.baseVersion).toBe(1);
    });

    it('without answer.draft: no restore, the entry stays; after roles_changed it is dropped', () => {
      const record = withMeeting({ answers: [v1], _actions: ['question.read'] });
      expect(restoreDraft(stored(), 'u-1', record, 0)).toMatchObject({ restored: false, drop: false });
      expect(restoreDraft(stored(), 'u-1', record, 0, { rolesChanged: true })).toMatchObject({ restored: false, drop: true });
    });

    it('an entry of another actor, another meeting or another question is never used', () => {
      const record = withMeeting({ answers: [v1] });
      for (const other of [stored({ ownerId: 'u-2' }), stored({ meetingId: 'm-2' }), stored({ questionId: 'q-9' })]) {
        const r = restoreDraft(other, 'u-1', record, 0);
        expect(r.restored).toBe(false);
        expect(r.draft.body).toEqual(startDraft('u-1', record).body);
      }
      expect(restoreDraft(stored(), 'u-1', question({ answers: [v1] }), 0).restored).toBe(false);
    });

    it('late snapshot: over an unchanged draft it replaces it with generation + 1; over a changed one nothing changes', () => {
      const record = withMeeting({ answers: [v1] });
      const fresh = startDraft('u-1', record, 2);
      const late = lateRestore(fresh, stored(), 'u-1', record);
      expect(late.restored).toBe(true);
      expect(late.draft.generation).toBe(3);
      const typed = { ...fresh, body: plain('Schon getippt.') };
      const kept = lateRestore(typed, stored(), 'u-1', record);
      expect(kept.restored).toBe(false);
      expect(kept.draft).toBe(typed);
    });
  });

  describe('U3 conflictAfterRefusal', () => {
    const mine = (): FocusDraft => ({ ...startDraft('u-1', withMeeting({ answers: [v1] })), body: plain('Mein Text.') });
    it('a newer differing version: compare', () => {
      expect(conflictAfterRefusal(mine(), withMeeting({ answers: [v1, v2] }))).toBe('compare');
    });
    it('a newer version saying the same: rebase-silent', () => {
      expect(conflictAfterRefusal(mine(), withMeeting({ answers: [v1, version(2, { text: 'Mein Text.', sources: ['GB S. 4'] })] }))).toBe('rebase-silent');
    });
    it('no newer version: retry', () => {
      expect(conflictAfterRefusal(mine(), withMeeting({ answers: [v1], version: 9 }))).toBe('retry');
    });
    it('a refusal as newest version: compare', () => {
      expect(conflictAfterRefusal(mine(), withMeeting({ answers: [v1, REFUSAL] }))).toBe('compare');
    });
  });

  describe('U4 keepMine and takeTheirs', () => {
    const mine = (): FocusDraft => ({ ...startDraft('u-1', withMeeting({ answers: [v1] })), body: plain('Mein Text.'), rebase: true });
    it('the base is the shown version n, not the record’s; record already at n+1 → rebase stands again', () => {
      const v3 = version(3, { text: 'Antwort drei.' });
      const next = keepMine(mine(), 2, withMeeting({ answers: [v1, v2, v3] }));
      expect(next.baseVersion).toBe(2);
      expect(next.rebase).toBe(true);
      expect(next.body).toEqual(plain('Mein Text.'));
    });
    it('record at n: rebase false, the draft is changed against n, the field rebuilds', () => {
      const before = mine();
      const next = keepMine(before, 2, withMeeting({ answers: [v1, v2] }));
      expect(next.baseVersion).toBe(2);
      expect(next.rebase).toBe(false);
      expect(isDirty(next)).toBe(true);
      expect(next.generation).toBe(before.generation + 1);
    });
    it('takeTheirs: the draft is the shown version, unchanged, rebuilt', () => {
      const before = mine();
      const next = takeTheirs(before, 2, withMeeting({ answers: [v1, v2] }));
      expect(next.baseVersion).toBe(2);
      expect(isDirty(next)).toBe(false);
      expect(previewAnswer(next.body)).toEqual(doc('Antwort zwei.'));
      expect(next.generation).toBe(before.generation + 1);
    });
  });

  describe('saving with a standing notice, and the buffer step of an input', () => {
    it('saveDecision: rebase opens the comparison instead of sending; locked stays locked', () => {
      expect(saveDecision({ rebase: true }, true)).toBe('compare');
      expect(saveDecision({ rebase: false }, true)).toBe('send');
      expect(saveDecision({ rebase: true }, false)).toBe('none');
      expect(saveDecision({ rebase: false }, false)).toBe('none');
    });
    it('bufferStep: only an input writes; a changed draft is put, an unchanged one deleted', () => {
      const record = withMeeting({ answers: [v1] });
      const fresh = startDraft('u-1', record);
      const typed = { ...fresh, body: plain('Neu.') };
      expect(bufferStep(typed, false)).toEqual({ kind: 'none' });
      expect(bufferStep(typed, true)).toEqual({ kind: 'put', body: plain('Neu.'), sources: 'GB S. 4', baseVersion: 1 });
      expect(bufferStep(fresh, true)).toEqual({ kind: 'delete' });
    });
  });
});

describe('orchestrator D-d: the notice on leaving says "in this browser", as decision 6', () => {
  it('goneKept names the browser, not the device, in both languages', () => {
    expect(translate('de', 'focus.write.goneKept', { number: 'F-1', time: '10:00' })).toContain('in diesem Browser');
    expect(translate('en', 'focus.write.goneKept', { number: 'F-1', time: '10:00' })).toContain('in this browser');
  });
});
