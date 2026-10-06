/**
 * takt-057, review finding 1: a write the live store withheld after an actor change or `clear()` rejects with the
 * content-free `WithheldAnswer`, so the view's write lock falls in its `catch`/`finally`. That rejection is no refusal
 * of the person on screen: `showProblem` shows nothing for it, every other error still becomes a toast.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WithheldAnswer } from '../api/liveStore';
import { dismissToast, showProblem, useToasts } from './toastStore';

/** The current toasts, read through the public hook (the store keeps its list private). */
function current(): readonly { id: number; title: string }[] {
  let seen: readonly { id: number; title: string }[] = [];
  const Probe = () => {
    seen = useToasts();
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  return seen;
}

describe('showProblem and the withheld write (takt-057)', () => {
  it('shows no toast for WithheldAnswer', () => {
    for (const toast of current()) dismissToast(toast.id);
    showProblem(new WithheldAnswer(), 'Fehler');
    expect(current()).toEqual([]);
  });

  it('still shows a toast for any other error', () => {
    for (const toast of current()) dismissToast(toast.id);
    showProblem(new Error('kaputt'), 'Fehler');
    expect(current().map((toast) => toast.title)).toEqual(['Fehler']);
  });
});
