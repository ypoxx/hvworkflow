/**
 * The HTTP surface of the HV-Tool: every path of `packages/contract/openapi.yaml` under `/v1`,
 * implemented over `createInProcessApi` from `@hv/domain` (AGENTS.md rule 6 — the contract comes
 * first, the interface uses `HvApi`, and here the server is just another `HvApi` caller reached
 * over HTTP). No business logic lives in this file: every handler maps a request to one `HvApi`
 * call and maps the result (or the `ApiProblem` it throws) back to a response. `validateOperation`
 * (see `validate.ts`) checks every request against the contract's own schemas first, so a
 * wrongly-typed or contract-violating request never reaches the domain (rework review blockers 1/2).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import {
  ApiProblem,
  createInMemoryEventStore,
  createInProcessApi,
  etagOf,
  seedEvents,
  type Actor,
  type AnswerDraft,
  type Classification,
  type ContributionCapture,
  type HvApi,
  type Persistence,
  type Question,
  type QuestionCapture,
  type QuestionFilter,
  type QuestionStatus,
  type Speaker,
  type SpeakerRegistration,
  type SpeakerUpdate,
  type Track,
} from '@hv/domain';
import { parseActorHeader } from './actor.ts';
import { createFileEventLog } from './eventLog.ts';
import { requireParam, writeOptions } from './http.ts';
import { problemResponse } from './problem.ts';
import { getValidatedBody, getValidatedQuery, validateOperation, type Variables } from './validate.ts';

export interface CreateAppOptions {
  /** Defaults to `process.env.HV_DEMO === '1'` — kept overridable so tests need not touch env vars. */
  demoEnabled?: boolean;
  /** Defaults to `process.env.HV_EVENT_LOG`. Append-only JSON-lines file (AGENTS.md rule 7). */
  eventLogPath?: string;
  /** Overrides `eventLogPath` — lets tests inject an in-memory `Persistence` without touching disk. */
  persistence?: Persistence;
  clock?: () => Date;
  idGenerator?: () => string;
  /**
   * Seed the synthetic demo corpus once at startup when demo mode is on and the store is still
   * empty (rework review major 5 — makes `pnpm --filter @hv/api dev` reproducible on its own). Off
   * by default so constructing an app for a test never has this side effect; `server.ts` turns it on.
   */
  seedOnStart?: boolean;
}

/** The concrete app type (with its `Variables`), so tests can type `let app: App` without repeating it. */
export type App = Hono<{ Variables: Variables }>;

export function createApp(options: CreateAppOptions = {}): App {
  const demoEnabled = options.demoEnabled ?? process.env['HV_DEMO'] === '1';
  const eventLogPath = options.eventLogPath ?? process.env['HV_EVENT_LOG'];
  const persistence = options.persistence ?? (eventLogPath !== undefined ? createFileEventLog(eventLogPath) : undefined);
  const store = createInMemoryEventStore(persistence);
  const actorStorage = new AsyncLocalStorage<Actor>();

  const domain: HvApi = createInProcessApi({
    store,
    actor: () => {
      const actor = actorStorage.getStore();
      // The global middleware below always sets this before a handler runs; this is a safety net.
      if (!actor) throw new ApiProblem(401, 'Unauthorized', 'The X-Actor header is required.');
      return actor;
    },
    ...(options.clock !== undefined ? { clock: options.clock } : {}),
    ...(options.idGenerator !== undefined ? { idGenerator: options.idGenerator } : {}),
    seeder: seedEvents,
  });

  if (options.seedOnStart && demoEnabled && store.lastSeq() === 0) {
    // `seedDemo` (packages/domain) does no real async I/O (AGENTS.md: "no framework, no I/O"), so the
    // store is already populated by the time this synchronous function returns even though the
    // promise below is not awaited here; `actorStorage.run` supplies the actor `seedDemo` needs
    // outside of any HTTP request.
    actorStorage.run({ id: 'system', role: 'admin' }, () => {
      domain
        .seedDemo({})
        .then((meeting) => {
          // eslint-disable-next-line no-console
          console.log(`HV-Tool API: demo mode — seeded ${meeting.counts.questions} sample questions.`);
        })
        .catch((err: unknown) => {
          console.error('HV-Tool API: demo auto-seed failed:', err);
        });
    });
  }

  const app = new Hono<{ Variables: Variables }>();

  // ---- CORS (dev only) -------------------------------------------------------------------------
  // The contract is same-origin (openapi.yaml: `servers: /v1`); this exists only so the Vite dev
  // server (apps/web, default port 5173) can reach a demo-mode server across origins.
  if (demoEnabled) {
    app.use(
      '/v1/*',
      cors({
        origin: 'http://localhost:5173',
        allowHeaders: ['X-Actor', 'If-Match', 'Idempotency-Key', 'Content-Type'],
        exposeHeaders: ['ETag'],
      }),
    );
  }

  // ---- actor + errors -------------------------------------------------------------------------
  app.use('*', async (c, next) => {
    const actor = parseActorHeader(c.req.header('X-Actor'));
    await actorStorage.run(actor, () => next());
  });
  app.onError((err, _c) => problemResponse(err));
  app.notFound(() => problemResponse(new ApiProblem(404, 'Not found', 'No such route.')));

  const etag = (c: Context, resource: { version: number }): void => {
    c.header('ETag', etagOf(resource.version));
  };

  // ---- meeting ----------------------------------------------------------------------------------
  app.get('/v1/meeting', async (c) => c.json(await domain.getMeeting()));
  app.get('/v1/agenda-items', async (c) => c.json(await domain.listAgendaItems()));
  app.get('/v1/units', async (c) => c.json(await domain.listUnits()));

  // ---- speakers -----------------------------------------------------------------------------------
  app.get('/v1/speakers', validateOperation('listSpeakers'), async (c) => {
    const query = getValidatedQuery(c);
    const round = query['round'] as number | undefined;
    const status = query['status'] as Speaker['status'] | undefined;
    const filter = {
      ...(round !== undefined ? { round } : {}),
      ...(status !== undefined ? { status } : {}),
    };
    return c.json(await domain.listSpeakers(filter));
  });
  app.post('/v1/speakers', validateOperation('registerSpeaker'), async (c) => {
    const body = getValidatedBody<SpeakerRegistration>(c);
    const speaker = await domain.registerSpeaker(body, writeOptions(c));
    etag(c, speaker);
    return c.json(speaker, 201);
  });
  app.put('/v1/speakers/order', validateOperation('reorderSpeakers'), async (c) => {
    const body = getValidatedBody<{ round: number; speakerIds: string[] }>(c);
    const speakers = await domain.reorderSpeakers(body.round, body.speakerIds, writeOptions(c));
    return c.json(speakers);
  });
  app.get('/v1/speakers/:speakerId', validateOperation('getSpeaker'), async (c) => {
    const speaker = await domain.getSpeaker(requireParam(c, 'speakerId'));
    etag(c, speaker);
    return c.json(speaker);
  });
  app.patch('/v1/speakers/:speakerId', validateOperation('updateSpeaker'), async (c) => {
    const body = getValidatedBody<SpeakerUpdate>(c);
    const speaker = await domain.updateSpeaker(requireParam(c, 'speakerId'), body, writeOptions(c));
    etag(c, speaker);
    return c.json(speaker);
  });

  // ---- contributions --------------------------------------------------------------------------
  app.get('/v1/contributions', validateOperation('listContributions'), async (c) => {
    const speakerId = getValidatedQuery(c)['speakerId'] as string | undefined;
    return c.json(await domain.listContributions(speakerId !== undefined ? { speakerId } : {}));
  });
  app.post('/v1/contributions', validateOperation('captureContribution'), async (c) => {
    const body = getValidatedBody<ContributionCapture>(c);
    const contribution = await domain.captureContribution(body, writeOptions(c));
    return c.json(contribution, 201);
  });
  app.get('/v1/contributions/:contributionId', validateOperation('getContribution'), async (c) => {
    return c.json(await domain.getContribution(requireParam(c, 'contributionId')));
  });
  app.post('/v1/contributions/:contributionId/questions', validateOperation('captureQuestions'), async (c) => {
    const body = getValidatedBody<{ questions: QuestionCapture[] }>(c);
    const questions = await domain.captureQuestions(requireParam(c, 'contributionId'), body.questions, writeOptions(c));
    return c.json(questions, 201);
  });

  // ---- questions ----------------------------------------------------------------------------------
  app.get('/v1/questions', validateOperation('listQuestions'), async (c) => {
    const query = getValidatedQuery(c);
    const filter: QuestionFilter = {
      ...((query['status'] as QuestionStatus[] | undefined)?.length ? { status: query['status'] as QuestionStatus[] } : {}),
      ...(query['track'] !== undefined ? { track: query['track'] as Track } : {}),
      ...(query['unitId'] !== undefined ? { unitId: query['unitId'] as string } : {}),
      ...(query['speakerId'] !== undefined ? { speakerId: query['speakerId'] as string } : {}),
      ...(query['contributionId'] !== undefined ? { contributionId: query['contributionId'] as string } : {}),
      ...(query['agendaItemId'] !== undefined ? { agendaItemId: query['agendaItemId'] as string } : {}),
      ...(query['q'] !== undefined ? { q: query['q'] as string } : {}),
      ...(query['limit'] !== undefined ? { limit: query['limit'] as number } : {}),
      ...(query['offset'] !== undefined ? { offset: query['offset'] as number } : {}),
    };
    return c.json(await domain.listQuestions(filter));
  });
  app.get('/v1/questions/:questionId', validateOperation('getQuestion'), async (c) => {
    const question = await domain.getQuestion(requireParam(c, 'questionId'));
    etag(c, question);
    return c.json(question);
  });
  app.get('/v1/questions/:questionId/history', validateOperation('getQuestionHistory'), async (c) => {
    return c.json(await domain.getQuestionHistory(requireParam(c, 'questionId')));
  });

  const questionResult = (c: Context, question: Question): Response => {
    etag(c, question);
    return c.json(question);
  };

  app.post('/v1/questions/:questionId/classification', validateOperation('classifyQuestion'), async (c) => {
    const body = getValidatedBody<Classification>(c);
    const question = await domain.classifyQuestion(requireParam(c, 'questionId'), body, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/assignment', validateOperation('assignQuestion'), async (c) => {
    const body = getValidatedBody<{ unitId: string }>(c);
    const question = await domain.assignQuestion(requireParam(c, 'questionId'), body.unitId, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/answers', validateOperation('draftAnswer'), async (c) => {
    const body = getValidatedBody<AnswerDraft>(c);
    const question = await domain.draftAnswer(requireParam(c, 'questionId'), body, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/review-submissions', validateOperation('submitForReview'), async (c) => {
    const question = await domain.submitForReview(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/approvals', validateOperation('approveQuestion'), async (c) => {
    const body = getValidatedBody<{ answerVersion: number }>(c);
    const question = await domain.approveQuestion(requireParam(c, 'questionId'), body.answerVersion, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/returns', validateOperation('returnQuestion'), async (c) => {
    const body = getValidatedBody<{ reason: string }>(c);
    const question = await domain.returnQuestion(requireParam(c, 'questionId'), body.reason, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/staging', validateOperation('stageQuestion'), async (c) => {
    const question = await domain.stageQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/delivery', validateOperation('deliverQuestion'), async (c) => {
    const question = await domain.deliverQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/closure', validateOperation('closeQuestion'), async (c) => {
    const question = await domain.closeQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/withdrawal', validateOperation('withdrawQuestion'), async (c) => {
    const body = getValidatedBody<{ reason: string }>(c);
    const question = await domain.withdrawQuestion(requireParam(c, 'questionId'), body.reason, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/merge', validateOperation('mergeQuestion'), async (c) => {
    const body = getValidatedBody<{ intoQuestionId: string }>(c);
    const question = await domain.mergeQuestion(requireParam(c, 'questionId'), body.intoQuestionId, writeOptions(c));
    return questionResult(c, question);
  });

  // ---- stage / events / demo -----------------------------------------------------------------
  app.get('/v1/stage', async (c) => c.json(await domain.getStage()));
  app.get('/v1/events', validateOperation('listEvents'), async (c) => {
    const query = getValidatedQuery(c);
    return c.json(await domain.listEvents(query['after'] as number | undefined, query['limit'] as number | undefined));
  });
  app.post('/v1/demo/seed', validateOperation('seedDemo'), async (c) => {
    if (!demoEnabled) {
      throw new ApiProblem(403, 'Forbidden', 'Demo endpoints are disabled. Set HV_DEMO=1 to enable them.');
    }
    const body = getValidatedBody<{ questions?: number; seed?: number }>(c);
    const seedOptions = {
      ...(body.questions !== undefined ? { questions: body.questions } : {}),
      ...(body.seed !== undefined ? { seed: body.seed } : {}),
    };
    return c.json(await domain.seedDemo(seedOptions));
  });

  // GET /v1/stream (SSE) is not implemented: optional per the slice spec (polling /v1/events is the
  // contract minimum) and left out of this pass under time pressure — see the slice's Open section.

  return app;
}
