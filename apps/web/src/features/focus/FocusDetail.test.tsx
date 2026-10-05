/**
 * Scheibe 054, Test 6: the detail of one of "Meine Fragen", rendered statically. Its buttons follow `focusActions`
 * exactly, with one primary; the return reason (a note) stands before the wording; the last forward names units by their
 * short names and the reason by its label; a refusal's justification is never rendered; with unsaved text the
 * hand-overs are absent; the Wortmeldung stands as the core delivers it.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnswerVersion, DomainEvent, Permission, Question, Unit } from '@hv/domain';
import { translate } from '../../i18n';
import type { TKey } from '../../i18n';
import { AnswerText } from '../../components';
import { FocusDetail } from './FocusDetail';

const de = (key: TKey, params?: Record<string, string | number>) => translate('de', key, params);

const UNITS: readonly Unit[] = [
  { id: 'unit-fin', name: 'Finanzen und Controlling', shortName: 'Finanzen' },
  { id: 'unit-ops', name: 'Operations und Technik', shortName: 'Operations' },
];

function question(actions: Permission[], over: Partial<Question> = {}): Question {
  return {
    id: 'q-1', number: 'F-0111', contributionId: 'c-1', speakerId: 's-1', speakerDisplayName: 'Redner 15',
    text: 'Wie hoch ist die Dividende?', status: 'assigned', unitId: 'unit-fin', answers: [], version: 3,
    createdAt: '2026-06-15T10:00:00.000Z', updatedAt: '2026-06-15T10:00:00.000Z', _actions: actions, ...over,
  };
}

function render(q: Question, opts: { dirty?: boolean; history?: readonly DomainEvent[] } = {}): string {
  return renderToStaticMarkup(
    <FocusDetail question={q} units={UNITS} history={opts.history ?? []} dirty={opts.dirty ?? false} busy={false} onAction={() => undefined} />,
  );
}

const BUTTONS = ['focus-write', 'focus-submit', 'focus-forward', 'focus-save'] as const;
const present = (html: string): string[] => BUTTONS.filter((id) => html.includes(`data-testid="${id}"`));
const buttonTag = (html: string, id: string): string => html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))?.[0] ?? '';
const primaries = (html: string): number => (html.match(/data-primary="true"/g) ?? []).length;
const EXPERT: Permission[] = ['answer.draft', 'question.submit_review', 'question.forward', 'question.claim', 'question.read', 'history.read'];

describe('FocusDetail (Test 6)', () => {
  it('assigned (draft, forward): write primary, forward secondary', () => {
    const html = render(question(['answer.draft', 'question.forward', 'question.read']));
    expect(present(html).sort()).toEqual(['focus-forward', 'focus-write']);
    expect(buttonTag(html, 'focus-write')).toContain('data-primary="true"');
    expect(buttonTag(html, 'focus-forward')).not.toContain('data-primary');
    expect(primaries(html)).toBe(1);
    expect(html).toContain(de('focus.write.open'));
    expect(html).toContain(de('action.question.forward'));
  });

  it('answer_drafted (draft, submit, forward): Weiterleiten primary', () => {
    const html = render(question(EXPERT, { status: 'answer_drafted', answers: [version(1)] }));
    expect(present(html).sort()).toEqual(['focus-forward', 'focus-submit', 'focus-write']);
    expect(buttonTag(html, 'focus-submit')).toContain('data-primary="true"');
    expect(html).toMatch(new RegExp(`data-testid="focus-submit"[^>]*>${de('action.question.submit_review')}</button>`));
    expect(primaries(html)).toBe(1);
  });

  it('without any of the rights there is no action bar at all (D9)', () => {
    const html = render(question(['question.read', 'question.refuse.propose', 'question.claim']));
    expect(present(html)).toEqual([]);
    expect(html).not.toContain('data-testid="focus-actions"');
  });

  it('with unsaved text: the notice, "Entwurf fortsetzen", neither focus-submit nor focus-forward', () => {
    const html = render(question(EXPERT, { status: 'answer_drafted', answers: [version(1)] }), { dirty: true });
    expect(html).toContain('data-testid="focus-draft-unsaved"');
    expect(present(html)).toEqual(['focus-write']);
    expect(html).toContain(de('focus.write.continue'));
  });

  it('the return reason as a note before the wording', () => {
    const html = render(question(EXPERT, { status: 'answer_drafted', returnReason: 'Bitte die Zahl prüfen', answers: [version(1)] }));
    expect(html).toMatch(/<p[^>]*role="note"[^>]*data-testid="focus-returned"[^>]*>.*Bitte die Zahl prüfen/);
    expect(html.indexOf('data-testid="focus-returned"')).toBeLessThan(html.indexOf('data-testid="focus-detail-text"'));
  });

  it('the last forward into the unit with short names and the reason label; none without the event', () => {
    const forwarded = { type: 'QuestionForwarded', subjectId: 'q-1', payload: { unitId: 'unit-fin', fromUnitId: 'unit-ops', reasonCode: 'capacity' } } as unknown as DomainEvent;
    const html = render(question(EXPERT), { history: [forwarded] });
    expect(html).toContain('data-testid="focus-forwarded"');
    expect(html).toContain(de('focus.forwarded', { from: 'Operations', reason: de('history.forward.reason.capacity') }));
    expect(render(question(EXPERT))).not.toContain('data-testid="focus-forwarded"');
    const noFrom = { type: 'QuestionForwarded', subjectId: 'q-1', payload: { unitId: 'unit-fin', reasonCode: 'other' } } as unknown as DomainEvent;
    expect(render(question(EXPERT), { history: [noFrom] })).toContain(de('focus.forwarded', { from: de('common.none'), reason: de('history.forward.reason.other') }));
  });

  it('a refusal as latest version: badge and wording, never the justification', () => {
    const refusal = version(1, { answerKind: 'refusal_with_ground', text: 'Wortlaut der Verweigerung', refusalJustification: 'GEHEIME BEGRÜNDUNG 054' });
    const html = render(question(EXPERT, { status: 'answer_drafted', answers: [refusal] }));
    expect(html).toContain('Wortlaut der Verweigerung');
    expect(html).toContain(de('answers.refusal.badge'));
    expect(html).not.toContain('GEHEIME BEGRÜNDUNG 054');
  });

  it('latest version with reading time; none without a version; the Wortmeldung as delivered', () => {
    const html = render(question(EXPERT, { status: 'answer_drafted', answers: [version(1)] }));
    expect(html).toMatch(/data-testid="focus-reading-time"[^>]*data-seconds="\d+"/);
    expect(html).toContain('Redner 15');
    const none = render(question(EXPERT));
    expect(none).toContain(de('focus.latest.none'));
    const unitName = UNITS[0]!.shortName ?? '';
    expect(none).toMatch(new RegExp(`data-testid="focus-detail-unit"[^>]*>${unitName}<`));
  });
});

function version(n: number, over: Partial<AnswerVersion> = {}): AnswerVersion {
  return { version: n, text: `Antwort ${n}`, createdAt: '2026-06-15T10:05:00.000Z', createdBy: { id: 'u-1', role: 'expert' }, ...over };
}

/** Scheibe 055b, Test 6: `focus-latest` shows the latest version through the one renderer, as the podium does. */
describe('FocusDetail with a formatted answer (Scheibe 055b, Test 6)', () => {
  const FORMATTED = version(1, {
    text: 'Die Dividende steigt.\n\neins\nzwei',
    body: {
      language: 'de',
      blocks: [
        { type: 'paragraph', content: [{ text: 'Die ' }, { text: 'Dividende', marks: ['bold'] }, { text: ' steigt.' }] },
        { type: 'list', items: [[{ text: 'eins', marks: ['highlight'] }], [{ text: 'zwei' }]] },
      ],
    },
  });
  const answerPart = (html: string): string | undefined =>
    html.match(/<div[^>]*data-answer-text="true"[^>]*>([\s\S]*?)<\/div>/)?.[1]; // i18n-ok: expected markup in a test, not a rendered text

  it('the same renderer markup as AnswerText; lang de; the reading time stays on the text', () => {
    const html = render(question(EXPERT, { status: 'answer_drafted', answers: [FORMATTED] }));
    const latest = html.slice(html.indexOf('data-testid="focus-latest"'));
    expect(answerPart(latest)).toBe(answerPart(renderToStaticMarkup(<AnswerText answer={FORMATTED} />)));
    expect(latest).toContain('lang="de"');
    expect(latest).toContain('<strong>Dividende</strong>'); // i18n-ok: expected markup in a test, not a rendered text
    expect(latest).toMatch(/data-testid="focus-reading-time"[^>]*data-seconds="3"/);
  });
});
