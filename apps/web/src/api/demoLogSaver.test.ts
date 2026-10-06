import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedSaver } from './demoLogSaver';

/** takt-053: the demo log is written late, but never lost on leaving the page, and never revived by a reset. */
describe('takt-053 createDebouncedSaver', () => {
  afterEach(() => vi.useRealTimers());

  it('writes the last value of a burst once after the delay', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const saver = createDebouncedSaver<number>(write, 150);
    saver.save(1);
    saver.save(2);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith(2);
    vi.useRealTimers();
  });

  it('flush writes a pending value at once and exactly once', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const saver = createDebouncedSaver<string>(write, 150);
    saver.save('a');
    saver.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith('a');
    vi.advanceTimersByTime(500);
    expect(write).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('flush without a pending value writes nothing', () => {
    const write = vi.fn();
    createDebouncedSaver<string>(write, 150).flush();
    expect(write).not.toHaveBeenCalled();
  });

  it('cancel drops a pending value, so a later flush or the timer writes nothing', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const saver = createDebouncedSaver<string>(write, 150);
    saver.save('old');
    saver.cancel();
    saver.flush();
    vi.advanceTimersByTime(500);
    expect(write).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('stop drops a pending value and ignores every later save and flush (a reset is never undone)', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const saver = createDebouncedSaver<string>(write, 150);
    saver.save('old');
    saver.stop();
    saver.save('late');
    saver.flush();
    vi.advanceTimersByTime(500);
    expect(write).not.toHaveBeenCalled();
  });

  it('a save after cancel writes only the new value', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const saver = createDebouncedSaver<string>(write, 150);
    saver.save('old');
    saver.cancel();
    saver.save('new');
    vi.advanceTimersByTime(150);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenLastCalledWith('new');
  });
});
