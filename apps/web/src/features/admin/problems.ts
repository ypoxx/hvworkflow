/**
 * Scheibe 041 (decision 7): which refusal of the service the open dialog shows, and what a tab does after one write.
 * The mapping rule id → key and status → key is a table (data); nothing here branches on a role or a status of the
 * domain. 412 is "stale" (decision 6): the dialog closes, the tab reads again and a toast says so.
 */
import type { TKey } from '../../i18n';

const RULE_KEYS: Readonly<Record<string, TKey>> = {
  'R-ADM-01': 'admin.problem.R-ADM-01',
  'R-ADM-02': 'admin.problem.R-ADM-02',
  'R-ADM-07': 'admin.problem.R-ADM-07',
  'R-ADM-08': 'admin.problem.R-ADM-08',
};

const STATUS_KEYS: Readonly<Record<number, TKey | 'stale'>> = {
  403: 'admin.problem.forbidden',
  404: 'admin.problem.notFound',
  409: 'admin.problem.conflict',
  412: 'stale',
  422: 'admin.problem.invalid',
};

interface ProblemShape {
  status: number;
  ruleId?: string;
}

/** Structural, like `showProblem`: the HTTP adapter hands out plain problem objects, the demo the domain's class. */
function problemOf(error: unknown): ProblemShape | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const { status, ruleId } = error as { status: unknown; ruleId?: unknown };
  if (typeof status !== 'number') return undefined;
  return { status, ...(typeof ruleId === 'string' ? { ruleId } : {}) };
}

/** The key of the dialog's message, `'stale'` for 412, or `undefined` for the ordinary toast. */
export function adminProblemKey(error: unknown): TKey | 'stale' | undefined {
  const problem = problemOf(error);
  if (problem === undefined) return undefined;
  if (problem.status === 409 && problem.ruleId !== undefined && Object.hasOwn(RULE_KEYS, problem.ruleId)) {
    return RULE_KEYS[problem.ruleId];
  }
  return Object.hasOwn(STATUS_KEYS, problem.status) ? STATUS_KEYS[problem.status] : undefined;
}

/** What the dialog shows: the text and, when the service named one, the rule id. */
export interface DialogProblem {
  key: TKey;
  ruleId?: string;
}

export type WriteOutcome =
  | { kind: 'saved' }
  | { kind: 'stale' }
  | ({ kind: 'problem' } & DialogProblem)
  | { kind: 'failed'; error: unknown };

/** Runs one write and names its outcome; it never throws. */
export async function attempt(run: () => Promise<unknown>): Promise<WriteOutcome> {
  try {
    await run();
    return { kind: 'saved' };
  } catch (error) {
    const key = adminProblemKey(error);
    if (key === 'stale') return { kind: 'stale' };
    if (key === undefined) return { kind: 'failed', error };
    const ruleId = problemOf(error)?.ruleId;
    return { kind: 'problem', key, ...(ruleId !== undefined ? { ruleId } : {}) };
  }
}

export interface OutcomeEffects {
  /** Close the dialog. */
  close: boolean;
  /** Read the tab's list again. */
  reload: boolean;
  /** A toast with this key (412). */
  toast?: TKey;
  /** The message inside the still open dialog. */
  problem?: DialogProblem;
  /** Anything else: the ordinary problem toast; the dialog keeps its inputs. */
  error?: unknown;
}

export function outcomeEffects(outcome: WriteOutcome): OutcomeEffects {
  switch (outcome.kind) {
    case 'saved':
      return { close: true, reload: true };
    case 'stale':
      return { close: true, reload: true, toast: 'admin.stale' };
    case 'problem':
      return {
        close: false,
        reload: false,
        problem: { key: outcome.key, ...(outcome.ruleId !== undefined ? { ruleId: outcome.ruleId } : {}) },
      };
    case 'failed':
      return { close: false, reload: false, error: outcome.error };
  }
}
