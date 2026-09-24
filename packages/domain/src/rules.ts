/**
 * The rule register (Regelregister, slice 011): every rule id of the domain, whether it lives as a
 * row of `TRANSITIONS`, as a `Guard`, or — for the handful of ids that are neither — right here.
 *
 * `LegalRef` is the trace field every rule carries (Festlegung 2 of docs/slices/011-legal-trace-
 * regelregister.md): `source` is one of a fixed, closed list; `citation` names a norm only when
 * `docs/anforderungen-recherche.md` or `docs/ist-analyse-und-schnittstellen.md` ties that norm
 * explicitly to the rule's subject (file and line, named in the slice's report) — otherwise `source`
 * is `'Prozess'` or `'Leitplanken'` and `citation` names the document and section that actually
 * describes the rule. No citation here is invented or supplied from memory; where neither research
 * document says anything, the citation says so instead of pretending otherwise (R-TRANS-11).
 * `verified` is the literal `false`: only the legal review (E15, 076) changes that, never this slice.
 */
import { TRANSITIONS } from './transitions.js';

/** Rule kinds (Festlegung 1): a transition-table row, a guard, a rights rule, or the idempotency
 * rule. German terms, because they are the vocabulary the register and its report use throughout. */
export type RuleKind = 'Übergang' | 'Guard' | 'Recht' | 'Idempotenz';

/** Closed list (Festlegung 2). No rule in this slice cites `'AktG'`, `'Satzung'` or
 * `'Geschäftsordnung'` — the research only ties a norm (§ 131 Abs. 3 AktG) to the refusal path
 * (044), out of scope here — but the three stay in the type for the rules that will need them. */
export type LegalSource =
  | 'AktG'
  | 'Satzung'
  | 'Geschäftsordnung'
  | 'Recherche'
  | 'Rechtekonzept'
  | 'Prozess'
  | 'Leitplanken';

export interface LegalRef {
  readonly source: LegalSource;
  /** Document and, where the source is a single line or table row, the line number(s) — never a bare
   * document name, so the citation stays checkable against the report's Fundstellentabelle. */
  readonly citation: string;
  /** The cited document's own stated version/date, only if the document names one; otherwise `null`. */
  readonly docVersion: string | null;
  /** Always `null` before a legal review has hashed the document (E15, 076). */
  readonly docHash: null;
  /** Literal `false`. A review by Legal changes the type in slice 076, never a literal edit here. */
  readonly verified: false;
}

export interface RuleEntry {
  readonly ruleId: string;
  readonly kind: RuleKind;
  readonly description: string;
  readonly legalRef: LegalRef;
}

/**
 * Rule ids that are neither a `TRANSITIONS` row nor a `Guard` (Festlegung 1): the transition
 * resolver's own conflict rule, the three permission rules `hasPermission`/`can()` use
 * (`packages/domain/src/permissions.ts`), and the idempotency rule `createInProcessApi` applies to
 * every write (`packages/domain/src/api.ts`).
 */
const OTHER_RULES: readonly RuleEntry[] = [
  {
    ruleId: 'R-TRANS-00',
    kind: 'Übergang',
    description:
      'A terminal status accepts no further action, and an action with no matching transition row ' +
      'is a conflict — both reported as 409 with this rule id (resolveTransition, transitions.ts).',
    legalRef: {
      source: 'Leitplanken',
      citation:
        'docs/qualitaetsleitplanken-produktreife.md:175 (Abschnitt 6.4: "Erfolg, 400/422, 403, 404, ' +
        '409, 412, 428 und 500 sind konsistent als Problem-Details mit Regel-ID modelliert")',
      docVersion: '23. September 2026 (Scheibe 009, konsolidiert aus Scheibe 008)',
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-PERM-01',
    kind: 'Recht',
    description:
      'A role without the write permission an action needs: deny (403), "Schreibrecht fehlt" ' +
      '(hasPermission, permissions.ts).',
    legalRef: {
      source: 'Rechtekonzept',
      citation:
        'docs/rollen-und-rechtekonzept.md:141 (Abschnitt 3, Punkt 4 "Deny by default": "Eine neue ' +
        'Aktion ist zunächst für niemanden erlaubt und muss ausdrücklich vergeben werden."); Regel-ID ' +
        'eingeführt in docs/slices/010-lesepfade-leserechte.md, Festlegung 6',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-PERM-02',
    kind: 'Recht',
    description:
      'A role without a read permission listed in READ_PERMISSIONS for the method it calls: deny ' +
      '(403), "Leserecht fehlt" (hasPermission, permissions.ts).',
    legalRef: {
      source: 'Rechtekonzept',
      citation:
        'docs/rollen-und-rechtekonzept.md:141 (Abschnitt 3, Punkt 4 "Deny by default": "Eine neue ' +
        'Aktion ist zunächst für niemanden erlaubt und muss ausdrücklich vergeben werden."); Regel-ID ' +
        'eingeführt in docs/slices/010-lesepfade-leserechte.md, Festlegung 6',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-PERM-03',
    kind: 'Recht',
    description:
      'A read permission scoped to specific statuses (READ_SCOPES) does not cover the question\'s ' +
      'current status: deny (403), "Leseumfang" (can(), api.ts).',
    legalRef: {
      source: 'Rechtekonzept',
      citation:
        'docs/rollen-und-rechtekonzept.md:91 (Abschnitt 2.3, Kontextattribut "Status": "erlaubte ' +
        'Übergänge — Expert Track darf nur ins juristische Clearing"); Regel-ID eingeführt in ' +
        'docs/slices/010-lesepfade-leserechte.md, Festlegung 2 ("Leseumfang")',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-IDEM-01',
    kind: 'Idempotenz',
    description:
      'An idempotency key is scoped to the calling actor and the operation; a replay of the same key ' +
      'returns the first result instead of re-executing (createInProcessApi, api.ts).',
    legalRef: {
      source: 'Leitplanken',
      citation:
        'docs/qualitaetsleitplanken-produktreife.md:167 (Abschnitt 6.3: "Wiederholungen sind ' +
        'idempotent je Akteur und Operation")',
      docVersion: '23. September 2026 (Scheibe 009, konsolidiert aus Scheibe 008)',
      docHash: null,
      verified: false,
    },
  },
];

/**
 * Every rule id of the domain, sorted by id (Festlegung 1): each `TRANSITIONS` row, each guard
 * collected by walking `TRANSITIONS[].guards` (no duplicates, no second list), and `OTHER_RULES`.
 * `docs/legal-trace.md` and the "N Regel-IDs, N legalRef, 0 verified" test output are both built from
 * this single function.
 */
export function ruleRegister(): readonly RuleEntry[] {
  const fromTransitions: RuleEntry[] = TRANSITIONS.map((t) => ({
    ruleId: t.ruleId,
    kind: 'Übergang',
    description: t.description,
    legalRef: t.legalRef,
  }));

  const seenGuardIds = new Set<string>();
  const fromGuards: RuleEntry[] = [];
  for (const t of TRANSITIONS) {
    for (const g of t.guards ?? []) {
      if (seenGuardIds.has(g.ruleId)) continue;
      seenGuardIds.add(g.ruleId);
      fromGuards.push({ ruleId: g.ruleId, kind: 'Guard', description: g.description, legalRef: g.legalRef });
    }
  }

  return [...fromTransitions, ...fromGuards, ...OTHER_RULES].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}
