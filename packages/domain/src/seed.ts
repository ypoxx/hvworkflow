/**
 * Synthetic demo corpus. Deterministic (seeded RNG), German, no real persons, no real company data.
 * Produces the event log of a general meeting in progress: four rounds of speakers, ~800 questions
 * in all workflow statuses, a podium queue, and a realistic afternoon backlog.
 *
 * Nothing here is used outside the demo; production data enters through the API only.
 */
import type { NewEvent } from './events.js';
import type { Actor, QuestionStatus, SpeakerKind, StageAssignment, Track } from './types.js';

/* ---------- deterministic randomness ---------- */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(rnd: () => number, arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const chance = (rnd: () => number, p: number): boolean => rnd() < p;
const intBetween = (rnd: () => number, min: number, max: number): number => min + Math.floor(rnd() * (max - min + 1));

/* ---------- master data ---------- */
export const SEED_AGENDA = [
  { id: 'top-1', number: 1, title: 'Vorlage des festgestellten Jahresabschlusses und des Konzernabschlusses' },
  { id: 'top-2', number: 2, title: 'Verwendung des Bilanzgewinns' },
  { id: 'top-3', number: 3, title: 'Entlastung der Mitglieder des Vorstands' },
  { id: 'top-4', number: 4, title: 'Entlastung der Mitglieder des Aufsichtsrats' },
  { id: 'top-5', number: 5, title: 'Wahl des Abschlussprüfers' },
  { id: 'top-6', number: 6, title: 'Billigung des Vergütungsberichts' },
  { id: 'top-7', number: 7, title: 'Wahlen zum Aufsichtsrat' },
  { id: 'top-8', number: 8, title: 'Ermächtigung zum Erwerb eigener Aktien' },
] as const;

export const SEED_UNITS = [
  { id: 'unit-fin', name: 'Finanzen und Controlling', shortName: 'Finanzen' },
  { id: 'unit-legal', name: 'Recht und Compliance', shortName: 'Recht' },
  { id: 'unit-hr', name: 'Personal und Vergütung', shortName: 'Personal' },
  { id: 'unit-esg', name: 'Nachhaltigkeit', shortName: 'ESG' },
  { id: 'unit-strat', name: 'Strategie und M&A', shortName: 'Strategie' },
  { id: 'unit-ir', name: 'Investor Relations', shortName: 'IR' },
  { id: 'unit-ops', name: 'Operations und Technik', shortName: 'Operations' },
  { id: 'unit-fast', name: 'Fast-Track-Team (Kommunikation und Recht)', shortName: 'Fast Track' },
] as const;

export const SEED_ACTORS: Record<string, Actor> = {
  system: { id: 'system', role: 'admin', displayName: 'System' },
  moderation: { id: 'u-mod-1', role: 'moderation', displayName: 'Versammlungsbüro' },
  capture1: { id: 'u-cap-1', role: 'capture', displayName: 'Erfassung 1' },
  capture2: { id: 'u-cap-2', role: 'capture', displayName: 'Erfassung 2' },
  expertFin: { id: 'u-exp-fin', role: 'expert', displayName: 'Fachbereich Finanzen' },
  expertHr: { id: 'u-exp-hr', role: 'expert', displayName: 'Fachbereich Personal' },
  expertEsg: { id: 'u-exp-esg', role: 'expert', displayName: 'Fachbereich Nachhaltigkeit' },
  expertStrat: { id: 'u-exp-strat', role: 'expert', displayName: 'Fachbereich Strategie' },
  expertOps: { id: 'u-exp-ops', role: 'expert', displayName: 'Fachbereich Operations' },
  fastTrack: { id: 'u-fast-1', role: 'expert', displayName: 'Fast-Track-Team' },
  legal: { id: 'u-legal-1', role: 'legal', displayName: 'Legal Clearing' },
  approver: { id: 'u-appr-1', role: 'approver', displayName: 'Freigabe Vorstandsbüro' },
  podium: { id: 'u-podium', role: 'podium', displayName: 'Podium' },
};

interface Topic {
  id: string;
  unitId: string;
  agenda: readonly string[];
  stage: readonly StageAssignment[];
  questions: readonly string[];
  answers: readonly string[];
}

/** {Y} = fiscal year, {P} = percentage, {M} = millions, {N} = small integer, {B} = billions */
const TOPICS: readonly Topic[] = [
  {
    id: 'dividende', unitId: 'unit-fin', agenda: ['top-2'], stage: ['cfo', 'ceo'],
    questions: [
      'Wie hoch war die Ausschüttungsquote im Geschäftsjahr {Y}, und welche Quote strebt der Vorstand mittelfristig an?',
      'Warum wird die Dividende trotz gestiegenem Free Cashflow nur um {N} Cent angehoben?',
      'Plant die Gesellschaft, die Dividendenpolitik von einer Quote auf einen Mindestbetrag je Aktie umzustellen?',
      'Welcher Anteil des Bilanzgewinns wird in die Gewinnrücklagen eingestellt, und wofür werden diese Mittel verwendet?',
      'Wie verhält sich die Dividendenrendite zum Durchschnitt der Wettbewerber im DAX?',
      'Wurde geprüft, statt einer Dividendenerhöhung ein Aktienrückkaufprogramm aufzulegen, und mit welchem Ergebnis?',
    ],
    answers: [
      'Die Ausschüttungsquote lag im Geschäftsjahr {Y} bei {P} Prozent des bereinigten Konzernergebnisses. Mittelfristig streben wir eine Quote zwischen 40 und 60 Prozent an, wie im Geschäftsbericht auf Seite {N}2 dargestellt.',
      'Der Vorschlag zur Gewinnverwendung berücksichtigt neben dem Free Cashflow auch den Investitionsbedarf des laufenden Jahres in Höhe von rund {B} Milliarden Euro. Die Dividendenkontinuität hat für uns Vorrang vor einer einmalig höheren Ausschüttung.',
      'Ein Aktienrückkauf wurde im Rahmen der Kapitalallokation geprüft. Der Vorstand hat sich für die Dividende entschieden, weil sie allen Aktionären gleichermaßen zugutekommt und die Bilanzstruktur nicht belastet.',
    ],
  },
  {
    id: 'verguetung', unitId: 'unit-hr', agenda: ['top-6'], stage: ['supervisory_board_chair'],
    questions: [
      'Wie hoch war die Zielerreichung der kurzfristigen variablen Vergütung des Vorstands im Geschäftsjahr {Y}, und welche Kennzahlen lagen ihr zugrunde?',
      'Warum enthält der Vergütungsbericht keine Angaben zum Verhältnis der Vorstandsvergütung zur durchschnittlichen Mitarbeitervergütung in Deutschland?',
      'Welche Nachhaltigkeitsziele sind Teil der langfristigen variablen Vergütung, und mit welchem Gewicht?',
      'Hat der Aufsichtsrat im Berichtsjahr von der Möglichkeit Gebrauch gemacht, variable Vergütung zurückzufordern?',
      'Wie begründet der Aufsichtsrat die Erhöhung der Festvergütung des Vorstandsvorsitzenden um {P} Prozent?',
      'Wurden Abfindungszahlungen an ausgeschiedene Vorstandsmitglieder geleistet, und in welcher Höhe?',
    ],
    answers: [
      'Die Zielerreichung der kurzfristigen variablen Vergütung lag im Geschäftsjahr {Y} bei {P} Prozent. Maßgeblich waren das bereinigte EBIT, der Free Cashflow und ein Nachhaltigkeitsfaktor. Die Einzelwerte sind im Vergütungsbericht, Abschnitt 3, tabellarisch dargestellt.',
      'Der Aufsichtsrat hat im Berichtsjahr keine Rückforderung variabler Vergütung veranlasst. Die Clawback-Regelung des Vergütungssystems wurde geprüft; ein Anwendungsfall lag nicht vor.',
      'Die Anpassung der Festvergütung folgt dem vertikalen und horizontalen Vergleich, den der Aufsichtsrat mit externer Unterstützung durchgeführt hat. Die Vergütung liegt damit im Median der Vergleichsgruppe.',
    ],
  },
  {
    id: 'nachhaltigkeit', unitId: 'unit-esg', agenda: ['top-1', 'top-3'], stage: ['ceo', 'board_member'],
    questions: [
      'Wie haben sich die Scope-1- und Scope-2-Emissionen im Geschäftsjahr {Y} gegenüber dem Basisjahr entwickelt?',
      'Welcher Anteil der Investitionen des Berichtsjahres war nach der EU-Taxonomie als ökologisch nachhaltig einzustufen?',
      'Bis wann will die Gesellschaft Klimaneutralität in Scope 3 erreichen, und welche Zwischenziele gelten?',
      'Wie viele Lieferanten wurden im Berichtsjahr nach dem Lieferkettensorgfaltspflichtengesetz geprüft, und wie viele Verstöße wurden festgestellt?',
      'Warum hat sich die Gesellschaft nicht der Science Based Targets Initiative angeschlossen?',
      'Welche Kosten sind im Geschäftsjahr {Y} für den Erwerb von CO2-Zertifikaten angefallen?',
      'Wie hoch ist der Frauenanteil in den beiden Führungsebenen unterhalb des Vorstands, und welche Zielgrößen gelten?',
    ],
    answers: [
      'Die Scope-1- und Scope-2-Emissionen lagen im Geschäftsjahr {Y} um {P} Prozent unter dem Basisjahr. Die Entwicklung ist im Nachhaltigkeitsbericht auf Seite {N}8 nach Standorten aufgeschlüsselt.',
      'Rund {P} Prozent der Investitionen des Berichtsjahres waren taxonomiekonform. Der Anteil steigt mit dem Investitionsprogramm in erneuerbare Eigenversorgung an den europäischen Standorten.',
      'Im Berichtsjahr wurden {N}20 Lieferanten mit erhöhtem Risikoprofil geprüft. In {N} Fällen wurden Abhilfemaßnahmen vereinbart; eine Beendigung der Geschäftsbeziehung war nicht erforderlich.',
    ],
  },
  {
    id: 'strategie', unitId: 'unit-strat', agenda: ['top-1', 'top-3'], stage: ['ceo'],
    questions: [
      'Welche Umsatz- und Margenziele verfolgt der Vorstand bis zum Geschäftsjahr {Y}+3, und wie realistisch sind sie angesichts der Marktentwicklung?',
      'Welche Rolle spielen Zukäufe in der Strategie, und welche Mittel sind dafür vorgesehen?',
      'Wie beurteilt der Vorstand die Abhängigkeit vom chinesischen Markt, und welche Gegenmaßnahmen wurden eingeleitet?',
      'Warum hält die Gesellschaft an dem verlustbringenden Geschäftsbereich fest, statt ihn zu veräußern?',
      'Welche Auswirkungen hatten die US-Zölle auf das Ergebnis des Geschäftsjahres {Y}?',
      'Welche Investitionen sind in künstliche Intelligenz geplant, und welche Einsparungen erwartet der Vorstand daraus?',
      'Wie hoch war der Anteil des Umsatzes mit neuen Produkten, die in den letzten drei Jahren eingeführt wurden?',
    ],
    answers: [
      'Der Vorstand hält an der Mittelfristplanung fest: Umsatzwachstum von durchschnittlich {N} Prozent pro Jahr und eine bereinigte EBIT-Marge von {P} Prozent. Die Annahmen sind im Geschäftsbericht im Prognosebericht erläutert.',
      'Der Umsatzanteil des chinesischen Marktes lag im Berichtsjahr bei {P} Prozent. Wir reduzieren Abhängigkeiten durch den Ausbau der Kapazitäten in Südostasien und Nordamerika; die Investitionen dafür sind im Kapitalallokationsrahmen enthalten.',
      'Die US-Zölle belasteten das Ergebnis des Geschäftsjahres {Y} mit rund {M} Millionen Euro. Ein Teil wurde durch Preisanpassungen und lokale Fertigung kompensiert.',
    ],
  },
  {
    id: 'kapital', unitId: 'unit-fin', agenda: ['top-8', 'top-1'], stage: ['cfo'],
    questions: [
      'Wofür sollen die zurückgekauften Aktien verwendet werden, und schließt der Vorstand eine Verwendung als Akquisitionswährung aus?',
      'Wie hoch ist die Nettoverschuldung im Verhältnis zum EBITDA, und welchen Zielkorridor verfolgt die Gesellschaft?',
      'Welche Fälligkeiten stehen im kommenden Geschäftsjahr an, und zu welchen Konditionen wurde zuletzt refinanziert?',
      'Warum wurde die Ermächtigung zum Erwerb eigener Aktien auf zehn Prozent des Grundkapitals festgelegt?',
      'Wie hoch waren die Zinsaufwendungen im Geschäftsjahr {Y}, und wie wirkt sich das Zinsniveau auf die Planung aus?',
      'Welche Ratingveränderungen gab es im Berichtsjahr, und wie bewertet der Vorstand das Risiko einer Herabstufung?',
    ],
    answers: [
      'Die Nettoverschuldung betrug zum Bilanzstichtag das {N},{N}-fache des EBITDA. Unser Zielkorridor liegt zwischen dem 1,0- und 2,0-fachen; die Finanzierungsstruktur ist im Konzernanhang, Abschnitt Finanzverbindlichkeiten, dargestellt.',
      'Die Ermächtigung entspricht dem gesetzlichen Rahmen des § 71 Abs. 1 Nr. 8 AktG. Über eine Ausnutzung entscheidet der Vorstand mit Zustimmung des Aufsichtsrats; ein konkreter Beschluss liegt nicht vor.',
      'Die Zinsaufwendungen lagen im Geschäftsjahr {Y} bei {M} Millionen Euro. Rund {P} Prozent der Finanzverbindlichkeiten sind festverzinslich, sodass die Planung gegenüber Zinsänderungen weitgehend unempfindlich ist.',
    ],
  },
  {
    id: 'aufsichtsrat', unitId: 'unit-legal', agenda: ['top-4', 'top-7'], stage: ['supervisory_board_chair'],
    questions: [
      'Wie viele Sitzungen hat der Prüfungsausschuss im Geschäftsjahr {Y} abgehalten, und wie hoch war die Teilnahmequote?',
      'Welche Qualifikationen bringt die zur Wahl vorgeschlagene Kandidatin für den Aufsichtsrat mit, und bestehen Interessenkonflikte?',
      'Warum überschreitet ein Aufsichtsratsmitglied die vom Kodex empfohlene Zahl an Mandaten?',
      'Wie hat der Aufsichtsrat die Effizienz seiner Tätigkeit im Berichtsjahr überprüft?',
      'Welche Beraterverträge bestehen mit Aufsichtsratsmitgliedern oder ihnen nahestehenden Unternehmen?',
      'Wie begründet der Aufsichtsrat die Wiederbestellung des Abschlussprüfers trotz der langen Mandatsdauer?',
    ],
    answers: [
      'Der Prüfungsausschuss hat im Geschäftsjahr {Y} {N} Sitzungen abgehalten; die Teilnahmequote lag bei {P} Prozent. Die Einzelteilnahme ist im Bericht des Aufsichtsrats tabellarisch dargestellt.',
      'Die vorgeschlagene Kandidatin verfügt über langjährige Erfahrung in der Finanzierung industrieller Unternehmen. Der Aufsichtsrat hat sich vergewissert, dass keine Interessenkonflikte im Sinne des Kodex bestehen.',
      'Die Selbstbeurteilung des Aufsichtsrats erfolgte im Berichtsjahr mit externer Unterstützung. Ergebnisse und abgeleitete Maßnahmen sind in der Erklärung zur Unternehmensführung zusammengefasst.',
    ],
  },
  {
    id: 'risiko', unitId: 'unit-legal', agenda: ['top-1', 'top-3'], stage: ['ceo', 'cfo'],
    questions: [
      'Welche Rückstellungen wurden für laufende Rechtsstreitigkeiten gebildet, und welches ist das größte Einzelrisiko?',
      'Gab es im Berichtsjahr Cyberangriffe mit Auswirkungen auf den Geschäftsbetrieb, und welche Kosten sind entstanden?',
      'Wie hoch war der Aufwand für Compliance-Untersuchungen, und wurden Behörden eingeschaltet?',
      'Welche Auswirkungen hätte ein Ausfall des größten Zulieferers auf die Produktion, und wie ist das abgesichert?',
      'Wurden im Geschäftsjahr {Y} Bußgelder gegen die Gesellschaft verhängt, und in welcher Höhe?',
      'Welche Sanktionsrisiken bestehen aus Geschäftsbeziehungen in Russland, und sind alle Aktivitäten beendet?',
    ],
    answers: [
      'Für Rechtsstreitigkeiten sind zum Bilanzstichtag Rückstellungen in Höhe von {M} Millionen Euro gebildet. Das größte Einzelverfahren ist im Konzernanhang unter den Eventualverbindlichkeiten beschrieben; weitergehende Angaben würden die Verteidigungsposition der Gesellschaft beeinträchtigen.',
      'Im Berichtsjahr wurden {N} sicherheitsrelevante Vorfälle registriert. Keiner davon hatte Auswirkungen auf den Geschäftsbetrieb oder auf personenbezogene Daten; die Kosten der Abwehr sind im IT-Budget enthalten.',
      'Die Geschäftsaktivitäten in Russland wurden im Jahr 2023 beendet. Verbleibende Verpflichtungen betreffen die Abwicklung von Gewährleistungen; ein Sanktionsverstoß liegt nach unserer Prüfung nicht vor.',
    ],
  },
  {
    id: 'personal', unitId: 'unit-hr', agenda: ['top-3'], stage: ['board_member', 'ceo'],
    questions: [
      'Wie viele Stellen wurden im Geschäftsjahr {Y} in Deutschland abgebaut, und wie viele im Ausland aufgebaut?',
      'Wie hoch ist die Fluktuationsrate, und welche Maßnahmen ergreift der Vorstand zur Mitarbeiterbindung?',
      'Welche Vereinbarungen bestehen mit den Arbeitnehmervertretungen zur Standortsicherung, und bis wann gelten sie?',
      'Wie viele Auszubildende wurden eingestellt, und wie hoch ist die Übernahmequote?',
      'Wie hat sich der Krankenstand im Berichtsjahr entwickelt?',
      'Welche Folgen hat der Einsatz künstlicher Intelligenz für die Beschäftigung in der Verwaltung?',
    ],
    answers: [
      'Die Zahl der Beschäftigten in Deutschland lag zum Jahresende bei {N}2.{N}00 und damit um {N} Prozent unter dem Vorjahr; der Abbau erfolgte ausschließlich über natürliche Fluktuation und freiwillige Programme.',
      'Die Fluktuationsrate betrug {N},{N} Prozent. Zur Bindung setzen wir auf Qualifizierung, flexible Arbeitsmodelle und die Beteiligung der Beschäftigten am Unternehmenserfolg.',
      'Die Standortsicherungsvereinbarung gilt bis Ende {Y}+2 und schließt betriebsbedingte Kündigungen an den deutschen Standorten aus.',
    ],
  },
  {
    id: 'operations', unitId: 'unit-ops', agenda: ['top-1'], stage: ['board_member'],
    questions: [
      'Wie hoch war die Auslastung der Produktionsstandorte im Geschäftsjahr {Y}, und welche Standorte stehen zur Disposition?',
      'Welche Fortschritte gibt es beim Bau des neuen Werks, und liegt das Projekt im Budget?',
      'Welche Lieferengpässe haben das Berichtsjahr belastet, und wie wurden sie gelöst?',
      'Wie hoch waren die Qualitätskosten, und welche Rückrufe gab es?',
      'Welche Investitionen fließen in die Digitalisierung der Fertigung, und welche Produktivitätsgewinne wurden bislang realisiert?',
    ],
    answers: [
      'Die Auslastung der Produktionsstandorte lag im Geschäftsjahr {Y} bei durchschnittlich {P} Prozent. Über Standortentscheidungen wird im Rahmen der Netzwerkplanung entschieden; ein Beschluss zur Schließung liegt nicht vor.',
      'Das neue Werk liegt im Zeit- und Budgetplan. Die Inbetriebnahme ist für das dritte Quartal {Y}+1 vorgesehen; die Gesamtinvestition beträgt rund {M} Millionen Euro.',
      'Die Qualitätskosten lagen bei {N},{N} Prozent des Umsatzes. Im Berichtsjahr gab es {N} freiwillige Rückrufaktionen ohne Sicherheitsrelevanz.',
    ],
  },
  {
    id: 'ir', unitId: 'unit-ir', agenda: ['top-1', 'top-2'], stage: ['cfo', 'ceo'],
    questions: [
      'Warum hat sich der Aktienkurs im Geschäftsjahr {Y} deutlich schlechter entwickelt als der DAX?',
      'Welche Maßnahmen ergreift der Vorstand, um die Bewertungslücke zu den Wettbewerbern zu schließen?',
      'Wie hoch ist der Anteil der Aktien im Besitz von Vorstand und Aufsichtsrat?',
      'Warum wurde die Prognose im dritten Quartal gesenkt, obwohl der Vorstand kurz zuvor die Ziele bestätigt hatte?',
      'Welche Aktionärsstruktur hat die Gesellschaft zum Stichtag, und wie hoch ist der Anteil aktivistischer Investoren?',
      'Wird die Hauptversammlung im kommenden Jahr wieder in Präsenz stattfinden?',
    ],
    answers: [
      'Die Kursentwicklung spiegelt vor allem die Unsicherheit über die Nachfrageentwicklung in unseren Kernmärkten wider. Der Vorstand konzentriert sich auf die Umsetzung der Mittelfristziele; die Bewertung durch den Kapitalmarkt folgt der operativen Entwicklung.',
      'Vorstand und Aufsichtsrat hielten zum Stichtag zusammen {N},{N} Prozent des Grundkapitals. Die Einzelangaben sind im Vergütungsbericht enthalten.',
      'Die Anpassung der Prognose im dritten Quartal beruhte auf der kurzfristigen Nachfrageabschwächung in Nordamerika, die sich erst nach der Bestätigung der Ziele abzeichnete. Der Vorstand hat den Kapitalmarkt am Tag der Erkenntnis informiert.',
    ],
  },
  {
    id: 'digital', unitId: 'unit-ops', agenda: ['top-1', 'top-3'], stage: ['board_member', 'ceo'],
    questions: [
      'Wie hoch waren die IT-Ausgaben im Geschäftsjahr {Y}, und welcher Anteil entfiel auf Cloud-Dienste außereuropäischer Anbieter?',
      'Welche Ergebnisse hat das KI-Programm bislang erbracht, und wie wird der Nutzen gemessen?',
      'Wie stellt die Gesellschaft sicher, dass beim Einsatz von KI keine Verstöße gegen den Datenschutz erfolgen?',
      'Welche Systeme sind noch nicht auf die neue ERP-Plattform migriert, und welche Kosten entstehen durch den Parallelbetrieb?',
      'Wie viele Datenschutzvorfälle wurden im Berichtsjahr an die Aufsichtsbehörden gemeldet?',
    ],
    answers: [
      'Die IT-Ausgaben lagen im Geschäftsjahr {Y} bei {M} Millionen Euro. Rund {P} Prozent entfielen auf Cloud-Dienste; für personenbezogene Daten nutzen wir ausschließlich Rechenzentren in der Europäischen Union.',
      'Das KI-Programm umfasst {N}0 Anwendungsfälle in Produktion, Einkauf und Verwaltung. Der Nutzen wird je Anwendungsfall über Zeit- und Kosteneinsparungen gemessen und vierteljährlich berichtet.',
      'Im Berichtsjahr wurden {N} meldepflichtige Datenschutzvorfälle an die zuständigen Behörden gemeldet. Keiner davon führte zu einem Bußgeld.',
    ],
  },
  {
    id: 'pruefer', unitId: 'unit-fin', agenda: ['top-5'], stage: ['supervisory_board_chair', 'cfo'],
    questions: [
      'Wie hoch war das Honorar des Abschlussprüfers im Geschäftsjahr {Y}, und welcher Anteil entfiel auf Nichtprüfungsleistungen?',
      'Welche besonders wichtigen Prüfungssachverhalte hat der Abschlussprüfer im Bestätigungsvermerk benannt?',
      'Wann ist der nächste Wechsel des Abschlussprüfers vorgesehen?',
      'Hat der Abschlussprüfer Schwächen im internen Kontrollsystem festgestellt, und welche Maßnahmen wurden ergriffen?',
    ],
    answers: [
      'Das Honorar des Abschlussprüfers betrug im Geschäftsjahr {Y} {N},{N} Millionen Euro; der Anteil der Nichtprüfungsleistungen lag bei {P} Prozent und damit innerhalb der gesetzlichen Grenze.',
      'Der Bestätigungsvermerk benennt als besonders wichtige Prüfungssachverhalte die Werthaltigkeit der Geschäfts- oder Firmenwerte und die Bewertung der Rückstellungen für Rechtsstreitigkeiten. Beide sind im Geschäftsbericht abgedruckt.',
      'Der Abschlussprüfer hat keine wesentlichen Schwächen des internen Kontrollsystems festgestellt. Hinweise zur Weiterentwicklung wurden mit dem Prüfungsausschuss erörtert und in das Maßnahmenprogramm aufgenommen.',
    ],
  },
];

const OPENINGS = [
  'Sehr geehrter Herr Vorsitzender, sehr geehrte Damen und Herren des Vorstands und des Aufsichtsrats, meine Damen und Herren Aktionäre.',
  'Herr Vorsitzender, meine Damen und Herren, ich spreche für eine Aktionärsvereinigung und vertrete heute mehrere tausend Stimmen.',
  'Guten Tag, ich bin seit vielen Jahren Aktionär dieser Gesellschaft und habe einige Fragen.',
  'Sehr geehrte Damen und Herren, ich fasse mich kurz, habe aber mehrere konkrete Fragen.',
  'Herr Vorsitzender, vielen Dank für das Wort. Ich vertrete heute Stimmrechte institutioneller Anleger.',
];
const CONNECTIVES = [
  'Meine erste Frage:',
  'Zweitens:',
  'Drittens:',
  'Darüber hinaus möchte ich wissen:',
  'Weiterhin frage ich:',
  'Außerdem:',
  'Und schließlich:',
  'Abschließend:',
  'Eine weitere Frage:',
  'Dann noch:',
];
const CLOSINGS = [
  'Vielen Dank für die Beantwortung.',
  'Ich bitte um konkrete Antworten und behalte mir vor, Fragen zu Protokoll zu geben.',
  'Danke.',
  'Ich danke Ihnen für Ihre Aufmerksamkeit.',
  '',
];
const FIRST_NAMES_F = ['Anna', 'Birgit', 'Claudia', 'Doris', 'Eva', 'Frauke', 'Gisela', 'Hanna', 'Ines', 'Julia', 'Karin', 'Lena', 'Monika', 'Nadine', 'Petra', 'Renate', 'Sabine', 'Tanja', 'Ulrike', 'Vera'];
const FIRST_NAMES_M = ['Andreas', 'Bernd', 'Christian', 'Dieter', 'Erik', 'Frank', 'Gerd', 'Holger', 'Ingo', 'Jörg', 'Klaus', 'Lars', 'Markus', 'Norbert', 'Olaf', 'Peter', 'Rainer', 'Stefan', 'Thomas', 'Uwe'];
const LAST_NAMES = ['Ahrens', 'Bachmann', 'Conrad', 'Dallmann', 'Ebert', 'Falk', 'Grunwald', 'Hartwig', 'Ilgner', 'Jansen', 'Kessler', 'Lindner', 'Mertens', 'Nowak', 'Ostermann', 'Pfeiffer', 'Quandt', 'Rehberg', 'Seidel', 'Thalmann', 'Ulbrich', 'Vogt', 'Wendt', 'Zeller'];
const ASSOCIATIONS = ['DSW', 'SdK', 'Verband der Kleinaktionäre', 'Dachverband Kritischer Aktionäre'];
const INSTITUTIONS = ['Fondsgesellschaft Nord', 'Pensionskasse Süd', 'Versicherungsverbund Mitte', 'Stiftung Kapital'];

function fill(template: string, rnd: () => number, year: number): string {
  return template
    .replace(/\{Y\}\+(\d)/g, (_, n) => String(year + Number(n)))
    .replace(/\{Y\}/g, String(year))
    .replace(/\{P\}/g, () => String(intBetween(rnd, 22, 78)))
    .replace(/\{M\}/g, () => String(intBetween(rnd, 40, 890)))
    .replace(/\{B\}/g, () => `${intBetween(rnd, 1, 4)},${intBetween(rnd, 0, 9)}`)
    .replace(/\{N\}/g, () => String(intBetween(rnd, 1, 9)));
}

export interface SeedOptions {
  questions: number;
  seed: number;
  now: Date;
  actor: Actor;
}

/** Produce the complete event log of a meeting in progress. */
export function seedEvents(o: SeedOptions): NewEvent[] {
  const rnd = mulberry32(o.seed);
  const year = o.now.getUTCFullYear() - 1;
  const events: NewEvent[] = [];
  let idCounter = 0;
  const id = (prefix: string): string => `${prefix}-${(++idCounter).toString(36).padStart(5, '0')}`;
  // The meeting clock: it opened this morning; we replay events up to "now".
  const start = new Date(o.now.getTime() - 6.5 * 3600_000);
  let clock = start.getTime();
  const tick = (minMs: number, maxMs: number): string => {
    clock += intBetween(rnd, minMs, maxMs);
    return new Date(Math.min(clock, o.now.getTime())).toISOString();
  };
  const push = (e: Omit<NewEvent, 'id'>): void => {
    events.push({ ...e, id: id('ev') } as NewEvent);
  };

  const meetingId = 'hv-' + o.now.getUTCFullYear();
  push({
    type: 'MeetingCreated',
    at: start.toISOString(),
    actor: SEED_ACTORS.system!,
    subjectId: meetingId,
    payload: {
      title: `Ordentliche Hauptversammlung ${o.now.getUTCFullYear()}`,
      legalEntity: 'Beispiel AG (synthetische Demodaten)',
      date: o.now.toISOString().slice(0, 10),
      agendaItems: SEED_AGENDA.map((a) => ({ ...a })),
      units: SEED_UNITS.map((u) => ({ ...u })),
    },
  });

  /* ---- speakers: four rounds; the meeting is in round 3 ---- */
  const roundSizes = [40, 34, 28, 16];
  const speakers: { id: string; round: number; position: number; kind: SpeakerKind; name: string; org?: string }[] = [];
  let speakerNumber = 0;
  const posCounters = [0, 0, 0, 0, 0];
  roundSizes.forEach((size, ri) => {
    for (let i = 0; i < size; i++) {
      const round = ri + 1;
      const kindRoll = rnd();
      const kind: SpeakerKind = kindRoll < 0.12 ? 'association' : kindRoll < 0.3 ? 'proxy' : 'shareholder';
      const female = chance(rnd, 0.42);
      const name = `${pick(rnd, female ? FIRST_NAMES_F : FIRST_NAMES_M)} ${pick(rnd, LAST_NAMES)}`;
      const org = kind === 'association' ? pick(rnd, ASSOCIATIONS) : kind === 'proxy' ? pick(rnd, INSTITUTIONS) : undefined;
      const sid = id('sp');
      speakerNumber += 1;
      posCounters[round] = (posCounters[round] ?? 0) + 1;
      const sp = { id: sid, round, position: posCounters[round]!, kind, name, ...(org !== undefined ? { org } : {}) };
      speakers.push(sp);
      push({
        type: 'SpeakerRegistered',
        at: tick(5_000, 40_000),
        actor: SEED_ACTORS.moderation!,
        subjectId: sid,
        payload: {
          number: speakerNumber,
          displayName: name,
          kind,
          round,
          position: sp.position,
          requestedMinutes: kind === 'association' ? intBetween(rnd, 8, 15) : intBetween(rnd, 3, 8),
          ...(org !== undefined ? { organisation: org } : {}),
        },
      });
    }
  });

  /* ---- speeches and questions ---- */
  // Speakers who have spoken: all of rounds 1-2, first 60% of round 3; one is speaking now.
  const spoken = speakers.filter((s) => s.round <= 2 || (s.round === 3 && s.position <= Math.floor(roundSizes[2]! * 0.6)));
  const speakingNow = speakers.find((s) => s.round === 3 && s.position === Math.floor(roundSizes[2]! * 0.6) + 1);
  const target = Math.max(0, o.questions);

  let questionNumber = 0;
  let stageCounter = 0;
  const expertByUnit: Record<string, Actor> = {
    'unit-fin': SEED_ACTORS.expertFin!,
    'unit-hr': SEED_ACTORS.expertHr!,
    'unit-esg': SEED_ACTORS.expertEsg!,
    'unit-strat': SEED_ACTORS.expertStrat!,
    'unit-ops': SEED_ACTORS.expertOps!,
    'unit-ir': SEED_ACTORS.expertFin!,
    'unit-legal': SEED_ACTORS.legal!,
    'unit-fast': SEED_ACTORS.fastTrack!,
  };

  // Target status by round: the further back the round, the further the questions have progressed.
  const statusFor = (round: number): QuestionStatus => {
    const r = rnd();
    if (round === 1) return r < 0.55 ? 'closed' : r < 0.78 ? 'delivered' : r < 0.9 ? 'staged' : r < 0.96 ? 'approved' : 'in_review';
    if (round === 2) return r < 0.25 ? 'closed' : r < 0.45 ? 'delivered' : r < 0.6 ? 'staged' : r < 0.75 ? 'approved' : r < 0.85 ? 'in_review' : r < 0.95 ? 'answer_drafted' : 'assigned';
    return r < 0.05 ? 'delivered' : r < 0.15 ? 'staged' : r < 0.3 ? 'approved' : r < 0.45 ? 'in_review' : r < 0.6 ? 'answer_drafted' : r < 0.75 ? 'assigned' : r < 0.9 ? 'classified' : 'captured';
  };

  const speechOf = (count: number): { text: string; parts: { text: string; start: number; end: number; topic: Topic }[] } => {
    const opening = pick(rnd, OPENINGS);
    let text = opening + ' ';
    const parts: { text: string; start: number; end: number; topic: Topic }[] = [];
    const usedTopics = new Set<string>();
    for (let i = 0; i < count; i++) {
      let topic = pick(rnd, TOPICS);
      if (usedTopics.has(topic.id) && chance(rnd, 0.7)) topic = pick(rnd, TOPICS);
      usedTopics.add(topic.id);
      const qText = fill(pick(rnd, topic.questions), rnd, year);
      const connective = i === 0 ? CONNECTIVES[0]! : pick(rnd, CONNECTIVES.slice(1));
      text += connective + ' ';
      const start = text.length;
      text += qText;
      parts.push({ text: qText, start, end: text.length, topic });
      text += ' ';
    }
    const closing = pick(rnd, CLOSINGS);
    text = (text + closing).trim();
    return { text, parts };
  };

  // Exact allocation: `target` captured questions in total. The speaker at the microphone has a
  // few questions captured so far (the capture is still running); the rest is spread over the
  // speakers who have finished, with jitter but an exact sum.
  const nowCaptured = speakingNow ? Math.min(3, target) : 0;
  const rest = target - nowCaptured;
  const counts: number[] = Array.from({ length: spoken.length }, () => 0);
  if (spoken.length > 0) {
    const base = Math.floor(rest / spoken.length);
    counts.fill(base);
    for (let r = rest - base * spoken.length; r > 0; r--) counts[intBetween(rnd, 0, spoken.length - 1)]! += 1;
    for (let k = 0; k < spoken.length * 3; k++) {
      const from = intBetween(rnd, 0, spoken.length - 1);
      const to = intBetween(rnd, 0, spoken.length - 1);
      if (counts[from]! > 1 && counts[to]! < 12) {
        counts[from]! -= 1;
        counts[to]! += 1;
      }
    }
  }
  const allSpeaking = speakingNow ? [...spoken, speakingNow] : spoken;
  allSpeaking.forEach((s, idx) => {
    const count = s === speakingNow ? nowCaptured * 2 : counts[idx]!;
    if (count === 0) return;

    const speakingAt = tick(20_000, 90_000);
    push({ type: 'SpeakerUpdated', at: speakingAt, actor: SEED_ACTORS.moderation!, subjectId: s.id, payload: { status: 'speaking' } });
    const speech = speechOf(count);
    const contributionId = id('rb');
    const captureActor = chance(rnd, 0.5) ? SEED_ACTORS.capture1! : SEED_ACTORS.capture2!;
    push({
      type: 'ContributionCaptured',
      at: tick(60_000, 240_000),
      actor: captureActor,
      subjectId: contributionId,
      payload: { speakerId: s.id, text: speech.text, source: chance(rnd, 0.3) ? 'transcript' : 'manual' },
    });
    if (s !== speakingNow) {
      push({ type: 'SpeakerUpdated', at: tick(10_000, 60_000), actor: SEED_ACTORS.moderation!, subjectId: s.id, payload: { status: 'finished' } });
    }

    // The speaker who is talking right now: the capture is still in progress, only some questions atomised.
    const partsToCapture = s === speakingNow ? speech.parts.slice(0, nowCaptured) : speech.parts;

    for (const part of partsToCapture) {
      const qid = id('fr');
      questionNumber += 1;
      const capturedAt = tick(20_000, 70_000);
      push({
        type: 'QuestionCaptured',
        at: capturedAt,
        actor: captureActor,
        subjectId: qid,
        payload: { number: `F-${String(questionNumber).padStart(4, '0')}`, contributionId, speakerId: s.id, text: part.text, span: { start: part.start, end: part.end } },
      });
      const targetStatus: QuestionStatus = s === speakingNow ? 'captured' : statusFor(s.round);
      if (targetStatus === 'captured') continue;

      const trackRoll = rnd();
      const track: Track = trackRoll < 0.15 ? 'podium' : trackRoll < 0.4 ? 'fast_track' : 'expert_track';
      const unitId = track === 'fast_track' ? 'unit-fast' : part.topic.unitId;
      push({
        type: 'QuestionClassified',
        at: tick(15_000, 60_000),
        actor: captureActor,
        subjectId: qid,
        payload: { track, agendaItemId: pick(rnd, part.topic.agenda), stageAssignment: pick(rnd, part.topic.stage) },
      });
      if (targetStatus === 'classified') continue;

      if (track === 'podium') {
        // Podium track: classified -> staged -> delivered -> closed
        if (['staged', 'delivered', 'closed', 'approved', 'in_review', 'answer_drafted', 'assigned'].includes(targetStatus)) {
          stageCounter += 1;
          push({ type: 'QuestionStaged', at: tick(30_000, 120_000), actor: SEED_ACTORS.approver!, subjectId: qid, payload: { stagePosition: stageCounter } });
          if (['delivered', 'closed', 'approved', 'in_review', 'answer_drafted', 'assigned'].includes(targetStatus)) {
            push({ type: 'QuestionDelivered', at: tick(30_000, 180_000), actor: SEED_ACTORS.podium!, subjectId: qid, payload: {} });
            if (targetStatus === 'closed' || targetStatus === 'in_review' || targetStatus === 'answer_drafted') {
              push({ type: 'QuestionClosed', at: tick(5_000, 20_000), actor: SEED_ACTORS.podium!, subjectId: qid, payload: {} });
            }
          }
        }
        continue;
      }

      const expert = expertByUnit[unitId] ?? SEED_ACTORS.expertFin!;
      push({ type: 'QuestionAssigned', at: tick(15_000, 90_000), actor: SEED_ACTORS.capture1!, subjectId: qid, payload: { unitId } });
      if (targetStatus === 'assigned') continue;

      const answerText = fill(pick(rnd, part.topic.answers), rnd, year);
      let version = 1;
      push({
        type: 'AnswerDrafted',
        at: tick(120_000, 900_000),
        actor: expert,
        subjectId: qid,
        payload: { answer: { version, text: answerText, createdAt: new Date(clock).toISOString(), createdBy: expert, sources: [track === 'fast_track' ? 'Geschäftsbericht ' + year : 'Q&A-Katalog ' + part.topic.id] } },
      });
      if (targetStatus === 'answer_drafted') continue;

      push({ type: 'QuestionSubmittedForReview', at: tick(30_000, 300_000), actor: expert, subjectId: qid, payload: { answerVersion: version } });
      // Some questions were returned once by legal and redrafted: shows the correction loop.
      if (chance(rnd, 0.12)) {
        push({ type: 'QuestionReturned', at: tick(60_000, 400_000), actor: SEED_ACTORS.legal!, subjectId: qid, payload: { reason: 'Bitte Zahl mit Geschäftsbericht abgleichen und Quelle nennen.', fromStatus: 'in_review', toStatus: 'answer_drafted' } });
        version = 2;
        push({
          type: 'AnswerDrafted',
          at: tick(120_000, 600_000),
          actor: expert,
          subjectId: qid,
          payload: { answer: { version, text: answerText + ' Quelle: Geschäftsbericht ' + year + ', Konzernanhang.', createdAt: new Date(clock).toISOString(), createdBy: expert, sources: ['Geschäftsbericht ' + year] } },
        });
        push({ type: 'QuestionSubmittedForReview', at: tick(30_000, 200_000), actor: expert, subjectId: qid, payload: { answerVersion: version } });
      }
      if (targetStatus === 'in_review') continue;

      push({ type: 'QuestionApproved', at: tick(60_000, 600_000), actor: SEED_ACTORS.legal!, subjectId: qid, payload: { answerVersion: version } });
      if (targetStatus === 'approved') continue;

      stageCounter += 1;
      push({ type: 'QuestionStaged', at: tick(30_000, 300_000), actor: SEED_ACTORS.approver!, subjectId: qid, payload: { stagePosition: stageCounter } });
      if (targetStatus === 'staged') continue;

      push({ type: 'QuestionDelivered', at: tick(60_000, 400_000), actor: SEED_ACTORS.podium!, subjectId: qid, payload: { answerVersion: version } });
      if (targetStatus === 'delivered') continue;

      push({ type: 'QuestionClosed', at: tick(5_000, 30_000), actor: SEED_ACTORS.podium!, subjectId: qid, payload: {} });
    }
  });

  // Events were generated per speaker with a monotonically increasing clock, but the clock is
  // capped at "now"; sort by time so the log reads chronologically, keeping causal order stable.
  events.sort((a, b) => a.at.localeCompare(b.at));
  return events;
}
