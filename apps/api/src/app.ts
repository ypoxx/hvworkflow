/**
 * The HTTP surface of the HV-Tool: every path of `packages/contract/openapi.yaml` under `/v1`,
 * implemented over `createInProcessApi` from `@hv/domain` (AGENTS.md rule 6 — the contract comes
 * first, the interface uses `HvApi`, and here the server is just another `HvApi` caller reached
 * over HTTP). No business logic lives in this file: every handler maps a request to one `HvApi`
 * call and maps the result (or the `ApiProblem` it throws) back to a response.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { Hono, type Context } from 'hono';
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
import { intQuery, readJson, requireParam, writeOptions } from './http.ts';
import { problemResponse } from './problem.ts';

export interface CreateAppOptions {
  /** Defaults to `process.env.HV_DEMO === '1'` — kept overridable so tests need not touch env vars. */
  demoEnabled?: boolean;
  /** Defaults to `process.env.HV_EVENT_LOG`. Append-only JSON-lines file (AGENTS.md rule 7). */
  eventLogPath?: string;
  /** Overrides `eventLogPath` — lets tests inject an in-memory `Persistence` without touching disk. */
  persistence?: Persistence;
  clock?: () => Date;
  idGenerator?: () => string;
}

export function createApp(options: CreateAppOptions = {}): Hono {
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

  const app = new Hono();

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
  app.get('/v1/speakers', async (c) => {
    const round = intQuery(c, 'round', { min: 1 });
    const status = c.req.query('status') as Speaker['status'] | undefined;
    const filter = {
      ...(round !== undefined ? { round } : {}),
      ...(status !== undefined ? { status } : {}),
    };
    return c.json(await domain.listSpeakers(filter));
  });
  app.post('/v1/speakers', async (c) => {
    const body = await readJson<SpeakerRegistration>(c);
    const speaker = await domain.registerSpeaker(body as SpeakerRegistration, writeOptions(c));
    etag(c, speaker);
    return c.json(speaker, 201);
  });
  app.put('/v1/speakers/order', async (c) => {
    const body = await readJson<{ round: number; speakerIds: string[] }>(c);
    const speakers = await domain.reorderSpeakers(body.round ?? 1, body.speakerIds ?? [], writeOptions(c));
    return c.json(speakers);
  });
  app.get('/v1/speakers/:speakerId', async (c) => {
    const speaker = await domain.getSpeaker(requireParam(c, 'speakerId'));
    etag(c, speaker);
    return c.json(speaker);
  });
  app.patch('/v1/speakers/:speakerId', async (c) => {
    const body = await readJson<SpeakerUpdate>(c);
    const speaker = await domain.updateSpeaker(requireParam(c, 'speakerId'), body, writeOptions(c));
    etag(c, speaker);
    return c.json(speaker);
  });

  // ---- contributions --------------------------------------------------------------------------
  app.get('/v1/contributions', async (c) => {
    const speakerId = c.req.query('speakerId');
    return c.json(await domain.listContributions(speakerId !== undefined ? { speakerId } : {}));
  });
  app.post('/v1/contributions', async (c) => {
    const body = await readJson<ContributionCapture>(c);
    const contribution = await domain.captureContribution(body as ContributionCapture, writeOptions(c));
    return c.json(contribution, 201);
  });
  app.get('/v1/contributions/:contributionId', async (c) => {
    return c.json(await domain.getContribution(requireParam(c, 'contributionId')));
  });
  app.post('/v1/contributions/:contributionId/questions', async (c) => {
    const body = await readJson<{ questions: QuestionCapture[] }>(c);
    const questions = await domain.captureQuestions(
      requireParam(c, 'contributionId'),
      body.questions ?? [],
      writeOptions(c),
    );
    return c.json(questions, 201);
  });

  // ---- questions ----------------------------------------------------------------------------------
  app.get('/v1/questions', async (c) => {
    const statusParam = c.req.query('status');
    const status = statusParam
      ? (statusParam.split(',').map((s) => s.trim()).filter(Boolean) as QuestionStatus[])
      : undefined;
    const track = c.req.query('track') as Track | undefined;
    const unitId = c.req.query('unitId');
    const speakerId = c.req.query('speakerId');
    const contributionId = c.req.query('contributionId');
    const agendaItemId = c.req.query('agendaItemId');
    const q = c.req.query('q');
    const limit = intQuery(c, 'limit', { min: 1, max: 2000 });
    const offset = intQuery(c, 'offset', { min: 0 });
    const filter: QuestionFilter = {
      ...(status && status.length > 0 ? { status } : {}),
      ...(track !== undefined ? { track } : {}),
      ...(unitId !== undefined ? { unitId } : {}),
      ...(speakerId !== undefined ? { speakerId } : {}),
      ...(contributionId !== undefined ? { contributionId } : {}),
      ...(agendaItemId !== undefined ? { agendaItemId } : {}),
      ...(q !== undefined ? { q } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(offset !== undefined ? { offset } : {}),
    };
    return c.json(await domain.listQuestions(filter));
  });
  app.get('/v1/questions/:questionId', async (c) => {
    const question = await domain.getQuestion(requireParam(c, 'questionId'));
    etag(c, question);
    return c.json(question);
  });
  app.get('/v1/questions/:questionId/history', async (c) => {
    return c.json(await domain.getQuestionHistory(requireParam(c, 'questionId')));
  });

  const questionResult = (c: Context, question: Question): Response => {
    etag(c, question);
    return c.json(question);
  };

  app.post('/v1/questions/:questionId/classification', async (c) => {
    const body = await readJson<Classification>(c);
    const question = await domain.classifyQuestion(requireParam(c, 'questionId'), body as Classification, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/assignment', async (c) => {
    const body = await readJson<{ unitId: string }>(c);
    const question = await domain.assignQuestion(requireParam(c, 'questionId'), body.unitId ?? '', writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/answers', async (c) => {
    const body = await readJson<AnswerDraft>(c);
    const question = await domain.draftAnswer(requireParam(c, 'questionId'), body as AnswerDraft, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/review-submissions', async (c) => {
    const question = await domain.submitForReview(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/approvals', async (c) => {
    const body = await readJson<{ answerVersion: number }>(c);
    const question = await domain.approveQuestion(requireParam(c, 'questionId'), body.answerVersion ?? 0, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/returns', async (c) => {
    const body = await readJson<{ reason: string }>(c);
    const question = await domain.returnQuestion(requireParam(c, 'questionId'), body.reason ?? '', writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/staging', async (c) => {
    const question = await domain.stageQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/delivery', async (c) => {
    const question = await domain.deliverQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/closure', async (c) => {
    const question = await domain.closeQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/withdrawal', async (c) => {
    const body = await readJson<{ reason: string }>(c);
    const question = await domain.withdrawQuestion(requireParam(c, 'questionId'), body.reason ?? '', writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/merge', async (c) => {
    const body = await readJson<{ intoQuestionId: string }>(c);
    const question = await domain.mergeQuestion(requireParam(c, 'questionId'), body.intoQuestionId ?? '', writeOptions(c));
    return questionResult(c, question);
  });

  // ---- stage / events / demo -----------------------------------------------------------------
  app.get('/v1/stage', async (c) => c.json(await domain.getStage()));
  app.get('/v1/events', async (c) => {
    const after = intQuery(c, 'after', { min: 0 });
    const limit = intQuery(c, 'limit', { min: 1, max: 5000 });
    return c.json(await domain.listEvents(after, limit));
  });
  app.post('/v1/demo/seed', async (c) => {
    if (!demoEnabled) {
      throw new ApiProblem(403, 'Forbidden', 'Demo endpoints are disabled. Set HV_DEMO=1 to enable them.');
    }
    const body = await readJson<{ questions?: number; seed?: number }>(c);
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
