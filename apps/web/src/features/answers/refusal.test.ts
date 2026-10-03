/**
 * Scheibe 045, Tests 1–5 and 11: the pure helpers of the refusal (Verweigerung) in the interface. They
 * hold every rule the dialog, the version card, the podium and the history read: the kind of a
 * version, the fail-safe status of a catalogue ground, the prefill of the wording from a template
 * (Formulierungsbaustein) and its marker, the body that is sent, and which refusals the dialog reports
 * itself instead of a toast.
 */
import { describe, expect, it } from 'vitest';
import type { AnswerVersion, Question, RefusalGround } from '@hv/domain';
import { translate } from '../../i18n';
import { settleProblem } from './lib';
import {
  EMPTY_REFUSAL_FORM,
  JUSTIFICATION_MAX,
  TEXT_MAX,
  buildRefusalProposal,
  carriesJustification,
  codePointLength,
  groundStatus,
  latestIsRefusal,
  nextRefusalForm,
  refusalKindOf,
  refusalProblemHandler,
  refusalProblemKey,
  refusalSubmitBlocked,
  showsTemplateMarker,
} from './refusal';
import type { RefusalForm } from './refusal';

const at = '2027-04-20T10:00:00.000Z';
const by = { id: 'u-1', role: 'legal' as const };

function version(n: number, extra: Partial<AnswerVersion> = {}): AnswerVersion {
  return { version: n, text: `Text ${n}`, createdAt: at, createdBy: by, ...extra };
}

function question(answers: AnswerVersion[]): Pick<Question, 'answers'> {
  return { answers };
}

function ground(id: string, extra: Partial<RefusalGround> = {}): RefusalGround {
  return {
    id,
    title: `Titel ${id}`,
    stageText: `Baustein ${id}.`,
    legalRef: { source: 'AktG', citation: `Zitat ${id}`, docVersion: '1', docHash: null, verified: false },
    hash: `hash-${id}`,
    ...extra,
  } as RefusalGround;
}

const G1 = ground('g1');
const G2 = ground('g2');
const VERIFIED = ground('g3', {
  legalRef: { source: 'AktG', citation: 'geprüft', docVersion: '1', docHash: 'x', verified: true },
} as unknown as Partial<RefusalGround>);
const GROUNDS = [G1, G2, VERIFIED];

describe('Test 1: refusalKindOf, latestIsRefusal, carriesJustification', () => {
  it('a version without answerKind is an answer', () => {
    expect(refusalKindOf(version(1))).toBe('answer');
    expect(refusalKindOf(undefined)).toBe('answer');
  });
  it('recognises both kinds of refusal', () => {
    expect(refusalKindOf(version(1, { answerKind: 'refusal_no_claim' }))).toBe('refusal_no_claim');
    expect(refusalKindOf(version(1, { answerKind: 'refusal_with_ground' }))).toBe('refusal_with_ground');
    expect(refusalKindOf(version(1, { answerKind: 'answer' }))).toBe('answer');
  });
  it('no version is no refusal; only the latest version counts', () => {
    expect(latestIsRefusal(question([]))).toBe(false);
    expect(latestIsRefusal(question([version(1, { answerKind: 'refusal_no_claim' })]))).toBe(true);
    expect(latestIsRefusal(question([version(1, { answerKind: 'refusal_no_claim' }), version(2)]))).toBe(false);
  });
  it('a justification on an older version counts', () => {
    expect(carriesJustification(question([]))).toBe(false);
    expect(carriesJustification(question([version(1)]))).toBe(false);
    expect(
      carriesJustification(question([version(1, { answerKind: 'refusal_no_claim', refusalJustification: 'B' }), version(2)])),
    ).toBe(true);
  });
});

describe('Test 2: groundStatus is fail-safe (table of decision 1)', () => {
  const proposed = version(1, { answerKind: 'refusal_with_ground', refusalGroundId: 'g1', refusalGroundHash: 'hash-g1' });
  it('ready, same hash: entry, unverified from legalRef, not changed', () => {
    expect(groundStatus(proposed, GROUNDS, 'ready')).toEqual({ entry: G1, unverified: true, changed: false });
  });
  it('ready, other hash: entry, changed', () => {
    const old = { ...proposed, refusalGroundHash: 'hash-old' };
    expect(groundStatus(old, GROUNDS, 'ready')).toEqual({ entry: G1, unverified: true, changed: true });
  });
  it('ready, entry missing: unverified and changed', () => {
    const gone = { ...proposed, refusalGroundId: 'g9' };
    expect(groundStatus(gone, GROUNDS, 'ready')).toEqual({ unverified: true, changed: true });
    expect('entry' in groundStatus(gone, GROUNDS, 'ready')).toBe(false);
  });
  it('loading or failed: unverified, never changed', () => {
    for (const status of ['loading', 'failed'] as const) {
      const result = groundStatus(proposed, GROUNDS, status);
      expect(result).toEqual({ unverified: true, changed: false });
      expect('entry' in result).toBe(false);
    }
  });
  it('ready with verified: true → not unverified', () => {
    const v = version(1, { answerKind: 'refusal_with_ground', refusalGroundId: 'g3', refusalGroundHash: 'hash-g3' });
    expect(groundStatus(v, GROUNDS, 'ready')).toEqual({ entry: VERIFIED, unverified: false, changed: false });
  });
});

describe('Test 3: buildRefusalProposal', () => {
  const filled: RefusalForm = {
    kind: 'refusal_with_ground',
    groundId: 'g1',
    text: '  Baustein g1.  ',
    justification: '  Offenlegung schadet.  ',
    lastTemplate: 'Baustein g1.',
    fromTemplate: true,
  };
  it('refusal_no_claim never carries refusalGroundId, even with a ground in the state', () => {
    const body = buildRefusalProposal({ ...filled, kind: 'refusal_no_claim' });
    expect(body).toEqual({ answerKind: 'refusal_no_claim', text: 'Baustein g1.', refusalJustification: 'Offenlegung schadet.' });
    expect(body !== undefined && 'refusalGroundId' in body).toBe(false);
  });
  it('refusal_with_ground carries the id; text and justification trimmed', () => {
    expect(buildRefusalProposal(filled)).toEqual({
      answerKind: 'refusal_with_ground',
      text: 'Baustein g1.',
      refusalGroundId: 'g1',
      refusalJustification: 'Offenlegung schadet.',
    });
  });
  it('the marker stands in no field (de and en)', () => {
    const body = JSON.stringify(buildRefusalProposal(filled));
    for (const lang of ['de', 'en'] as const) {
      expect(body).not.toContain(translate(lang, 'answers.refusal.text.marker'));
      expect(body).not.toContain('E15');
    }
  });
  it('no key holds undefined; no kind → nothing to send', () => {
    const body = buildRefusalProposal({ ...filled, kind: 'refusal_no_claim', groundId: undefined });
    expect(Object.values(body ?? {})).not.toContain(undefined);
    expect(buildRefusalProposal(EMPTY_REFUSAL_FORM)).toBeUndefined();
  });
});

describe('Test 4: nextRefusalForm (prefill and fromTemplate, decision 3)', () => {
  const withGround = nextRefusalForm(EMPTY_REFUSAL_FORM, { type: 'kind', kind: 'refusal_with_ground' }, GROUNDS);
  const prefilled = nextRefusalForm(withGround, { type: 'ground', groundId: 'g1' }, GROUNDS);

  it('empty field + ground → template, fromTemplate true', () => {
    expect(prefilled).toMatchObject({ groundId: 'g1', text: 'Baustein g1.', lastTemplate: 'Baustein g1.', fromTemplate: true });
  });
  it('field = previous template + new ground → new template', () => {
    expect(nextRefusalForm(prefilled, { type: 'ground', groundId: 'g2' }, GROUNDS)).toMatchObject({
      groundId: 'g2', text: 'Baustein g2.', lastTemplate: 'Baustein g2.', fromTemplate: true,
    });
  });
  it('typed text + ground → text unchanged', () => {
    const typed = nextRefusalForm(withGround, { type: 'text', text: 'Eigener Wortlaut' }, GROUNDS);
    const next = nextRefusalForm(typed, { type: 'ground', groundId: 'g1' }, GROUNDS);
    expect(next.text).toBe('Eigener Wortlaut');
    expect(next.fromTemplate).toBe(false);
  });
  it('unchanged template + switch to refusal_no_claim → field empty, fromTemplate false', () => {
    const next = nextRefusalForm(prefilled, { type: 'kind', kind: 'refusal_no_claim' }, GROUNDS);
    expect(next).toMatchObject({ kind: 'refusal_no_claim', text: '', fromTemplate: false, groundId: 'g1' });
    expect(next.lastTemplate).toBeUndefined();
  });
  it('edited template + switch to refusal_no_claim → text stays, fromTemplate true', () => {
    const edited = nextRefusalForm(prefilled, { type: 'text', text: 'Baustein g1. Ergänzt' }, GROUNDS);
    const next = nextRefusalForm(edited, { type: 'kind', kind: 'refusal_no_claim' }, GROUNDS);
    expect(next).toMatchObject({ text: 'Baustein g1. Ergänzt', fromTemplate: true });
    expect(showsTemplateMarker(next, GROUNDS, 'ready')).toBe(true);
  });
  it('field emptied → fromTemplate false', () => {
    const emptied = nextRefusalForm(prefilled, { type: 'text', text: '' }, GROUNDS);
    expect(emptied).toMatchObject({ text: '', fromTemplate: false });
    expect(emptied.lastTemplate).toBeUndefined();
  });
  it('switch back with empty field → prefilled again', () => {
    const noClaim = nextRefusalForm(prefilled, { type: 'kind', kind: 'refusal_no_claim' }, GROUNDS);
    const back = nextRefusalForm(noClaim, { type: 'kind', kind: 'refusal_with_ground' }, GROUNDS);
    expect(back).toMatchObject({ kind: 'refusal_with_ground', text: 'Baustein g1.', fromTemplate: true });
  });
  it('the marker follows fromTemplate, a non-blank text and verified === false', () => {
    expect(showsTemplateMarker(prefilled, GROUNDS, 'ready')).toBe(true);
    const verified = nextRefusalForm(withGround, { type: 'ground', groundId: 'g3' }, GROUNDS);
    expect(verified.fromTemplate).toBe(true);
    expect(showsTemplateMarker(verified, GROUNDS, 'ready')).toBe(false);
    expect(showsTemplateMarker(EMPTY_REFUSAL_FORM, GROUNDS, 'ready')).toBe(false);
    // Origin no longer determinable (catalogue not ready): fail-safe "unverified".
    expect(showsTemplateMarker(verified, GROUNDS, 'loading')).toBe(true);
  });
});

describe('Test 5: refusalProblemKey and the length limits in code points', () => {
  it('409 R-GUARD-09 → guard09; 422 → invalid; others undefined', () => {
    expect(refusalProblemKey({ status: 409, ruleId: 'R-GUARD-09' })).toBe('answers.refusal.error.guard09');
    expect(refusalProblemKey({ status: 422 })).toBe('answers.refusal.error.invalid');
    expect(refusalProblemKey({ status: 409, ruleId: 'R-GUARD-11' })).toBeUndefined();
    expect(refusalProblemKey({ status: 412 })).toBeUndefined();
    expect(refusalProblemKey({ status: 403, ruleId: 'R-PERM-01' })).toBeUndefined();
    expect(refusalProblemKey(new Error('net'))).toBeUndefined();
  });
  it('counts code points, not UTF-16 units', () => {
    expect(codePointLength('😀😀')).toBe(2);
  });
  const base: RefusalForm = { ...EMPTY_REFUSAL_FORM, kind: 'refusal_no_claim', text: 'Wortlaut', justification: 'Begründung' };
  it('4000 emoji in the justification allow submitting, 4001 block it', () => {
    expect(JUSTIFICATION_MAX).toBe(4000);
    expect(refusalSubmitBlocked({ ...base, justification: '😀'.repeat(4000) }, 'ready')).toBe(false);
    expect(refusalSubmitBlocked({ ...base, justification: '😀'.repeat(4001) }, 'ready')).toBe(true);
  });
  it('20000 emoji in the wording allow submitting, 20001 block it', () => {
    expect(TEXT_MAX).toBe(20000);
    expect(refusalSubmitBlocked({ ...base, text: '😀'.repeat(20000) }, 'ready')).toBe(false);
    expect(refusalSubmitBlocked({ ...base, text: '😀'.repeat(20001) }, 'ready')).toBe(true);
  });
  it('blocked without kind, without ground or catalogue, without text, without justification', () => {
    expect(refusalSubmitBlocked(EMPTY_REFUSAL_FORM, 'ready')).toBe(true);
    const ground = { ...base, kind: 'refusal_with_ground' as const };
    expect(refusalSubmitBlocked(ground, 'ready')).toBe(true);
    expect(refusalSubmitBlocked({ ...ground, groundId: 'g1' }, 'ready')).toBe(false);
    expect(refusalSubmitBlocked({ ...ground, groundId: 'g1' }, 'failed')).toBe(true);
    expect(refusalSubmitBlocked({ ...ground, groundId: 'g1' }, 'loading')).toBe(true);
    expect(refusalSubmitBlocked({ ...base, text: '   ' }, 'ready')).toBe(true);
    expect(refusalSubmitBlocked({ ...base, justification: '  ' }, 'ready')).toBe(true);
    expect(refusalSubmitBlocked(base, 'failed')).toBe(false);
  });
});

describe('Test 11: onProblem in run (settleProblem, refusalProblemHandler)', () => {
  const setup = (shown = true) => {
    const shownKeys: string[] = [];
    let closed = 0;
    const handler = refusalProblemHandler((key) => shownKeys.push(key), () => { closed += 1; });
    return { handler, shownKeys, closed: () => closed, stillShown: () => shown };
  };
  it('409 R-GUARD-09 and 422 with the dialog → handled, no toast, message in the dialog', () => {
    const s = setup();
    expect(settleProblem({ status: 409, ruleId: 'R-GUARD-09' }, s.handler, s.stillShown)).toBe('handled');
    expect(settleProblem({ status: 422 }, s.handler, s.stillShown)).toBe('handled');
    expect(s.shownKeys).toEqual(['answers.refusal.error.guard09', 'answers.refusal.error.invalid']);
    expect(s.closed()).toBe(0);
  });
  it('412 → stale; the dialog closes only while its question is shown', () => {
    const s = setup(true);
    expect(settleProblem({ status: 412 }, s.handler, s.stillShown)).toBe('stale');
    expect(s.closed()).toBe(1);
    const gone = setup(false);
    expect(settleProblem({ status: 412 }, gone.handler, gone.stillShown)).toBe('stale');
    expect(gone.closed()).toBe(0);
  });
  it('403 and 409 with another rule → toast, the dialog stays open', () => {
    const s = setup();
    expect(settleProblem({ status: 403, ruleId: 'R-PERM-01' }, s.handler, s.stillShown)).toBe('toast');
    expect(settleProblem({ status: 409, ruleId: 'R-GUARD-11' }, s.handler, s.stillShown)).toBe('toast');
    expect(s.closed()).toBe(0);
    expect(s.shownKeys).toEqual([]);
  });
  it('without onProblem: unchanged behaviour', () => {
    expect(settleProblem({ status: 412 }, undefined, () => true)).toBe('stale');
    expect(settleProblem({ status: 409, ruleId: 'R-GUARD-09' }, undefined, () => true)).toBe('toast');
    expect(settleProblem({ status: 422 }, undefined, () => true)).toBe('toast');
  });
});
