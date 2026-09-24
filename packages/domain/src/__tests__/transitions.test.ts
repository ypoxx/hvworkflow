/**
 * One test per rule id of the transition table, plus the generated truth table
 * Role × Status × Action, diffed against the committed file (docs gate "Policy-Wahrheitstabelle").
 */
import { describe, expect, it } from 'vitest';
import { TRANSITIONS, resolveTransition, TRANSITION_ACTIONS, type Guard } from '../transitions.js';
import { can } from '../api.js';
import { PERMISSIONS, QUESTION_STATUSES, type QuestionRecord, type Role, type Permission } from '../types.js';
import { ROLE_PERMISSIONS, READ_PERMISSION_LIST, READ_SCOPES } from '../permissions.js';

const ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];

function question(overrides: Partial<QuestionRecord> = {}): QuestionRecord {
  return {
    id: 'q1',
    number: 'F-0001',
    contributionId: 'c1',
    speakerId: 's1',
    text: 'Wie hoch war die Ausschüttungsquote?',
    status: 'captured',
    answers: [],
    version: 1,
    createdAt: '2027-04-20T08:00:00.000Z',
    updatedAt: '2027-04-20T08:00:00.000Z',
    ...overrides,
  };
}

describe('transition table', () => {
  it('has unique rule ids', () => {
    const ids = TRANSITIONS.map((t) => t.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const t of TRANSITIONS) {
    it(`${t.ruleId}: ${t.action} from [${t.from.join(', ')}] — ${t.description}`, () => {
      // A representative question that satisfies every guard of this row.
      const base = question({
        status: t.from[0]!,
        track: t.ruleId === 'R-TRANS-08' ? 'podium' : 'expert_track',
        answers: [{ version: 1, text: 'Antwort', createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'e', role: 'expert' } }],
      });
      const payload = t.action === 'question.approve' ? { answerVersion: 1 } : t.action === 'question.merge' ? { intoQuestionId: 'q2' } : undefined;
      const r = resolveTransition(base, t.action, payload);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.transition.ruleId).toBe(t.ruleId);
      // And it is forbidden from a status the row does not list.
      const other = QUESTION_STATUSES.find((s) => !t.from.includes(s) && !['closed', 'withdrawn', 'merged'].includes(s));
      if (other) {
        const otherRows = TRANSITIONS.filter((x) => x.action === t.action && x.from.includes(other));
        if (otherRows.length === 0) {
          expect(resolveTransition(question({ ...base, status: other }), t.action, payload).ok).toBe(false);
        }
      }
    });
  }

  it('R-TRANS-00: terminal statuses accept no action', () => {
    for (const s of ['closed', 'withdrawn', 'merged'] as const) {
      for (const p of PERMISSIONS) {
        expect(resolveTransition(question({ status: s }), p).ok).toBe(false);
      }
    }
  });

  it('R-GUARD-04: approval must name the latest answer version', () => {
    const q = question({
      status: 'in_review',
      track: 'expert_track',
      answers: [
        { version: 1, text: 'v1', createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'e', role: 'expert' } },
        { version: 2, text: 'v2', createdAt: '2027-04-20T09:10:00.000Z', createdBy: { id: 'e', role: 'expert' } },
      ],
    });
    expect(resolveTransition(q, 'question.approve', { answerVersion: 1 }).ok).toBe(false);
    expect(resolveTransition(q, 'question.approve', { answerVersion: 2 }).ok).toBe(true);
  });

  it('R-TRANS-06: a returned podium question goes back to classified, a text question to answer_drafted', () => {
    const podium = resolveTransition(question({ status: 'staged', track: 'podium' }), 'question.return', { reason: 'x' });
    const expert = resolveTransition(question({ status: 'staged', track: 'expert_track' }), 'question.return', { reason: 'x' });
    expect(podium.ok && podium.to).toBe('classified');
    expect(expert.ok && expert.to).toBe('answer_drafted');
  });
});

/**
 * Slice 011, Festlegung 3: one generated test per guard, collected from `TRANSITIONS[].guards` (no
 * duplicates, no second list) — each one checked once satisfied and once violated. This is how a
 * guard counts as "has a test" for `apps/api/src/__tests__/rule-register.test.ts` without its rule id
 * needing to appear literally anywhere. A guard added later without an entry here fails loudly
 * instead of silently passing "untested".
 */
const GUARD_SCENARIOS: Record<string, { satisfies: [QuestionRecord, unknown?]; violates: [QuestionRecord, unknown?] }> = {
  'R-GUARD-01': {
    satisfies: [question({ answers: [{ version: 1, text: 'a', createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'e', role: 'expert' } }] })],
    violates: [question({ answers: [] })],
  },
  'R-GUARD-02': {
    satisfies: [question({ track: 'podium' })],
    violates: [question({ track: 'expert_track' })],
  },
  'R-GUARD-03': {
    satisfies: [question({ track: 'fast_track' })],
    violates: [question({ track: 'podium' })],
  },
  'R-GUARD-04': {
    satisfies: [
      question({
        answers: [
          { version: 1, text: 'v1', createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'e', role: 'expert' } },
          { version: 2, text: 'v2', createdAt: '2027-04-20T09:10:00.000Z', createdBy: { id: 'e', role: 'expert' } },
        ],
      }),
      { answerVersion: 2 },
    ],
    violates: [
      question({
        answers: [
          { version: 1, text: 'v1', createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'e', role: 'expert' } },
          { version: 2, text: 'v2', createdAt: '2027-04-20T09:10:00.000Z', createdBy: { id: 'e', role: 'expert' } },
        ],
      }),
      { answerVersion: 1 },
    ],
  },
  'R-GUARD-05': {
    satisfies: [question({ id: 'q1' }), { intoQuestionId: 'q2' }],
    violates: [question({ id: 'q1' }), { intoQuestionId: 'q1' }],
  },
};

describe('guards (one generated test each, Festlegung 3 of slice 011)', () => {
  const guards = new Map<string, Guard>();
  for (const t of TRANSITIONS) for (const g of t.guards ?? []) if (!guards.has(g.ruleId)) guards.set(g.ruleId, g);

  it('every guard has a scenario in GUARD_SCENARIOS', () => {
    const missing = [...guards.keys()].filter((id) => !GUARD_SCENARIOS[id]);
    expect(missing, `guard(s) without a test scenario: ${missing.join(', ')}`).toEqual([]);
  });

  for (const [ruleId, guard] of guards) {
    it(`${ruleId}: guard — ${guard.description}`, () => {
      const scenario = GUARD_SCENARIOS[ruleId];
      if (!scenario) return; // reported by the "every guard has a scenario" test above
      expect(guard.check(...scenario.satisfies)).toBe(true);
      expect(guard.check(...scenario.violates)).toBe(false);
    });
  }
});

describe('policy truth table (Role × Status × Action, Role × Leserecht)', () => {
  const actions = PERMISSIONS.filter((p) => p.startsWith('question.') || p === 'answer.draft') as Permission[];
  it('matches the committed table — any change must be reviewed', async () => {
    const lines: string[] = [
      '# Policy truth table — Role × Status × Action',
      '',
      'Generated by `packages/domain/src/__tests__/transitions.test.ts`. A diff here is a rights change and',
      'needs an explicit decision (docs/rollen-und-rechtekonzept.md). Representative question: expert track,',
      'one answer version; podium-track rows are marked separately.',
      '',
      '| Role | Status | ' + actions.map((a) => a.replace('question.', 'q.')).join(' | ') + ' |',
      '|---|---|' + actions.map(() => '---').join('|') + '|',
    ];
    for (const role of ROLES) {
      for (const status of QUESTION_STATUSES) {
        for (const track of ['expert_track', 'podium'] as const) {
          const q = question({
            status,
            track,
            answers: track === 'podium' ? [] : [{ version: 1, text: 'v1', createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'e', role: 'expert' } }],
          });
          const cells = actions.map((a) => {
            const payload = a === 'question.approve' ? { answerVersion: 1 } : a === 'question.merge' ? { intoQuestionId: 'other' } : undefined;
            return can({ id: 'x', role }, a, q, payload).allow ? '✓' : '·';
          });
          lines.push(`| ${role} | ${status}${track === 'podium' ? ' (podium)' : ''} | ${cells.join(' | ')} |`);
        }
      }
    }

    // Second table (Ziel 3 of slice 010): Rolle × Leserecht, generated from the same `hasPermission`
    // decision the read methods use (packages/domain/src/api.ts) — must match Festlegung 4 exactly.
    lines.push(
      '',
      '# Policy truth table — Role × Leserecht',
      '',
      'Generated by the same test. A diff here is a rights change and needs an explicit decision',
      '(Festlegung 4 of docs/slices/010-lesepfade-leserechte.md).',
      '',
      '| Role | ' + READ_PERMISSION_LIST.join(' | ') + ' |',
      '|---|' + READ_PERMISSION_LIST.map(() => '---').join('|') + '|',
    );
    for (const role of ROLES) {
      const cells = READ_PERMISSION_LIST.map((p) => (can({ id: 'x', role }, p).allow ? '✓' : '·'));
      lines.push(`| ${role} | ${cells.join(' | ')} |`);
    }

    await expect(lines.join('\n') + '\n').toMatchFileSnapshot('../../policy-truth-table.md');
  });

  it('deny by default: an unknown role has no permissions', () => {
    // `question.read` is a read permission (READ_PERMISSIONS, types.ts), so its own denial is
    // R-PERM-02 (Leserecht fehlt), not R-PERM-01 (slice 010, Festlegung 6).
    const d = can({ id: 'x', role: 'nobody' as Role }, 'question.read');
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.ruleId).toBe('R-PERM-02');
    const w = can({ id: 'x', role: 'nobody' as Role }, 'question.classify');
    expect(w.allow).toBe(false);
    if (!w.allow) expect(w.ruleId).toBe('R-PERM-01');
  });

  it('no READ_SCOPES entry extends a transition action (rework round, point 9) — extends must target a pure read', () => {
    for (const [permission, scope] of Object.entries(READ_SCOPES) as [Permission, { extends?: Permission }][]) {
      if (scope.extends !== undefined) {
        expect(TRANSITION_ACTIONS.includes(scope.extends), `${permission} extends ${scope.extends}`).toBe(false);
      }
    }
  });

  it('a second scoped read right works through can() without touching ROLE_PERMISSIONS (rework round, point 3)', () => {
    // No current role holds `stage.read` without also holding unrestricted `question.read` except
    // podium — a fake second `extends: 'question.read'` entry on `stage.read` proves the walk in
    // `extendingScopesFor` (permissions.ts) correctly handles more than one scoped alternative for the
    // same base action, coexisting with the real `question.read.delivered` entry, with no further
    // change to `can()` or the `listQuestions` status-filter check.
    const mutableReadScopes = READ_SCOPES as Record<string, { statuses: readonly string[]; extends?: string }>;
    expect(mutableReadScopes['stage.read']).toBeUndefined(); // sanity: not already scoped for real
    mutableReadScopes['stage.read'] = { statuses: ['staged'], extends: 'question.read' };
    try {
      const podium: Role = 'podium'; // holds stage.read, holds neither question.read nor question.read.delivered
      const staged = question({ status: 'staged' });
      const captured = question({ status: 'captured' });
      expect(can({ id: 'x', role: podium }, 'question.read', staged).allow).toBe(true); // via the fake scope
      expect(can({ id: 'x', role: podium }, 'question.read', captured).allow).toBe(false); // outside it

      // The pre-existing scope (question.read.delivered for observer) still works unaffected —
      // proving the loop over multiple READ_SCOPES entries does not let one interfere with another.
      const observer: Role = 'observer';
      const delivered = question({ status: 'delivered' });
      expect(can({ id: 'x', role: observer }, 'question.read', delivered).allow).toBe(true);
      expect(can({ id: 'x', role: observer }, 'question.read', staged).allow).toBe(false); // observer holds no stage.read
    } finally {
      delete mutableReadScopes['stage.read'];
    }
  });
});
