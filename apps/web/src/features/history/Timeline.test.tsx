/**
 * Scheibe 040a, Test 13: an event of a role-managing role carries the "Administration" badge in both
 * readings of the log (timeline and stream table), with visible text and an accessible name; other
 * events carry none (Rechtekonzept §4: administrative actions are highlighted in the history). The
 * administrative role is taken from the rights data, not named (AGENTS.md R4).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnswerDrafted, DomainEvent, QuestionReturned, Role } from '@hv/domain';
import { ROLE_PERMISSIONS } from '@hv/domain';
import { setLang, translate } from '../../i18n';
import type { Lang } from '../../i18n';
import { EventStream, Timeline } from './Timeline';
import type { SummaryContext } from './eventSummary';

const roles = Object.keys(ROLE_PERMISSIONS) as Role[];
const managing = roles.find((role) => ROLE_PERMISSIONS[role].includes('admin.roles.manage'))!;
const drafting = roles.find((role) => ROLE_PERMISSIONS[role].includes('question.legal.clear'))!;

const drafted: AnswerDrafted = {
  seq: 1, id: 'event-draft', type: 'AnswerDrafted', at: '2027-04-20T10:00:00.000Z',
  actor: { id: 'leg-1', role: drafting }, subjectId: 'q-1',
  payload: { answer: { version: 1, text: 'Entwurf.', createdAt: '2027-04-20T10:00:00.000Z', createdBy: { id: 'leg-1', role: drafting } } },
};
const returned: QuestionReturned = {
  seq: 2, id: 'event-return', type: 'QuestionReturned', at: '2027-04-20T10:05:00.000Z',
  actor: { id: 'adm-1', role: managing }, subjectId: 'q-1',
  payload: { reason: 'Bitte prüfen.', fromStatus: 'in_review', toStatus: 'answer_drafted' },
};
const events: DomainEvent[] = [drafted, returned];

const context: SummaryContext = {
  unitNames: new Map(), agendaNumbers: new Map(), questionNumbers: new Map([['q-1', 'F-0001']]), speakerNames: new Map(),
};

const badges = (html: string): string[] =>
  [...html.matchAll(/<span[^>]*data-testid="history-admin-badge"[^>]*>(.*?)<\/span>/g)].map((m) => m[0]);

/** The event row (li in the timeline, div in the table) that holds the badge. */
const rowOf = (html: string, eventId: string): string => {
  const rows = html.split('data-testid="history-event"');
  return rows.find((row) => row.includes(eventId)) ?? '';
};

afterEach(() => setLang('de'));

describe.each(['de', 'en'] as Lang[])('history badge "Administration" (%s)', (lang) => {
  const text = translate(lang, 'history.actor.administrative');
  const label = translate(lang, 'history.actor.administrative.label');

  const renderings: [string, () => string][] = [
    ['timeline', () => renderToStaticMarkup(<Timeline events={events} context={context} label={translate(lang, 'history.timeline.title')} />)],
    ['stream table', () => renderToStaticMarkup(<EventStream events={events} context={context} curve={[0, 1]} />)],
  ];

  for (const [name, render] of renderings) {
    it(`${name}: exactly one badge, on the administrative event, with text and accessible name`, () => {
      setLang(lang);
      const html = render();
      const found = badges(html);
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(`>${text}</span>`);
      expect(found[0]).toContain(`aria-label=${JSON.stringify(label)}`);
      // The badge sits in the row of the returning event, not in the drafting one.
      expect(rowOf(html, 'QuestionReturned')).toContain('history-admin-badge');
      expect(rowOf(html, 'AnswerDrafted')).not.toContain('history-admin-badge');
    });
  }

  it('the two languages carry their own text', () => {
    expect(text.length).toBeGreaterThan(0);
    expect(label).not.toBe(translate(lang === 'de' ? 'en' : 'de', 'history.actor.administrative.label'));
  });
});
