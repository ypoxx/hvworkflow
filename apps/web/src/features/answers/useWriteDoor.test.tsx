/**
 * takt-057, review finding 1: the write door (Schreibtür) takes the next action after a write the live store withheld.
 * Pages do not remount on an actor change, and every `clear()` raises the store's epoch even for the same person; a
 * withheld write that stayed unsettled would hold `writing` forever. It rejects with the content-free `WithheldAnswer`
 * instead: the door's ordinary `catch` frees the lock and reloads, and `showProblem` shows nothing for it.
 *
 * The web package has no DOM test environment (see admin/Page.test.tsx), so the hook is rendered once statically and its
 * `run` is called outside the render: refs keep working, state updates after the render are no-ops on the server.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Actor, HvApi, Question } from '@hv/domain';
import { getActor } from '../../api/actor';
import { createLiveStore } from '../../api/liveStore';
import { dismissToast, useToasts } from '../../components';
import { useWriteDoor } from './useWriteDoor';
import type { WriteDoor } from './useWriteDoor';

const question = { id: 'q-057', number: 'F-057', version: 4, _actions: ['question.close'] } as unknown as Question;

function door(reload: () => void): WriteDoor<string> {
  let captured: WriteDoor<string> | undefined;
  const Probe = () => {
    captured = useWriteDoor<string>({ question, selectedId: question.id, reload });
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  return captured!;
}

function toasts(): readonly { id: number; tone: string }[] {
  let seen: readonly { id: number; tone: string }[] = [];
  const Probe = () => {
    seen = useToasts();
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  return seen;
}

const settles = async (promise: Promise<unknown>): Promise<boolean> => {
  let done = false;
  void promise.finally(() => { done = true; });
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  return done;
};

describe('useWriteDoor after a withheld write (takt-057)', () => {
  it('frees its lock without a toast, reloads, and sends the next action', async () => {
    for (const toast of toasts()) dismissToast(toast.id);
    let release: (value: unknown) => void = () => undefined;
    const closeQuestion = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }))
      .mockImplementation(async () => ({ ...question, version: 5 }));
    const adapter = { closeQuestion, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    const person: Actor = getActor();
    let actor: Actor = person;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0 });
    const reload = vi.fn();
    const { run } = door(reload);

    const first = run('question.close', (options) => store.closeQuestion(question.id, options));
    // A stream end (`roles_changed`) for the very same person: the epoch rises, the person stays.
    actor = { ...person };
    store.clear('roles_changed');
    release({ ...question, version: 5 });
    expect(await settles(first)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(toasts().filter((toast) => toast.tone === 'danger')).toEqual([]);

    const second = run('question.close', (options) => store.closeQuestion(question.id, options));
    expect(await settles(second)).toBe(true);
    expect(closeQuestion).toHaveBeenCalledTimes(2);
  });
});
