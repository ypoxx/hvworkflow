/** Same-origin HTTP implementation of the domain-facing HvApi port. */
import { ApiProblem, type HvApi } from '@hv/domain';
import type { components, paths } from '../../../../packages/contract/src/types';
import { translate } from '../i18n';

export type HttpSession = components['schemas']['Session'];
export type TransparencyNotice = components['schemas']['TransparencyNotice'];

type Verb = 'get' | 'post' | 'put' | 'patch';
type Route<M extends Verb> = { [P in keyof paths]: paths[P][M] extends never ? never : P }[keyof paths];
type Query = Record<string, string | number | readonly string[] | undefined>;
type Transport = (url: string, init: RequestInit) => Promise<Response>;
type Language = 'de' | 'en';

export interface HttpApiOptions {
  /** Only a confirmed, in-memory session may provide this token. */
  getCsrfToken: () => string | undefined;
  onUnauthorized: () => void;
  locale?: () => Language;
  fetcher?: Transport;
  /**
   * Slice 036a: how each own write ended, for the live store (liveStore.ts). `success` after a 2xx, once the ETag
   * is set and before the listeners run; `server_error` for any answer or network failure after sending;
   * `local_reject` for a write refused here without a request (no CSRF token, the speaker reopen reason).
   */
  onWriteSettled?: (outcome: WriteOutcome) => void;
}

export type WriteOutcome = 'success' | 'server_error' | 'local_reject';

function genericProblem(status: number, language: Language): ApiProblem {
  return new ApiProblem(status, translate(language, 'http.errorTitle'), translate(language, 'http.errorDetail'));
}

function randomKey(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto.randomUUID === 'function') return webCrypto.randomUUID();
  const bytes = new Uint8Array(16);
  webCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function urlFor(route: keyof paths, params?: Record<string, string>, query?: Query): string {
  const path = route.replace(/\{([^}]+)\}/g, (_placeholder, name: string) => {
    const value = params?.[name];
    if (value === undefined) throw new Error(`Missing route parameter: ${name}`);
    return encodeURIComponent(value);
  });
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) search.set(name, Array.isArray(value) ? value.join(',') : String(value));
  }
  return `/v1${path}${search.size > 0 ? `?${search.toString()}` : ''}`;
}

interface RequestDetails {
  params?: Record<string, string>;
  query?: Query;
  body?: unknown;
  write?: Parameters<HvApi['closeQuestion']>[1];
  /** For auth endpoints outside /v1. */
  authPath?: '/auth/me' | '/auth/transparency-notice' | '/auth/logout';
  csrf?: string;
}

async function perform<T>(
  method: Uppercase<Verb>,
  route: keyof paths | undefined,
  details: RequestDetails,
  transport: Transport,
  language: Language,
  onUnauthorized?: () => void,
  onWriteEtag?: (etag: string | null) => void,
): Promise<T> {
  const url = details.authPath ?? urlFor(route!, details.params, details.query);
  const headers = new Headers();
  if (details.body !== undefined) headers.set('Content-Type', 'application/json');
  if (method !== 'GET') {
    const csrf = details.csrf;
    if (!csrf) throw new ApiProblem(401, translate(language, 'http.errorTitle'), translate(language, 'http.noSession'));
    headers.set('X-CSRF-Token', csrf);
    headers.set('Idempotency-Key', details.write?.idempotencyKey ?? randomKey());
    if (details.write?.ifMatch !== undefined) headers.set('If-Match', details.write.ifMatch);
  }
  let response: Response;
  try {
    response = await transport(url, {
      method,
      credentials: 'same-origin',
      headers,
      ...(details.body !== undefined ? { body: JSON.stringify(details.body) } : {}),
    });
  } catch {
    throw genericProblem(0, language);
  }
  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.();
    const contentType = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
    if (contentType === 'application/problem+json') {
      try {
        const body: unknown = await response.json();
        if (body && typeof body === 'object') {
          const problem = body as Record<string, unknown>;
          if (problem.status === response.status && typeof problem.title === 'string' && typeof problem.detail === 'string') {
            const rejected = new ApiProblem(response.status, problem.title, problem.detail,
              typeof problem.ruleId === 'string' ? problem.ruleId : undefined);
            // Contract 0.3.8 `NoActiveRole`: only this one response carries a token, for sign-out.
            if (details.authPath === '/auth/me' && response.status === 403 && typeof problem.csrfToken === 'string') {
              return Promise.reject(Object.assign(rejected, { csrfToken: problem.csrfToken }));
            }
            return Promise.reject(rejected);
          }
        }
      } catch { /* malformed provider/server data must not be reflected */ }
    }
    throw genericProblem(response.status, language);
  }
  if (method !== 'GET') onWriteEtag?.(response.headers.get('ETag'));
  if (response.status === 204) return undefined as T;
  try {
    return await response.json() as T;
  } catch {
    throw genericProblem(response.status, language);
  }
}

export function createHttpApi(options: HttpApiOptions): HvApi {
  const transport: Transport = options.fetcher ?? ((url, init) => fetch(url, init));
  const language = () => options.locale?.() ?? 'de';
  let writeEtag: string | undefined;
  let unauthorized = false;
  let observedToken = options.getCsrfToken();
  const listeners = new Set<Parameters<HvApi['subscribe']>[0]>();
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  const stopPolling = () => { if (pollTimer !== undefined) clearInterval(pollTimer); pollTimer = undefined; };
  const observeSession = () => {
    const token = options.getCsrfToken();
    if (token !== observedToken) {
      if (token) unauthorized = false;
      observedToken = token;
    }
  };
  // A listener that throws must not turn an accepted write into a failure or starve the other listeners.
  const notifyListeners = () => {
    for (const current of [...listeners]) {
      try { current([]); } catch { /* swallowed on purpose: the server has already accepted the write */ }
    }
  };
  // A throwing hook must not turn the outcome of a write into another one.
  const settled = (outcome: WriteOutcome) => {
    try { options.onWriteSettled?.(outcome); } catch { /* swallowed on purpose, like a throwing listener */ }
  };
  const onUnauthorized = () => {
    if (unauthorized) return;
    unauthorized = true;
    options.onUnauthorized();
    observedToken = options.getCsrfToken();
    stopPolling();
  };
  const read = <T, M extends Verb>(method: M, route: Route<M>, details: RequestDetails = {}): Promise<T> => {
    observeSession();
    return perform<T>(method.toUpperCase() as Uppercase<M>, route, details, transport, language(), onUnauthorized);
  };
  const write = <T, M extends Exclude<Verb, 'get'>>(method: M, route: Route<M>, details: RequestDetails = {}): Promise<T> => {
    observeSession();
    const csrf = options.getCsrfToken();
    if (!csrf) {
      settled('local_reject');
      return Promise.reject(new ApiProblem(401, translate(language(), 'http.errorTitle'), translate(language(), 'http.noSession')));
    }
    // Own successful writes refresh the views at once (the demo adapter does the same); the ETag is set inside `perform`
    // before the listeners run, so a reload sees the current `lastWriteEtag()`. Failures reject before this line.
    return perform<T>(method.toUpperCase() as Uppercase<M>, route, { ...details, csrf }, transport,
      language(), onUnauthorized, (etag) => { writeEtag = etag ?? undefined; }).then((result) => {
      settled('success');
      notifyListeners();
      return result;
    }, (error: unknown) => {
      settled('server_error');
      throw error;
    });
  };
  const currentMeetingId = async () => (await read<Awaited<ReturnType<HvApi['getMeeting']>>, 'get'>('get', '/meeting')).id;
  const meetingRoute = async () => ({ meetingId: await currentMeetingId() });
  const questionPath = (questionId: string) => ({ questionId });
  const contributionPath = (contributionId: string) => ({ contributionId });
  return {
    getMeeting: () => read('get', '/meeting'),
    listMeetings: (status) => read('get', '/meetings', { query: { status } }),
    getMeetingById: (meetingId) => read('get', '/meetings/{meetingId}', { params: { meetingId } }),
    listMeetingAgendaItems: (meetingId) => read('get', '/meetings/{meetingId}/agenda-items', { params: { meetingId } }),
    listMeetingUnits: (meetingId) => read('get', '/meetings/{meetingId}/units', { params: { meetingId } }),
    openAgendaItem: async (agendaItemId, writeOptions) => write('post', '/meetings/{meetingId}/agenda-items/{agendaItemId}/opening', { params: { ...await meetingRoute(), agendaItemId }, write: writeOptions }),
    openVoting: async (agendaItemId, writeOptions) => write('post', '/meetings/{meetingId}/agenda-items/{agendaItemId}/voting/opening', { params: { ...await meetingRoute(), agendaItemId }, write: writeOptions }),
    closeVoting: async (agendaItemId, writeOptions) => write('post', '/meetings/{meetingId}/agenda-items/{agendaItemId}/voting/closure', { params: { ...await meetingRoute(), agendaItemId }, write: writeOptions }),
    listAgendaItems: () => read('get', '/agenda-items'),
    listUnits: () => read('get', '/units'),
    listRoleAssignments: async (filter) => read('get', '/meetings/{meetingId}/role-assignments', { params: await meetingRoute(), query: { subjectId: filter?.subjectId, role: filter?.role } }),
    assignRole: async (input, writeOptions) => write('post', '/meetings/{meetingId}/role-assignments', { params: await meetingRoute(), body: input, write: writeOptions }),
    revokeRole: async (id, reason, writeOptions) => write('post', '/meetings/{meetingId}/role-assignments/{assignmentId}/revocation', { params: { ...await meetingRoute(), assignmentId: id }, ...(reason !== undefined ? { body: { reason } } : {}), write: writeOptions }),
    listSpeakers: (filter) => read('get', '/speakers', { query: { round: filter?.round, status: filter?.status } }),
    getSpeaker: (speakerId) => read('get', '/speakers/{speakerId}', { params: { speakerId } }),
    registerSpeaker: (input, writeOptions) => write('post', '/speakers', { body: input, write: writeOptions }),
    reorderSpeakers: (round, speakerIds, writeOptions) => write('put', '/speakers/order', { body: { round, speakerIds }, write: writeOptions }),
    updateSpeaker: (speakerId, input, writeOptions) => {
      if (input.reason !== undefined) {
        settled('local_reject');
        return Promise.reject(new ApiProblem(422, translate(language(), 'http.errorTitle'), translate(language(), 'http.unsupported')));
      }
      return write('patch', '/speakers/{speakerId}', { params: { speakerId }, body: input, write: writeOptions });
    },
    listContributions: (filter) => read('get', '/contributions', { query: { speakerId: filter?.speakerId } }),
    getContribution: (contributionId) => read('get', '/contributions/{contributionId}', { params: contributionPath(contributionId) }),
    captureContribution: (input, writeOptions) => write('post', '/contributions', { body: input, write: writeOptions }),
    captureMeetingContribution: async (input, writeOptions) => write('post', '/meetings/{meetingId}/contributions', { params: await meetingRoute(), body: input, write: writeOptions }),
    captureQuestions: (contributionId, questions, writeOptions) => write('post', '/contributions/{contributionId}/questions', { params: contributionPath(contributionId), body: { questions }, write: writeOptions }),
    claimContribution: (contributionId, writeOptions) => write('post', '/contributions/{contributionId}/claim', { params: contributionPath(contributionId), write: writeOptions }),
    releaseContribution: (contributionId, writeOptions) => write('post', '/contributions/{contributionId}/release', { params: contributionPath(contributionId), write: writeOptions }),
    claimQuestion: (questionId, writeOptions) => write('post', '/questions/{questionId}/claim', { params: questionPath(questionId), write: writeOptions }),
    releaseQuestion: (questionId, writeOptions) => write('post', '/questions/{questionId}/release', { params: questionPath(questionId), write: writeOptions }),
    lastWriteEtag: () => writeEtag,
    listQuestions: (filter) => read('get', '/questions', { query: { status: filter?.status, track: filter?.track, unitId: filter?.unitId, speakerId: filter?.speakerId, contributionId: filter?.contributionId, agendaItemId: filter?.agendaItemId, q: filter?.q, limit: filter?.limit, offset: filter?.offset } }),
    getQuestion: (questionId) => read('get', '/questions/{questionId}', { params: questionPath(questionId) }),
    getQuestionHistory: (questionId) => read('get', '/questions/{questionId}/history', { params: questionPath(questionId) }),
    classifyQuestion: (questionId, input, writeOptions) => write('post', '/questions/{questionId}/classification', { params: questionPath(questionId), body: input, write: writeOptions }),
    assignQuestion: (questionId, unitId, writeOptions) => write('post', '/questions/{questionId}/assignment', { params: questionPath(questionId), body: { unitId }, write: writeOptions }),
    draftAnswer: (questionId, input, writeOptions) => write('post', '/questions/{questionId}/answers', { params: questionPath(questionId), body: input, write: writeOptions }),
    submitForReview: (questionId, writeOptions) => write('post', '/questions/{questionId}/review-submissions', { params: questionPath(questionId), write: writeOptions }),
    approveQuestion: (questionId, answerVersion, writeOptions) => write('post', '/questions/{questionId}/approvals', { params: questionPath(questionId), body: { answerVersion }, write: writeOptions }),
    clearQuestionLegally: (questionId, input, writeOptions) => write('post', '/questions/{questionId}/legal-clearances', { params: questionPath(questionId), body: input, write: writeOptions }),
    returnQuestion: (questionId, reason, writeOptions) => write('post', '/questions/{questionId}/returns', { params: questionPath(questionId), body: { reason }, write: writeOptions }),
    stageQuestion: (questionId, writeOptions) => write('post', '/questions/{questionId}/staging', { params: questionPath(questionId), write: writeOptions }),
    deliverQuestion: (questionId, writeOptions) => write('post', '/questions/{questionId}/delivery', { params: questionPath(questionId), write: writeOptions }),
    closeQuestion: (questionId, writeOptions) => write('post', '/questions/{questionId}/closure', { params: questionPath(questionId), write: writeOptions }),
    withdrawQuestion: (questionId, reason, writeOptions) => write('post', '/questions/{questionId}/withdrawal', { params: questionPath(questionId), body: { reason }, write: writeOptions }),
    mergeQuestion: (questionId, intoQuestionId, writeOptions) => write('post', '/questions/{questionId}/merge', { params: questionPath(questionId), body: { intoQuestionId }, write: writeOptions }),
    getStage: () => read('get', '/stage'),
    listEvents: (after, limit) => read('get', '/events', { query: { after, limit } }),
    seedDemo: () => Promise.reject(new ApiProblem(403, translate(language(), 'http.errorTitle'), translate(language(), 'http.demoOnly'))),
    subscribe(listener) {
      listeners.add(listener);
      if (pollTimer === undefined) {
        pollTimer = setInterval(() => {
          if (!options.getCsrfToken()) { stopPolling(); return; }
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
          for (const current of listeners) current([]);
        }, 30_000);
      }
      return () => { listeners.delete(listener); if (listeners.size === 0) stopPolling(); };
    },
  };
}

const authTransport: Transport = (url, init) => fetch(url, init);

export function getHttpSession(): Promise<HttpSession> {
  return perform<HttpSession>('GET', undefined, { authPath: '/auth/me' }, authTransport, 'de');
}

export function getTransparencyNotice(): Promise<TransparencyNotice> {
  return perform<TransparencyNotice>('GET', undefined, { authPath: '/auth/transparency-notice' }, authTransport, 'de');
}

export function logoutHttpSession(csrfToken: string): Promise<void> {
  return perform<void>('POST', undefined, { authPath: '/auth/logout', csrf: csrfToken }, authTransport, 'de');
}
