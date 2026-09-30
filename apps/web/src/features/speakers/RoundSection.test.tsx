/**
 * takt-032 (Ziel 2): while a reorder of a round is in flight the round says so (`data-busy`,
 * `aria-busy`) and its row actions are locked. Rendered statically, like `app/LoginPage.test.tsx`.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import type { Speaker } from '@hv/domain';
import { RoundSection } from './RoundSection';

function row(id: string, position: number, status: Speaker['status']): Speaker {
  return {
    id, number: position, displayName: id, round: 1, position, status, questionCount: 0, version: 1,
    _actions: ['speaker.update', 'speaker.reorder'],
  };
}
const speakers = [row('a', 1, 'waiting'), row('b', 2, 'speaking'), row('c', 3, 'waiting')];
const actions = { onCall: () => undefined, onFinish: () => undefined, onWithdraw: () => undefined, onMove: () => undefined };

function render(busy: boolean): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <RoundSection
        round={1} speakers={speakers} open current busyId={null} busy={busy} onToggle={() => undefined}
        actions={actions}
      />
    </MemoryRouter>,
  );
}

/** The opening tags of every button with the given test id. */
function buttons(html: string, testId: string): string[] {
  return [...html.matchAll(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>`, 'g'))].map((m) => m[0]);
}

describe('RoundSection busy', () => {
  it('marks the round and locks every row action while busy', () => {
    const html = render(true);
    expect(html).toMatch(/<section[^>]*data-testid="speakers-round-1"[^>]*>/);
    const section = html.match(/<section[^>]*>/)![0];
    expect(section).toContain('data-busy="true"');
    expect(section).toContain('aria-busy="true"');
    for (const id of ['speaker-call', 'speaker-finish', 'speaker-move', 'speaker-withdraw']) {
      const found = buttons(html, id);
      expect(found.length, id).toBeGreaterThan(0);
      for (const tag of found) expect(tag, id).toContain('disabled=""');
    }
  });

  it('locks dragging while busy', () => {
    const handles = buttons(render(true), 'speaker-drag-handle');
    expect(handles).toHaveLength(3);
    for (const tag of handles) expect(tag).toContain('aria-disabled="true"');
  });

  it('is as before without a running write', () => {
    const html = render(false);
    const section = html.match(/<section[^>]*>/)![0];
    expect(section).not.toContain('data-busy="true"');
    expect(section).not.toContain('aria-busy="true"');
    for (const id of ['speaker-call', 'speaker-finish', 'speaker-move', 'speaker-withdraw']) {
      for (const tag of buttons(html, id)) expect(tag, id).not.toContain('disabled=""');
    }
    for (const tag of buttons(html, 'speaker-drag-handle')) expect(tag).toContain('aria-disabled="false"');
  });
});
