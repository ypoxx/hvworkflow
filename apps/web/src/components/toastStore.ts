/**
 * Error messages live in a module store, not in a React context: a failed write is raised from an
 * event handler or a helper, and the message must survive the component that started it.
 */
import { useSyncExternalStore } from 'react';
import type { ApiProblem } from '@hv/domain';

export type ToastTone = 'neutral' | 'success' | 'danger';

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  title: string;
  /** `ApiProblem.detail` — the sentence the server can defend. */
  detail?: string;
  /** `ApiProblem.ruleId` — names the rule that refused, e.g. `R-PERM-01`. */
  ruleId?: string;
}

let nextId = 1;
let toasts: readonly ToastMessage[] = [];
const listeners = new Set<() => void>();

function emit(next: readonly ToastMessage[]): void {
  toasts = next;
  for (const l of listeners) l();
}

export function dismissToast(id: number): void {
  emit(toasts.filter((toast) => toast.id !== id));
}

export function showToast(input: Omit<ToastMessage, 'id'>): number {
  const id = nextId++;
  emit([...toasts, { ...input, id }]);
  return id;
}

/**
 * Structural check instead of `instanceof`: the interface talks to `HvApi`, and an HTTP adapter will
 * hand out a plain problem object rather than the domain's error class.
 */
function isProblem(error: unknown): error is ApiProblem {
  return typeof error === 'object' && error !== null && 'detail' in error && 'status' in error;
}

/** Show a failed API call the way the contract describes it: title, detail and the rule that said no. */
export function showProblem(error: unknown, fallbackTitle: string): number {
  if (isProblem(error)) {
    return showToast({
      tone: 'danger',
      title: error.title || fallbackTitle,
      detail: error.detail,
      ...(error.ruleId !== undefined ? { ruleId: error.ruleId } : {}),
    });
  }
  return showToast({
    tone: 'danger',
    title: fallbackTitle,
    detail: error instanceof Error ? error.message : String(error),
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = (): readonly ToastMessage[] => toasts;

export function useToasts(): readonly ToastMessage[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
