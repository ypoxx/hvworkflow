/**
 * One test per rule id of the transition table, plus the generated truth table
 * Role × Status × Action, diffed against the committed file (docs gate "Policy-Wahrheitstabelle").
 */
import { describe, expect, it } from 'vitest';
import { TRANSITIONS, resolveTransition, TRANSITION_ACTIONS, SPEAKER_TRANSITIONS, resolveSpeakerTransition, type Guard, type TransitionContext } from '../transitions.js';
import { ApiProblem, can, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { createInMemoryEventStore } from '../store.js';
import type { DomainEvent } from '../events.js';
import { PERMISSIONS, QUESTION_STATUSES, type QuestionRecord, type Role, type Permission, type SpeakerRecord, type SpeakerStatus } from '../types.js';
import { ROLE_PERMISSIONS, READ_PERMISSION_LIST, READ_SCOPES } from '../permissions.js';
import { REFUSAL_GROUNDS } from '../refusalGrounds.js';

const ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];

/** A deciding actor who wrote none of the fixture answers (their creator is `{ id: 'e' }`). */
const OTHER: TransitionContext = { actor: { id: 'a', role: 'approver' } };

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
      // A representative question that satisfies every guard of this row. R-TRANS-16 (Scheibe 044a)
      // approves a refusal: its version is a refusal (R-GUARD-13), legally cleared by `l` (R-GUARD-08).
      const base = question({
        status: t.from[0]!,
        track: ['R-TRANS-08', 'R-TRANS-14'].includes(t.ruleId) ? 'podium' : 'expert_track',
        answers: ['R-TRANS-08', 'R-TRANS-14'].includes(t.ruleId)
          ? []
          : [{ version: 1, text: 'Antwort', createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'e', role: 'expert' },
            ...(t.ruleId === 'R-TRANS-16' ? { answerKind: 'refusal_no_claim' as const } : {}) }],
        approval: { answerVersion: 1, approvedAt: '2027-04-20T09:10:00.000Z', approvedBy: OTHER.actor },
        legalClearance: { answerVersion: 1, clearedAt: '2027-04-20T09:05:00.000Z', clearedBy: { id: 'l', role: 'legal' } },
      });
      const payload = t.action === 'question.approve' || t.action === 'question.refuse.approve' ? { answerVersion: 1 }
        : t.action === 'question.merge' ? { intoQuestionId: 'q2' } : undefined;
      const r = resolveTransition(base, t.action, payload, OTHER);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.transition.ruleId).toBe(t.ruleId);
      // And it is forbidden from a status the row does not list.
      const other = QUESTION_STATUSES.find((s) => !t.from.includes(s) && !['closed', 'withdrawn', 'merged'].includes(s));
      if (other) {
        const otherRows = TRANSITIONS.filter((x) => x.action === t.action && x.from.includes(other));
        if (otherRows.length === 0) {
          expect(resolveTransition(question({ ...base, status: other }), t.action, payload, OTHER).ok).toBe(false);
        }
      }
    });
  }

  it('R-TRANS-00: terminal statuses accept no action', () => {
    for (const s of ['closed', 'withdrawn', 'merged'] as const) {
      for (const p of PERMISSIONS) {
        expect(resolveTransition(question({ status: s }), p, undefined, OTHER).ok).toBe(false);
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
    expect(resolveTransition(q, 'question.approve', { answerVersion: 1 }, OTHER).ok).toBe(false);
    expect(resolveTransition(q, 'question.approve', { answerVersion: 2 }, OTHER).ok).toBe(true);
  });

  it('R-GUARD-06: the creator of the latest version may not approve it, by actor id, whatever the role (slice 021a)', () => {
    const answers = (...ids: string[]) =>
      ids.map((id, i) => ({ version: i + 1, text: `v${i + 1}`, createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id, role: 'legal' as const } }));
    const legal = { actor: { id: 'leg', role: 'legal' as const } };
    const admin = { actor: { id: 'leg', role: 'admin' as const } };
    const ownV1 = question({ status: 'in_review', track: 'expert_track', answers: answers('leg') });
    const denied = resolveTransition(ownV1, 'question.approve', { answerVersion: 1 }, legal);
    expect(denied).toMatchObject({ ok: false, ruleId: 'R-GUARD-06' });
    // Same person under another role (demo role switcher, admin): still denied — ids, never roles.
    expect(resolveTransition(ownV1, 'question.approve', { answerVersion: 1 }, admin)).toMatchObject({ ok: false, ruleId: 'R-GUARD-06' });
    // Capability without payload (`_actions`) is denied too.
    expect(resolveTransition(ownV1, 'question.approve', undefined, legal)).toMatchObject({ ok: false, ruleId: 'R-GUARD-06' });
    // Somebody else wrote the latest version: the earlier author may approve it.
    const otherV2 = question({ status: 'in_review', track: 'expert_track', answers: answers('leg', 'exp') });
    expect(resolveTransition(otherV2, 'question.approve', { answerVersion: 2 }, legal).ok).toBe(true);
  });

  it('R-GUARD-07: an old legal clearance does not release a newer approved answer', () => {
    const q = question({
      status: 'approved',
      track: 'expert_track',
      answers: [
        { version: 1, text: 'v1', createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'e', role: 'expert' } },
        { version: 2, text: 'v2', createdAt: '2027-04-20T09:10:00.000Z', createdBy: { id: 'e', role: 'expert' } },
      ],
      approval: { answerVersion: 2, approvedAt: '2027-04-20T09:20:00.000Z', approvedBy: OTHER.actor },
      legalClearance: { answerVersion: 1, clearedAt: '2027-04-20T09:05:00.000Z', clearedBy: { id: 'l', role: 'legal' } },
    });
    expect(resolveTransition(q, 'question.stage', undefined, OTHER)).toMatchObject({ ok: false, ruleId: 'R-GUARD-07' });
  });

  it('R-TRANS-15 (Scheibe 044a): a refusal proposal goes to in_review from every working status of a text question', () => {
    for (const status of ['classified', 'assigned', 'answer_drafted', 'in_review', 'approved'] as const) {
      const r = resolveTransition(question({ status, track: 'fast_track' }), 'question.refuse.propose',
        { answerKind: 'refusal_no_claim', text: 't', refusalJustification: 'j' }, OTHER);
      expect(r.ok && r.to, status).toBe('in_review');
    }
    for (const status of ['captured', 'staged', 'delivered'] as const) {
      expect(resolveTransition(question({ status, track: 'fast_track' }), 'question.refuse.propose', undefined, OTHER)).toMatchObject({ ok: false, ruleId: 'R-TRANS-00' });
    }
  });

  it('R-TRANS-16 (Scheibe 044a): a refusal is approved only from in_review, after clearance, by a third person', () => {
    const refusal = question({
      status: 'in_review', track: 'expert_track',
      answers: [{ version: 1, text: 'v1', createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'e', role: 'legal' }, answerKind: 'refusal_no_claim' }],
      legalClearance: { answerVersion: 1, clearedAt: '2027-04-20T09:05:00.000Z', clearedBy: { id: 'l', role: 'legal' } },
    });
    expect(resolveTransition(refusal, 'question.refuse.approve', { answerVersion: 1 }, OTHER)).toMatchObject({ ok: true, to: 'approved' });
    expect(resolveTransition(refusal, 'question.refuse.approve', { answerVersion: 1 }, { actor: { id: 'l', role: 'approver' } })).toMatchObject({ ok: false, ruleId: 'R-GUARD-14' });
    expect(resolveTransition(refusal, 'question.refuse.approve', { answerVersion: 1 }, { actor: { id: 'e', role: 'approver' } })).toMatchObject({ ok: false, ruleId: 'R-GUARD-06' });
    expect(resolveTransition({ ...refusal, status: 'answer_drafted' }, 'question.refuse.approve', { answerVersion: 1 }, OTHER)).toMatchObject({ ok: false, ruleId: 'R-TRANS-00' });
    expect(resolveTransition(refusal, 'question.approve', { answerVersion: 1 }, OTHER)).toMatchObject({ ok: false, ruleId: 'R-GUARD-12' });
  });

  it('R-GUARD-12 and R-GUARD-13 (Scheibe 044a) are false without a version', () => {
    const guards = new Map<string, Guard>();
    for (const t of TRANSITIONS) for (const g of t.guards ?? []) guards.set(g.ruleId, g);
    expect(guards.get('R-GUARD-12')!.check(question({ answers: [] }), undefined, OTHER)).toBe(false);
    expect(guards.get('R-GUARD-13')!.check(question({ answers: [] }), undefined, OTHER)).toBe(false);
  });

  it('R-TRANS-06: a returned podium question goes back to classified, a text question to answer_drafted', () => {
    const podium = resolveTransition(question({ status: 'staged', track: 'podium' }), 'question.return', { reason: 'x' }, OTHER);
    const expert = resolveTransition(question({ status: 'staged', track: 'expert_track' }), 'question.return', { reason: 'x' }, OTHER);
    expect(podium.ok && podium.to).toBe('classified');
    expect(expert.ok && expert.to).toBe('answer_drafted');
  });
});

/** Fixture versions for the refusal guards (Scheibe 044a). */
function answerVersion(version: number): QuestionRecord['answers'][number] {
  return { version, text: `v${version}`, createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'e', role: 'expert' } };
}
function refusalVersion(version: number, answerKind: 'refusal_no_claim' | 'refusal_with_ground', hash?: string): QuestionRecord['answers'][number] {
  return { version, text: `v${version}`, createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'k', role: 'legal' }, answerKind,
    ...(answerKind === 'refusal_with_ground' ? { refusalGroundId: 'aktg-131-3-nr1', refusalGroundHash: hash ?? '' } : {}) };
}

/**
 * Slice 011, Festlegung 3: one generated test per guard, collected from `TRANSITIONS[].guards` (no
 * duplicates, no second list) — each one checked once satisfied and once violated. This is how a
 * guard counts as "has a test" for `apps/api/src/__tests__/rule-register.test.ts` without its rule id
 * needing to appear literally anywhere. A guard added later without an entry here fails loudly
 * instead of silently passing "untested".
 */
const GUARD_SCENARIOS: Record<string, { satisfies: [QuestionRecord, unknown?, TransitionContext?]; violates: [QuestionRecord, unknown?, TransitionContext?] }> = {
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
  'R-GUARD-06': {
    satisfies: [
      question({ answers: [{ version: 1, text: 'v1', createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'e', role: 'expert' } }] }),
      { answerVersion: 1 },
      { actor: { id: 'l', role: 'legal' } },
    ],
    violates: [
      question({ answers: [{ version: 1, text: 'v1', createdAt: '2027-04-20T09:00:00.000Z', createdBy: { id: 'l', role: 'legal' } }] }),
      { answerVersion: 1 },
      { actor: { id: 'l', role: 'legal' } },
    ],
  },
  // Scheibe 044a: the six refusal guards.
  'R-GUARD-08': {
    satisfies: [question({ answers: [refusalVersion(1, 'refusal_no_claim')],
      legalClearance: { answerVersion: 1, clearedAt: '2027-04-20T09:05:00.000Z', clearedBy: { id: 'l', role: 'legal' } } })],
    violates: [question({ answers: [answerVersion(1), refusalVersion(2, 'refusal_no_claim')],
      legalClearance: { answerVersion: 1, clearedAt: '2027-04-20T09:05:00.000Z', clearedBy: { id: 'l', role: 'legal' } } })],
  },
  'R-GUARD-09': {
    satisfies: [question(), { answerKind: 'refusal_with_ground', text: 't', refusalGroundId: 'aktg-131-3-nr1', refusalJustification: ' j ' }],
    violates: [question(), { answerKind: 'refusal_with_ground', text: 't', refusalGroundId: 'aktg-131-3-nr1', refusalJustification: '   ' }],
  },
  'R-GUARD-11': {
    satisfies: [question({ answers: [refusalVersion(1, 'refusal_with_ground', REFUSAL_GROUNDS[0]!.hash)] })],
    violates: [question({ answers: [refusalVersion(1, 'refusal_with_ground', '0'.repeat(64))] })],
  },
  'R-GUARD-12': {
    satisfies: [question({ answers: [refusalVersion(1, 'refusal_no_claim'), answerVersion(2)] })],
    violates: [question({ answers: [answerVersion(1), refusalVersion(2, 'refusal_no_claim')] })],
  },
  'R-GUARD-13': {
    satisfies: [question({ answers: [answerVersion(1), refusalVersion(2, 'refusal_with_ground', REFUSAL_GROUNDS[0]!.hash)] })],
    violates: [question({ answers: [refusalVersion(1, 'refusal_no_claim'), { ...answerVersion(2), answerKind: 'answer' }] })],
  },
  'R-GUARD-14': {
    satisfies: [question({ legalClearance: { answerVersion: 1, clearedAt: '2027-04-20T09:05:00.000Z', clearedBy: { id: 'l', role: 'legal' } } }),
      { answerVersion: 1 }, { actor: { id: 'a', role: 'approver' } }],
    violates: [question({ legalClearance: { answerVersion: 1, clearedAt: '2027-04-20T09:05:00.000Z', clearedBy: { id: 'l', role: 'legal' } } }),
      { answerVersion: 1 }, { actor: { id: 'l', role: 'approver' } }],
  },
  'R-GUARD-07': {
    satisfies: [question({
      track: 'expert_track',
      approval: { answerVersion: 1, approvedAt: '2027-04-20T09:10:00.000Z', approvedBy: OTHER.actor },
      legalClearance: { answerVersion: 1, clearedAt: '2027-04-20T09:05:00.000Z', clearedBy: { id: 'l', role: 'legal' } },
    })],
    violates: [question({
      track: 'expert_track',
      approval: { answerVersion: 1, approvedAt: '2027-04-20T09:10:00.000Z', approvedBy: OTHER.actor },
    })],
  },
};

describe('guards (one generated test each, Festlegung 3 of slice 011)', () => {
  const guards = new Map<string, Guard>();
  for (const t of TRANSITIONS) for (const g of t.guards ?? []) if (!guards.has(g.ruleId)) guards.set(g.ruleId, g);

  it('every guard has a scenario in GUARD_SCENARIOS', () => {
    const missing = [...guards.keys()].filter((id) => !GUARD_SCENARIOS[id]);
    expect(missing, `guard(s) without a test scenario: ${missing.join(', ')}`).toEqual([]);
  });

  it('GUARD_SCENARIOS has no stale entry for a guard that no longer exists (rework after Codex/Legal review)', () => {
    const stale = Object.keys(GUARD_SCENARIOS).filter((id) => !guards.has(id));
    expect(stale, `GUARD_SCENARIOS entry(ies) for a guard no longer in TRANSITIONS[].guards: ${stale.join(', ')}`).toEqual([]);
  });

  for (const [ruleId, guard] of guards) {
    it(`${ruleId}: guard — ${guard.description}`, () => {
      const scenario = GUARD_SCENARIOS[ruleId];
      if (!scenario) return; // reported by the "every guard has a scenario" test above
      const [sq, sp, sctx] = scenario.satisfies;
      const [vq, vp, vctx] = scenario.violates;
      expect(guard.check(sq, sp, sctx ?? OTHER)).toBe(true);
      expect(guard.check(vq, vp, vctx ?? OTHER)).toBe(false);
    });
  }
});

describe('policy truth table (Role × Status × Action, Role × Leserecht)', () => {
  const actions = PERMISSIONS.filter((p) => (p.startsWith('question.') && p !== 'question.identity.reveal') || p === 'answer.draft') as Permission[];
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

    lines.push('', '# Policy truth table — Role × Agenda', '',
      'Scheibe 025: explicit agenda.manage grant; other roles are denied by default.', '',
      '| Role | agenda.manage |', '|---|---|');
    for (const role of ROLES) {
      lines.push(`| ${role} | ${can({ id: 'x', role }, 'agenda.manage').allow ? '✓' : '·'} |`);
    }

    lines.push('', '# Policy truth table — Role × Identität und Rollenverwaltung', '',
      'Scheibe 026: identity reveal is limited to the five operational roles selected before build;',
      'role management is limited to administration. Both are independent of question status.', '',
      '| Role | question.identity.reveal | admin.roles.manage |', '|---|---|---|');
    for (const role of ROLES) {
      lines.push(`| ${role} | ${can({ id: 'x', role }, 'question.identity.reveal').allow ? '✓' : '·'} | ${can({ id: 'x', role }, 'admin.roles.manage').allow ? '✓' : '·'} |`);
    }

    // Scheibe 040a: the speaker, contribution-capture and demo rights stood in no section, so their
    // loss for the administration would have been invisible. Same `can()` decision as above.
    const intake: Permission[] = ['speaker.register', 'speaker.reorder', 'speaker.update', 'contribution.capture', 'contribution.claim', 'demo.seed'];
    lines.push('', '# Policy truth table — Role × Wortmeldung, Erfassung und Demo', '',
      'Scheibe 040a: rights on speaker requests, contribution capture and the demo seed; independent of',
      'question status. The administration holds none of the writing ones.', '',
      '| Role | ' + intake.join(' | ') + ' |', '|---|' + intake.map(() => '---').join('|') + '|');
    for (const role of ROLES) {
      lines.push(`| ${role} | ${intake.map((p) => (can({ id: 'x', role }, p).allow ? '✓' : '·')).join(' | ')} |`);
    }

    // Scheibe 040b: the two master-data rights of the administration (Fachbereiche, Bühnenplätze).
    const administration: Permission[] = ['admin.units.manage', 'admin.seats.manage'];
    lines.push('', '# Policy truth table — Role × Administration', '',
      'Scheibe 040b: answering units and podium seats of a meeting; only the administration holds them.', '',
      '| Role | ' + administration.join(' | ') + ' |', '|---|' + administration.map(() => '---').join('|') + '|');
    for (const role of ROLES) {
      lines.push(`| ${role} | ${administration.map((p) => (can({ id: 'x', role }, p).allow ? '✓' : '·')).join(' | ')} |`);
    }

    // Scheibe 044a: a refusal as the latest version, which the representative question of the first
    // table never is. Version 1 an answer by `e`, version 2 a path-B refusal by `l` with the current
    // hash; "frei" = legally cleared by `k`. Same `can()` decision, actor `x`.
    const refusalActions: Permission[] = ['question.refuse.propose', 'question.refuse.approve', 'question.approve', 'question.submit_review', 'question.legal.clear', 'answer.draft'];
    const refusalCases: [string, Partial<QuestionRecord>][] = [
      ['in_review, frei', { status: 'in_review', legalClearance: { answerVersion: 2, clearedAt: '2027-04-20T09:20:00.000Z', clearedBy: { id: 'k', role: 'legal' } } }],
      ['in_review, offen', { status: 'in_review' }],
      ['answer_drafted', { status: 'answer_drafted', legalClearance: { answerVersion: 2, clearedAt: '2027-04-20T09:20:00.000Z', clearedBy: { id: 'k', role: 'legal' } } }],
    ];
    lines.push('', '# Policy truth table — Role × Verweigerung', '',
      'Scheibe 044a: the latest version is a refusal (path B by `l`, current catalogue hash); "frei" = legally',
      'cleared by `k`, "answer_drafted" = a returned refusal. Built on the default (ADR 0012 proposed, not read by Recht).', '',
      '| Role | Fall | ' + refusalActions.map((a) => a.replace('question.', 'q.')).join(' | ') + ' |',
      '|---|---|' + refusalActions.map(() => '---').join('|') + '|');
    for (const role of ROLES) {
      for (const [name, overrides] of refusalCases) {
        const q = question({ track: 'expert_track', answers: [
          answerVersion(1),
          { version: 2, text: 'v2', createdAt: '2027-04-20T09:10:00.000Z', createdBy: { id: 'l', role: 'legal' }, answerKind: 'refusal_with_ground',
            refusalGroundId: 'aktg-131-3-nr1', refusalGroundHash: REFUSAL_GROUNDS.find((g) => g.id === 'aktg-131-3-nr1')!.hash },
        ], ...overrides });
        const cells = refusalActions.map((a) => {
          const payload = a === 'question.approve' || a === 'question.refuse.approve' ? { answerVersion: 2 } : undefined;
          return can({ id: 'x', role }, a, q, payload).allow ? '✓' : '·';
        });
        lines.push(`| ${role} | ${name} | ${cells.join(' | ')} |`);
      }
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

/* ---------- speaker state table R-SPK (slice 080) ---------- */

const SPEAKER_STATUSES: readonly SpeakerStatus[] = ['waiting', 'speaking', 'finished', 'withdrawn'];

function speakerRecord(status: SpeakerStatus): SpeakerRecord {
  return { id: 's1', number: 1, displayName: 'Testperson', round: 1, position: 1, status, questionCount: 0, version: 1 };
}

/** An in-process API with one Wortmeldung brought into `status` along allowed rows only. */
async function speakerIn(status: SpeakerStatus): Promise<{ api: HvApi; id: string; events: () => readonly DomainEvent[] }> {
  const store = createInMemoryEventStore();
  const actor = { id: 'fixture', role: 'admin' as const };
  store.append([{ id: 'meeting-speaker-fixture', type: 'MeetingCreated', at: '2027-04-20T10:00:00.000Z',
    actor, subjectId: 'hv-speaker-fixture', meetingId: 'hv-speaker-fixture',
    payload: { title: 'Sprecher-Testjahrgang', date: '2027-04-20', agendaItems: [], units: [] } }]);
  let t = Date.parse('2027-04-20T12:00:00.000Z');
  const api = createInProcessApi({ store, actor: () => ({ id: 'mod', role: 'moderation' }), clock: () => new Date((t += 1000)) });
  const s = await api.registerSpeaker({ displayName: 'Testperson' }, { ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
  const path: Record<SpeakerStatus, SpeakerStatus[]> = {
    waiting: [],
    speaking: ['speaking'],
    finished: ['speaking', 'finished'],
    withdrawn: ['withdrawn'],
  };
  for (const next of path[status]) await api.updateSpeaker(s.id, { status: next }, { ifMatch: etagOf((await api.getSpeaker(s.id)).version) });
  return { api, id: s.id, events: () => store.all() };
}

async function problemOf(p: Promise<unknown>): Promise<ApiProblem> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ApiProblem) return e;
    throw e;
  }
  throw new Error('expected an ApiProblem');
}

describe('speaker state table (R-SPK, slice 080)', () => {
  it('lists exactly R-SPK-01..05 with the guard R-SPK-GUARD-01 on R-SPK-05', () => {
    expect(SPEAKER_TRANSITIONS.map((t) => t.ruleId)).toEqual(['R-SPK-01', 'R-SPK-02', 'R-SPK-03', 'R-SPK-04', 'R-SPK-05']);
    const r05 = SPEAKER_TRANSITIONS.find((t) => t.ruleId === 'R-SPK-05')!;
    expect(r05.guards?.map((g) => g.ruleId)).toEqual(['R-SPK-GUARD-01']);
  });

  for (const t of SPEAKER_TRANSITIONS) {
    const payload = t.guards?.length ? { reason: 'follow_up' as const } : {};
    it(`${t.ruleId}: ${t.from} → ${t.to} is allowed — ${t.description}`, async () => {
      const r = resolveSpeakerTransition(speakerRecord(t.from), t.to, payload);
      expect(r.ok && r.transition.ruleId).toBe(t.ruleId);
      const { api, id } = await speakerIn(t.from);
      const updated = await api.updateSpeaker(id, { status: t.to, ...payload }, { ifMatch: etagOf((await api.getSpeaker(id)).version) });
      expect(updated.status).toBe(t.to);
    });
  }

  for (const from of SPEAKER_STATUSES) {
    for (const to of SPEAKER_STATUSES) {
      if (SPEAKER_TRANSITIONS.some((t) => t.from === from && t.to === to)) continue;
      it(`R-SPK-00: ${from} → ${to} is not listed: 409 with the rule id`, async () => {
        expect(resolveSpeakerTransition(speakerRecord(from), to, { reason: 'follow_up' })).toMatchObject({ ok: false, ruleId: 'R-SPK-00' });
        const { api, id } = await speakerIn(from);
        const p = await problemOf(api.updateSpeaker(id, { status: to, reason: 'follow_up' }, { ifMatch: etagOf((await api.getSpeaker(id)).version) }));
        expect(p.status).toBe(409);
        expect(p.ruleId).toBe('R-SPK-00');
      });
    }
  }

  it('R-SPK-00: finished → speaking is a 409 with ruleId in the problem, and no event is written', async () => {
    const { api, id, events } = await speakerIn('finished');
    const before = events().length;
    const p = await problemOf(api.updateSpeaker(id, { status: 'speaking' }, { ifMatch: etagOf((await api.getSpeaker(id)).version) }));
    expect(p.status).toBe(409);
    expect(p.toProblem().ruleId).toBe('R-SPK-00');
    expect(events().length).toBe(before);
  });

  it('R-SPK-05 without the reason "follow_up" is a 409 with R-SPK-GUARD-01', async () => {
    const { api, id } = await speakerIn('finished');
    const p = await problemOf(api.updateSpeaker(id, { status: 'waiting' }, { ifMatch: etagOf((await api.getSpeaker(id)).version) }));
    expect(p.status).toBe(409);
    expect(p.ruleId).toBe('R-SPK-GUARD-01');
  });

  it('R-SPK-05 with the reason writes it into SpeakerUpdated', async () => {
    const { api, id, events } = await speakerIn('finished');
    await api.updateSpeaker(id, { status: 'waiting', reason: 'follow_up' }, { ifMatch: etagOf((await api.getSpeaker(id)).version) });
    const last = events().at(-1)!;
    expect(last.type).toBe('SpeakerUpdated');
    expect(last.payload).toEqual({ status: 'waiting', reason: 'follow_up' });
  });

  it('waiting → speaking mit reason:\'x\' schreibt keinen Grund ins Ereignis (Review R1)', async () => {
    const { api, id, events } = await speakerIn('waiting');
    await api.updateSpeaker(id, { status: 'speaking', reason: 'x' as unknown as 'follow_up' }, { ifMatch: etagOf((await api.getSpeaker(id)).version) });
    const last = events().at(-1)!;
    expect(last.type).toBe('SpeakerUpdated');
    expect(last.payload).toEqual({ status: 'speaking' });
  });

  it('R-SPK-GUARD-01: guard — only the reason "follow_up" satisfies it', () => {
    const guard = SPEAKER_TRANSITIONS.find((t) => t.ruleId === 'R-SPK-05')!.guards![0]!;
    expect(guard.check(speakerRecord('finished'), { reason: 'follow_up' })).toBe(true);
    expect(guard.check(speakerRecord('finished'), {})).toBe(false);
    expect(guard.check(speakerRecord('finished'))).toBe(false);
  });

  it('a round change without status stays allowed from any status', async () => {
    for (const status of SPEAKER_STATUSES) {
      const { api, id } = await speakerIn(status);
      const moved = await api.updateSpeaker(id, { round: 2 }, { ifMatch: etagOf((await api.getSpeaker(id)).version) });
      expect(moved.round).toBe(2);
      expect(moved.status).toBe(status);
    }
  });

  // takt-015 Ziel 1: an empty PATCH (or one whose only fields are gone from the domain type, e.g.
  // the deprecated requestedMinutes) writes no event — no growth of the log for a write with no
  // effect, and no version bump for a change nobody made.
  it('an empty PATCH writes no event and leaves the version unchanged', async () => {
    const { api, id, events } = await speakerIn('waiting');
    const before = events().length;
    const view = await api.getSpeaker(id);
    const updated = await api.updateSpeaker(id, {}, { ifMatch: etagOf(view.version) });
    expect(events().length).toBe(before);
    expect(updated.version).toBe(view.version);
  });

  it('a PATCH with only the deprecated requestedMinutes writes no event and leaves the version unchanged', async () => {
    const { api, id, events } = await speakerIn('waiting');
    const before = events().length;
    const view = await api.getSpeaker(id);
    const updated = await api.updateSpeaker(id, { requestedMinutes: 7 } as never, { ifMatch: etagOf(view.version) });
    expect(events().length).toBe(before);
    expect(updated.version).toBe(view.version);
  });

  it('a stale If-Match on a forbidden transition (finished → speaking) is 412, not 409 (order)', async () => {
    const { api, id } = await speakerIn('finished');
    const p = await problemOf(api.updateSpeaker(id, { status: 'speaking' }, { ifMatch: '"v99"' }));
    expect(p.status).toBe(412);
  });

  it('R-SPK-01: repeating updateSpeaker with the same idempotency key replays the answer, writes no second event, and is not a 409', async () => {
    const { api, id, events } = await speakerIn('waiting');
    const opts = { idempotencyKey: 'takt-015-same-key', ifMatch: etagOf((await api.getSpeaker(id)).version) };
    const first = await api.updateSpeaker(id, { status: 'speaking' }, opts);
    const before = events().length;
    const second = await api.updateSpeaker(id, { status: 'speaking' }, opts);
    expect(second).toEqual(first);
    expect(events().length).toBe(before);
  });
});
