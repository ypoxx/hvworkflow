import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiProblem, type HvApi } from '@hv/domain';
import { createHttpApi, getHttpSession, getTransparencyNotice, logoutHttpSession } from './http';

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
    ['listEvents', [7, 50], 'GET', '/v1/events?after=7&limit=50'],
  ];

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

  it('rejects the domain-only speaker reopen reason without a request', async () => {
    const api = createHttpApi({ getCsrfToken: () => 'csrf', onUnauthorized: vi.fn(), fetcher: request });
    await expect(api.updateSpeaker('s', { status: 'waiting', reason: 'follow_up' })).rejects.toMatchObject({ status: 422 });
    expect(calls).toHaveLength(0);
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
});
