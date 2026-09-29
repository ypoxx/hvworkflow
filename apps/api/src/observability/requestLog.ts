/**
 * The outermost middleware (slice 033a): correlation id, `X-Server-Time` and the access log line.
 * It runs before CORS, authentication and the Postgres boundary, and after `await next()` it sees
 * the final response of every path — handler result, `onError`, `notFound` and a response the
 * Postgres boundary replaced — so header and log line cannot be forgotten by a branch.
 *
 * The line has exactly eight keys and never carries a path, query, header, body, question text,
 * name, IP address, user agent or error message (ADR 0013 level 2). Everything variable comes from
 * the service itself: a generated id, the contract's operationId, a keyed hash of the actor id.
 */
import { randomUUID } from 'node:crypto';
import type { Context, Next } from 'hono';
import { matchServedOperationId } from '../contractSchema.ts';
import { requestContext, type RequestContext } from './context.ts';
import type { AccessLogSink } from './accessLog.ts';

export interface RequestLogOptions {
  clock: () => Date;
  /** Monotonic milliseconds (server.ts wires the process timer); falls back to clock differences. */
  monotonic?: () => number;
  sink: AccessLogSink;
}

const SINK_FAILURE = 'HV-Tool API: access log sink unavailable.';

export function createRequestLog(options: RequestLogOptions) {
  const { clock, sink } = options;
  const elapsedSource = options.monotonic ?? ((): number => clock().getTime());
  let lastFailureMinute: number | undefined;

  const reportSinkFailure = (at: Date): void => {
    const minute = Math.floor(at.getTime() / 60_000);
    if (lastFailureMinute === minute) return;
    lastFailureMinute = minute;
    // Fixed text on purpose: the error may name a path or a device. Alerting follows in 037.
    console.error(SINK_FAILURE);
  };

  return async (c: Context, next: Next): Promise<void> => {
    const context: RequestContext = { requestId: randomUUID(), clock, subjectHash: null, seq: null,
      phase: 'running', suppressLog: false };
    const operationId = matchServedOperationId(c.req.method, c.req.path) ?? null;
    const started = elapsedSource();
    try {
      await requestContext.run(context, next);
    } finally {
      const now = clock();
      const iso = now.toISOString();
      // A handler that already fixed the header (`/readyz`: header and body from one reading) keeps it.
      if (!c.res.headers.has('X-Server-Time')) {
        try {
          c.res.headers.set('X-Server-Time', iso);
        } catch {
          c.res = new Response(c.res.body, c.res);
          c.res.headers.set('X-Server-Time', iso);
        }
      }
      // Protocol exception (slice 034a, decision 11): repeated refusals of one exhausted source key are
      // counted in a fixed stderr summary instead of one line each; the header above is still set.
      if (!context.suppressLog) {
        const line = JSON.stringify({
          v: 1,
          ts: iso,
          requestId: context.requestId,
          subjectHash: context.subjectHash,
          operationId,
          status: c.res.status,
          latencyMs: Math.max(0, Math.round(elapsedSource() - started)),
          seq: context.seq,
        });
        try {
          sink.write(line, now);
        } catch {
          reportSinkFailure(now);
        }
      }
    }
  };
}
