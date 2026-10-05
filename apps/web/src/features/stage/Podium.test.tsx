/**
 * takt-039 (Tests zuerst, 2): "Vorgelesen, weiter" is locked exactly by the rule of `lib.ts` (`nextButton`), and its
 * click hands the question it was drawn with to `onNext`. Rendered statically, like `speakers/RoundSection.test.tsx`;
 * the click itself is not simulated, the hand-over is checked through `nextPress`, which the button calls.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { AnswerVersion, Permission, Question, RefusalGround } from '@hv/domain';
import { translate } from '../../i18n';
import type { TKey, TParams } from '../../i18n';
import { AnswerText } from '../../components';
import { Podium, PreviewAnswer, nextPress } from './Podium';
import type { DeliverLock } from './lib';

function staged(id: string, version: number, actions: Permission[]): Question {
  return {
    id, number: `F-${id}`, contributionId: 'c-1', speakerId: 's-1', text: id, status: 'staged',
    answers: [], version, createdAt: '2026-09-30T10:00:00.000Z', updatedAt: '2026-09-30T10:00:00.000Z',
    _actions: actions,
  };
}
const q = staged('q1', 4, ['question.deliver', 'question.return']);

function render(lock: DeliverLock | null, returning = false, current: Question = q): string {
  return renderToStaticMarkup(
    <Podium
      stage={{ current, queue: [], deliveredCount: 0, openCount: 0 }}
      lock={lock}
      returning={returning}
      onNext={() => true}
      onReturn={() => undefined}
    />,
  );
}
const nextTag = (html: string): string | undefined =>
  html.match(/<button[^>]*data-testid="stage-next"[^>]*>/)?.[0];

describe('Podium "Vorgelesen, weiter" (takt-039)', () => {
  it('is locked with aria-disabled while the rule locks it: a lock on the drawn question and version', () => {
    expect(nextTag(render({ id: 'q1', version: 4 }))).toContain('aria-disabled="true"');
  });

  it('is locked while a return is written', () => {
    expect(nextTag(render(null, true))).toContain('aria-disabled="true"');
  });

  it('is free without a lock, and with a lock that no longer holds (another version)', () => {
    expect(nextTag(render(null))).not.toContain('aria-disabled="true"');
    expect(nextTag(render({ id: 'q1', version: 3 }))).not.toContain('aria-disabled="true"');
  });

  it('is not drawn without question.deliver in _actions', () => {
    expect(nextTag(render(null, false, staged('q1', 4, ['question.return'])))).toBeUndefined();
  });

  it('hands the drawn question to onNext and reports a started write', () => {
    const seen: Question[] = [];
    let started = 0;
    nextPress(q, (question) => { seen.push(question); return true; }, () => { started += 1; })();
    expect(seen).toEqual([q]);
    expect(seen[0]).toBe(q);
    expect(started).toBe(1);
  });

  it('leaves no focus marker when the press wrote nothing (slice 010c, Ziel 6: N3)', () => {
    let started = 0;
    nextPress(q, () => false, () => { started += 1; })();
    expect(started).toBe(0);
  });
});

/**
 * Scheibe 045, Test 7: a refusal on the podium carries one marker per kind, the ground with "ungeprüft",
 * and the wording that is read out; the justification is never rendered — `Podium.tsx` does not read the
 * field at all, even if an object carried it.
 */
describe('Podium with a refusal (Scheibe 045, Test 7)', () => {
  const JUSTIFICATION_MARKER = 'interne begruendung fuenfundvierzig';
  const WORDING = 'Zu dieser Frage gibt der Vorstand keine Auskunft.';
  const at = '2027-04-20T10:00:00.000Z';
  const G1 = {
    id: 'g1', title: 'Titel g1', stageText: 'Baustein.',
    legalRef: { source: 'AktG', citation: 'Zitat', docVersion: '1', docHash: null, verified: false }, hash: 'h-g1',
  } as RefusalGround;
  const de = (key: TKey, params?: TParams) => translate('de', key, params);

  function withAnswer(answer: Partial<AnswerVersion>): Question {
    return {
      ...staged('q1', 4, ['question.deliver', 'question.return']),
      answers: [{ version: 1, text: WORDING, createdAt: at, createdBy: { id: 'u', role: 'legal' }, ...answer }],
      approval: { answerVersion: 1, approvedAt: at, approvedBy: { id: 'u-appr-1', role: 'approver' } },
    };
  }
  const renderWith = (current: Question): string =>
    renderToStaticMarkup(
      <Podium
        stage={{ current, queue: [], deliveredCount: 0, openCount: 0 }}
        catalogue={{ status: 'ready', grounds: [G1] }}
        lock={null}
        returning={false}
        onNext={() => true}
        onReturn={() => undefined}
      />,
    );

  it('refusal_no_claim: marker "Kein Auskunftsanspruch" and the wording', () => {
    const html = renderWith(withAnswer({ answerKind: 'refusal_no_claim' }));
    expect(html).toContain(de('stage.refusal.marker.noClaim'));
    expect(html).not.toContain(de('stage.refusal.marker.withGround'));
    expect(html).toContain(WORDING);
  });

  it('refusal_with_ground: marker "Auskunft wird verweigert" with the ground and "ungeprüft"', () => {
    const html = renderWith(withAnswer({ answerKind: 'refusal_with_ground', refusalGroundId: 'g1', refusalGroundHash: 'h-g1' }));
    expect(html).toContain(de('stage.refusal.marker.withGround'));
    expect(html).toContain(de('stage.refusal.ground', { title: 'Titel g1' }));
    expect(html).toContain(de('answers.refusal.ground.unverified'));
  });

  it('a record with refusalJustification does not render the justification', () => {
    const html = renderWith(withAnswer({ answerKind: 'refusal_no_claim', refusalJustification: JUSTIFICATION_MARKER }));
    expect(html).not.toContain(JUSTIFICATION_MARKER);
    expect(readFileSync(new URL('./Podium.tsx', import.meta.url).pathname, 'utf8')).not.toContain('refusalJustification');
  });

  it('an ordinary answer carries no marker', () => {
    const html = renderWith(withAnswer({}));
    expect(html).not.toContain(de('stage.refusal.marker.noClaim'));
    expect(html).not.toContain(de('stage.refusal.marker.withGround'));
  });
});

/**
 * Scheibe 055b, Tests 6 and 10: the podium shows the approved version through the one renderer (`AnswerText`) — the
 * same markup the Beantwortung, the focus view and the history show for that version (Recht/Freigabe). Both places
 * are `<div>` now (a `<p>` may not hold blocks) with their test ids, classes and `data-prepared`.
 */
describe('Podium with a formatted answer (Scheibe 055b, Tests 6 and 10)', () => {
  const at = '2027-04-20T10:00:00.000Z';
  const FORMATTED: AnswerVersion = {
    version: 1, text: 'Die Dividende steigt.\n\neins\nzwei', createdAt: at, createdBy: { id: 'u', role: 'expert' },
    body: {
      language: 'de',
      blocks: [
        { type: 'paragraph', content: [{ text: 'Die ' }, { text: 'Dividende', marks: ['bold'] }, { text: ' steigt.' }] },
        { type: 'list', items: [[{ text: 'eins', marks: ['highlight'] }], [{ text: 'zwei' }]] },
      ],
    },
  };
  const approved: Question = {
    ...staged('q1', 4, ['question.deliver']),
    answers: [FORMATTED],
    approval: { answerVersion: 1, approvedAt: at, approvedBy: { id: 'u-appr-1', role: 'approver' } },
  };
  const answerPart = (html: string): string | undefined =>
    html.match(/<div[^>]*data-answer-text="true"[^>]*>([\s\S]*?)<\/div>/)?.[1]; // i18n-ok: expected markup in a test, not a rendered text

  it('stage-answer is a div with data-prepared, holding strong, mark and the list of the approved version', () => {
    const html = render(null, false, approved);
    const tag = html.match(/<(\w+)[^>]*data-testid="stage-answer"[^>]*>/);
    expect(tag?.[1]).toBe('div');
    expect(tag?.[0]).toContain('data-prepared="true"');
    expect(tag?.[0]).toContain('text-[24px]');
    expect(html).toContain('<strong>Dividende</strong>'); // i18n-ok: expected markup in a test, not a rendered text
    expect(html).toMatch(/<mark style="[^"]*">eins<\/mark>/); // i18n-ok: expected markup in a test, not a rendered text
    expect(html).toMatch(/<div[^>]*data-answer-text="true"[^>]*lang="de"|<div[^>]*lang="de"[^>]*data-answer-text="true"/);
  });

  it('Test 6: the same renderer markup as AnswerText for this version', () => {
    const own = answerPart(renderToStaticMarkup(<AnswerText answer={FORMATTED} />));
    expect(own).toBeDefined();
    expect(answerPart(render(null, false, approved))).toBe(own);
    expect(answerPart(renderToStaticMarkup(<PreviewAnswer question={approved} />))).toBe(own);
  });

  it('stage-preview-answer is a div with its classes, holding the renderer', () => {
    const html = renderToStaticMarkup(<PreviewAnswer question={approved} />);
    const tag = html.match(/<(\w+)[^>]*data-testid="stage-preview-answer"[^>]*>/);
    expect(tag?.[1]).toBe('div');
    expect(tag?.[0]).toContain('text-[18px]');
    expect(html).toContain('<strong>Dividende</strong>'); // i18n-ok: expected markup in a test, not a rendered text
  });

  it('without an approved version: the placeholder as a paragraph, data-prepared false, no renderer', () => {
    const html = render(null, false, { ...approved, approval: undefined } as unknown as Question);
    const tag = html.match(/<(\w+)[^>]*data-testid="stage-answer"[^>]*>/);
    expect(tag?.[1]).toBe('div');
    expect(tag?.[0]).toContain('data-prepared="false"');
    expect(html).toMatch(new RegExp(`data-testid="stage-answer"[^>]*><p[^>]*>${translate('de', 'stage.answer.none')}</p>`));
    expect(html).not.toContain('data-answer-text');
    const preview = renderToStaticMarkup(<PreviewAnswer question={{ ...approved, approval: undefined } as unknown as Question} />);
    expect(preview).toMatch(new RegExp(`data-testid="stage-preview-answer"[^>]*><p[^>]*>${translate('de', 'stage.answer.none')}</p>`));
  });
});
