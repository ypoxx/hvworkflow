/**
 * The rule register (Regelregister, slice 011): every rule id of the domain, whether it lives as a
 * row of `TRANSITIONS`, as a `Guard`, or — for the handful of ids that are neither — right here.
 *
 * `LegalRef` is the trace field every rule carries (Festlegung 2 of docs/slices/011-legal-trace-
 * regelregister.md): `source` is one of a fixed, closed list; `citation` names a norm only when
 * `docs/anforderungen-recherche.md` or `docs/ist-analyse-und-schnittstellen.md` ties that norm
 * explicitly to the rule's subject (file and line, named in the slice's report) — otherwise `source`
 * is `'Prozess'` or `'Leitplanken'` and `citation` names the document and section that actually
 * describes the rule. No citation here is invented or supplied from memory; where a document covers
 * only part of what the rule does, or only a related but distinct concept, the citation says so
 * instead of pretending otherwise (after an agent review from the legal perspective, which is not a
 * review by Recht, E15; e.g. R-TRANS-00, R-TRANS-02,
 * R-TRANS-05, R-TRANS-11, R-TRANS-12, R-GUARD-05 below all name a gap or a scope mismatch in words,
 * never by silently dropping the honest half of the sentence).
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
      'resolveTransition()\'s own internal rule id (transitions.ts): a terminal status accepts no ' +
      'further action, and an action with no matching transition row, is a conflict. The domain API ' +
      '(api.ts `transition()`, which apps/api wraps; Festlegung 8 of slice 010) reports this rule id and the real reason ' +
      'only to an actor who can also read the question; an actor who holds the action\'s own ' +
      'permission but cannot read the question gets a generic 409 with no rule id instead, so ' +
      '`ruleId: "R-TRANS-00"` never reaches a response about a question outside that actor\'s read ' +
      'access.',
    legalRef: {
      source: 'Leitplanken',
      citation:
        'Checklistenpunkt, kein Regel-Charakter (docs/qualitaetsleitplanken-produktreife.md:8-9: "Dieses ' +
        'Dokument führt keine Regel, kein Tor, keine Rolle und keine Freigabe ein"): ' +
        'docs/qualitaetsleitplanken-produktreife.md:175 (Checkliste 6.4: "Erfolg, 400/422, 403, 404, ' +
        '409, 412, 428 und 500 sind konsistent als Problem-Details mit Regel-ID modelliert") stützt ' +
        'nur das Antwortformat (409 mit Regel-ID), nicht die Terminalität der Stände selbst. Für ' +
        'Letztere nennt weder docs/anforderungen-recherche.md noch ' +
        'docs/ist-analyse-und-schnittstellen.md eine Fundstelle — das ist eine Architekturentscheidung ' +
        '(`TERMINAL_STATUSES`, types.ts), keine externe Vorgabe. Auch die Maskierung selbst — ein ' +
        'Akteur ohne Leserecht auf die Frage bekommt weder Regel-ID noch Stand, sondern nur einen ' +
        'generischen 409 — hat keine Fundstelle in Recherche oder Ist-Analyse; sie ist eine ' +
        'Architekturentscheidung (`transition()`, api.ts), keine externe Vorgabe.',
      docVersion: '23. September 2026 (Scheibe 009, konsolidiert aus Scheibe 008)',
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-PERM-01',
    kind: 'Recht',
    description:
      'A role without the write permission an action needs: deny with this rule id, "Schreibrecht ' +
      'fehlt" (can(), permissions.ts). The domain API answers 403 with this rule id, except for a ' +
      'single question the actor may neither read nor act on: that answers the same 404 as an ' +
      'unknown id (Festlegung 3 of slice 010, no derivable ids), and the rule id does not reach the ' +
      'response.',
    legalRef: {
      source: 'Rechtekonzept',
      citation:
        'docs/rollen-und-rechtekonzept.md:141 (Abschnitt 3, Punkt 4 "Deny by default": "Eine neue ' +
        'Aktion ist zunächst für niemanden erlaubt und muss ausdrücklich vergeben werden."). Regel-ID ' +
        '"R-PERM-01" zugeordnet (Schreibrecht fehlt) seit Commit a0c38c4 (02.09.2026, "Fundament fuer ' +
        'die erste lauffaehige Version"). ' +
        'Die 404-Maskierung für eine Frage, die der Akteur weder lesen noch bearbeiten darf ' +
        '(Festlegung 3 von docs/slices/010-lesepfade-leserechte.md), hat ebenfalls keine Fundstelle ' +
        'in Recherche oder Ist-Analyse; sie ist eine Architekturentscheidung, keine externe Vorgabe.',
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
      'with this rule id, "Leserecht fehlt" (can(), permissions.ts). The domain API answers 403 with ' +
      'this rule id, except where the actor may not read the single question concerned: that answers ' +
      'the same 404 as an unknown id (Festlegung 3 of slice 010).',
    legalRef: {
      source: 'Rechtekonzept',
      citation:
        'docs/rollen-und-rechtekonzept.md:141 (Abschnitt 3, Punkt 4 "Deny by default": "Eine neue ' +
        'Aktion ist zunächst für niemanden erlaubt und muss ausdrücklich vergeben werden."); Regel-ID ' +
        'eingeführt in docs/slices/010-lesepfade-leserechte.md, Festlegung 6. Die 404-Maskierung für ' +
        'eine Frage, die der Akteur nicht lesen darf (Festlegung 3 von docs/slices/010-lesepfade-' +
        'leserechte.md), hat ebenfalls keine Fundstelle in Recherche oder Ist-Analyse; sie ist eine ' +
        'Architekturentscheidung, keine externe Vorgabe.',
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
      'current status: deny with this rule id, "Leseumfang" (can(), api.ts). A status filter outside ' +
      'the scope answers 403 with this rule id; a single question outside the scope answers the same ' +
      '404 as an unknown id (Festlegung 3 of slice 010).',
    legalRef: {
      source: 'Rechtekonzept',
      citation:
        'docs/rollen-und-rechtekonzept.md:93 (Abschnitt 2.3, Kontextattribut "Bühnenzuordnung": "der ' +
        'Vorstand sieht nur, was ihm zugeordnet **und** bereit ist"). Ableitung: dieselbe Art ' +
        'statusabhängiger Sichtbarkeitsbeschränkung wie "Leseumfang", auch wenn die Zeile selbst von ' +
        'der Bühnenzuordnung spricht, nicht vom Lesestatus. Regel-ID eingeführt in ' +
        'docs/slices/010-lesepfade-leserechte.md, Festlegung 2 ("Leseumfang") — dort die genauere ' +
        'Herleitung. Durch diese Regel nicht umgesetzt: die Bühnenzuordnung für den Vorstand selbst ' +
        '(Attributregel, laut Scheibe 010 für 047 vorgesehen); R-PERM-03 betrifft heute nur den ' +
        'Leseumfang von `question.read.delivered` (permissions.ts). Die 404-Maskierung für eine ' +
        'einzelne Frage außerhalb des Leseumfangs (Festlegung 3 von docs/slices/010-lesepfade-' +
        'leserechte.md) hat ebenfalls keine Fundstelle in Recherche oder Ist-Analyse; sie ist eine ' +
        'Architekturentscheidung, keine externe Vorgabe.',
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
      'returns the first successful result instead of re-executing (createInProcessApi, api.ts). A ' +
      'first call that fails (403, 409, 422 …) is not cached; a retry runs again.',
    legalRef: {
      source: 'Leitplanken',
      citation:
        'Checklistenpunkt, kein Regel-Charakter (docs/qualitaetsleitplanken-produktreife.md:8-9: "Dieses ' +
        'Dokument führt keine Regel, kein Tor, keine Rolle und keine Freigabe ein"): ' +
        'docs/qualitaetsleitplanken-produktreife.md:167 (Checkliste 6.3: "Wiederholungen sind ' +
        'idempotent je Akteur und Operation"). Teilweise: gibt das erste erfolgreiche Ergebnis ' +
        'zurück; fehlgeschlagene Erstaufrufe werden nicht zwischengespeichert (api.ts `idempotent`), ' +
        'eine Wiederholung läuft erneut durch und kann anders ausgehen. Ableitung: ein ' +
        'fehlgeschlagener Aufruf hängt kein Ereignis an, eine doppelte Wirkung entsteht so nicht.',
      docVersion: '23. September 2026 (Scheibe 009, konsolidiert aus Scheibe 008)',
      docHash: null,
      verified: false,
    },
  },
];

/** An effect every question-changing rule has, which hangs on no single rule id (Festlegung 1: no new
 * id for it). Listed so that docs/legal-trace.md — the document Recht receives — shows it with a trace. */
export interface CrossCuttingEffect {
  readonly effect: string;
  /** Where the effect happens in the code. */
  readonly code: string;
  readonly legalRef: LegalRef;
}

/**
 * Cross-cutting effects (Querschnitt), rendered as their own section of docs/legal-trace.md by the
 * snapshot test in `__tests__/rules.test.ts`. Not part of `ruleRegister()`: none of them is a rule id.
 */
export const CROSS_CUTTING_EFFECTS: readonly CrossCuttingEffect[] = [
  {
    effect: 'Das erste Frage-Ereignis setzt die Version der Frage (`version`) auf 1, jedes weitere erhöht sie; Grundlage für If-Match/ETag.',
    code: 'state.ts `touch`; api.ts `checkIfMatch`',
    legalRef: {
      source: 'Leitplanken',
      citation:
        'Checklistenpunkt, kein Regel-Charakter (docs/qualitaetsleitplanken-produktreife.md:8-9): ' +
        'docs/qualitaetsleitplanken-produktreife.md:175 (Checkliste 6.4: "Erfolg, 400/422, 403, 404, ' +
        '409, 412, 428 und 500 sind konsistent als Problem-Details mit Regel-ID modelliert") stützt ' +
        'nur das Antwortformat für 412/428. Nicht belegt: die Versionszählung selbst. Ableitung: ' +
        'Architekturentscheidung gegen verlorene Änderungen bei gleichzeitiger Bearbeitung, keine ' +
        'Vorgabe in Recherche oder Ist-Analyse.',
      docVersion: '23. September 2026 (Scheibe 009, konsolidiert aus Scheibe 008)',
      docHash: null,
      verified: false,
    },
  },
  {
    effect: 'Jedes Frage-Ereignis setzt den Bearbeitungszeitpunkt der Frage (`updatedAt`).',
    code: 'state.ts `touch`',
    legalRef: {
      source: 'Prozess',
      citation:
        'docs/ist-analyse-und-schnittstellen.md:81 ("Zeitstempel Erstellung und Bearbeitung"). ' +
        'Teilweise zu docs/anforderungen-recherche.md:205 ("Serverseitiger, NTP-synchronisierter ' +
        'Zeitstempel für Eingang, jede Statusänderung und jede Wortlautversion"): Zeitpunkt aus der ' +
        'eingesetzten Uhr; serverseitig und NTP-synchronisiert nicht sichergestellt (Demo: ' +
        'Browser-Uhr, apps/web/src/api/index.ts:46).',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    effect:
      'Jede Änderung ist ein angehängtes Ereignis mit Zeitpunkt (`at`) und Akteur (`actor`); ' +
      'Ereignisse werden nur angehängt, nie überschrieben oder entfernt.',
    code: 'api.ts `append`; Ereignisspeicher',
    legalRef: {
      source: 'Recherche',
      citation:
        'Teilweise zu docs/anforderungen-recherche.md:205 ("Serverseitiger, NTP-synchronisierter ' +
        'Zeitstempel für Eingang, jede Statusänderung und jede Wortlautversion"): Zeitpunkt aus der ' +
        'eingesetzten Uhr; serverseitig und NTP-synchronisiert nicht sichergestellt (Demo: ' +
        'Browser-Uhr, apps/web/src/api/index.ts:46). Akteur: nicht belegt als eigenes Feld. ' +
        'Ableitung: docs/rollen-und-rechtekonzept.md:158-160 (Abschnitt 4: "Keine physische ' +
        'Löschung … eines Auditeintrags", "Kein Abschalten des Audit-Logs") setzt ein Protokoll ' +
        'voraus, das den Handelnden nennt. Demo: `resetDemo` (apps/web/src/api/index.ts:72-79) löscht ' +
        'das gesamte Protokoll des Geräts, für jede Rolle; docs/rollen-und-rechtekonzept.md:158-160 ist ' +
        'in der Demo nicht erfüllt, der Speicher der Domäne selbst ändert und löscht nichts.',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    effect:
      'Nach jedem Ereignis werden die Zähler aus den Ständen neu berechnet: auf der Bühne ' +
      '(`staged`), vorgelesen (`delivered` und `closed`), offen (alles außer `closed`, ' +
      '`withdrawn`, `merged`, `delivered`), je Stand.',
    code: 'state.ts `refreshCounts`; api.ts `getStage` (`deliveredCount`, `openCount`)',
    legalRef: {
      source: 'Recherche',
      citation:
        'docs/anforderungen-recherche.md:285 ("[MUSS] Verbindliche Zähldefinition vor der ' +
        'Einberufung. Was ist eine Frage? Zählen Dubletten, Nachfragen, zurückgezogene? Von Recht ' +
        'und Kommunikation gemeinsam freigegeben, vom Tool exakt so berechnet …"). Nicht umgesetzt: ' +
        'eine freigegebene Zähldefinition gibt es nicht; die Zähler folgen allein dem Stand, so ' +
        'zählt eine zurückgezogene oder zusammengeführte Frage nicht mehr als offen, und eine ' +
        'vorgelesene Frage fällt nach Rückgabe oder Zurückziehen aus dem Zähler der vorgelesenen. ' +
        'Teilweise zu docs/ist-analyse-und-schnittstellen.md:88 ("Zähler je Person: gesamt / in ' +
        'Bearbeitung / bereit zum Vorlesen / abgeschlossen"): ein Zähler für alle, nicht je Person.',
      docVersion: null,
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
