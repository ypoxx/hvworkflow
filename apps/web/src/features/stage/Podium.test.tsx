/**
 * takt-039 (Tests zuerst, 2): "Vorgelesen, weiter" is locked exactly by the rule of `lib.ts` (`nextButton`), and its
 * click hands the question it was drawn with to `onNext`. Rendered statically, like `speakers/RoundSection.test.tsx`;
 * the click itself is not simulated, the hand-over is checked through `nextPress`, which the button calls.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Permission, Question } from '@hv/domain';
import { Podium, nextPress } from './Podium';
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
