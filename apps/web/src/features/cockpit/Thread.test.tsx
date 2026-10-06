/**
 * Scheibe 061 (part B), W6: the thread (Faden) of one question, horizontal under the list. Entries in time order with
 * HH:MM (Europe/Berlin), the current one with "seit n min" and "aktuell" in its name, three shapes (filled, ring,
 * hollow), a break after eight entries, no actor and no return reason.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StatusTrailEntry } from '../../api/cockpit';
import { Thread } from './Thread';
import { UNITS } from './fixtures';
import { threadEntries } from './lib';

const ASOF = '2026-06-15T13:42:00.000Z';
const TRAIL: StatusTrailEntry[] = [
  { status: 'captured', at: '2026-06-15T12:53:00.000Z' },
  { status: 'classified', at: '2026-06-15T12:58:00.000Z' },
  { status: 'assigned', at: '2026-06-15T13:02:00.000Z' },
  { status: 'in_review', at: '2026-06-15T13:18:00.000Z' },
];

const tags = (html: string, testId: string): string[] =>
  [...html.matchAll(new RegExp(`<(\\w+)[^>]*data-testid="${testId}"[^>]*>`, 'g'))].map((match) => match[0]);
const attr = (tag: string, name: string): string | undefined => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const text = (markup: string): string => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function render(trail: StatusTrailEntry[] | null, current: StatusTrailEntry['status'] = 'in_review'): string {
  return renderToStaticMarkup(
    <Thread
      read={{ status: 'ready', id: 'q-141', number: 'F-0141', text: 'Wie hoch war die Ausschüttungsquote?', unitId: 'unit-fin', stageAssignment: 'cfo', entries: threadEntries(trail, current, ASOF) }}
      units={UNITS}
      onClose={() => undefined}
    />,
  );
}

describe('W6 thread', () => {
  it('a horizontal line: entries in time order with HH:MM, then the stations not reached', () => {
    const html = render(TRAIL);
    const entries = tags(html, 'cockpit-thread-entry');
    expect(entries.map((entry) => [attr(entry, 'data-status'), attr(entry, 'data-state')])).toEqual([
      ['captured', 'past'], ['classified', 'past'], ['assigned', 'past'], ['in_review', 'current'],
      ['approved', 'future'], ['staged', 'future'], ['delivered', 'future'],
    ]);
    const all = text(html);
    // Europe/Berlin in June is UTC+2.
    for (const time of ['14:53', '14:58', '15:02', '15:18']) expect(all).toContain(time);
    expect(all).toContain('seit 24 min');
    expect(all).toContain('Faden F-0141');
    expect(all).toContain('Ausschüttungsquote');
    expect(all).toContain('Finanzen');
    expect(all).toContain('Bühne: Finanzvorstand');
    // "seit …" stands on its own line in grey mono, never truncated with the time (design major 3, 15).
    const since = tags(html, 'cockpit-thread-since');
    expect(since).toHaveLength(1);
    expect(attr(since[0] ?? '', 'class')).toContain('text-ink-600');
    expect(attr(since[0] ?? '', 'class')).not.toContain('truncate');
    expect(html).not.toContain('text-accent-700');
    // Horizontal: one ordered row per eight entries.
    expect(tags(html, 'cockpit-thread-row')).toHaveLength(1);
  });

  it('three shapes: filled grey 600 (past), ring accent 500 (current, named "aktuell"), hollow grey 300 (future)', () => {
    const html = render(TRAIL);
    const marks = tags(html, 'cockpit-thread-mark');
    const shapes = marks.map((mark) => attr(mark, 'data-shape'));
    expect(shapes).toEqual(['filled', 'filled', 'filled', 'ring', 'hollow', 'hollow', 'hollow']);
    expect(attr(marks[0] ?? '', 'class')).toContain('bg-ink-600');
    expect(attr(marks[3] ?? '', 'class')).toContain('border-accent-500');
    expect(attr(marks[4] ?? '', 'class')).toContain('border-ink-300');
    const current = tags(html, 'cockpit-thread-entry')[3] ?? '';
    expect(attr(current, 'aria-current')).toBe('step');
    expect(attr(current, 'aria-label')).toBe('im Legal Clearing, aktuell, seit 24 min');
  });

  it('breaks after eight entries (returns are entries of their own)', () => {
    const long: StatusTrailEntry[] = [
      ...TRAIL,
      { status: 'answer_drafted', at: '2026-06-15T13:20:00.000Z' },
      { status: 'in_review', at: '2026-06-15T13:25:00.000Z' },
      { status: 'answer_drafted', at: '2026-06-15T13:30:00.000Z' },
      { status: 'in_review', at: '2026-06-15T13:35:00.000Z' },
      { status: 'answer_drafted', at: '2026-06-15T13:40:00.000Z' },
    ];
    const html = render(long, 'answer_drafted');
    expect(tags(html, 'cockpit-thread-entry')).toHaveLength(9 + 4);
    expect(tags(html, 'cockpit-thread-row')).toHaveLength(2);
  });

  it('without history only the current station; no actor, no reason', () => {
    const html = render(null, 'assigned');
    expect(tags(html, 'cockpit-thread-entry').map((entry) => attr(entry, 'data-state'))).toEqual(['current']);
    expect(html).not.toMatch(/\bu-[a-z]+/);
    expect(html).not.toMatch(/Grund|reason/i);
  });
});
