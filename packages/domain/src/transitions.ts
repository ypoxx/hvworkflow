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
      'Beantwortung", dann "7 Legal Clearing"). Ableitung: das Legal Clearing setzt eine vorliegende ' +
      'Antwort voraus.',
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
      'ohne weitere Recherche", verantwortlich "Vorstand", Spalte "Rechtsprüfung vor der Bühne": ' +
      '"keine")',
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
      'docs/ist-analyse-und-schnittstellen.md:51-52 (Antwortpfade B "Fast Track": "Antwort über ' +
      'vorhandene Publikation (Verweis)" und C "Expert Track": "fachliche Beantwortung"). Ableitung: ' +
      'beide Pfade erzeugen einen Text, anders als Pfad A.',
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
      'docs/anforderungen-recherche.md:147 ("[MUSS] Dublettenerkennung auf Trefferquote statt ' +
      'Präzision kalibrieren ..."). Ableitung: Ziel und Quelle des Merges müssen zwei unterschiedliche ' +
      'Fragen sein. Teilweise wie R-TRANS-12: die Zeile selbst spricht von "Merge reversibel, mit ' +
      'Nutzer, Zeitstempel und Ähnlichkeitsscore protokolliert" — dieser Guard verlangt davon nur die ' +
      'Verschiedenheit von Ziel und Quelle, nichts zur Reversibilität oder zum Score.',
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
        'klassifizieren → Zuordnung zu Pfad A, B oder C") belegt das Pflichtfeld `track`. Die beiden ' +
        'übrigen Felder dieser Zeile haben je eine eigene Fundstelle: `agendaItemId` ' +
        '(Tagesordnungspunkt) in docs/anforderungen-recherche.md:62 ("[MUSS] TOP-Zuordnung als ' +
        'hartes Pflichtfeld, Mehrfachzuordnung erlaubt, Umhängen mit Historie. Ohne TOP-Bezug ist ' +
        'weder die Erforderlichkeit prüfbar …"); `stageAssignment` (Bühnenzuordnung) in ' +
        'docs/ist-analyse-und-schnittstellen.md:80 ("Bühnenzuordnung (Aufsichtsrat / Vorstand / ' +
        'CFO)"). Teilweise für `agendaItemId`: (1) optional statt Pflichtfeld — eine Klassifizierung ' +
        'ohne Tagesordnungspunkt wird angenommen, nur ein genannter Punkt muss existieren ' +
        '(types.ts `Classification`, api.ts `classifyQuestion`); (2) keine Mehrfachzuordnung — das ' +
        'Feld nimmt genau einen Tagesordnungspunkt auf; (3) Umhängen nur durch erneutes ' +
        'Klassifizieren und nur aus `captured` oder `classified`; jede Klassifizierung steht als ' +
        'eigenes Ereignis im Ereignisprotokoll (Verlauf der Frage), einen eigenen Vermerk "umgehängt ' +
        'von … nach …" gibt es nicht, und ein erneutes Klassifizieren ohne `agendaItemId` entfernt ' +
        'die bestehende Zuordnung (state.ts, `QuestionClassified`). Nicht belegt: dass ein erneutes ' +
        'Klassifizieren ohne `stageAssignment` ebenso die bestehende Bühnenzuordnung entfernt ' +
        '(state.ts, `QuestionClassified`). Ableitung: jede Klassifizierung ersetzt die vorige ' +
        'vollständig; docs/ist-analyse-und-schnittstellen.md:80 nennt die Bühnenzuordnung nur als ' +
        'Feld der Frage, ohne Regel für ihr Entfernen.',
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
      source: 'Rechtekonzept',
      citation:
        'docs/rollen-und-rechtekonzept.md:107 (2.4: Übergang `classified` → `expert_answering`, ' +
        'Pflichtfeld "Segment"). Offene Lücke: ' +
        'docs/anforderungen-recherche.md:221 fordert „Zuweisung an Personen statt Postfächer, mit ' +
        'Anwesenheitsstatus, hinterlegten Vertretern, automatischer Umleitung … und \'Take next\'"; ' +
        'diese Regel weist nur eine Einheit (`unitId`) zu, keine Person — teilweise umgesetzt, nicht ' +
        'die in der Recherche beschriebene Personenzuweisung. Teilweise für die Zuweisung aus ' +
        '`assigned` (Umhängen an eine andere Einheit): docs/anforderungen-recherche.md:220 verlangt ' +
        '"Mehrfachzuweisung mit einem federführenden Bereich, jedes Umrouten mit Historie"; hier ' +
        'ersetzt die neue Einheit die bisherige (`unitId`, genau ein Wert), jede Zuweisung steht als ' +
        'eigenes Ereignis im Ereignisprotokoll, einen Vermerk "von … nach …" gibt es nicht.',
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
        'Beantwortung") belegt das Hinzufügen einer Antwortversion selbst. Die Folge, dass eine ' +
        'neue Version eine bestehende Freigabe erlöschen lässt (`invalidatedApprovalOfVersion`), ' +
        'steht in docs/rollen-und-rechtekonzept.md:163 (Abschnitt 4: "Keine Freigabe ohne Bindung ' +
        'an die Textversion. Jede Textänderung nach Freigabe setzt sie zurück."). Teilweise für ' +
        'die Quelle: docs/rollen-und-rechtekonzept.md:108 (2.4: Übergang `expert_answering` → ' +
        '`legal_clearing`) nennt "Antworttext, Quelle" als Pflichtfelder, und ' +
        'docs/anforderungen-recherche.md:101 (unter "[MUSS] Konsistenztest gegen die letzte ' +
        'Kapitalmarktkommunikation") verlangt "Jede Antwort an eine belastbare Quelle mit ' +
        'Fundstelle gebunden"; hier ist nur der Antworttext Pflicht, `sources` ist optional ' +
        '(api.ts `draftAnswer`), und auch R-TRANS-04 verlangt keine Quelle. Jede Version hält ' +
        'Zeitpunkt und Ersteller fest (`createdAt`, `createdBy`, api.ts `draftAnswer`). Zum ' +
        'Zeitpunkt teilweise zu docs/anforderungen-recherche.md:205 ("Serverseitiger, ' +
        'NTP-synchronisierter Zeitstempel für Eingang, jede Statusänderung und jede ' +
        'Wortlautversion"): Zeitpunkt aus der eingesetzten Uhr; serverseitig und NTP-synchronisiert ' +
        'nicht sichergestellt (Demo: Browser-Uhr, apps/web/src/api/index.ts:46). Den Ersteller ' +
        'setzt Rechtekonzept Abschnitt 4 "Ersteller ≠ Freigeber" (docs/rollen-und-' +
        'rechtekonzept.md:156) voraus (Ableitung; der Guard dazu fehlt, siehe R-TRANS-05). Nicht ' +
        'belegt: ein Entwurf schon aus `classified`, ohne Zuweisung an eine Einheit (R-TRANS-02). ' +
        'Ableitung: docs/rollen-und-rechtekonzept.md:107 sieht vor der fachlichen Beantwortung das ' +
        'Pflichtfeld "Segment" vor; für Fast Track nennt docs/ist-analyse-und-schnittstellen.md:51 ' +
        'ein festes "Fast-Track-Team aus Kommunikation und Legal" statt einer Zuweisung. Nicht ' +
        'belegt: dass eine neue Version eine Frage aus `in_review` zurück nach `answer_drafted` holt ' +
        '(Ableitung: nur die jeweils letzte Version geht über R-TRANS-04 erneut ins Legal Clearing, ' +
        'R-GUARD-04), und dass ein bestehender Rückgabegrund dabei entfällt (Ableitung: er betraf ' +
        'die zurückgegebene Version).',
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
        '"Rechtsprüfung vor der Bühne": "ja, eigener Schritt"). Für Fast Track nicht belegt: ' +
        'docs/ist-analyse-und-schnittstellen.md:51 sieht keinen eigenen Clearing-Schritt vor ' +
        '(Spalte "Rechtsprüfung vor der Bühne": "im Team enthalten"); hier durchläuft auch Pfad B ' +
        '`in_review`/`approved`. Ableitung: welche Version dabei ins Legal Clearing geht ' +
        '(`answerVersion`, nur im Ereignis dieses Übergangs, nicht in der Projektion), hat keine ' +
        'eigene Fundstelle — das Feld hält nur die zuletzt ' +
        'entworfene Version fest (R-TRANS-03).',
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
        'ready_for_stage, Berechtigung answer.approve.legal, Pflichtfelder "Freigabevermerk" und ' +
        'Vier-Augen "Ersteller ≠ Freigeber"). Nicht umgesetzt: ' +
        '`approveQuestion` nimmt keinen Freigabevermerk entgegen, und es gibt keinen Guard ' +
        '"Ersteller ≠ Freigeber" — die Rolle `legal` hält sowohl `answer.draft` als auch ' +
        '`question.approve` (permissions.ts), obwohl Rechtekonzept §4 (docs/rollen-und-' +
        'rechtekonzept.md:156) das Vier-Augen-Prinzip als nicht konfigurierbar bezeichnet ("Kein ' +
        'Recht und keine Rollenkombination kann das Vier-Augen-Prinzip abschalten"). Für Fast Track nicht belegt: docs/ist-analyse-und-schnittstellen.md:51 sieht keinen ' +
        'eigenen Clearing-Schritt vor (Spalte "Rechtsprüfung vor der Bühne": "im Team enthalten"); ' +
        'hier durchläuft auch Pfad B `in_review`/`approved`. Die Freigabe hält Version, Zeitpunkt ' +
        'und Freigebenden fest (`approval.answerVersion`, `approvedAt`, `approvedBy`; state.ts ' +
        '`QuestionApproved`). Teilweise zu docs/anforderungen-recherche.md:227 ("Kryptografische ' +
        'Versiegelung freigegebener Antworten — Hash über den exakten Text, signiert vom ' +
        'Freigebenden, mit qualifiziertem Zeitstempel"): Freigebender und Zeitpunkt stehen fest, ' +
        'Hash, Signatur, qualifizierter Zeitstempel und "die Podiumsansicht verifiziert vor ' +
        'Anzeige" fehlen.',
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
      source: 'Rechtekonzept',
      citation:
        'Je Ausgangsstand: aus `in_review` belegt durch docs/rollen-und-rechtekonzept.md:110 ' +
        '(Abschnitt 2.4, Übergang legal_clearing → expert_answering, Pflichtfeld "Rückgabegrund" — ' +
        'passt zum Pflichtfeld `reason` dieser Regel); aus `staged` belegt durch ' +
        'docs/ist-analyse-und-schnittstellen.md:90 (Bühnenansicht-Aktion "Antwort zurückgeben" → ' +
        'zurück ins Backoffice), das trägt auch die Folge, dass die Frage die Bühnen-Warteschlange ' +
        'verlässt (`stagePosition` entfällt). Aus `approved` nicht belegt. Ableitung: nach der ' +
        'Freigabe und vor der Bühne steht die Frage wie im Legal Clearing noch im Backoffice. Aus ' +
        '`delivered` teilweise belegt durch docs/anforderungen-recherche.md:255 (Rückkanal Podium → ' +
        'Backoffice mit Grund: "Rückkanal Podium → Backoffice (\'unzureichend, bitte ' +
        'nachschärfen\', \'nur teilweise beantwortet\', \'frei formuliert abgewichen\') plus ' +
        'Erfassung der Ist-Antwort und Diff gegen den Soll-Text mit automatischem Prüfauftrag ab ' +
        'einer Abweichungsschwelle"); nicht umgesetzt: feste Kategorien, Erfassung der Ist-Antwort, ' +
        'Diff gegen den Soll-Text, automatischer Prüfauftrag. Ableitung: ' +
        'docs/ist-analyse-und-schnittstellen.md:59 (nach der Antwortprüfung "Nein: ' +
        'Qualitätsschleife zurück zu Schritt 5") führt zurück zur Klassifizierung (Schritt 5); ' +
        'hier geht eine Textfrage zum Antwortentwurf, nur eine Podiumsfrage nach `classified`. ' +
        'Nicht belegt: eine Frage aus `delivered` fällt aus dem Zähler der vorgelesenen Fragen und ' +
        'zählt wieder als offen, eine Frage aus `staged` fällt aus dem Zähler der Fragen auf der ' +
        'Bühne (state.ts `refreshCounts`; Ableitung: Zähldefinition aus ' +
        'docs/anforderungen-recherche.md:285 fehlt). Ableitung: dass eine Podiumsfrage ' +
        'nach `classified` statt `answer_drafted` zurückgeht, hat keine eigene Fundstelle — ' +
        'Podiumsfragen durchlaufen `answer_drafted` nie (R-TRANS-08). Nicht belegt: dass bei einem ' +
        'Rücksprung nach `classified` eine Freigabe entfällt (Ableitung: eine Podiumsfrage erreicht ' +
        '`approved` nie, die Löschung greift heute ins Leere). Nicht belegt: beim Rücksprung nach ' +
        '`answer_drafted` bleibt eine bestehende Freigabe stehen (state.ts `QuestionReturned`) und ' +
        'erscheint weiter an der Frage in `answer_drafted` und `in_review`. Ableitung: die Freigabe ' +
        'hängt an einer Version (R-GUARD-04), erst eine neue Version hebt sie auf (R-TRANS-03); ohne ' +
        'neue Version muss R-TRANS-05 sie erneut erteilen, bevor die Frage auf die Bühne kann ' +
        '(R-TRANS-07 nur aus `approved`). Nicht belegt: in beiden Zweigen bleibt `deliveredAt` einer ' +
        'schon vorgelesenen Frage stehen (Ableitung: das Vorlesen bleibt eine Tatsache; ein erneutes ' +
        'Vorlesen überschreibt den Zeitpunkt in der Projektion, das Ereignisprotokoll behält beide). ' +
        'Nicht belegt: der Rückgabegrund (`returnReason`) bleibt an der Frage, bis R-TRANS-03 eine ' +
        'neue Version anlegt; eine Podiumsfrage erhält nie eine Version, bei ihr bleibt er auch nach ' +
        'erneutem Klassifizieren, Bühne und Vorlesen stehen (Ableitung: er zeigt den letzten ' +
        'Rückgabegrund, nicht einen offenen).',
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
      citation:
        'docs/ist-analyse-und-schnittstellen.md:92 ("es laufen nur die zugeordneten und ' +
        'freigegebenen Fragen ein"). Teilweise: die Bühnenzuordnung ist keine Voraussetzung für ' +
        '`staged` (optional); Sicht nach Zuordnung siehe R-PERM-03, nicht umgesetzt. Die ' +
        'Reihenfolge (`stagePosition`) ist nicht belegt ' +
        '(Architekturentscheidung: eine globale Warteschlange in der Reihenfolge, in der Fragen auf ' +
        'die Bühne gestellt werden); docs/ist-analyse-und-schnittstellen.md:87 nennt eine andere ' +
        'Sortierung ("Sortierung nach Fragesteller und vor allem nach Bühnenzuordnung").',
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
        'Beantwortung ohne weitere Recherche", verantwortlich "Vorstand", Spalte "Rechtsprüfung vor ' +
        'der Bühne": "keine"). docs/ist-analyse-und-schnittstellen.md:92 ("es laufen nur die ' +
        'zugeordneten und freigegebenen Fragen ein"): Teilweise: die Bühnenzuordnung ist keine ' +
        'Voraussetzung für `staged` (optional); Sicht nach Zuordnung siehe R-PERM-03, nicht ' +
        'umgesetzt. Ableitung: "freigegeben" kann für Pfad A keine Rechtsfreigabe meinen, ' +
        'docs/ist-analyse-und-schnittstellen.md:50 ' +
        'sieht keine vor; eine Podiumsfrage kommt ohne Freigabe auf die Bühne. Nicht umgesetzt: das ' +
        'Gate aus docs/ist-analyse-und-schnittstellen.md:135-137 (Abschnitt 5 "Delta — was das neue ' +
        'Tool zusätzlich leisten muss", Punkt 7: "Pfad A … hat heute vor dem ' +
        'Verlesen keine Rechtsprüfung. Mindestens ein schnelles, protokolliertes Gate ist nötig, das ' +
        'eine kursrelevante Antwort vor dem Podium anhalten kann"). Die Reihenfolge (`stagePosition`) ist nicht belegt (Architekturentscheidung: globale ' +
        'Warteschlange, derselbe Zähler wie R-TRANS-07); docs/ist-analyse-und-schnittstellen.md:87 ' +
        'nennt eine andere Sortierung ("nach Fragesteller und vor allem nach Bühnenzuordnung").',
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
      citation:
        'docs/ist-analyse-und-schnittstellen.md:89 (Bühnenansicht-Aktion "vorgelesen, weiter"). ' +
        'Teilweise: docs/ist-analyse-und-schnittstellen.md:89 führt "vorgelesen, weiter" unmittelbar zu "Status abgeschlossen"; hier ' +
        'endet die Aktion in `delivered`, abgeschlossen wird erst über den eigenen Schritt ' +
        'R-TRANS-10. Ableitung: die Zähler (state.ts `refreshCounts`) führen eine Frage in ' +
        '`delivered` schon als vorgelesen und nicht mehr als offen, wie ' +
        'docs/ist-analyse-und-schnittstellen.md:89 es für den ' +
        'abgeschlossenen Stand beschreibt. Festhalten der freigegebenen Version zum Zeitpunkt des ' +
        'Vorlesens (Soll); was tatsächlich gesprochen wurde (Ist), wird nicht erfasst. Die Version ' +
        'steht nur im Ereignis `QuestionDelivered` (`answerVersion`, api.ts `deliverQuestion`, nur ' +
        'wenn eine Freigabe vorliegt), nicht in der Projektion; das stützt ' +
        'docs/anforderungen-recherche.md:103 ("Soll-Ist-Abgleich der tatsächlich gesprochenen ' +
        'Antwort gegen den freigegebenen Wortlaut"). Ableitung: der Abgleich braucht die ' +
        'freigegebene Version als Soll; bei Podiumsfragen ohne Freigabe fehlt das Feld. Nicht ' +
        'umgesetzt aus derselben Zeile: der Abgleich selbst, der Overdisclosure-Alarm, die ' +
        'Handlungsoptionen "Klarstellung im Saal, Nachhol-Veröffentlichung, Korrektur der ' +
        'Q&A-Publikation" und das Pflichtfeld absichtlich/unabsichtlich. Der Zeitpunkt des ' +
        'Vorlesens (`deliveredAt`, state.ts `QuestionDelivered`, über die API sichtbar): teilweise zu ' +
        'docs/anforderungen-recherche.md:277 ("Delivery als eigene Entität, nicht als Boolean: ' +
        'Zeitpunkt, Kanal …, Antwortender, Fundstelle, verwendete Antwortversion. Eine Frage kann ' +
        'mehrere Deliveries haben."). Zeitpunkt und (im Ereignis) Version sind festgehalten; Kanal, ' +
        'Antwortender und Fundstelle fehlen, und die Projektion hält nur einen Zeitpunkt — ein ' +
        'erneutes Vorlesen nach R-TRANS-06 überschreibt ihn, nur das Ereignisprotokoll behält ' +
        'beide. Ableitung: `stagePosition` bleibt in `delivered` stehen und entfällt erst mit ' +
        'R-TRANS-10; die Bühnenansicht zeigt nur `staged` (api.ts `getStage`).',
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
        'docs/ist-analyse-und-schnittstellen.md:58-59 ("10 Antwortprüfung (Legal · FOO/GC) → ' +
        'Entscheidung \'Antwort ausreichend?\' — Ja: Frage beantwortet") — ein eigener ' +
        'Abschluss-Schritt nach der Bühne, getrennt vom Vorlesen (R-TRANS-09). Ableitung: ' +
        'docs/ist-analyse-und-schnittstellen.md:89 kennt diesen zweiten Schritt nicht, dort setzt ' +
        'schon "vorgelesen, weiter" den Status abgeschlossen; die Trennung folgt ' +
        'docs/ist-analyse-und-schnittstellen.md:58-59. Nicht ' +
        'umgesetzt: ' +
        'keine Antwortprüfung durch Legal oder FOO/GC; den Abschluss lösen die Berechtigten von ' +
        '`question.close` aus (heute podium und admin, permissions.ts), ohne Entscheidung "Antwort ' +
        'ausreichend?" und ohne deren Festhalten. Nicht belegt: dass `stagePosition` beim ' +
        'Abschluss entfällt (Ableitung: die Frage hat die Bühnen-Warteschlange schon mit R-TRANS-09 ' +
        'verlassen, die Löschung räumt nur das Feld auf).',
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
      source: 'Recherche',
      citation:
        'docs/anforderungen-recherche.md:285 ("[MUSS] Verbindliche Zähldefinition vor der ' +
        'Einberufung. Was ist eine Frage? Zählen Dubletten, Nachfragen, zurückgezogene? …") nennt ' +
        '"zurückgezogene" Fragen nur als Zählkategorie, die Recht und Kommunikation gemeinsam ' +
        'freigeben — nicht als eigenen Übergang. Der Übergang selbst (aus jedem nicht-terminalen ' +
        'Stand, mit Begründung, in den Stand `withdrawn`) steht in keinem der beiden ' +
        'Recherche-Dokumente. Ableitung: das ist NICHT dasselbe wie "Kein Auskunftsanspruch" ' +
        '(docs/anforderungen-recherche.md:24), das dort ausdrücklich ein eigener Statuspfad mit ' +
        'eigener Rechtsfolge ist, getrennt von "Verweigerung trotz Anspruchs". Das Pflichtfeld ' +
        '`reason` hat ebenfalls keine Fundstelle in den beiden Recherche-Dokumenten — nicht belegt, ' +
        'wie der Übergang selbst. Ebenfalls nicht belegt: dass eine zurückgezogene Frage aus ' +
        '`staged` die Bühnen-Warteschlange verlässt (`stagePosition` entfällt). Ableitung: ' +
        'docs/ist-analyse-und-schnittstellen.md:92 lässt nur zugeordnete und freigegebene Fragen ' +
        'auf die Bühne einlaufen; eine zurückgezogene gehört nicht mehr dazu. Nicht belegt: die ' +
        'Begründung landet im selben Feld wie ein Rückgabegrund (`returnReason`, state.ts ' +
        '`QuestionWithdrawn`) und ersetzt einen dort stehenden; eine Freigabe und `deliveredAt` ' +
        'bleiben stehen (Ableitung: das Ereignisprotokoll trennt beide Gründe nach Ereignistyp, die ' +
        'Projektion nicht). Nicht belegt: eine schon vorgelesene Frage (aus `delivered`) fällt beim ' +
        'Zurückziehen aus dem Zähler der vorgelesenen Fragen heraus (state.ts `refreshCounts`). ' +
        'Ableitung: ob sie dann als zurückgezogen oder als beantwortet zählt, legt erst die ' +
        'Zähldefinition aus docs/anforderungen-recherche.md:285 fest, die es noch nicht gibt.',
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
    description: 'Merge a duplicate (Zusammenführen) into another question while it is in capture or answering, before legal clearing.',
    legalRef: {
      source: 'Recherche',
      citation:
        'docs/anforderungen-recherche.md:147 ("[MUSS] Dublettenerkennung auf Trefferquote statt ' +
        'Präzision kalibrieren ..."). Teilweise: die Zeile fordert "Merge reversibel, mit Nutzer, Zeitstempel ' +
        'und Ähnlichkeitsscore protokolliert" — `merged` ist hier aber ein Terminalstand ' +
        '(`TERMINAL_STATUSES`), es gibt kein Unmerge und keinen gespeicherten Ähnlichkeitsscore; ' +
        'Nutzer und Zeitstempel stehen im Ereignis `QuestionMerged` (Akteur, Zeitpunkt). ' +
        'Teilweise auch beim Ziel: es muss nur existieren, sein Stand spielt keine Rolle ' +
        '(api.ts `mergeQuestion`, `requireQuestionFor`); eine Frage lässt sich auch in eine ' +
        'zurückgezogene, selbst zusammengeführte oder abgeschlossene Frage zusammenführen, und das ' +
        'Ziel kommt selbst nicht (mehr) auf die Bühne (zurückgezogen, abgeschlossen) oder nur über ' +
        'eine Kette, die der Code nicht auflöst (zusammengeführt). Die zusammengeführte Frage zählt ' +
        'dann nicht mehr als offen (state.ts `refreshCounts`), unabhängig vom Stand des Ziels. Die ' +
        'Zeile sagt dazu: "Eine fälschlich weggeclusterte Frage gilt als nicht beantwortet." ' +
        'Nicht belegt: eine Freigabe, `deliveredAt` oder ein Rückgabegrund, die nach R-TRANS-06 an ' +
        'einer Frage in `answer_drafted` stehen geblieben sind, und `deliveredAt` und Rückgabegrund einer ' +
        'nach R-TRANS-06 aus `delivered` nach `classified` zurückgegebenen Frage, bleiben auch an der ' +
        'zusammengeführten Frage stehen (Ableitung wie bei R-TRANS-06). Nicht belegt: der ' +
        'Bestandscheck des Zielobjekts (`intoQuestionId`, `requireQuestionFor` in api.ts) — ' +
        'Architekturentscheidung, keine externe Vorgabe. Er maskiert nicht nach Leserecht: wer ' +
        '`question.merge` hält, erreicht die Zielsuche erst, nachdem `can()` dieses Recht bestätigt hat, und bekommt jede ' +
        'vorhandene Frage als Ziel, auch eine, die er nicht lesen darf; 404 nur für eine unbekannte ' +
        'ID. Die Existenz eines Ziels ist damit für jeden sichtbar, der `question.merge` hält; heute ' +
        'ohne Folge (beide Rollen mit `question.merge` lesen alle Fragen), wirksam, sobald ein ' +
        'Merge-Recht ohne volles Leserecht vergeben wird.',
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
