/**
 * Scheibe 053, Test 7: the steering detail, rendered statically. Its buttons follow `_actions` exactly (the cases of
 * decision 5 as `_actions` lists), with at most one primary; without a steering right there is no action bar at all
 * (D9). Unit and seat are shown by their names, an unknown seat by its id in mono. A refusal as latest version shows
 * its badge; the justification of a refusal is never rendered here.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnswerVersion, Permission, Question, StageSeat, Unit } from '@hv/domain';
import { translate } from '../../i18n';
import type { TKey } from '../../i18n';
import { SteeringDetail } from './SteeringDetail';

const de = (key: TKey) => translate('de', key);

const UNITS: readonly Unit[] = [
  { id: 'unit-fin', name: 'Finanzen und Controlling', shortName: 'Finanzen' },
  { id: 'unit-ops', name: 'Operations und Technik', shortName: 'Operations' },
  { id: 'unit-ar', name: 'Büro des Aufsichtsrats' },
];
const SEATS: readonly StageSeat[] = [
  { id: 'cfo', label: 'Finanzvorstand', position: 3 },
  { id: 'ceo', label: 'Vorstandsvorsitz', position: 2 },
];

function question(actions: Permission[], over: Partial<Question> = {}): Question {
  return {
    id: 'q-1', number: 'F-0111', contributionId: 'c-1', speakerId: 's-1', speakerDisplayName: 'Aktionärin A',
    text: 'Wie hoch ist die Dividende?', status: 'assigned', answers: [], version: 3,
    createdAt: '2026-06-15T10:00:00.000Z', updatedAt: '2026-06-15T10:00:00.000Z', _actions: actions, ...over,
  };
}

function render(q: Question): string {
  return renderToStaticMarkup(<SteeringDetail question={q} units={UNITS} seats={SEATS} busy={false} onAction={() => undefined} />);
}
/** The text of the element carrying `data-testid` (a static render puts plain text between its tags). */
const textOf = (html: string, testId: string): string | undefined =>
  html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`))?.[1];
const BUTTONS = ['steering-classify', 'steering-assign', 'steering-forward', 'steering-refuse'] as const;
const present = (html: string): string[] => BUTTONS.filter((id) => html.includes(`data-testid="${id}"`));
const buttonTag = (html: string, id: string): string => html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))?.[0] ?? '';
const primaries = (html: string): number => (html.match(/data-primary="true"/g) ?? []).length;

describe('SteeringDetail (Test 7)', () => {
  it('captured: classify only, primary', () => {
    const html = render(question(['question.classify', 'question.read'], { status: 'captured' }));
    expect(present(html)).toEqual(['steering-classify']);
    expect(buttonTag(html, 'steering-classify')).toContain('data-primary="true"');
    expect(primaries(html)).toBe(1);
  });

  it('classified text track: assign primary, classify and refuse beside it', () => {
    const html = render(question(['question.classify', 'question.assign', 'question.refuse.propose', 'question.read'], { status: 'classified' }));
    expect(present(html).sort()).toEqual(['steering-assign', 'steering-classify', 'steering-refuse']);
    expect(buttonTag(html, 'steering-assign')).toContain('data-primary="true"');
    expect(buttonTag(html, 'steering-classify')).not.toContain('data-primary');
    expect(buttonTag(html, 'steering-refuse')).not.toContain('data-primary');
    expect(primaries(html)).toBe(1);
  });

  it('assigned: forward primary, refuse beside it, no assign although allowed', () => {
    const html = render(question(['question.assign', 'question.forward', 'question.refuse.propose', 'question.read']));
    expect(present(html).sort()).toEqual(['steering-forward', 'steering-refuse']);
    expect(buttonTag(html, 'steering-forward')).toContain('data-primary="true"');
    expect(primaries(html)).toBe(1);
  });

  it('approved: refuse only, never primary', () => {
    const html = render(question(['question.refuse.propose', 'question.read'], { status: 'approved' }));
    expect(present(html)).toEqual(['steering-refuse']);
    expect(primaries(html)).toBe(0);
  });

  it('without a steering right there is no action bar at all, not a greyed one', () => {
    const html = render(question(['question.read', 'answer.draft', 'question.approve']));
    expect(present(html)).toEqual([]);
    expect(html).not.toContain('data-testid="steering-actions"');
  });

  it('shows number in mono, unit by its short name and seat by its label', () => {
    const html = render(question(['question.read'], { unitId: 'unit-ops', seatId: 'cfo', stageAssignment: 'cfo', track: 'expert_track' }));
    expect(html).toMatch(/data-testid="steering-detail-number"[^>]*class="[^"]*font-mono[^"]*"|class="[^"]*font-mono[^"]*"[^>]*data-testid="steering-detail-number"/);
    expect(textOf(html, 'steering-detail-number')).toBe('F-0111');
    expect(textOf(html, 'steering-detail-unit')).toBe(UNITS[1]?.shortName);
    expect(textOf(html, 'steering-detail-seat')).toBe(SEATS[0]?.label);
    expect(html).toContain(de('answers.detail.stageAssignment'));
    expect(html).toContain('Aktionärin A');
    expect(html).toContain('Wie hoch ist die Dividende?');
  });

  it('a unit without short name shows its name; no unit and no seat say "keine"', () => {
    const named = render(question(['question.read'], { unitId: 'unit-ar' }));
    expect(textOf(named, 'steering-detail-unit')).toBe(UNITS[2]?.name);
    const none = render(question(['question.read']));
    expect(textOf(none, 'steering-detail-unit')).toBe(de('common.none'));
    expect(textOf(none, 'steering-detail-seat')).toBe(de('common.none'));
  });

  it('an unknown seat shows its id in mono', () => {
    const html = render(question(['question.read'], { seatId: 'seat-z' }));
    const seat = html.match(/<[^>]*data-testid="steering-detail-seat"[^>]*>([^<]*)</);
    expect(seat?.[1]).toBe('seat-z');
    expect(seat?.[0]).toContain('font-mono');
  });

  it('shows the return reason when set', () => {
    const html = render(question(['question.read'], { returnReason: 'Bitte präzisieren' }));
    expect(html).toContain(de('answers.detail.returned'));
    expect(html).toContain('Bitte präzisieren');
  });

  it('a refusal as latest version shows its badge; the justification is never rendered', () => {
    const refusal: AnswerVersion = {
      version: 1, text: 'Wortlaut der Verweigerung', createdAt: '2026-06-15T10:00:00.000Z',
      createdBy: { id: 'u-coord-1', role: 'coordination' }, answerKind: 'refusal_no_claim',
      refusalJustification: 'Interne Begründung 053',
    } as AnswerVersion;
    const html = render(question(['question.read'], { status: 'in_review', answers: [refusal] }));
    expect(html).toContain(de('answers.refusal.badge'));
    expect(html).not.toContain('Interne Begründung 053');
    expect(html).not.toContain('Wortlaut der Verweigerung');
    const plain = render(question(['question.read']));
    expect(plain).not.toContain(de('answers.refusal.badge'));
  });
});
