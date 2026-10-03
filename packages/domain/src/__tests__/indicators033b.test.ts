/**
 * Scheibe 033b: the five indicators as a pure function of events and a fixed `now`.
 * Threat ids: T-G1-I-01/SC-03 (counts only, no content), T-G3-I-03 (no per-person value).
 */
import { describe, expect, it } from 'vitest';
import { computeIndicators } from '../indicators.js';
import type { DomainEvent } from '../events.js';

const NOW = new Date('2031-05-06T12:00:00.000Z');
const ago = (seconds: number): string => new Date(NOW.getTime() - seconds * 1000).toISOString();
const actor = { id: 'fixture-actor', role: 'admin' as const };
const M = 'hv-2031';
let seq = 0;

function ev(type: string, subjectId: string, payload: unknown, at: string, extra: Record<string, unknown> = {}): DomainEvent {
  seq += 1;
  return { seq, id: `e-${seq}`, type, at, actor, subjectId, meetingId: M, payload, ...extra } as unknown as DomainEvent;
}

function meeting(running = true, id = M): DomainEvent[] {
  const created = ev('MeetingCreated', id, { title: 'Synthetisch', date: '2031-05-06', lifecycleVersion: 2, agendaItems: [],
    units: [{ id: 'u-fin', name: 'Finanzen' }, { id: 'u-ir', name: 'IR' }] }, ago(86_000), { meetingId: id });
  return running ? [created, ev('MeetingStarted', id, {}, ago(85_000), { meetingId: id })] : [created];
}

function capture(id: string, at: string, extra: Record<string, unknown> = {}): DomainEvent {
  return ev('QuestionCaptured', id, { number: id, contributionId: 'c-1', speakerId: 's-1',
    text: 'MARKER-Fragetext darf nie erscheinen' }, at, extra);
}
const assign = (id: string, unit: string): DomainEvent[] => [
  ev('QuestionClassified', id, { track: 'written' }, ago(80_000)),
  ev('QuestionAssigned', id, { unitId: unit }, ago(79_000)),
];
const draft = (id: string, version: number, at: string): DomainEvent =>
  ev('AnswerDrafted', id, { answer: { version, text: 'x', createdAt: at, createdBy: actor } }, at);
const submit = (id: string, at: string): DomainEvent => ev('QuestionSubmittedForReview', id, { answerVersion: 1 }, at);
const only = (events: DomainEvent[]) => computeIndicators(events, NOW).meetings[0]!;

describe('Scheibe 033b: indicators (core, pure)', () => {
  it('reports no meeting indicators without a running meeting, but still counts events', () => {
    const result = computeIndicators([...meeting(false), capture('q1', ago(10))], NOW);
    expect(result.meetings).toEqual([]);
    expect(result.eventsLast1m).toBe(1); // only the capture is within 60 s
  });

  it('counts the oldest open question age, 0 without one', () => {
    expect(only([...meeting()]).oldestOpenQuestionAgeSeconds).toBe(0);
    const m = only([...meeting(), capture('q1', ago(1000)), capture('q2', ago(50))]);
    expect(m.oldestOpenQuestionAgeSeconds).toBe(1000);
  });

  it('inflow window: exactly 300 s counts, 301 s does not', () => {
    expect(only([...meeting(), capture('q1', ago(300))]).questionsCapturedLast5m).toBe(1);
    expect(only([...meeting(), capture('q1', ago(301))]).questionsCapturedLast5m).toBe(0);
  });

  it('an event with a server time after `now` counts in no rolling window (clock set back, Codex P2 on #73)', () => {
    const result = computeIndicators([...meeting(), capture('q1', ago(-5))], NOW);
    expect(result.eventsLast1m).toBe(0);
    expect(result.meetings[0]!.questionsCapturedLast5m).toBe(0);
  });

  it('events window: 60 s counts, 61 s does not, over all meetings', () => {
    const other = ev('MeetingCreated', 'hv-other', { title: 'Andere', date: '2031-05-06', lifecycleVersion: 2, agendaItems: [], units: [] }, ago(60), { meetingId: 'hv-other' });
    const result = computeIndicators([...meeting(), other, capture('q1', ago(61)), capture('q2', ago(60))], NOW);
    expect(result.eventsLast1m).toBe(2);
  });

  it('legal review: exactly 600 s does not count, 601 s does', () => {
    const base = (s: number) => [...meeting(), capture('q1', ago(2000)), ...assign('q1', 'u-fin'),
      draft('q1', 1, ago(1900)), submit('q1', ago(s))];
    expect(only(base(600)).questionsInLegalReviewOver10m).toBe(0);
    expect(only(base(601)).questionsInLegalReviewOver10m).toBe(1);
  });

  it('a clearance of the current version excludes the question, one of a former version does not', () => {
    const cleared = (version: number) => [...meeting(), capture('q1', ago(2000)), ...assign('q1', 'u-fin'),
      draft('q1', 1, ago(1900)), submit('q1', ago(900)),
      ev('QuestionLegalCleared', 'q1', { questionId: 'q1', answerVersion: version }, ago(800))];
    expect(only(cleared(1)).questionsInLegalReviewOver10m).toBe(0);
    // A clearance naming version 1 while version 2 is the latest is not a clearance of the current text.
    const stale = [...meeting(), capture('q1', ago(2000)), ...assign('q1', 'u-fin'),
      draft('q1', 1, ago(1900)), draft('q1', 2, ago(1800)), submit('q1', ago(900)),
      ev('QuestionLegalCleared', 'q1', { questionId: 'q1', answerVersion: 1 }, ago(800))];
    expect(only(stale).questionsInLegalReviewOver10m).toBe(1);
  });

  it('counts open questions per unit and puts unassigned ones under "unassigned"', () => {
    const m = only([...meeting(), capture('q1', ago(500)), capture('q2', ago(500)), capture('q3', ago(500)),
      ...assign('q1', 'u-fin'), ...assign('q2', 'u-fin')]);
    expect(m.openQuestionsByUnit).toEqual({ 'u-fin': 2, 'u-ir': 0, unassigned: 1 });
  });

  it('withdrawn and merged questions only change counters (no content, no id in the result)', () => {
    const events = [...meeting(), capture('q1', ago(500)), capture('q2', ago(500)), capture('q3', ago(500)),
      ev('QuestionWithdrawn', 'q2', { reason: 'MARKER-Grund' }, ago(400)),
      ev('QuestionMerged', 'q3', { intoQuestionId: 'q1' }, ago(300))];
    const result = computeIndicators(events, NOW);
    expect(result.meetings[0]!.openQuestionsByUnit['unassigned']).toBe(1);
    const text = JSON.stringify(result);
    expect(text).not.toContain('MARKER');
    expect(text).not.toContain('fixture-actor');
    expect(text).not.toContain('q2');
  });

  it('uses server time (recordedAt over at) and ignores occurredAt of a paper capture', () => {
    // `at` says 10 s ago, the server recorded it 400 s ago: the recorded time wins.
    const recorded = capture('q1', ago(10), { recordedAt: ago(400) });
    expect(only([...meeting(), recorded]).oldestOpenQuestionAgeSeconds).toBe(400);
    // A paper capture that occurred a day ago but was recorded 10 s ago is a fresh capture.
    const paper = capture('q1', ago(10), { occurredAt: ago(86_400), occurredAtSource: 'paper' });
    const m = only([...meeting(), paper]);
    expect(m.oldestOpenQuestionAgeSeconds).toBe(10);
    expect(m.questionsCapturedLast5m).toBe(1);
  });

  // Scheibe 044a, Test 26: a refusal proposal goes straight to `in_review` as `AnswerDrafted` with
  // `toStatus`; the ten-minute clock starts with it and restarts with every new proposal.
  it('Scheibe 044a: a refusal proposal starts the legal-review clock, a new proposal restarts it', () => {
    const refusal = (id: string, version: number, at: string): DomainEvent => ev('AnswerDrafted', id, {
      answer: { version, text: 'x', createdAt: at, createdBy: actor, answerKind: 'refusal_no_claim' },
      pii: { keyId: M, refusalJustification: 'MARKER-Begruendung' }, toStatus: 'in_review' }, at);
    const base = [...meeting(), capture('q1', ago(4000)), ...assign('q1', 'u-fin')];
    // Proposed at t0: counted at t0 + 11 min, not at t0 + 9 min.
    expect(only([...base, refusal('q1', 1, ago(660))]).questionsInLegalReviewOver10m).toBe(1);
    expect(only([...base, refusal('q1', 1, ago(540))]).questionsInLegalReviewOver10m).toBe(0);
    // Was in review long before (old submit, then returned): counts from the proposal, not the old time.
    const earlier = [...base, draft('q1', 1, ago(3500)), submit('q1', ago(3000)),
      ev('QuestionReturned', 'q1', { reason: 'r', fromStatus: 'in_review', toStatus: 'answer_drafted' }, ago(2900))];
    expect(only([...earlier, refusal('q1', 2, ago(540))]).questionsInLegalReviewOver10m).toBe(0);
    // A second proposal at t0 + 8 min: not counted at t0 + 11 min, counted at t0 + 19 min.
    expect(only([...base, refusal('q1', 1, ago(660)), refusal('q1', 2, ago(180))]).questionsInLegalReviewOver10m).toBe(0);
    expect(only([...base, refusal('q1', 1, ago(1140)), refusal('q1', 2, ago(660))]).questionsInLegalReviewOver10m).toBe(1);
    expect(JSON.stringify(computeIndicators([...base, refusal('q1', 1, ago(660))], NOW))).not.toContain('MARKER');
  });

  it('is deterministic and does not mutate its input', () => {
    const events = [...meeting(), capture('q1', ago(20))];
    const copy = JSON.stringify(events);
    expect(computeIndicators(events, NOW)).toEqual(computeIndicators(events, NOW));
    expect(JSON.stringify(events)).toBe(copy);
  });
});
