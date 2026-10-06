import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiProblem, type Actor, type HvApi } from '@hv/domain';
import { createHttpApi, followSessionActor, getHttpSession, getTransparencyNotice, logoutHttpSession, type HttpApi, type StreamEnvironment } from './http';
import { createConnectionStore } from './connection';
import { createLiveStore, type LiveStore } from './liveStore';
import { createSessionAuth } from './auth';

const json = (value: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('HTTP HvApi adapter', () => {
  const calls: { url: string; init: RequestInit }[] = [];
  let replies: Response[];
  const request = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const reply = replies.shift();
    if (!reply) throw new Error(`No fixture for ${url}`);
    return reply;
  });

  beforeEach(() => {
    calls.length = 0;
    replies = [];
    request.mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  it('maps every kind of read to declared paths with encoded path and query values', async () => {
    const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
    replies.push(json({ id: 'meeting /1' }), json([{ id: 'speaker' }]), json({ items: [], total: 0 }), json([]));
    await api.getMeeting();
    await api.listSpeakers({ round: 2, status: 'waiting' });
    await api.listQuestions({ status: ['captured'], q: 'a & b', limit: 20 });
    await api.getQuestionHistory('q /?');
    expect(calls.map(({ url, init }) => [url, init.method])).toEqual([
      ['/v1/meeting', 'GET'],
      ['/v1/speakers?round=2&status=waiting', 'GET'],
      ['/v1/questions?status=captured&q=a+%26+b&limit=20', 'GET'],
      ['/v1/questions/q%20%2F%3F/history', 'GET'],
    ]);
    expect(calls.every(({ init }) => init.credentials === 'same-origin')).toBe(true);
  });

  it('sends CSRF, If-Match and a fresh key for each write, retaining explicit keys and the last ETag', async () => {
    const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
    replies.push(json({ id: 'q' }, 200, { ETag: '"v2"' }), json({ id: 'q' }), json({ id: 'q' }));
    await api.closeQuestion('q /?', { ifMatch: '"v1"' });
    expect(api.lastWriteEtag()).toBe('"v2"');
    await api.closeQuestion('q /?', { idempotencyKey: 'same-key' });
    await api.closeQuestion('q /?', { idempotencyKey: 'same-key' });
    expect(calls[0]?.url).toBe('/v1/questions/q%20%2F%3F/closure');
    expect(calls[0]?.init.method).toBe('POST');
    const headers = calls.map((call) => new Headers(call.init.headers));
    expect(headers[0]?.get('X-CSRF-Token')).toBe('csrf');
    expect(headers[0]?.get('If-Match')).toBe('"v1"');
    expect(headers[0]?.get('Idempotency-Key')).toBeTruthy();
    expect(headers[1]?.get('Idempotency-Key')).toBe('same-key');
    expect(headers[2]?.get('Idempotency-Key')).toBe('same-key');
  });

  it('sends a different Idempotency-Key for two calls that name none', async () => {
    const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
    replies.push(json({ id: 'q' }), json({ id: 'q' }));
    await api.closeQuestion('q');
    await api.closeQuestion('q');
    const keys = calls.map((call) => new Headers(call.init.headers).get('Idempotency-Key'));
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBeTruthy();
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('does not send a write without a confirmed CSRF token', async () => {
    const api = createHttpApi({ getCsrfToken: () => undefined, onUnauthorized: vi.fn(), fetcher: request });
    await expect(api.closeQuestion('q')).rejects.toBeInstanceOf(ApiProblem);
    expect(calls).toHaveLength(0);
  });

  it('maps trusted problem details and signals 401 once, while 403 stays a Fachfehler', async () => {
    const onUnauthorized = vi.fn();
    const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized, fetcher: request });
    replies.push(
      new Response(JSON.stringify({ status: 403, title: 'Forbidden', detail: 'No right', ruleId: 'R-1' }), { status: 403, headers: { 'Content-Type': 'application/problem+json' } }),
      new Response(JSON.stringify({ status: 401, title: 'Unauthorized', detail: 'Expired' }), { status: 401, headers: { 'Content-Type': 'application/problem+json' } }),
      new Response('private upstream failure', { status: 401 }),
    );
    await expect(api.getQuestion('q')).rejects.toMatchObject({ status: 403, ruleId: 'R-1' });
    expect(onUnauthorized).not.toHaveBeenCalled();
    await expect(api.getQuestion('q')).rejects.toMatchObject({ status: 401 });
    await expect(api.getQuestion('q')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('signals 401 again after a new confirmed session and stops polling immediately', async () => {
    vi.useFakeTimers();
    let csrf: string | undefined = 'first-session';
    const onUnauthorized = vi.fn(() => { csrf = undefined; });
    const api = createHttpApi({ getCsrfToken: () => csrf, onUnauthorized, fetcher: request });
    const unsubscribe = api.subscribe(vi.fn());
    expect(vi.getTimerCount()).toBe(1);
    replies.push(new Response(null, { status: 401 }));
    await expect(api.getQuestion('q')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    csrf = 'second-session';
    replies.push(new Response(null, { status: 401 }));
    await expect(api.getQuestion('q')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
    unsubscribe();
    vi.useRealTimers();
  });

  it('rejects demo seeding locally and supports the auth transport including 204 logout', async () => {
    const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
    await expect(api.seedDemo({ roundSizes: [2] })).rejects.toBeInstanceOf(ApiProblem);
    expect(calls).toHaveLength(0);
    vi.stubGlobal('fetch', request);
    replies.push(json({ scheme: 'session', actor: { id: 'a', role: 'admin' }, csrfToken: 'csrf' }), json({ version: 'v1', text: { de: 'Hallo', en: 'Hello' } }), new Response(null, { status: 204 }));
    await getHttpSession();
    await getTransparencyNotice();
    await logoutHttpSession('csrf');
    expect(calls.map(({ url, init }) => [url, init.method, init.credentials])).toEqual([
      ['/auth/me', 'GET', 'same-origin'],
      ['/auth/transparency-notice', 'GET', 'same-origin'],
      ['/auth/logout', 'POST', 'same-origin'],
    ]);
    expect(new Headers(calls[2]?.init.headers).get('X-CSRF-Token')).toBe('csrf');
  });

  it('carries the CSRF token of a 403 from /auth/me on the problem (takt-023)', async () => {
    vi.stubGlobal('fetch', request);
    replies.push(new Response(JSON.stringify({ type: 'urn:hv:problem:403', title: 'Forbidden', status: 403,
      detail: 'No active role assignment.', csrfToken: 'c'.repeat(43) }),
    { status: 403, headers: { 'Content-Type': 'application/problem+json' } }));
    await expect(getHttpSession()).rejects.toMatchObject({ status: 403, csrfToken: 'c'.repeat(43) });
  });

  const endpointCases: [keyof HvApi, unknown[], string, string, unknown?][] = [
    ['listMeetings', ['running'], 'GET', '/v1/meetings?status=running'],
    ['getMeetingById', ['m /1'], 'GET', '/v1/meetings/m%20%2F1'],
    ['listMeetingAgendaItems', ['m /1'], 'GET', '/v1/meetings/m%20%2F1/agenda-items'],
    ['listMeetingUnits', ['m /1'], 'GET', '/v1/meetings/m%20%2F1/units'],
    ['openAgendaItem', ['a /1'], 'POST', '/v1/meetings/current/agenda-items/a%20%2F1/opening'],
    ['openVoting', ['a /1'], 'POST', '/v1/meetings/current/agenda-items/a%20%2F1/voting/opening'],
    ['closeVoting', ['a /1'], 'POST', '/v1/meetings/current/agenda-items/a%20%2F1/voting/closure'],
    ['listAgendaItems', [], 'GET', '/v1/agenda-items'],
    ['listUnits', [], 'GET', '/v1/units'],
    ['listRoleAssignments', [{ subjectId: 's /1', role: 'admin' }], 'GET', '/v1/meetings/current/role-assignments?subjectId=s+%2F1&role=admin'],
    ['assignRole', [{ subjectId: 's', role: 'admin' }], 'POST', '/v1/meetings/current/role-assignments', { subjectId: 's', role: 'admin' }],
    ['revokeRole', ['ra /1', 'why'], 'POST', '/v1/meetings/current/role-assignments/ra%20%2F1/revocation', { reason: 'why' }],
    // Scheibe 040b: master data of a named meeting; the body is the whole list.
    ['replaceMeetingAgendaItems', ['m /1', [{ number: 1, title: 'TOP' }]], 'PUT', '/v1/meetings/m%20%2F1/agenda-items', [{ number: 1, title: 'TOP' }]],
    ['replaceMeetingUnits', ['m /1', [{ name: 'Fachbereich' }]], 'PUT', '/v1/meetings/m%20%2F1/units', [{ name: 'Fachbereich' }]],
    ['listMeetingStageSeats', ['m /1'], 'GET', '/v1/meetings/m%20%2F1/stage-seats'],
    ['replaceMeetingStageSeats', ['m /1', [{ label: 'Platz', position: 1 }]], 'PUT', '/v1/meetings/m%20%2F1/stage-seats', [{ label: 'Platz', position: 1 }]],
    ['getSpeaker', ['s /1'], 'GET', '/v1/speakers/s%20%2F1'],
    ['registerSpeaker', [{ displayName: 'Test' }], 'POST', '/v1/speakers', { displayName: 'Test' }],
    ['reorderSpeakers', [2, ['s1', 's2']], 'PUT', '/v1/speakers/order', { round: 2, speakerIds: ['s1', 's2'] }],
    ['updateSpeaker', ['s /1', { round: 2 }], 'PATCH', '/v1/speakers/s%20%2F1', { round: 2 }],
    ['listContributions', [{ speakerId: 's /1' }], 'GET', '/v1/contributions?speakerId=s+%2F1'],
    ['getContribution', ['c /1'], 'GET', '/v1/contributions/c%20%2F1'],
    ['captureContribution', [{ speakerId: 's', text: 'Text' }], 'POST', '/v1/contributions', { speakerId: 's', text: 'Text' }],
    ['captureMeetingContribution', [{ speakerId: 's', text: 'Text', source: 'paper' }], 'POST', '/v1/meetings/current/contributions', { speakerId: 's', text: 'Text', source: 'paper' }],
    ['captureQuestions', ['c /1', [{ text: 'Question' }]], 'POST', '/v1/contributions/c%20%2F1/questions', { questions: [{ text: 'Question' }] }],
    ['claimContribution', ['c /1'], 'POST', '/v1/contributions/c%20%2F1/claim'],
    ['releaseContribution', ['c /1'], 'POST', '/v1/contributions/c%20%2F1/release'],
    ['claimQuestion', ['q /1'], 'POST', '/v1/questions/q%20%2F1/claim'],
    ['releaseQuestion', ['q /1'], 'POST', '/v1/questions/q%20%2F1/release'],
    ['getQuestion', ['q /1'], 'GET', '/v1/questions/q%20%2F1'],
    ['classifyQuestion', ['q /1', { track: 'standard' }], 'POST', '/v1/questions/q%20%2F1/classification', { track: 'standard' }],
    ['assignQuestion', ['q /1', 'u'], 'POST', '/v1/questions/q%20%2F1/assignment', { unitId: 'u' }],
    ['draftAnswer', ['q /1', { text: 'Answer' }], 'POST', '/v1/questions/q%20%2F1/answers', { text: 'Answer' }],
    // Scheibe 055 (contract 0.4.4): the open input form passes through unchanged; the core normalises.
    ['draftAnswer', ['q /1', { text: 'x', body: { blocks: [{ type: 'heading', content: [{ text: 'A', marks: ['underline'] }] }] } }], 'POST',
      '/v1/questions/q%20%2F1/answers', { text: 'x', body: { blocks: [{ type: 'heading', content: [{ text: 'A', marks: ['underline'] }] }] } }],
    ['submitForReview', ['q /1'], 'POST', '/v1/questions/q%20%2F1/review-submissions'],
    ['approveQuestion', ['q /1', 3], 'POST', '/v1/questions/q%20%2F1/approvals', { answerVersion: 3 }],
    ['clearQuestionLegally', ['q /1', { note: 'Legal' }], 'POST', '/v1/questions/q%20%2F1/legal-clearances', { note: 'Legal' }],
    ['returnQuestion', ['q /1', 'Why'], 'POST', '/v1/questions/q%20%2F1/returns', { reason: 'Why' }],
    ['stageQuestion', ['q /1'], 'POST', '/v1/questions/q%20%2F1/staging'],
    ['deliverQuestion', ['q /1'], 'POST', '/v1/questions/q%20%2F1/delivery'],
    ['closeQuestion', ['q /1'], 'POST', '/v1/questions/q%20%2F1/closure'],
    ['withdrawQuestion', ['q /1', 'Why'], 'POST', '/v1/questions/q%20%2F1/withdrawal', { reason: 'Why' }],
    ['mergeQuestion', ['q /1', 'q2'], 'POST', '/v1/questions/q%20%2F1/merge', { intoQuestionId: 'q2' }],
    ['getStage', [], 'GET', '/v1/stage'],
    ['getCockpit', [], 'GET', '/v1/meetings/current/cockpit'], // Scheibe 061 (contract 0.4.5)
    ['listEvents', [7, 50], 'GET', '/v1/events?after=7&limit=50'],
    // Scheibe 044a: the three refusal operations of contract 0.4.0.
    ['listRefusalGrounds', [], 'GET', '/v1/refusal-grounds'],
    ['proposeRefusal', ['q /1', { answerKind: 'refusal_no_claim', text: 'T', refusalJustification: 'J' }], 'POST', '/v1/questions/q%20%2F1/refusals',
      { answerKind: 'refusal_no_claim', text: 'T', refusalJustification: 'J' }],
    ['approveRefusal', ['q /1', 2], 'POST', '/v1/questions/q%20%2F1/refusal-approvals', { answerVersion: 2 }],
    // Scheibe 048: forward to another answering unit (contract 0.4.3).
    ['forwardQuestion', ['q /1', { unitId: 'unit-hr', reasonCode: 'capacity' }], 'POST', '/v1/questions/q%20%2F1/forwards',
      { unitId: 'unit-hr', reasonCode: 'capacity' }],
  ];

  it.each([
    ['proposeRefusal', ['q1', { answerKind: 'refusal_with_ground', text: 'T', refusalGroundId: 'g', refusalJustification: 'J' }]],
    ['approveRefusal', ['q1', 1]],
    ['forwardQuestion', ['q1', { unitId: 'unit-hr', reasonCode: 'wrong_unit' }]], // Scheibe 048, W2
  ] as [keyof HvApi, unknown[]][])('Scheibe 044a/048: %s sends CSRF, If-Match and an Idempotency-Key like draftAnswer', async (name, args) => {
    const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
    replies.push(json({ id: 'q1' }, 200, { ETag: '"v2"' }), json({ id: 'q1' }, 200, { ETag: '"v3"' }));
    const invoke = api[name] as (...parameters: unknown[]) => Promise<unknown>;
    await invoke(...args, { ifMatch: '"v1"', idempotencyKey: 'refusal-key' });
    await invoke(...args);
    const first = new Headers(calls.at(-2)?.init.headers);
    expect(first.get('X-CSRF-Token')).toBe('csrf');
    expect(first.get('If-Match')).toBe('"v1"');
    expect(first.get('Idempotency-Key')).toBe('refusal-key');
    const second = new Headers(calls.at(-1)?.init.headers);
    expect(second.get('X-CSRF-Token')).toBe('csrf');
    expect(second.get('Idempotency-Key')).toBeTruthy();
    expect(second.get('Idempotency-Key')).not.toBe('refusal-key');
  });

  it.each(endpointCases)('%s uses its declared route and request body', async (name, args, method, url, body) => {
    const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
    replies.push(json({ id: 'current' }), json({ id: 'result' }));
    const invoke = api[name] as (...parameters: unknown[]) => Promise<unknown>;
    await invoke(...args);
    const actual = calls.at(-1);
    expect(actual?.url).toBe(url);
    expect(actual?.init.method).toBe(method);
    expect(actual?.init.credentials).toBe('same-origin');
    expect(actual?.init.body ? JSON.parse(actual.init.body as string) : undefined).toEqual(body);
  });

  it('sends the speaker reopen reason to the service in one PATCH (contract 0.4.0)', async () => {
    const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
    replies.push(json({ id: 's', status: 'waiting' }, 200, { ETag: '"v3"' }));
    await api.updateSpeaker('s', { status: 'waiting', reason: 'follow_up' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('/v1/speakers/s');
    expect(calls[0]?.init.method).toBe('PATCH');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ status: 'waiting', reason: 'follow_up' });
  });

  it('emits polling impulses only with a visible confirmed session and stops after unsubscribe', () => {
    vi.useFakeTimers();
    let csrf: string | undefined = 'csrf';
    const api = createHttpApi({ getCsrfToken: () => csrf, onUnauthorized: vi.fn(), fetcher: request });
    const listener = vi.fn();
    const unsubscribe = api.subscribe(listener);
    vi.advanceTimersByTime(30_000);
    expect(listener).toHaveBeenCalledWith([]);
    csrf = undefined;
    vi.advanceTimersByTime(30_000);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    vi.useRealTimers();
  });

  describe('notification after an own successful write (takt-030)', () => {
    it('calls every listener once with [] after a 2xx write, after the ETag is set', async () => {
      const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
      let etagSeen: string | undefined;
      let seenBeforeResponse = false;
      const listener = vi.fn(() => { etagSeen = api.lastWriteEtag(); });
      const stop = api.subscribe(listener);
      replies.push(json({ id: 's' }, 201, { ETag: '"v7"' }));
      const pending = api.registerSpeaker({ displayName: 'A' });
      seenBeforeResponse = listener.mock.calls.length > 0;
      await pending;
      expect(seenBeforeResponse).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith([]);
      expect(etagSeen).toBe('"v7"');
      stop();
    });

    const failures: [string, () => void][] = [
      ['403', () => replies.push(json({ title: 'x' }, 403))],
      ['412', () => replies.push(json({ title: 'x' }, 412))],
      ['500', () => replies.push(json({ title: 'x' }, 500))],
      ['network error', () => { /* no fixture: the fetcher throws */ }],
    ];
    it.each(failures)('does not notify after a write answered with %s', async (_name, arrange) => {
      const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
      const listener = vi.fn();
      const stop = api.subscribe(listener);
      arrange();
      await expect(api.closeQuestion('q')).rejects.toBeDefined();
      expect(listener).not.toHaveBeenCalled();
      stop();
    });

    it('does not notify after a write refused locally without a session', async () => {
      const api = createHttpApi({ getCsrfToken: () => undefined, onUnauthorized: vi.fn(), fetcher: request });
      const listener = vi.fn();
      const stop = api.subscribe(listener);
      await expect(api.closeQuestion('q')).rejects.toMatchObject({ status: 401 });
      expect(listener).not.toHaveBeenCalled();
      stop();
    });

    it('does not notify after a read, and a write without listeners is fine', async () => {
      const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
      const listener = vi.fn();
      const stop = api.subscribe(listener);
      replies.push(json([]));
      await api.listSpeakers({ round: 1 });
      expect(listener).not.toHaveBeenCalled();
      stop();
      replies.push(json({ id: 'q' }));
      await expect(api.closeQuestion('q')).resolves.toBeDefined();
    });

    it('lets a throwing listener neither break the write nor the other listeners', async () => {
      const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
      const first = vi.fn(() => { throw new Error('boom'); });
      const second = vi.fn();
      const stopFirst = api.subscribe(first);
      const stopSecond = api.subscribe(second);
      replies.push(json({ id: 'q' }));
      await expect(api.closeQuestion('q')).resolves.toEqual({ id: 'q' });
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledWith([]);
      stopFirst();
      stopSecond();
    });
  });

  describe('write outcome hook onWriteSettled (slice 036a)', () => {
    it('reports success after a 2xx write, after the ETag is set and before the listeners run', async () => {
      const order: string[] = [];
      const api = createHttpApi({
        getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request,
        onWriteSettled: (outcome) => { order.push(`${outcome}:${api.lastWriteEtag() ?? '-'}`); },
      });
      const stop = api.subscribe(() => { order.push('listener'); });
      replies.push(json({ id: 'q' }, 200, { ETag: '"v9"' }));
      await api.closeQuestion('q');
      expect(order).toEqual(['success:"v9"', 'listener']);
      stop();
    });

    const serverFailures: [string, () => void][] = [
      ['412', () => replies.push(json({ title: 'x' }, 412))],
      ['500', () => replies.push(json({ title: 'x' }, 500))],
      ['network error', () => { /* no fixture: the fetcher throws */ }],
    ];
    it.each(serverFailures)('reports server_error for a write answered with %s', async (_name, arrange) => {
      const outcomes: string[] = [];
      const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request, onWriteSettled: (o) => { outcomes.push(o); } });
      arrange();
      await expect(api.closeQuestion('q')).rejects.toBeDefined();
      expect(outcomes).toEqual(['server_error']);
    });

    it('reports local_reject without a CSRF token, without a request', async () => {
      const outcomes: string[] = [];
      const noSession = createHttpApi({ getCsrfToken: () => undefined, onUnauthorized: vi.fn(), fetcher: request, onWriteSettled: (o) => { outcomes.push(o); } });
      await expect(noSession.closeQuestion('q')).rejects.toMatchObject({ status: 401 });
      const session = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request, onWriteSettled: (o) => { outcomes.push(o); } });
      replies.push(json({ id: 's', status: 'waiting' }, 200, { ETag: '"v4"' }));
      await session.updateSpeaker('s', { status: 'waiting', reason: 'follow_up' });
      expect(outcomes).toEqual(['local_reject', 'success']);
      expect(calls).toHaveLength(1);
    });

    it('does not report reads, and a throwing hook neither breaks the write nor the listeners', async () => {
      const outcomes: string[] = [];
      const api = createHttpApi({
        getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request,
        onWriteSettled: (o) => { outcomes.push(o); throw new Error('boom'); },
      });
      const listener = vi.fn();
      const stop = api.subscribe(listener);
      replies.push(json([]), json({ id: 'q' }));
      await api.listSpeakers();
      await expect(api.closeQuestion('q')).resolves.toEqual({ id: 'q' });
      expect(outcomes).toEqual(['success']);
      expect(listener).toHaveBeenCalledTimes(1);
      stop();
    });
  });
});

/**
 * Slice 036b: the stream client inside the HTTP adapter. A fake fetcher answers `/v1/stream` with a readable body the test
 * writes into, every other path with JSON; timers, `Date` and the jitter are fake. Where the buffer matters, the real live
 * store (036a) sits on top, wired as in `index.ts`.
 */
describe('stream client (slice 036b)', () => {
  const encoder = new TextEncoder();
  const CURSOR = (seq: number) => `event: cursor\nid: ${seq}\ndata: {"seq":${seq}}\n\n`;
  const CHANGE = (seq: number, topics: string[]) => `event: change\nid: ${seq}\ndata: ${JSON.stringify({ seq, topics })}\n\n`;
  const END = (reason: string) => `event: end\ndata: {"reason":"${reason}"}\n\n`;
  const RESET = 'event: reset\ndata: {"lastSeq":99}\n\n';
  const HEARTBEAT = ': heartbeat\n\n';
  const ACTOR: Actor = { id: 'p1', role: 'capture' };

  function sse() {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const state = { cancelled: false };
    const body = new ReadableStream<Uint8Array>({
      start(c) { controller = c; },
      cancel() { state.cancelled = true; },
    });
    return {
      response: new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      send: (text: string) => controller.enqueue(encoder.encode(text)),
      close: () => controller.close(),
      get cancelled() { return state.cancelled; },
    };
  }
  /** A stream that delivers `retry` and a cursor and is over at once (a cutting proxy). */
  const shortLived = () => new Response(`retry: 3000\n\n${CURSOR(5)}`, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  const refused = (status: number, headers: Record<string, string> = {}) => new Response(null, { status, headers });

  async function settle(): Promise<void> {
    for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(0);
  }
  /** Lets time pass in 15 s steps with a heartbeat after each, as the service sends it. */
  async function beat(stream: { send(text: string): void }, ms: number): Promise<void> {
    for (let passed = 0; passed < ms; passed += 15_000) {
      await vi.advanceTimersByTimeAsync(15_000);
      stream.send(HEARTBEAT);
      await settle();
    }
  }

  function harness(options: { hidden?: boolean; random?: number; withStore?: boolean } = {}) {
    let csrf: string | undefined = 'csrf-1';
    let hidden = options.hidden ?? false;
    const visibility = new Set<() => void>();
    const environment: StreamEnvironment = {
      hidden: () => hidden,
      onVisibilityChange: (listener) => { visibility.add(listener); return () => { visibility.delete(listener); }; },
      online: () => true,
      onOnlineChange: () => () => undefined,
      random: () => options.random ?? 0,
    };
    const streams: { at: number; headers: Headers; init: RequestInit }[] = [];
    const streamReplies: (Response | Error)[] = [];
    const reads: string[] = [];
    const fetcher = vi.fn(async (url: string, init: RequestInit): Promise<Response> => {
      if (url.startsWith('/v1/stream')) {
        streams.push({ at: Date.now(), headers: new Headers(init.headers), init });
        const next = streamReplies.shift();
        if (next === undefined) return new Promise<Response>(() => undefined);
        if (next instanceof Error) throw next;
        return next;
      }
      reads.push(url);
      return json(url.startsWith('/v1/questions') ? { items: [], total: 0 } : []);
    });
    const connection = createConnectionStore(() => Date.now());
    let live: LiveStore | undefined;
    const onStreamMessage = vi.fn((...args: Parameters<LiveStore['onStreamMessage']>) => { live?.onStreamMessage(...args); });
    const onStreamEnd = vi.fn((reason: 'session' | 'forbidden' | 'roles_changed' | 'unauthorized') => { live?.clear(reason); });
    const onUnauthorized = vi.fn(() => { live?.clear('unauthorized'); csrf = undefined; });
    const api: HttpApi = createHttpApi({
      getCsrfToken: () => csrf, onUnauthorized, fetcher, onStreamMessage, onStreamEnd, connection, environment,
    });
    if (options.withStore) {
      live = createLiveStore(api, { getActor: () => ACTOR, now: () => Date.now(), monotonic: () => Date.now() });
    }
    return {
      api, live: live!, fetcher, streams, streamReplies, reads, connection, onStreamMessage, onStreamEnd, onUnauthorized,
      setCsrf: (value: string | undefined) => { csrf = value; },
      setHidden: (value: boolean) => { hidden = value; for (const listener of [...visibility]) listener(); },
      readsOf: (path: string) => reads.filter((url) => url.split('?')[0] === path).length,
    };
  }

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => { vi.useRealTimers(); });

  it('opens without a cursor once the session is confirmed, before any read, and not without a session (N5)', async () => {
    const h = harness();
    const s = sse();
    h.streamReplies.push(s.response);
    h.api.openStream();
    await settle();
    expect(h.fetcher).toHaveBeenCalledTimes(1);
    expect(h.fetcher.mock.calls[0]?.[0]).toBe('/v1/stream');
    const { headers, init } = h.streams[0]!;
    expect(headers.get('Last-Event-ID')).toBeNull();
    expect(headers.get('Accept')).toBe('text/event-stream');
    expect(headers.get('X-CSRF-Token')).toBeNull();
    expect(init.credentials).toBe('same-origin');
    expect(h.connection.get().phase).toBe('live');
    s.send(CURSOR(5));
    await settle();
    // Nothing was read before the stream request: the first cursor invalidates nothing, no extra read (H10).
    expect(h.onStreamMessage).not.toHaveBeenCalled();

    const none = harness();
    none.setCsrf(undefined);
    none.api.openStream();
    await settle();
    expect(none.fetcher).not.toHaveBeenCalled();
  });

  it('after the first cursor only entries asked for before the stream request are invalidated (N5)', async () => {
    const h = harness({ withStore: true });
    const stop = h.live.subscribe(vi.fn());
    await h.live.listSpeakers(); // before the stream request
    const s = sse();
    h.streamReplies.push(s.response);
    h.api.openStream();
    await settle();
    await h.live.listQuestions(); // after the stream request, before the cursor
    s.send(CURSOR(5));
    await settle();
    await vi.advanceTimersByTimeAsync(100); // the live store's batch
    await h.live.listSpeakers();
    await h.live.listQuestions();
    expect(h.readsOf('/v1/speakers')).toBe(2);
    expect(h.readsOf('/v1/questions')).toBe(1);
    // A later cursor (heartbeat, catch-up) invalidates nothing more.
    s.send(CURSOR(6));
    await settle();
    await vi.advanceTimersByTimeAsync(100);
    await h.live.listSpeakers();
    expect(h.readsOf('/v1/speakers')).toBe(2);
    stop();
  });

  it('reconnects with Last-Event-ID along 1 s, 2 s, 4 s … at most 30 s', async () => {
    const h = harness();
    const s = sse();
    h.streamReplies.push(s.response);
    h.api.openStream();
    await settle();
    s.send(CHANGE(5, ['speakers']));
    await settle();
    for (let i = 0; i < 7; i++) h.streamReplies.push(new TypeError('network'));
    s.close();
    await settle();
    for (const step of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
      const before = h.streams.length;
      await vi.advanceTimersByTimeAsync(step - 1);
      expect(h.streams.length, `no attempt before ${step} ms`).toBe(before);
      await vi.advanceTimersByTimeAsync(1);
      await settle();
      expect(h.streams.length, `an attempt after ${step} ms`).toBe(before + 1);
    }
    expect(h.streams.slice(1).map((call) => call.headers.get('Last-Event-ID'))).toEqual(Array(7).fill('5'));
    expect(h.connection.get().phase).toBe('offline'); // three network errors in a row
  });

  it('draws the jitter below the step, never above it', async () => {
    const h = harness({ random: 1 });
    const s = sse();
    h.streamReplies.push(s.response);
    h.api.openStream();
    await settle();
    s.send(CHANGE(5, ['speakers']));
    s.close();
    await settle();
    await vi.advanceTimersByTimeAsync(799);
    expect(h.streams).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.streams).toHaveLength(2);
  });

  it('reset: the whole buffer once, then a new stream without a cursor', async () => {
    const h = harness();
    const s1 = sse();
    const s2 = sse();
    h.streamReplies.push(s1.response, s2.response);
    h.api.openStream();
    await settle();
    s1.send(CHANGE(5, ['speakers']));
    s1.send(RESET);
    await settle();
    expect(h.onStreamMessage).toHaveBeenLastCalledWith([]);
    expect(h.onStreamMessage).toHaveBeenCalledTimes(2);
    expect(s1.cancelled).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(h.streams).toHaveLength(2);
    expect(h.streams[1]!.headers.get('Last-Event-ID')).toBeNull();
  });

  it('end {rotate}: at once again, with the last id', async () => {
    const h = harness();
    const s1 = sse();
    const s2 = sse();
    h.streamReplies.push(s1.response, s2.response);
    h.api.openStream();
    await settle();
    s1.send(CURSOR(5));
    await vi.advanceTimersByTimeAsync(11_000);
    s1.send(END('rotate'));
    await settle();
    expect(h.streams).toHaveLength(2);
    expect(h.streams[1]!.headers.get('Last-Event-ID')).toBe('5');
    expect(h.connection.get().phase).toBe('live');
  });

  it.each(['roles_changed', 'forbidden', 'session'] as const)(
    'end {%s}: the buffer is emptied, and no new stream follows until the session is confirmed again',
    async (reason) => {
      const h = harness({ withStore: true });
      const stop = h.live.subscribe(vi.fn());
      const s = sse();
      h.streamReplies.push(s.response);
      h.api.openStream();
      await settle();
      s.send(CURSOR(5));
      await settle();
      await h.live.listSpeakers();
      await h.live.listSpeakers();
      expect(h.readsOf('/v1/speakers')).toBe(1);
      s.send(END(reason));
      await settle();
      expect(h.onStreamEnd).toHaveBeenCalledWith(reason);
      await h.live.listSpeakers();
      expect(h.readsOf('/v1/speakers'), 'a buffered read goes to the network after the end').toBe(2);
      await vi.advanceTimersByTimeAsync(600_000);
      expect(h.streams).toHaveLength(1);
      expect(h.connection.get().phase).toBe('idle');
      h.api.openStream(); // `onActorChange(actor)` after a confirmed `/auth/me`
      await settle();
      // Review major 1: the open after a session end waits for the backoff.
      await vi.advanceTimersByTimeAsync(999);
      expect(h.streams).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      await settle();
      expect(h.streams).toHaveLength(2);
      expect(h.streams[1]!.headers.get('Last-Event-ID')).toBe('5');
      stop();
    },
  );

  function sessionWiring(h: ReturnType<typeof harness>, readSession: () => Promise<unknown>) {
    // The same wiring as `index.ts`: open on every confirmed actor, close without one, re-read the session on an end.
    const auth = createSessionAuth({
      readSession: readSession as never,
      signOut: vi.fn(),
      onActorChange: followSessionActor(h.api),
    });
    h.onStreamEnd.mockImplementation((reason) => {
      h.live.clear(reason);
      if (reason !== 'unauthorized') void auth.refresh().catch(() => undefined);
    });
    return auth;
  }
  const session = () => ({ scheme: 'session', csrfToken: 'c'.repeat(43), actor: { ...ACTOR }, roles: [ACTOR.role] });

  it('after end {roles_changed} a successful /auth/me with a structurally equal actor opens the stream again', async () => {
    const h = harness({ withStore: true });
    const readSession = vi.fn(async () => session());
    const auth = sessionWiring(h, readSession);
    const s1 = sse();
    const s2 = sse();
    h.streamReplies.push(s1.response, s2.response);
    await auth.start();
    await settle();
    expect(h.streams).toHaveLength(1);
    s1.send(CURSOR(5));
    s1.send(END('roles_changed'));
    await settle();
    expect(readSession).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(h.streams).toHaveLength(2);
  });

  it.each([429, 503])('%i: the poll runs, a new attempt after Retry-After', async (status) => {
    const h = harness();
    const listener = vi.fn();
    const stop = h.api.subscribe(listener);
    h.streamReplies.push(refused(status, { 'Retry-After': '40' }));
    h.api.openStream();
    await settle();
    expect(h.connection.get().phase).toBe('polling');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(listener).toHaveBeenCalledWith([]);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(h.streams).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.streams).toHaveLength(2);
    stop();
  });

  it('401 on open and on reopen: the buffer is emptied, onUnauthorized runs, no new stream without a new confirmation', async () => {
    const h = harness({ withStore: true });
    const stop = h.live.subscribe(vi.fn());
    await h.live.listSpeakers();
    await h.live.listSpeakers();
    expect(h.readsOf('/v1/speakers')).toBe(1);
    h.streamReplies.push(refused(401));
    h.api.openStream();
    await settle();
    expect(h.onStreamEnd).toHaveBeenCalledWith('unauthorized');
    expect(h.onUnauthorized).toHaveBeenCalledTimes(1);
    await h.live.listSpeakers();
    expect(h.readsOf('/v1/speakers'), 'the buffered read goes to the network').toBe(2);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(h.streams).toHaveLength(1);

    // Signed in again: the stream opens; its reopen after a loss answers 401.
    h.setCsrf('csrf-2');
    const s = sse();
    h.streamReplies.push(s.response, refused(401));
    h.api.openStream();
    await vi.advanceTimersByTimeAsync(1000); // the backoff after a session end (review major 1)
    await settle();
    s.send(CHANGE(7, ['questions']));
    await settle();
    await h.live.listSpeakers();
    await h.live.listSpeakers();
    expect(h.readsOf('/v1/speakers')).toBe(3);
    s.close();
    await vi.advanceTimersByTimeAsync(2000);
    await settle();
    expect(h.streams).toHaveLength(3);
    expect(h.onStreamEnd).toHaveBeenCalledTimes(2);
    expect(h.onUnauthorized).toHaveBeenCalledTimes(2);
    await h.live.listSpeakers();
    expect(h.readsOf('/v1/speakers')).toBe(4);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(h.streams).toHaveLength(3);
    stop();
  });

  it('a reopen after a hidden tab answered 403: buffer empty, /auth/me read, no further open without confirmation', async () => {
    const h = harness({ withStore: true });
    const readSession = vi.fn(async () => session());
    const auth = sessionWiring(h, readSession);
    const stop = h.live.subscribe(vi.fn());
    const s = sse();
    h.streamReplies.push(s.response);
    await auth.start();
    await settle();
    s.send(CURSOR(5));
    await settle();
    h.setHidden(true);
    await beat(s, 45_000);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(s.cancelled).toBe(true);
    await h.live.listSpeakers();
    expect(h.readsOf('/v1/speakers')).toBe(1);
    // The session read after the 403 fails (no confirmation): nothing opens again.
    readSession.mockImplementation(async () => { throw new ApiProblem(500, 't', 'd'); });
    h.streamReplies.push(refused(403));
    h.setHidden(false);
    await settle();
    expect(h.streams).toHaveLength(2);
    expect(h.streams[1]!.headers.get('Last-Event-ID')).toBe('5');
    expect(h.onStreamEnd).toHaveBeenCalledWith('forbidden');
    expect(readSession).toHaveBeenCalledTimes(2);
    await h.live.listSpeakers();
    expect(h.readsOf('/v1/speakers'), 'the buffered read goes to the network').toBe(2);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(h.streams).toHaveLength(2);
    stop();
  });

  it('45 s without a heartbeat: dropped, reconnecting, the poll runs', async () => {
    const h = harness();
    const listener = vi.fn();
    const stop = h.api.subscribe(listener);
    const s = sse();
    h.streamReplies.push(s.response);
    h.api.openStream();
    await settle();
    s.send(CURSOR(5));
    await vi.advanceTimersByTimeAsync(30_000);
    s.send(HEARTBEAT);
    await settle();
    await vi.advanceTimersByTimeAsync(44_990);
    expect(s.cancelled).toBe(false);
    expect(h.connection.get().phase).toBe('live');
    await vi.advanceTimersByTimeAsync(10);
    expect(s.cancelled).toBe(true);
    expect(h.connection.get().phase).toBe('reconnecting');
    expect(listener).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000); // the tick at 90 s
    expect(listener).toHaveBeenCalledWith([]);
    stop();
  });

  it('three short-lived streams in a row: 5 min polling, then a new attempt', async () => {
    const h = harness();
    h.streamReplies.push(shortLived(), shortLived(), shortLived(), sse().response);
    h.api.openStream();
    await settle();
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    await vi.advanceTimersByTimeAsync(2000);
    await settle();
    expect(h.streams.map((call) => call.at)).toEqual([0, 1000, 3000]);
    expect(h.connection.get().phase).toBe('polling');
    await vi.advanceTimersByTimeAsync(299_999);
    expect(h.streams).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(h.streams).toHaveLength(4);
    expect(h.connection.get().phase).toBe('live');
  });

  it('the poll rests while the stream is open and resumes once it is lost', async () => {
    const h = harness();
    const listener = vi.fn();
    const stop = h.api.subscribe(listener);
    const s = sse();
    h.streamReplies.push(s.response);
    h.api.openStream();
    await settle();
    s.send(CURSOR(5));
    for (let i = 0; i < 8; i++) {
      await vi.advanceTimersByTimeAsync(15_000);
      s.send(HEARTBEAT);
      await settle();
    }
    expect(listener).not.toHaveBeenCalled();
    s.close();
    await settle();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(listener).toHaveBeenCalledWith([]);
    stop();
  });

  it('a tab hidden for more than 60 s closes its stream; visible again reopens it with the last id', async () => {
    const h = harness();
    const s1 = sse();
    const s2 = sse();
    h.streamReplies.push(s1.response, s2.response);
    h.api.openStream();
    await settle();
    s1.send(CURSOR(5));
    h.setHidden(true);
    await beat(s1, 45_000);
    await vi.advanceTimersByTimeAsync(14_000);
    h.setHidden(false); // back after 59 s: the stream stays
    h.setHidden(true);
    await beat(s1, 45_000);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(s1.cancelled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(s1.cancelled).toBe(true);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(h.streams).toHaveLength(1);
    h.setHidden(false);
    await settle();
    expect(h.streams).toHaveLength(2);
    expect(h.streams[1]!.headers.get('Last-Event-ID')).toBe('5');
  });

  it('a tab hidden at the start opens its stream only once it is visible', async () => {
    const h = harness({ hidden: true });
    h.streamReplies.push(sse().response);
    h.api.openStream();
    await settle();
    expect(h.streams).toHaveLength(0);
    h.setHidden(false);
    await settle();
    expect(h.streams).toHaveLength(1);
  });

  it('a message over 1 MiB drops the connection; a read answered 401 closes the stream', async () => {
    const h = harness();
    const s1 = sse();
    const s2 = sse();
    h.streamReplies.push(s1.response, s2.response);
    h.api.openStream();
    await settle();
    s1.send(`event: change\ndata: ${'x'.repeat(1_100_000)}`);
    await settle();
    expect(s1.cancelled).toBe(true);
    expect(h.connection.get().phase).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(h.streams).toHaveLength(2);
    h.fetcher.mockImplementationOnce(async () => refused(401));
    await expect(h.api.getSpeaker('s1')).rejects.toMatchObject({ status: 401 });
    await settle();
    expect(s2.cancelled).toBe(true);
    expect(h.connection.get().phase).toBe('idle');
    await vi.advanceTimersByTimeAsync(600_000);
    expect(h.streams).toHaveLength(2);
  });

  it('a malformed message invalidates everything (never too little)', async () => {
    const h = harness();
    const s = sse();
    h.streamReplies.push(s.response);
    h.api.openStream();
    await settle();
    s.send('event: change\nid: 9\ndata: {"seq":"x"}\n\n');
    await settle();
    expect(h.onStreamMessage).toHaveBeenCalledWith([]);
  });

  it('review major 1: 403 on every open with a confirming /auth/me backs off and pauses 5 min after three ends', async () => {
    const h = harness({ withStore: true });
    const readSession = vi.fn(async () => session());
    const auth = sessionWiring(h, readSession);
    for (let i = 0; i < 20; i++) h.streamReplies.push(refused(403));
    await auth.start();
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);
    await settle();
    // 0 s, 1 s, 3 s — then the pause; never a loop of opens and session reads.
    expect(h.streams.map((call) => call.at)).toEqual([0, 1000, 3000]);
    expect(readSession).toHaveBeenCalledTimes(4);
    expect(h.connection.get().phase).toBe('polling');
    // The pause runs from the third end (3 s) for 5 min.
    await vi.advanceTimersByTimeAsync(242_999);
    expect(h.streams).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(h.streams).toHaveLength(4);
  });

  it('review major 1: a healthy stream (≥ 10 s) before a session end resets the count and the backoff', async () => {
    const h = harness();
    const s1 = sse();
    h.streamReplies.push(s1.response, refused(403), refused(403), sse().response);
    h.api.openStream();
    await settle();
    s1.send(CURSOR(5));
    await vi.advanceTimersByTimeAsync(11_000);
    s1.send(END('roles_changed'));
    await settle();
    h.api.openStream();
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(h.streams.map((call) => call.at)).toEqual([0, 12_000]);
  });

  it('review minor 2: after sign-out and sign-in as another actor the stream opens without Last-Event-ID (N5 path)', async () => {
    const h = harness({ withStore: true });
    const stop = h.live.subscribe(vi.fn());
    const s1 = sse();
    const s2 = sse();
    h.streamReplies.push(s1.response, s2.response);
    const follow = followSessionActor(h.api);
    follow(ACTOR);
    await settle();
    s1.send(CHANGE(5, ['speakers']));
    await settle();
    follow(undefined); // sign-out
    expect(s1.cancelled).toBe(true);
    await h.live.listSpeakers(); // read before the new stream request
    follow({ id: 'p2', role: 'capture' });
    await settle();
    expect(h.streams).toHaveLength(2);
    expect(h.streams[1]!.headers.get('Last-Event-ID')).toBeNull();
    const before = h.readsOf('/v1/speakers');
    s2.send(CURSOR(9));
    await settle();
    await vi.advanceTimersByTimeAsync(100);
    await h.live.listSpeakers();
    expect(h.readsOf('/v1/speakers'), 'the read before the request is invalidated by the first cursor').toBe(before + 1);
    stop();
  });

  it('review minor 3: a structural actor change while live aborts the old stream and opens a new one', async () => {
    const h = harness();
    const s1 = sse();
    const s2 = sse();
    h.streamReplies.push(s1.response, s2.response);
    const follow = followSessionActor(h.api);
    follow(ACTOR);
    await settle();
    s1.send(CURSOR(5));
    await settle();
    follow({ ...ACTOR }); // a refresh with an equal actor keeps the stream
    await settle();
    expect(s1.cancelled).toBe(false);
    expect(h.streams).toHaveLength(1);
    follow({ ...ACTOR, unitId: 'unit-fin' });
    await settle();
    expect(s1.cancelled).toBe(true);
    // The old stream was young and carried only a cursor: closing it counts as short-lived, the new open waits 1 s.
    expect(h.streams).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(h.streams).toHaveLength(2);
    expect(h.streams[1]!.headers.get('Last-Event-ID')).toBeNull();
    expect(h.connection.get().phase).toBe('live');
  });

  it('re-check nit 1.4: a short stream with data does not end a series of session ends', async () => {
    const h = harness({ withStore: true });
    const readSession = vi.fn(async () => session());
    const auth = sessionWiring(h, readSession);
    const withData = new Response(`${CHANGE(5, ['speakers'])}`, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    h.streamReplies.push(refused(403), refused(403), withData, refused(403), refused(403), refused(403));
    await auth.start();
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);
    await settle();
    // 403 (1), 403 (2), a short stream with data, 403 (3) → the pause.
    expect(h.streams.map((call) => call.at)).toEqual([0, 1000, 3000, 4000]);
    expect(h.connection.get().phase).toBe('polling');
  });

  it('re-check finding 1: an actor change while the gated open is in flight re-arms the gate', async () => {
    const h = harness();
    const follow = followSessionActor(h.api);
    h.streamReplies.push(refused(403));
    follow(ACTOR);
    await settle();
    follow({ ...ACTOR }); // the session is confirmed again after the end: the gate waits 1 s
    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(h.streams).toHaveLength(2); // in flight, no answer yet
    follow({ id: 'p2', role: ACTOR.role });
    await settle();
    expect(h.streams, 'no open at once after the actor change').toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2000);
    await settle();
    expect(h.streams).toHaveLength(3);
  });

  /**
   * Final re-check (T-G1-D-03): the reconnect limit is per tab and survives every close but an explicit sign-out or a
   * 401. Every end kind with every actor pattern, each with a session refresh every 500 ms, for 10 min of fake time.
   */
  describe('reconnect limit matrix (final re-check)', () => {
    const body = (text: string) => () => new Response(`retry: 3000\n\n${text}`, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    const END_KINDS: [string, (i: number) => () => Response][] = [
      ['403', () => () => refused(403)],
      ['end {forbidden}', () => body(END('forbidden'))],
      ['end {roles_changed}', () => body(`${CURSOR(5)}${END('roles_changed')}`)],
      ['end {session}', () => body(END('session'))],
      ['reset', () => body(RESET)],
      ['cursor only', () => body(CURSOR(5))],
      ['malformed', () => body('event: change\nid: 9\ndata: {"seq":"x"}\n\n')],
      ['rotate', () => body(`${CURSOR(5)}${END('rotate')}`)],
      ['reset and 403 mixed', (i) => (i % 2 === 0 ? body(RESET) : () => refused(403))],
    ];
    const noRole = () => Object.assign(new ApiProblem(403, 't', 'd'), { csrfToken: 'n'.repeat(43) });
    const PATTERNS: [string, (n: number) => unknown][] = [
      ['same actor', () => session()],
      ['alternating actor', (n) => ({ ...session(), actor: { id: n % 2 === 0 ? 'p1' : 'p2', role: ACTOR.role } })],
      ['noRole flapping', (n) => { if (n % 2 === 0) throw noRole(); return session(); }],
    ];
    const cases = END_KINDS.flatMap(([kind, reply]) => PATTERNS.map(([pattern, answer]) => [kind, pattern, reply, answer] as const));

    it.each(cases)('%s with %s: at most 6 opens in 10 min', async (kind, pattern, reply, answer) => {
      const h = harness({ withStore: true });
      let n = 0;
      const readSession = vi.fn(async () => { n += 1; return answer(n); });
      const auth = sessionWiring(h, readSession as () => Promise<unknown>);
      for (let i = 0; i < 400; i++) h.streamReplies.push(reply(i)());
      await auth.start().catch(() => undefined);
      await settle();
      for (let t = 0; t < 600_000; t += 500) {
        void auth.refresh().catch(() => undefined);
        await vi.advanceTimersByTimeAsync(500);
      }
      console.log(`[matrix] ${kind} | ${pattern} | ${h.streams.length} opens in 10 min`);
      expect(h.streams.length).toBeGreaterThan(0);
      expect(h.streams.length).toBeLessThanOrEqual(6);
    });

    it.each(['403', 'reset'] as const)('%s on every open with a hide/show cycle every 2 s: at most 6 opens in 10 min', async (kind) => {
      const h = harness({ withStore: true });
      const readSession = vi.fn(async () => session());
      const auth = sessionWiring(h, readSession);
      for (let i = 0; i < 400; i++) {
        h.streamReplies.push(kind === '403' ? refused(403) : body(RESET)());
      }
      await auth.start();
      await settle();
      for (let t = 0; t < 600_000; t += 500) {
        if (t % 2000 === 0) h.setHidden(true);
        if (t % 2000 === 1000) h.setHidden(false);
        void auth.refresh().catch(() => undefined);
        await vi.advanceTimersByTimeAsync(500);
      }
      console.log(`[matrix] ${kind} | hide/show every 2 s | ${h.streams.length} opens in 10 min | at ${h.streams.map((c) => c.at).join(",")}`);
      expect(h.streams.length).toBeLessThanOrEqual(6);
      // Codex P2: the backoff steps stay 1, 2, 4 s across hide/show; a return to the tab does not shorten them.
      expect(h.streams.map((call) => call.at)).toEqual([0, 1000, 3000, 303_000, 307_000, 315_000]);
    });

    it('a healthy stream still reconnects in about 1 s: with data, and after 10 s without', async () => {
      const h = harness();
      const s1 = sse();
      const s2 = sse();
      const s3 = sse();
      h.streamReplies.push(s1.response, s2.response, s3.response);
      h.api.openStream();
      await settle();
      s1.send(CHANGE(5, ['speakers']));
      s1.close();
      await settle();
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      expect(h.streams.map((call) => call.at)).toEqual([0, 1000]);
      s2.send(CURSOR(6));
      await beat(s2, 15_000);
      s2.close();
      await settle();
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      expect(h.streams.map((call) => call.at)).toEqual([0, 1000, 17_000]);
    });

    it('only an explicit sign-out lets the limit start afresh', async () => {
      const h = harness();
      const follow = followSessionActor(h.api);
      h.streamReplies.push(refused(403), refused(403), sse().response);
      follow(ACTOR);
      await settle();
      follow(undefined); // closing (no role, other actor) keeps the gate
      follow(ACTOR);
      await settle();
      expect(h.streams).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      expect(h.streams).toHaveLength(2);
      h.api.resetStreamLimits(); // explicit sign-out
      follow(undefined);
      follow({ id: 'p9', role: ACTOR.role });
      await settle();
      expect(h.streams).toHaveLength(3);
    });
  });
});
