/** Tiny `fetch`-shaped request helper for driving `app.request()` (Hono's in-process test client). */
import type { App } from '../app.ts';

export interface ReqOptions {
  actor?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function req(app: App, method: string, path: string, opts: ReqOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.actor !== undefined) headers['X-Actor'] = opts.actor;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  return app.request(path, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
}

export const ACTOR = {
  admin: 'admin:admin',
  moderation: 'mod:moderation',
  capture: 'cap:capture',
  expert: 'exp:expert',
  legal: 'leg:legal',
  approver: 'app:approver',
  podium: 'pod:podium',
  observer: 'obs:observer',
} as const;
