/**
 * The status machine of a question as a table. Every row is one allowed edge; anything not listed is
 * forbidden (deny by default). Guards express conditions that depend on the question itself.
 *
 * Rule ids (R-TRANS-nn) are referenced by tests and by error responses so that a legal or process
 * reviewer can trace a decision back to this table.
 */
import type { Permission, QuestionRecord, QuestionStatus, Track } from './types.js';
import { TERMINAL_STATUSES } from './types.js';
// Type-only: `rules.ts` imports the *value* `TRANSITIONS` from this file to build `ruleRegister()`,
// so this direction must stay type-only (isolatedModules erases it) or the two files would import
// each other's values and form a real load-time cycle.
import type { LegalRef } from './rules.js';

export interface Guard {
  ruleId: string;
  description: string;
  /** Legal/process trace for this guard (slice 011, Festlegung 2 of docs/slices/011-legal-trace-
   * regelregister.md) — `ruleRegister()` (rules.ts) reads this to build docs/legal-trace.md. */
  legalRef: LegalRef;
  check: (q: QuestionRecord, payload?: unknown) => boolean;
}

export interface Transition {
  ruleId: string;
  action: Permission;
  from: readonly QuestionStatus[];
  to: QuestionStatus | ((q: QuestionRecord) => QuestionStatus);
  guards?: readonly Guard[];
  description: string;
  /** Legal/process trace for this row (slice 011, see `Guard.legalRef`). */
  legalRef: LegalRef;
}

const NON_PODIUM: readonly Track[] = ['fast_track', 'expert_track'];

const hasAnswer: Guard = {
  ruleId: 'R-GUARD-01',
  description: 'At least one answer version exists.',
  legalRef: {
    source: 'Prozess',
    citation:
      'docs/ist-analyse-und-schnittstellen.md:52 (Antwortpfad C "Expert Track": erst "6 fachliche ' +
      'Beantwortung", dann "7 Legal Clearing" — die Prüfung setzt eine vorliegende Antwort voraus)',
    docVersion: null,
    docHash: null,
    verified: false,
  },
  check: (q) => q.answers.length > 0,
};
const isPodiumTrack: Guard = {
  ruleId: 'R-GUARD-02',
  description: 'Track is "podium": the board answers freely, no text is prepared.',
  legalRef: {
    source: 'Prozess',
    citation:
      'docs/ist-analyse-und-schnittstellen.md:50 (Antwortpfad A "No-Brainer": "\'freie\' Beantwortung ' +
      'ohne weitere Recherche" durch den Vorstand, keine Rechtsprüfung vor der Bühne)',
    docVersion: null,
    docHash: null,
    verified: false,
  },
  check: (q) => q.track === 'podium',
};
const isTextTrack: Guard = {
  ruleId: 'R-GUARD-03',
  description: 'Track is fast_track or expert_track: an answer text is prepared.',
  legalRef: {
    source: 'Prozess',
    citation:
      'docs/ist-analyse-und-schnittstellen.md:51-52 (Antwortpfade B "Fast Track" und C "Expert ' +
      'Track": Antwort über vorhandene Publikation bzw. fachliche Beantwortung — beide mit Text)',
    docVersion: null,
    docHash: null,
    verified: false,
  },
  check: (q) => q.track !== undefined && NON_PODIUM.includes(q.track),
};
const approvalIsLatest: Guard = {
  ruleId: 'R-GUARD-04',
  description:
    'The approved version must be the latest answer version (approval bound to the text).',
  legalRef: {
    source: 'Rechtekonzept',
    citation:
      'docs/rollen-und-rechtekonzept.md:163 (Abschnitt 4: "Keine Freigabe ohne Bindung an die ' +
      'Textversion. Jede Textänderung nach Freigabe setzt sie zurück.")',
    docVersion: null,
    docHash: null,
    verified: false,
  },
  check: (q, payload) => {
    const latest = q.answers[q.answers.length - 1]?.version;
    if (latest === undefined) return false;
    const v = (payload as { answerVersion?: number } | undefined)?.answerVersion;
    // Without a payload this is the capability question behind `_actions` ("may approve at all?"):
    // yes, and only the latest version. With a payload the named version must be the latest.
    return v === undefined || v === latest;
  },
};
const notMergingIntoSelf: Guard = {
  ruleId: 'R-GUARD-05',
  description: 'A question cannot be merged into itself.',
  legalRef: {
    source: 'Recherche',
    citation:
      'docs/anforderungen-recherche.md:147 ("[MUSS] Dublettenerkennung ...; Merge reversibel, mit ' +
      'Nutzer, Zeitstempel und Ähnlichkeitsscore protokolliert" — Ziel und Quelle des Merges müssen ' +
      'zwei unterschiedliche Fragen sein)',
    docVersion: null,
    docHash: null,
    verified: false,
  },
  check: (q, payload) => (payload as { intoQuestionId?: string } | undefined)?.intoQuestionId !== q.id,
};

const NON_TERMINAL = (['captured', 'classified', 'assigned', 'answer_drafted', 'in_review', 'approved', 'staged', 'delivered'] as const) satisfies readonly QuestionStatus[];

export const TRANSITIONS: readonly Transition[] = [
  {
    ruleId: 'R-TRANS-01',
    action: 'question.classify',
    from: ['captured', 'classified'],
    to: 'classified',
    description: 'Classify (Klassifizieren): choose the answer track, agenda item, stage assignment.',
    legalRef: {
      source: 'Prozess',
      citation:
        'docs/ist-analyse-und-schnittstellen.md:42-43 (P3 Klassifizierung und Aufteilung: "5 Frage ' +
        'klassifizieren → Zuordnung zu Pfad A, B oder C")',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-TRANS-02',
    action: 'question.assign',
    from: ['classified', 'assigned'],
    to: 'assigned',
    guards: [isTextTrack],
    description: 'Assign to an answering unit (Zuweisen). Not for the podium track.',
    legalRef: {
      source: 'Recherche',
      citation:
        'docs/anforderungen-recherche.md:221 ("[MUSS] Zuweisung an Personen statt Postfächer, mit ' +
        'Anwesenheitsstatus, hinterlegten Vertretern, automatischer Umleitung ... und \'Take next\' ' +
        'für freie Kapazitäten")',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-TRANS-03',
    action: 'answer.draft',
    from: ['classified', 'assigned', 'answer_drafted', 'in_review', 'approved'],
    to: 'answer_drafted',
    guards: [isTextTrack],
    description:
      'Add an answer version (Antwortentwurf). A new version after approval invalidates the approval.',
    legalRef: {
      source: 'Prozess',
      citation:
        'docs/ist-analyse-und-schnittstellen.md:52 (Antwortpfad C "Expert Track": "6 fachliche ' +
        'Beantwortung")',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-TRANS-04',
    action: 'question.submit_review',
    from: ['answer_drafted'],
    to: 'in_review',
    guards: [hasAnswer],
    description: 'Hand the latest version to legal clearing (Zur Prüfung).',
    legalRef: {
      source: 'Prozess',
      citation:
        'docs/ist-analyse-und-schnittstellen.md:52 (Antwortpfad C: "7 Legal Clearing"; Spalte ' +
        '"Rechtsprüfung vor der Bühne: ja, eigener Schritt")',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-TRANS-05',
    action: 'question.approve',
    from: ['in_review'],
    to: 'approved',
    guards: [hasAnswer, approvalIsLatest],
    description: 'Approve (Freigeben) exactly the latest answer version.',
    legalRef: {
      source: 'Rechtekonzept',
      citation:
        'docs/rollen-und-rechtekonzept.md:109 (Abschnitt 2.4, Übergang legal_clearing → ' +
        'ready_for_stage, Berechtigung answer.approve.legal, Pflichtfeld Freigabevermerk)',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-TRANS-06',
    action: 'question.return',
    from: ['in_review', 'approved', 'staged', 'delivered'],
    to: (q) => (q.track === 'podium' ? 'classified' : 'answer_drafted'),
    description: 'Return for rework (Zurückgeben) with a reason. Podium-track questions go back to classified.',
    legalRef: {
      source: 'Prozess',
      citation:
        'docs/ist-analyse-und-schnittstellen.md:59,90 (Entscheidung "Antwort ausreichend?" — Nein: ' +
        '"Qualitätsschleife zurück zu Schritt 5"; Bühnenansicht-Aktion "Antwort zurückgeben" → zurück ' +
        'ins Backoffice)',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-TRANS-07',
    action: 'question.stage',
    from: ['approved'],
    to: 'staged',
    description: 'Put an approved answer on the podium queue (Auf die Bühne).',
    legalRef: {
      source: 'Prozess',
      citation: 'docs/ist-analyse-und-schnittstellen.md:57 ("→ Bühne: Frage wird verlesen")',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-TRANS-08',
    action: 'question.stage',
    from: ['classified'],
    to: 'staged',
    guards: [isPodiumTrack],
    description: 'Podium track: the question itself goes to the podium, the board answers freely.',
    legalRef: {
      source: 'Prozess',
      citation:
        'docs/ist-analyse-und-schnittstellen.md:50 (Antwortpfad A "No-Brainer": "\'freie\' ' +
        'Beantwortung ohne weitere Recherche" durch den Vorstand, keine Rechtsprüfung vor der Bühne)',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-TRANS-09',
    action: 'question.deliver',
    from: ['staged'],
    to: 'delivered',
    description: 'Read out on the podium (Vorgelesen).',
    legalRef: {
      source: 'Prozess',
      citation: 'docs/ist-analyse-und-schnittstellen.md:89 (Bühnenansicht-Aktion "vorgelesen, weiter")',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-TRANS-10',
    action: 'question.close',
    from: ['delivered'],
    to: 'closed',
    description: 'Close (Abschließen) after delivery.',
    legalRef: {
      source: 'Prozess',
      citation:
        'docs/ist-analyse-und-schnittstellen.md:89 (Bühnenansicht-Aktion "vorgelesen, weiter" → ' +
        'Status abgeschlossen; das IST-Tool kennt "vorgelesen" und "abgeschlossen" nicht als zwei ' +
        'getrennte Stände)',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-TRANS-11',
    action: 'question.withdraw',
    from: NON_TERMINAL,
    to: 'withdrawn',
    description: 'Withdraw (Zurückziehen) with a reason, from any non-terminal status.',
    legalRef: {
      source: 'Prozess',
      citation:
        'kein wörtlicher Beleg in docs/anforderungen-recherche.md oder ' +
        'docs/ist-analyse-und-schnittstellen.md; nächstliegende Analogie ' +
        'docs/ist-analyse-und-schnittstellen.md:44 (Sonderfall "kein Antwortbedarf" → ' +
        'Direktabschluss); der Statusbegriff selbst nur als Vokabular in docs/glossar.md:33 ' +
        '("Zurückgezogen"/"Withdrawn")',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
  {
    ruleId: 'R-TRANS-12',
    action: 'question.merge',
    from: ['captured', 'classified', 'assigned', 'answer_drafted'],
    to: 'merged',
    guards: [notMergingIntoSelf],
    description: 'Merge a duplicate (Zusammenführen) into another question before an answer is reviewed.',
    legalRef: {
      source: 'Recherche',
      citation:
        'docs/anforderungen-recherche.md:147 ("[MUSS] Dublettenerkennung auf Trefferquote statt ' +
        'Präzision kalibrieren ...; Merge reversibel, mit Nutzer, Zeitstempel und Ähnlichkeitsscore ' +
        'protokolliert")',
      docVersion: null,
      docHash: null,
      verified: false,
    },
  },
];

/** Actions that change the status of a question. Everything else is read or non-question. */
export const TRANSITION_ACTIONS: readonly Permission[] = Array.from(
  new Set(TRANSITIONS.map((t) => t.action)),
);

export type TransitionResult =
  | { ok: true; transition: Transition; to: QuestionStatus }
  | { ok: false; ruleId: string; reason: string };

/**
 * Find the transition for `action` from the question's current status and evaluate its guards.
 * R-TRANS-00: an action without a matching row is a conflict.
 */
export function resolveTransition(
  q: QuestionRecord,
  action: Permission,
  payload?: unknown,
): TransitionResult {
  if (TERMINAL_STATUSES.includes(q.status)) {
    return { ok: false, ruleId: 'R-TRANS-00', reason: `Status "${q.status}" is terminal.` };
  }
  const candidates = TRANSITIONS.filter((t) => t.action === action && t.from.includes(q.status));
  if (candidates.length === 0) {
    return {
      ok: false,
      ruleId: 'R-TRANS-00',
      reason: `Action "${action}" is not allowed from status "${q.status}".`,
    };
  }
  let lastGuardFailure: { ruleId: string; reason: string } | undefined;
  for (const t of candidates) {
    const failed = (t.guards ?? []).find((g) => !g.check(q, payload));
    if (!failed) {
      const to = typeof t.to === 'function' ? t.to(q) : t.to;
      return { ok: true, transition: t, to };
    }
    lastGuardFailure = { ruleId: failed.ruleId, reason: failed.description };
  }
  return { ok: false, ...lastGuardFailure! };
}
