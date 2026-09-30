import { describe, expect, it } from 'vitest';
import { INITIAL_CONNECTION, createConnectionStore, nextConnectionState, type ConnectionSignal, type ConnectionState } from './connection';

const run = (signals: readonly ConnectionSignal[], start: ConnectionState = INITIAL_CONNECTION, now = 1000): ConnectionState =>
  signals.reduce((state, signal) => nextConnectionState(state, signal, now), start);

describe('connection state (slice 036b)', () => {
  it('starts idle and goes connecting → live, which also sets the time of the data', () => {
    expect(INITIAL_CONNECTION.phase).toBe('idle');
    expect(run([{ type: 'start' }]).phase).toBe('connecting');
    const live = run([{ type: 'start' }, { type: 'opened' }], INITIAL_CONNECTION, 5000);
    expect(live).toMatchObject({ phase: 'live', asOf: 5000 });
  });

  it('a lost stream is reconnecting, a new attempt keeps that phase until the stream is open again', () => {
    const lost = run([{ type: 'start' }, { type: 'opened' }, { type: 'lost' }]);
    expect(lost.phase).toBe('reconnecting');
    expect(run([{ type: 'start' }], lost).phase).toBe('reconnecting');
    expect(run([{ type: 'start' }, { type: 'opened' }], lost).phase).toBe('live');
  });

  it('a refused open (429, 503, short-lived streams) is polling', () => {
    const polling = run([{ type: 'start' }, { type: 'fallback' }]);
    expect(polling.phase).toBe('polling');
    expect(run([{ type: 'start' }], polling).phase).toBe('polling');
  });

  it('three network errors in a row are offline; an open stream resets the count', () => {
    const two = run([{ type: 'start' }, { type: 'networkError' }, { type: 'networkError' }]);
    expect(two.phase).toBe('reconnecting');
    expect(run([{ type: 'networkError' }], two).phase).toBe('offline');
    const reset = run([{ type: 'opened' }, { type: 'lost' }, { type: 'networkError' }], two);
    expect(reset.phase).toBe('reconnecting');
  });

  it('the browser offline flag is offline whatever else happens; online again goes back to reconnecting', () => {
    const offline = run([{ type: 'start' }, { type: 'opened' }, { type: 'offline' }]);
    expect(offline.phase).toBe('offline');
    expect(run([{ type: 'lost' }], offline).phase).toBe('offline');
    expect(run([{ type: 'fallback' }], offline).phase).toBe('offline');
    expect(run([{ type: 'online' }], offline).phase).toBe('reconnecting');
  });

  it('synced moves the time of the data only; stop is idle and forgets it', () => {
    const live = run([{ type: 'start' }, { type: 'opened' }], INITIAL_CONNECTION, 1000);
    const later = nextConnectionState(run([{ type: 'lost' }], live), { type: 'synced' }, 9000);
    expect(later).toMatchObject({ phase: 'reconnecting', asOf: 9000 });
    expect(run([{ type: 'stop' }], later)).toMatchObject({ phase: 'idle', asOf: undefined });
    // Idle ignores everything but a new start.
    expect(run([{ type: 'lost' }, { type: 'fallback' }, { type: 'networkError' }]).phase).toBe('idle');
  });

  it('the store notifies only on a real change and hands out the same object otherwise', () => {
    let clock = 0;
    const store = createConnectionStore(() => clock);
    const seen: string[] = [];
    const off = store.subscribe(() => seen.push(store.get().phase));
    store.dispatch({ type: 'start' });
    const first = store.get();
    store.dispatch({ type: 'start' });
    expect(store.get()).toBe(first);
    clock = 10;
    store.dispatch({ type: 'opened' });
    off();
    store.dispatch({ type: 'lost' });
    expect(seen).toEqual(['connecting', 'live']);
  });
});
