/**
 * Scheibe 045, Test 9: the refusal in the answer detail, rendered statically. "Verweigerung freigeben"
 * takes the place of "Freigeben" as the primary action; "Verweigerung vorschlagen" is never primary;
 * the justification (Begründung) is rendered only where the record carries it — the interface asks no
 * right and no role for it (044a §6).
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import type { AnswerVersion, Permission, Question, RefusalGround } from '@hv/domain';
import { translate } from '../../i18n';
import type { TKey, TParams } from '../../i18n';
import { QuestionDetail } from './QuestionDetail';

const de = (key: TKey, params?: TParams) => translate('de', key, params);
const at = '2027-04-20T10:00:00.000Z';
const JUSTIFICATION_MARKER = 'interne begruendung fuenfundvierzig';

const G1 = {
  id: 'g1', title: 'Titel g1', stageText: 'Baustein g1.',
  legalRef: { source: 'AktG', citation: 'Zitat', docVersion: '1', docHash: null, verified: false }, hash: 'h-g1',
} as RefusalGround;

function refusal(extra: Partial<AnswerVersion> = {}): AnswerVersion {
  return {
    version: 1, text: 'Zu dieser Frage gibt der Vorstand keine Auskunft.', createdAt: at,
    createdBy: { id: 'u-legal-1', role: 'legal' },
    answerKind: 'refusal_with_ground', refusalGroundId: 'g1', refusalGroundHash: 'h-g1', ...extra,
  };
}

function noGround({ refusalGroundId: _id, refusalGroundHash: _hash, ...rest }: AnswerVersion): AnswerVersion {
  return rest;
}

function q(actions: Permission[], answers: AnswerVersion[]): Question {
  return {
    id: 'q1', number: 'F-0001', contributionId: 'c1', speakerId: 's1', text: 'Frage?', status: 'in_review',
    track: 'expert_track', answers, version: 3, createdAt: at, updatedAt: at, _actions: actions,
  };
}

function render(question: Question): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <QuestionDetail
        question={question}
        history={[]}
        historyForbidden={false}
        units={[]}
        busy={false}
        draftResetToken={0}
        versionFocus={{ token: 0, version: 0 }}
        catalogue={{ status: 'ready', grounds: [G1] }}
        onAction={() => undefined}
      />
    </MemoryRouter>,
  );
}
const buttonTag = (html: string, testId: string): string =>
  html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? '';
const isPrimary = (tag: string): boolean => /bg-accent-600/.test(tag);

describe('QuestionDetail with a refusal (Test 9)', () => {
  it('with question.refuse.approve the primary action is approving the refusal', () => {
    const html = render(q(['question.refuse.approve', 'question.return', 'question.read'], [refusal()]));
    const approve = buttonTag(html, 'answer-refuse-approve');
    expect(approve).not.toBe('');
    expect(isPrimary(approve)).toBe(true);
    expect(html).toContain(de('answers.refusal.approve.label', { version: 1 }));
    expect(buttonTag(html, 'answer-approve')).toBe('');
  });

  it('"Verweigerung vorschlagen" is never primary', () => {
    for (const actions of [
      ['question.refuse.propose'],
      ['question.refuse.propose', 'answer.draft'],
      ['question.refuse.propose', 'question.assign', 'question.return'],
    ] as Permission[][]) {
      const tag = buttonTag(render(q(actions, [])), 'answer-refuse');
      expect(tag).not.toBe('');
      expect(isPrimary(tag)).toBe(false);
    }
  });

  it('no offer without question.refuse.propose in _actions', () => {
    expect(buttonTag(render(q(['answer.draft', 'question.read'], [])), 'answer-refuse')).toBe('');
  });

  it('the version card names the kind, the ground and "ungeprüft"; the justification only when it is in the record', () => {
    const without = render(q(['question.read'], [refusal()]));
    expect(without).toContain(de('answers.refusal.kind.withGround'));
    expect(without).toContain('Titel g1');
    expect(without).toContain(de('answers.refusal.ground.unverified'));
    expect(without).not.toContain(de('answers.refusal.justification.label'));
    expect(without).not.toContain(JUSTIFICATION_MARKER);

    const withJustification = render(q(['question.read'], [refusal({ refusalJustification: JUSTIFICATION_MARKER })]));
    expect(withJustification).toContain(de('answers.refusal.justification.label'));
    expect(withJustification).toContain(JUSTIFICATION_MARKER);
  });

  it('a changed ground on the latest version is named', () => {
    const html = render(q(['question.read'], [refusal({ refusalGroundHash: 'h-old' })]));
    expect(html).toContain(de('answers.refusal.ground.changed'));
  });

  it('an ordinary answer carries no refusal badge', () => {
    const html = render(q(['question.read'], [{ version: 1, text: 'Antwort.', createdAt: at, createdBy: { id: 'u', role: 'expert' } }]));
    expect(html).not.toContain(de('answers.refusal.kind.withGround'));
    expect(html).not.toContain(de('answers.refusal.kind.noClaim'));
  });

  it('the editor over a refusal carries the hint', () => {
    const html = render(q(['answer.draft', 'question.read'], [{ ...noGround(refusal()), answerKind: 'refusal_no_claim' }]));
    expect(html).toContain('data-testid="answer-editor"');
    expect(html).toContain(de('answers.refusal.editorHint'));
    const plain = render(q(['answer.draft', 'question.read'], []));
    expect(plain).not.toContain(de('answers.refusal.editorHint'));
  });
});
