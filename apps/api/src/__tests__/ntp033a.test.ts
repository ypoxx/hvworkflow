/**
 * Scheibe 033a: SNTP status in `/readyz` (T-G2-D-01, T-G1-D-04). Only UDP servers on 127.0.0.1 —
 * no real network. The fake server speaks just enough NTPv4 to be asked by `clock/ntp.ts`.
 */
import { createSocket, type RemoteInfo, type Socket } from 'node:dgram';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { createNtpClockCheck, parseNtpEnv } from '../clock/ntp.ts';
import { req } from './helpers.ts';

const NTP_EPOCH_OFFSET = 2_208_988_800;
const base = new Date('2031-05-06T07:08:09.000Z');

function ntpTimestamp(ms: number): Buffer {
  const out = Buffer.alloc(8);
  out.writeUInt32BE(Math.floor(ms / 1000) + NTP_EPOCH_OFFSET, 0);
  out.writeUInt32BE(Math.round(((ms % 1000) / 1000) * 2 ** 32) >>> 0, 4);
  return out;
}

interface Behaviour {
  /** Offset of the server clock against `base` in ms. */
  delta?: number;
  leap?: number;
  stratum?: number;
  mode?: number;
  wrongOriginate?: boolean;
  fromOtherPort?: boolean;
  /** Send one forged packet (wrong originate) before the real answer. */
  forgedFirst?: boolean;
  silent?: boolean;
  delayMs?: number;
}

interface FakeServer { port: number; requests: Buffer[]; socket: Socket; behaviour: Behaviour }

const open: Socket[] = [];
afterEach(() => { for (const s of open.splice(0)) { try { s.close(); } catch { /* already closed */ } } });

async function fakeServer(behaviour: Behaviour = {}, clockMs: () => number = () => base.getTime()): Promise<FakeServer> {
  const socket = createSocket('udp4');
  const other = createSocket('udp4');
  open.push(socket, other);
  await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
  await new Promise<void>((resolve) => other.bind(0, '127.0.0.1', resolve));
  const server: FakeServer = { port: socket.address().port, requests: [], socket, behaviour };
  socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => {
    server.requests.push(msg);
    const b = server.behaviour;
    if (b.silent) return;
    const reply = Buffer.alloc(48);
    reply[0] = ((b.leap ?? 0) << 6) | (4 << 3) | (b.mode ?? 4);
    reply[1] = b.stratum ?? 2;
    (b.wrongOriginate ? Buffer.alloc(8, 7) : msg.subarray(40, 48)).copy(reply, 24);
    const t = clockMs() + (b.delta ?? 0);
    ntpTimestamp(t).copy(reply, 32);
    ntpTimestamp(t).copy(reply, 40);
    if (b.forgedFirst) {
      const forged = Buffer.from(reply);
      Buffer.alloc(8, 9).copy(forged, 24);
      socket.send(forged, rinfo.port, rinfo.address);
    }
    const send = (): void => { (b.fromOtherPort ? other : socket).send(reply, rinfo.port, rinfo.address); };
    if (b.delayMs) setTimeout(send, b.delayMs); else send();
  });
  return server;
}

const at = (server: FakeServer) => ({ host: '127.0.0.1', port: server.port });
const check = (servers: FakeServer[], extra: { maxDriftMs?: number; clock?: () => Date } = {}) =>
  createNtpClockCheck({ servers: servers.map(at), maxDriftMs: extra.maxDriftMs ?? 1000, clock: extra.clock ?? (() => base) });

describe('Scheibe 033a: SNTP client (T-G2-D-01)', () => {
  it('reports ok for a synchronised server within the drift limit', async () => {
    const server = await fakeServer({ delta: 200 });
    expect(await check([server])()).toEqual({ status: 'ok' });
  });

  it('reports clock_drift when the offset exceeds the limit, in either direction', async () => {
    for (const delta of [5000, -5000]) {
      const server = await fakeServer({ delta });
      expect(await check([server])()).toEqual({ status: 'fail', code: 'clock_drift' });
    }
  });

  it.each<[string, Behaviour]>([
    ['leap indicator 3', { leap: 3 }],
    ['stratum 0', { stratum: 0 }],
    ['stratum 16', { stratum: 16 }],
    ['mode 3 instead of 4', { mode: 3 }],
  ])('reports clock_unsynced for %s', async (_label, behaviour) => {
    const server = await fakeServer(behaviour);
    expect(await check([server])()).toEqual({ status: 'fail', code: 'clock_unsynced' });
  });

  it.each<[string, Behaviour]>([
    ['a wrong originate field', { wrongOriginate: true }],
    ['a foreign sender port', { fromOtherPort: true }],
  ])('drops a packet with %s silently: timeout, not clock_unsynced', async (_label, behaviour) => {
    const server = await fakeServer(behaviour);
    expect(await check([server])()).toEqual({ status: 'fail', code: 'timeout' });
  });

  it('keeps listening after a forged packet: the genuine answer in the same slot gives ok', async () => {
    const server = await fakeServer({ forgedFirst: true });
    expect(await check([server])()).toEqual({ status: 'ok' });
  });

  it('reports clock_unsynced for a DNS failure and never leaks the host', async () => {
    const run = createNtpClockCheck({ servers: [{ host: 'ntp.secret-host.example', port: 123 }], maxDriftMs: 1000,
      clock: () => base, lookup: async () => { throw new Error('ENOTFOUND ntp.secret-host.example'); } });
    const result = await run();
    expect(result).toEqual({ status: 'fail', code: 'clock_unsynced' });
    expect(JSON.stringify(result)).not.toContain('secret-host');
  });

  it('reports timeout for a silent server and not_configured without servers', async () => {
    const silent = await fakeServer({ silent: true });
    expect(await check([silent])()).toEqual({ status: 'fail', code: 'timeout' });
    expect(await createNtpClockCheck({ servers: [], maxDriftMs: 1000, clock: () => base })())
      .toEqual({ status: 'fail', code: 'not_configured' });
  });

  it('asks the second server when the first is silent, within the 1800 ms budget', async () => {
    const silent = await fakeServer({ silent: true });
    const good = await fakeServer();
    const started = Date.now();
    expect(await check([silent, good])()).toEqual({ status: 'ok' });
    const took = Date.now() - started;
    expect(took).toBeGreaterThanOrEqual(500);
    expect(took).toBeLessThanOrEqual(1800);
    expect(silent.requests).toHaveLength(1);
    expect(good.requests).toHaveLength(1);
  });

  it('asks the third server when two are silent, and times out after at most 1800 ms when all three are', async () => {
    const [a, b, c] = [await fakeServer({ silent: true }), await fakeServer({ silent: true }), await fakeServer({ silent: true })];
    const started = Date.now();
    expect(await check([a, b, c])()).toEqual({ status: 'fail', code: 'timeout' });
    expect(Date.now() - started).toBeLessThanOrEqual(1900);
    c.behaviour.silent = false;
    const again = createNtpClockCheck({ servers: [a, b, c].map(at), maxDriftMs: 1000, clock: () => base });
    expect(await again()).toEqual({ status: 'ok' });
  });

  it('discards a reply after the budget: neither result nor cache change', async () => {
    let nowMs = base.getTime();
    const late = await fakeServer({ delayMs: 900 }, () => nowMs);
    const run = createNtpClockCheck({ servers: [at(late)], maxDriftMs: 1000, clock: () => new Date(nowMs) });
    expect(await run()).toEqual({ status: 'fail', code: 'timeout' });
    await new Promise((r) => setTimeout(r, 500)); // the late reply arrives now
    expect(await run()).toEqual({ status: 'fail', code: 'timeout' });
    expect(late.requests).toHaveLength(1);
    nowMs += 31_000;
    late.behaviour.delayMs = 0;
    expect(await run()).toEqual({ status: 'ok' });
  });

  it('puts a random transmit field into every request, not a coding of the injected clock', async () => {
    let nowMs = base.getTime();
    const server = await fakeServer();
    const run = createNtpClockCheck({ servers: [at(server)], maxDriftMs: 1000, clock: () => new Date(nowMs) });
    await run();
    nowMs += 31_000;
    await run();
    expect(server.requests).toHaveLength(2);
    const [first, second] = server.requests.map((m) => m.subarray(40, 48));
    expect(first!.equals(second!)).toBe(false);
    for (const m of server.requests) {
      expect(m.length).toBe(48);
      expect(m[0]).toBe(0x23);
      expect(m.subarray(40, 44).readUInt32BE(0)).not.toBe(Math.floor(nowMs / 1000) + NTP_EPOCH_OFFSET);
      expect(m.subarray(40, 44).readUInt32BE(0)).not.toBe(Math.floor(base.getTime() / 1000) + NTP_EPOCH_OFFSET);
    }
  });
});

describe('Scheibe 033a: cache and load limit on the public probe (T-G1-D-04)', () => {
  it('sends one query for 100 calls within 30 s, and another after the interval', async () => {
    let nowMs = base.getTime();
    const server = await fakeServer();
    const run = createNtpClockCheck({ servers: [at(server)], maxDriftMs: 1000, clock: () => new Date(nowMs) });
    const results = await Promise.all(Array.from({ length: 100 }, () => run()));
    expect(results.every((r) => r.status === 'ok')).toBe(true);
    expect(server.requests).toHaveLength(1);
    nowMs += 29_999;
    for (let i = 0; i < 20; i += 1) await run();
    expect(server.requests).toHaveLength(1);
    nowMs += 1;
    await run();
    expect(server.requests).toHaveLength(2);
  });

  it('caches an error code as well', async () => {
    const server = await fakeServer({ leap: 3 });
    const run = check([server]);
    for (let i = 0; i < 10; i += 1) expect(await run()).toEqual({ status: 'fail', code: 'clock_unsynced' });
    expect(server.requests).toHaveLength(1);
  });

  it('limits /readyz itself: many public calls, one outbound query', async () => {
    const server = await fakeServer();
    const app = createApp({ demoEnabled: true, clock: () => base, persistence: { load: () => undefined, save: () => {} },
      clockHealth: check([server]) });
    const responses = await Promise.all(Array.from({ length: 100 }, () => req(app, 'GET', '/readyz')));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(server.requests).toHaveLength(1);
  });
});

describe('Scheibe 033a: /readyz with the clock check', () => {
  const persistence = { load: () => undefined, save: () => {} };

  it('is 200 only when every check is ok, and the body carries no host, address or offset', async () => {
    const good = await fakeServer({ delta: 123 });
    const app = createApp({ demoEnabled: true, clock: () => base, persistence, clockHealth: check([good]) });
    const ok = await req(app, 'GET', '/readyz');
    expect(ok.status).toBe(200);
    const text = JSON.stringify(await ok.json());
    expect(text).toContain('"clock":{"status":"ok"}');
    for (const forbidden of ['127.0.0.1', String(good.port), '123', 'offset']) {
      expect(text.replace('2031-05-06T07:08:09.000Z', '')).not.toContain(forbidden);
    }
    const bad = await fakeServer({ delta: 9000 });
    const drifting = createApp({ demoEnabled: true, clock: () => base, persistence, clockHealth: check([bad]) });
    const notReady = await req(drifting, 'GET', '/readyz');
    expect(notReady.status).toBe(503);
    expect((await notReady.json() as { checks: { clock: unknown } }).checks.clock)
      .toEqual({ status: 'fail', code: 'clock_drift' });
  });

  it('keeps not_configured without clockHealth', async () => {
    const app = createApp({ demoEnabled: true, clock: () => base, persistence });
    const res = await req(app, 'GET', '/readyz');
    expect(res.status).toBe(503);
    expect((await res.json() as { checks: { clock: unknown } }).checks.clock)
      .toEqual({ status: 'fail', code: 'not_configured' });
  });
});

describe('Scheibe 033a: NTP configuration', () => {
  it('parses host[:port], at most three, default drift 1000 ms', () => {
    expect(parseNtpEnv({})).toBeUndefined();
    expect(parseNtpEnv({ HV_NTP_SERVERS: '' })).toBeUndefined();
    expect(parseNtpEnv({ HV_NTP_SERVERS: 'a.example:1234, b.example ,[::1]:99' })).toEqual({
      servers: [{ host: 'a.example', port: 1234 }, { host: 'b.example', port: 123 }, { host: '::1', port: 99 }],
      maxDriftMs: 1000 });
  });

  it('refuses malformed input with a fixed sentence that does not echo the value', () => {
    for (const env of [
      { HV_NTP_SERVERS: 'a,b,c,d' }, { HV_NTP_SERVERS: 'a:0' }, { HV_NTP_SERVERS: 'a:70000' },
      { HV_NTP_SERVERS: 'bad host' }, { HV_NTP_SERVERS: 'a', HV_CLOCK_MAX_DRIFT_MS: '49' },
      { HV_NTP_SERVERS: 'a', HV_CLOCK_MAX_DRIFT_MS: '60001' }, { HV_NTP_SERVERS: 'a', HV_CLOCK_MAX_DRIFT_MS: 'x' },
    ]) {
      let message = '';
      try { parseNtpEnv(env); } catch (e) { message = String(e); }
      expect(message, JSON.stringify(env)).toMatch(/^Error: HV-Tool API: refusing to start: HV_NTP_SERVERS|HV_CLOCK_MAX_DRIFT_MS/);
      expect(message).not.toContain('bad host');
    }
    expect(parseNtpEnv({ HV_NTP_SERVERS: 'a', HV_CLOCK_MAX_DRIFT_MS: '50' })!.maxDriftMs).toBe(50);
    expect(parseNtpEnv({ HV_NTP_SERVERS: 'a', HV_CLOCK_MAX_DRIFT_MS: '60000' })!.maxDriftMs).toBe(60000);
  });
});
