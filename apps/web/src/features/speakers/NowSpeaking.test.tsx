/** takt-032 (Ziel 2): calling and finishing are locked while a reorder of the affected round runs. */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import type { Speaker } from '@hv/domain';
import { NowSpeaking } from './NowSpeaking';

function person(id: string, round: number, status: Speaker['status']): Speaker {
  return {
    id, number: 1, displayName: id, round, position: 1, status, questionCount: 0, version: 1,
    _actions: ['speaker.update'],
  };
}
const speaking = person('now', 1, 'speaking');
const next = person('next', 1, 'waiting');

function render(busyRound: number | null, nextSpeaker: Speaker = next): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <NowSpeaking
        speaking={speaking} next={nextSpeaker} busyId={null} busyRound={busyRound}
        onFinish={() => undefined} onCall={() => undefined}
      />
    </MemoryRouter>,
  );
}
const callTag = (html: string): string => html.match(/<button[^>]*data-testid="speaker-call-next"[^>]*>/)![0];
/** The finish button has no test id; it is the only other button with a `disabled` state. */
const buttonTags = (html: string): string[] => [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);

describe('NowSpeaking busy', () => {
  it('locks calling and finishing while the round of the Wortmeldung is being reordered', () => {
    const html = render(1);
    expect(callTag(html)).toContain('disabled=""');
    const tags = buttonTags(html);
    expect(tags).toHaveLength(2);
    for (const tag of tags) expect(tag).toContain('disabled=""');
  });

  it('is as before without a running reorder', () => {
    const html = render(null);
    expect(callTag(html)).not.toContain('disabled=""');
    for (const tag of buttonTags(html)) expect(tag).not.toContain('disabled=""');
  });

  it('a reorder of another round locks nothing here', () => {
    const html = render(2, person('next', 1, 'waiting'));
    // speaking and next are in round 1: round 2 touches neither.
    expect(callTag(html)).not.toContain('disabled=""');
  });
});
