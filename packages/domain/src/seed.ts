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
  /** Question and the matching answer, paired so that the podium never reads a mismatched text. */
  qa: readonly (readonly [question: string, answer: string])[];
}

/** {Y} = fiscal year, {P} = percentage, {M} = millions, {N} = small integer, {B} = billions */
const TOPICS: readonly Topic[] = [
  {
    id: 'dividende', unitId: 'unit-fin', agenda: ['top-2'], stage: ['cfo', 'ceo'],
    qa: [
      ['Wie hoch war die Ausschüttungsquote im Geschäftsjahr {Y}, und welche Quote strebt der Vorstand mittelfristig an?',
       'Die Ausschüttungsquote lag im Geschäftsjahr {Y} bei {P} Prozent des bereinigten Konzernergebnisses. Mittelfristig streben wir eine Quote zwischen 40 und 60 Prozent an, wie im Geschäftsbericht auf Seite {N}2 dargestellt.'],
      ['Warum wird die Dividende trotz gestiegenem Free Cashflow nur um {N} Cent angehoben?',
       'Der Vorschlag zur Gewinnverwendung berücksichtigt neben dem Free Cashflow auch den Investitionsbedarf des laufenden Jahres in Höhe von rund {B} Milliarden Euro. Die Dividendenkontinuität hat für uns Vorrang vor einer einmalig höheren Ausschüttung.'],
      ['Plant die Gesellschaft, die Dividendenpolitik von einer Quote auf einen Mindestbetrag je Aktie umzustellen?',
       'Eine Umstellung auf einen Mindestbetrag je Aktie ist nicht geplant. Die Quotenpolitik verbindet die Ausschüttung mit der Ertragskraft; der Vorstand hält sie für die verlässlichere Grundlage und hat sie zuletzt im Kapitalmarkttag bestätigt.'],
      ['Welcher Anteil des Bilanzgewinns wird in die Gewinnrücklagen eingestellt, und wofür werden diese Mittel verwendet?',
       'Von dem Bilanzgewinn werden {M} Millionen Euro in die Gewinnrücklagen eingestellt. Die Mittel dienen der Finanzierung des Investitionsprogramms und der Stärkung der Eigenkapitalquote, die zum Stichtag {P} Prozent betrug.'],
      ['Wie verhält sich die Dividendenrendite zum Durchschnitt der Wettbewerber im DAX?',
       'Auf Basis des Jahresschlusskurses ergibt sich eine Dividendenrendite von {N},{N} Prozent. Sie liegt damit im oberen Drittel der Vergleichsgruppe; die Berechnung ist im Geschäftsbericht im Abschnitt Aktie dargestellt.'],
      ['Wurde geprüft, statt einer Dividendenerhöhung ein Aktienrückkaufprogramm aufzulegen, und mit welchem Ergebnis?',
       'Ein Aktienrückkauf wurde im Rahmen der Kapitalallokation geprüft. Der Vorstand hat sich für die Dividende entschieden, weil sie allen Aktionären gleichermaßen zugutekommt und die Bilanzstruktur nicht belastet.'],
    ],
  },
  {
    id: 'verguetung', unitId: 'unit-hr', agenda: ['top-6'], stage: ['supervisory_board_chair'],
    qa: [
      ['Wie hoch war die Zielerreichung der kurzfristigen variablen Vergütung des Vorstands im Geschäftsjahr {Y}, und welche Kennzahlen lagen ihr zugrunde?',
       'Die Zielerreichung der kurzfristigen variablen Vergütung lag im Geschäftsjahr {Y} bei {P} Prozent. Maßgeblich waren das bereinigte EBIT, der Free Cashflow und ein Nachhaltigkeitsfaktor. Die Einzelwerte sind im Vergütungsbericht, Abschnitt 3, tabellarisch dargestellt.'],
      ['Warum enthält der Vergütungsbericht keine Angaben zum Verhältnis der Vorstandsvergütung zur durchschnittlichen Mitarbeitervergütung in Deutschland?',
       'Der Vergütungsbericht enthält den vertikalen Vergleich in Abschnitt 5: Die Vergütung des Vorstandsvorsitzenden entspricht dem {N}0-fachen der durchschnittlichen Vergütung der Belegschaft in Deutschland. Der Aufsichtsrat berücksichtigt dieses Verhältnis bei jeder Anpassung.'],
      ['Welche Nachhaltigkeitsziele sind Teil der langfristigen variablen Vergütung, und mit welchem Gewicht?',
       'Die langfristige variable Vergütung enthält mit einem Gewicht von {N}0 Prozent Nachhaltigkeitsziele: die Reduktion der Scope-1- und Scope-2-Emissionen, die Unfallhäufigkeit und den Frauenanteil in Führungspositionen. Die Zielwerte sind im Vergütungssystem veröffentlicht.'],
      ['Hat der Aufsichtsrat im Berichtsjahr von der Möglichkeit Gebrauch gemacht, variable Vergütung zurückzufordern?',
       'Der Aufsichtsrat hat im Berichtsjahr keine Rückforderung variabler Vergütung veranlasst. Die Clawback-Regelung des Vergütungssystems wurde geprüft; ein Anwendungsfall lag nicht vor.'],
      ['Wie begründet der Aufsichtsrat die Erhöhung der Festvergütung des Vorstandsvorsitzenden um {P} Prozent?',
       'Die Anpassung der Festvergütung folgt dem vertikalen und horizontalen Vergleich, den der Aufsichtsrat mit externer Unterstützung durchgeführt hat. Die Vergütung liegt damit im Median der Vergleichsgruppe.'],
      ['Wurden Abfindungszahlungen an ausgeschiedene Vorstandsmitglieder geleistet, und in welcher Höhe?',
       'Im Berichtsjahr wurden Abfindungszahlungen in Höhe von {N},{N} Millionen Euro an ein ausgeschiedenes Vorstandsmitglied geleistet. Sie entsprechen der vertraglichen Regelung und der Obergrenze des Kodex von zwei Jahresvergütungen; Einzelheiten stehen im Vergütungsbericht.'],
    ],
  },
  {
    id: 'nachhaltigkeit', unitId: 'unit-esg', agenda: ['top-1', 'top-3'], stage: ['ceo', 'board_member'],
    qa: [
      ['Wie haben sich die Scope-1- und Scope-2-Emissionen im Geschäftsjahr {Y} gegenüber dem Basisjahr entwickelt?',
       'Die Scope-1- und Scope-2-Emissionen lagen im Geschäftsjahr {Y} um {P} Prozent unter dem Basisjahr. Die Entwicklung ist im Nachhaltigkeitsbericht auf Seite {N}8 nach Standorten aufgeschlüsselt.'],
      ['Welcher Anteil der Investitionen des Berichtsjahres war nach der EU-Taxonomie als ökologisch nachhaltig einzustufen?',
       'Rund {P} Prozent der Investitionen des Berichtsjahres waren taxonomiekonform. Der Anteil steigt mit dem Investitionsprogramm in erneuerbare Eigenversorgung an den europäischen Standorten.'],
      ['Bis wann will die Gesellschaft Klimaneutralität in Scope 3 erreichen, und welche Zwischenziele gelten?',
       'Für Scope 3 gilt das Ziel der Klimaneutralität bis 2045 mit einem Zwischenziel von minus {P} Prozent bis 2030 gegenüber dem Basisjahr. Der Pfad ist im Nachhaltigkeitsbericht im Abschnitt Klimastrategie beschrieben.'],
      ['Wie viele Lieferanten wurden im Berichtsjahr nach dem Lieferkettensorgfaltspflichtengesetz geprüft, und wie viele Verstöße wurden festgestellt?',
       'Im Berichtsjahr wurden {N}20 Lieferanten mit erhöhtem Risikoprofil geprüft. In {N} Fällen wurden Abhilfemaßnahmen vereinbart; eine Beendigung der Geschäftsbeziehung war nicht erforderlich.'],
      ['Warum hat sich die Gesellschaft nicht der Science Based Targets Initiative angeschlossen?',
       'Die Gesellschaft hat ihre Klimaziele im Berichtsjahr bei der Science Based Targets Initiative zur Validierung eingereicht; das Verfahren läuft. Über das Ergebnis wird im nächsten Nachhaltigkeitsbericht informiert.'],
      ['Welche Kosten sind im Geschäftsjahr {Y} für den Erwerb von CO2-Zertifikaten angefallen?',
       'Für den Erwerb von Emissionszertifikaten sind im Geschäftsjahr {Y} Aufwendungen von {M} Millionen Euro entstanden. Sie sind im Konzernanhang unter den sonstigen betrieblichen Aufwendungen ausgewiesen.'],
      ['Wie hoch ist der Frauenanteil in den beiden Führungsebenen unterhalb des Vorstands, und welche Zielgrößen gelten?',
       'Der Frauenanteil betrug zum Stichtag {P} Prozent in der ersten und {P} Prozent in der zweiten Führungsebene. Die Zielgrößen von 30 beziehungsweise 35 Prozent bis Ende {Y}+2 sind in der Erklärung zur Unternehmensführung veröffentlicht.'],
    ],
  },
  {
    id: 'strategie', unitId: 'unit-strat', agenda: ['top-1', 'top-3'], stage: ['ceo'],
    qa: [
      ['Welche Umsatz- und Margenziele verfolgt der Vorstand bis zum Geschäftsjahr {Y}+3, und wie realistisch sind sie angesichts der Marktentwicklung?',
       'Der Vorstand hält an der Mittelfristplanung fest: Umsatzwachstum von durchschnittlich {N} Prozent pro Jahr und eine bereinigte EBIT-Marge von {P} Prozent. Die Annahmen sind im Geschäftsbericht im Prognosebericht erläutert.'],
      ['Welche Rolle spielen Zukäufe in der Strategie, und welche Mittel sind dafür vorgesehen?',
       'Zukäufe ergänzen das organische Wachstum in den Bereichen Software und Service. Der Kapitalallokationsrahmen sieht dafür bis zu {B} Milliarden Euro über drei Jahre vor; über einzelne Vorhaben informieren wir, sobald sie beschlossen sind.'],
      ['Wie beurteilt der Vorstand die Abhängigkeit vom chinesischen Markt, und welche Gegenmaßnahmen wurden eingeleitet?',
       'Der Umsatzanteil des chinesischen Marktes lag im Berichtsjahr bei {P} Prozent. Wir reduzieren Abhängigkeiten durch den Ausbau der Kapazitäten in Südostasien und Nordamerika; die Investitionen dafür sind im Kapitalallokationsrahmen enthalten.'],
      ['Warum hält die Gesellschaft an dem verlustbringenden Geschäftsbereich fest, statt ihn zu veräußern?',
       'Der Geschäftsbereich wird derzeit restrukturiert; die Maßnahmen sollen ihn bis Ende {Y}+1 in die Gewinnzone führen. Alle Optionen einschließlich einer Veräußerung werden regelmäßig geprüft; über eine Entscheidung würden wir den Kapitalmarkt unverzüglich informieren.'],
      ['Welche Auswirkungen hatten die US-Zölle auf das Ergebnis des Geschäftsjahres {Y}?',
       'Die US-Zölle belasteten das Ergebnis des Geschäftsjahres {Y} mit rund {M} Millionen Euro. Ein Teil wurde durch Preisanpassungen und lokale Fertigung kompensiert.'],
      ['Welche Investitionen sind in künstliche Intelligenz geplant, und welche Einsparungen erwartet der Vorstand daraus?',
       'Für Anwendungen künstlicher Intelligenz sind über drei Jahre Investitionen von rund {M} Millionen Euro vorgesehen. Wir erwarten daraus Einsparungen im mittleren zweistelligen Millionenbereich pro Jahr, vor allem in Einkauf, Fertigungsplanung und Verwaltung.'],
      ['Wie hoch war der Anteil des Umsatzes mit neuen Produkten, die in den letzten drei Jahren eingeführt wurden?',
       'Der Umsatzanteil von Produkten, die in den letzten drei Jahren eingeführt wurden, lag im Geschäftsjahr {Y} bei {P} Prozent. Die Kennzahl ist im Lagebericht im Abschnitt Forschung und Entwicklung ausgewiesen.'],
    ],
  },
  {
    id: 'kapital', unitId: 'unit-fin', agenda: ['top-8', 'top-1'], stage: ['cfo'],
    qa: [
      ['Wofür sollen die zurückgekauften Aktien verwendet werden, und schließt der Vorstand eine Verwendung als Akquisitionswährung aus?',
       'Die Ermächtigung sieht die Einziehung, die Verwendung für Mitarbeiterbeteiligungsprogramme und die Nutzung als Gegenleistung bei Unternehmenszusammenschlüssen vor. Eine Verwendung als Akquisitionswährung ist damit nicht ausgeschlossen; ein konkretes Vorhaben besteht nicht.'],
      ['Wie hoch ist die Nettoverschuldung im Verhältnis zum EBITDA, und welchen Zielkorridor verfolgt die Gesellschaft?',
       'Die Nettoverschuldung betrug zum Bilanzstichtag das {N},{N}-fache des EBITDA. Unser Zielkorridor liegt zwischen dem 1,0- und 2,0-fachen; die Finanzierungsstruktur ist im Konzernanhang, Abschnitt Finanzverbindlichkeiten, dargestellt.'],
      ['Welche Fälligkeiten stehen im kommenden Geschäftsjahr an, und zu welchen Konditionen wurde zuletzt refinanziert?',
       'Im kommenden Geschäftsjahr werden Anleihen über {M} Millionen Euro fällig. Die letzte Refinanzierung erfolgte über eine Anleihe mit einem Kupon von {N},{N} Prozent und siebenjähriger Laufzeit; die Konditionen sind im Konzernanhang aufgeführt.'],
      ['Warum wurde die Ermächtigung zum Erwerb eigener Aktien auf zehn Prozent des Grundkapitals festgelegt?',
       'Die Ermächtigung entspricht dem gesetzlichen Rahmen des § 71 Abs. 1 Nr. 8 AktG. Über eine Ausnutzung entscheidet der Vorstand mit Zustimmung des Aufsichtsrats; ein konkreter Beschluss liegt nicht vor.'],
      ['Wie hoch waren die Zinsaufwendungen im Geschäftsjahr {Y}, und wie wirkt sich das Zinsniveau auf die Planung aus?',
       'Die Zinsaufwendungen lagen im Geschäftsjahr {Y} bei {M} Millionen Euro. Rund {P} Prozent der Finanzverbindlichkeiten sind festverzinslich, sodass die Planung gegenüber Zinsänderungen weitgehend unempfindlich ist.'],
      ['Welche Ratingveränderungen gab es im Berichtsjahr, und wie bewertet der Vorstand das Risiko einer Herabstufung?',
       'Beide Ratingagenturen haben das Rating im Berichtsjahr mit stabilem Ausblick bestätigt. Der Vorstand sieht auf Basis der Verschuldungskennzahlen kein erhöhtes Risiko einer Herabstufung; die Ratingerhaltung ist Teil der Finanzstrategie.'],
    ],
  },
  {
    id: 'aufsichtsrat', unitId: 'unit-legal', agenda: ['top-4', 'top-7'], stage: ['supervisory_board_chair'],
    qa: [
      ['Wie viele Sitzungen hat der Prüfungsausschuss im Geschäftsjahr {Y} abgehalten, und wie hoch war die Teilnahmequote?',
       'Der Prüfungsausschuss hat im Geschäftsjahr {Y} {N} Sitzungen abgehalten; die Teilnahmequote lag bei {P} Prozent. Die Einzelteilnahme ist im Bericht des Aufsichtsrats tabellarisch dargestellt.'],
      ['Welche Qualifikationen bringt die zur Wahl vorgeschlagene Kandidatin für den Aufsichtsrat mit, und bestehen Interessenkonflikte?',
       'Die vorgeschlagene Kandidatin verfügt über langjährige Erfahrung in der Finanzierung industrieller Unternehmen. Der Aufsichtsrat hat sich vergewissert, dass keine Interessenkonflikte im Sinne des Kodex bestehen.'],
      ['Warum überschreitet ein Aufsichtsratsmitglied die vom Kodex empfohlene Zahl an Mandaten?',
       'Das betreffende Mitglied hält einschließlich des Vorsitzes vier Mandate, was nach der Zählweise des Kodex der Empfehlung entspricht. Die Erklärung zur Unternehmensführung legt die Mandate und die Zählung offen.'],
      ['Wie hat der Aufsichtsrat die Effizienz seiner Tätigkeit im Berichtsjahr überprüft?',
       'Die Selbstbeurteilung des Aufsichtsrats erfolgte im Berichtsjahr mit externer Unterstützung. Ergebnisse und abgeleitete Maßnahmen sind in der Erklärung zur Unternehmensführung zusammengefasst.'],
      ['Welche Beraterverträge bestehen mit Aufsichtsratsmitgliedern oder ihnen nahestehenden Unternehmen?',
       'Im Berichtsjahr bestanden keine Beraterverträge mit Aufsichtsratsmitgliedern oder ihnen nahestehenden Unternehmen. Zustimmungspflichtige Verträge nach § 114 AktG hat der Aufsichtsrat nicht behandelt.'],
      ['Wie begründet der Aufsichtsrat die Wiederbestellung des Abschlussprüfers trotz der langen Mandatsdauer?',
       'Die Mandatsdauer liegt mit {N} Jahren innerhalb der gesetzlichen Höchstdauer. Der Prüfungsausschuss hat Unabhängigkeit und Qualität der Prüfung bewertet und empfiehlt die Wiederbestellung; die nächste Ausschreibung ist für das Geschäftsjahr {Y}+2 vorgesehen.'],
    ],
  },
  {
    id: 'risiko', unitId: 'unit-legal', agenda: ['top-1', 'top-3'], stage: ['ceo', 'cfo'],
    qa: [
      ['Welche Rückstellungen wurden für laufende Rechtsstreitigkeiten gebildet, und welches ist das größte Einzelrisiko?',
       'Für Rechtsstreitigkeiten sind zum Bilanzstichtag Rückstellungen in Höhe von {M} Millionen Euro gebildet. Das größte Einzelverfahren ist im Konzernanhang unter den Eventualverbindlichkeiten beschrieben; weitergehende Angaben würden die Verteidigungsposition der Gesellschaft beeinträchtigen.'],
      ['Gab es im Berichtsjahr Cyberangriffe mit Auswirkungen auf den Geschäftsbetrieb, und welche Kosten sind entstanden?',
       'Im Berichtsjahr wurden {N} sicherheitsrelevante Vorfälle registriert. Keiner davon hatte Auswirkungen auf den Geschäftsbetrieb oder auf personenbezogene Daten; die Kosten der Abwehr sind im IT-Budget enthalten.'],
      ['Wie hoch war der Aufwand für Compliance-Untersuchungen, und wurden Behörden eingeschaltet?',
       'Der Aufwand für interne Untersuchungen lag im Berichtsjahr bei {N},{N} Millionen Euro. In einem Fall wurde die zuständige Behörde von der Gesellschaft selbst informiert; das Verfahren ist im Konzernanhang beschrieben.'],
      ['Welche Auswirkungen hätte ein Ausfall des größten Zulieferers auf die Produktion, und wie ist das abgesichert?',
       'Der größte Zulieferer steht für rund {N} Prozent des Einkaufsvolumens. Für die kritischen Komponenten bestehen Zweitquellen und ein Sicherheitsbestand von {N} Wochen; das Szenario ist Teil der jährlichen Notfallplanung.'],
      ['Wurden im Geschäftsjahr {Y} Bußgelder gegen die Gesellschaft verhängt, und in welcher Höhe?',
       'Im Geschäftsjahr {Y} wurden gegen Konzerngesellschaften Bußgelder in Höhe von insgesamt {N}00.000 Euro verhängt, überwiegend wegen Verstößen gegen Melde- und Formvorschriften. Kartell- oder Korruptionsverfahren gab es nicht.'],
      ['Welche Sanktionsrisiken bestehen aus Geschäftsbeziehungen in Russland, und sind alle Aktivitäten beendet?',
       'Die Geschäftsaktivitäten in Russland wurden im Jahr 2023 beendet. Verbleibende Verpflichtungen betreffen die Abwicklung von Gewährleistungen; ein Sanktionsverstoß liegt nach unserer Prüfung nicht vor.'],
    ],
  },
  {
    id: 'personal', unitId: 'unit-hr', agenda: ['top-3'], stage: ['board_member', 'ceo'],
    qa: [
      ['Wie viele Stellen wurden im Geschäftsjahr {Y} in Deutschland abgebaut, und wie viele im Ausland aufgebaut?',
       'Die Zahl der Beschäftigten in Deutschland lag zum Jahresende bei {N}2.{N}00 und damit um {N} Prozent unter dem Vorjahr; der Abbau erfolgte ausschließlich über natürliche Fluktuation und freiwillige Programme. Im Ausland wurden {N}00 Stellen aufgebaut, vor allem in der Fertigung in Nordamerika.'],
      ['Wie hoch ist die Fluktuationsrate, und welche Maßnahmen ergreift der Vorstand zur Mitarbeiterbindung?',
       'Die Fluktuationsrate betrug {N},{N} Prozent. Zur Bindung setzen wir auf Qualifizierung, flexible Arbeitsmodelle und die Beteiligung der Beschäftigten am Unternehmenserfolg.'],
      ['Welche Vereinbarungen bestehen mit den Arbeitnehmervertretungen zur Standortsicherung, und bis wann gelten sie?',
       'Die Standortsicherungsvereinbarung gilt bis Ende {Y}+2 und schließt betriebsbedingte Kündigungen an den deutschen Standorten aus.'],
      ['Wie viele Auszubildende wurden eingestellt, und wie hoch ist die Übernahmequote?',
       'Im Berichtsjahr wurden {N}00 Auszubildende und dual Studierende eingestellt. Die Übernahmequote nach erfolgreichem Abschluss lag bei {P} Prozent.'],
      ['Wie hat sich der Krankenstand im Berichtsjahr entwickelt?',
       'Die Gesundheitsquote lag im Berichtsjahr bei {P} Prozent und damit auf dem Niveau des Vorjahres. Die Kennzahl und die Maßnahmen des betrieblichen Gesundheitsmanagements sind im Personalbericht dargestellt.'],
      ['Welche Folgen hat der Einsatz künstlicher Intelligenz für die Beschäftigung in der Verwaltung?',
       'Der Einsatz künstlicher Intelligenz verändert Tätigkeiten in der Verwaltung, führt aber nicht zu betriebsbedingten Kündigungen; das schließt die Standortsicherungsvereinbarung aus. Freiwerdende Kapazitäten werden über Qualifizierung und natürliche Fluktuation gesteuert.'],
    ],
  },
  {
    id: 'operations', unitId: 'unit-ops', agenda: ['top-1'], stage: ['board_member'],
    qa: [
      ['Wie hoch war die Auslastung der Produktionsstandorte im Geschäftsjahr {Y}, und welche Standorte stehen zur Disposition?',
       'Die Auslastung der Produktionsstandorte lag im Geschäftsjahr {Y} bei durchschnittlich {P} Prozent. Über Standortentscheidungen wird im Rahmen der Netzwerkplanung entschieden; ein Beschluss zur Schließung liegt nicht vor.'],
      ['Welche Fortschritte gibt es beim Bau des neuen Werks, und liegt das Projekt im Budget?',
       'Das neue Werk liegt im Zeit- und Budgetplan. Die Inbetriebnahme ist für das dritte Quartal {Y}+1 vorgesehen; die Gesamtinvestition beträgt rund {M} Millionen Euro.'],
      ['Welche Lieferengpässe haben das Berichtsjahr belastet, und wie wurden sie gelöst?',
       'Engpässe betrafen im ersten Halbjahr elektronische Bauteile und Spezialstähle. Sie wurden durch Zweitquellen, Vorratsaufbau und Konstruktionsänderungen gelöst; die Lieferfähigkeit lag im zweiten Halbjahr wieder bei {P} Prozent.'],
      ['Wie hoch waren die Qualitätskosten, und welche Rückrufe gab es?',
       'Die Qualitätskosten lagen bei {N},{N} Prozent des Umsatzes. Im Berichtsjahr gab es {N} freiwillige Rückrufaktionen ohne Sicherheitsrelevanz.'],
      ['Welche Investitionen fließen in die Digitalisierung der Fertigung, und welche Produktivitätsgewinne wurden bislang realisiert?',
       'In die Digitalisierung der Fertigung fließen im laufenden Programm {M} Millionen Euro. An den bereits umgestellten Standorten stieg die Produktivität je Stunde um {N} Prozent; die Kennzahl wird je Standort verfolgt.'],
    ],
  },
  {
    id: 'ir', unitId: 'unit-ir', agenda: ['top-1', 'top-2'], stage: ['cfo', 'ceo'],
    qa: [
      ['Warum hat sich der Aktienkurs im Geschäftsjahr {Y} deutlich schlechter entwickelt als der DAX?',
       'Die Kursentwicklung spiegelt vor allem die Unsicherheit über die Nachfrageentwicklung in unseren Kernmärkten wider. Der Vorstand konzentriert sich auf die Umsetzung der Mittelfristziele; die Bewertung durch den Kapitalmarkt folgt der operativen Entwicklung.'],
      ['Welche Maßnahmen ergreift der Vorstand, um die Bewertungslücke zu den Wettbewerbern zu schließen?',
       'Der Vorstand adressiert die Bewertung über drei Hebel: Margenverbesserung im Kerngeschäft, Portfoliobereinigung und eine verlässliche Ausschüttung. Der Fortschritt wird quartalsweise am Kapitalmarkt berichtet.'],
      ['Wie hoch ist der Anteil der Aktien im Besitz von Vorstand und Aufsichtsrat?',
       'Vorstand und Aufsichtsrat hielten zum Stichtag zusammen {N},{N} Prozent des Grundkapitals. Die Einzelangaben sind im Vergütungsbericht enthalten.'],
      ['Warum wurde die Prognose im dritten Quartal gesenkt, obwohl der Vorstand kurz zuvor die Ziele bestätigt hatte?',
       'Die Anpassung der Prognose im dritten Quartal beruhte auf der kurzfristigen Nachfrageabschwächung in Nordamerika, die sich erst nach der Bestätigung der Ziele abzeichnete. Der Vorstand hat den Kapitalmarkt am Tag der Erkenntnis informiert.'],
      ['Welche Aktionärsstruktur hat die Gesellschaft zum Stichtag, und wie hoch ist der Anteil aktivistischer Investoren?',
       'Zum Stichtag hielten institutionelle Investoren {P} Prozent, Privataktionäre {P} Prozent des Grundkapitals; der Streubesitz lag bei {P} Prozent. Meldepflichtige Beteiligungen aktivistischer Investoren bestanden nicht.'],
      ['Wird die Hauptversammlung im kommenden Jahr wieder in Präsenz stattfinden?',
       'Über das Format der nächsten Hauptversammlung entscheidet der Vorstand mit Zustimmung des Aufsichtsrats im Herbst. Die Erfahrungen der heutigen Versammlung und die Rückmeldungen der Aktionäre fließen in die Entscheidung ein.'],
    ],
  },
  {
    id: 'digital', unitId: 'unit-ops', agenda: ['top-1', 'top-3'], stage: ['board_member', 'ceo'],
    qa: [
      ['Wie hoch waren die IT-Ausgaben im Geschäftsjahr {Y}, und welcher Anteil entfiel auf Cloud-Dienste außereuropäischer Anbieter?',
       'Die IT-Ausgaben lagen im Geschäftsjahr {Y} bei {M} Millionen Euro. Rund {P} Prozent entfielen auf Cloud-Dienste; für personenbezogene Daten nutzen wir ausschließlich Rechenzentren in der Europäischen Union.'],
      ['Welche Ergebnisse hat das KI-Programm bislang erbracht, und wie wird der Nutzen gemessen?',
       'Das KI-Programm umfasst {N}0 Anwendungsfälle in Produktion, Einkauf und Verwaltung. Der Nutzen wird je Anwendungsfall über Zeit- und Kosteneinsparungen gemessen und vierteljährlich berichtet.'],
      ['Wie stellt die Gesellschaft sicher, dass beim Einsatz von KI keine Verstöße gegen den Datenschutz erfolgen?',
       'Jeder KI-Anwendungsfall durchläuft vor dem Einsatz eine Datenschutz-Folgenabschätzung und die Abstimmung mit dem Betriebsrat. Personenbezogene Daten werden nur pseudonymisiert und in europäischen Rechenzentren verarbeitet.'],
      ['Welche Systeme sind noch nicht auf die neue ERP-Plattform migriert, und welche Kosten entstehen durch den Parallelbetrieb?',
       'Noch nicht migriert sind die Vertriebsgesellschaften in Südamerika und Asien; ihre Umstellung ist für {Y}+1 geplant. Der Parallelbetrieb verursacht Mehrkosten von rund {N} Millionen Euro pro Jahr, die im Projektbudget enthalten sind.'],
      ['Wie viele Datenschutzvorfälle wurden im Berichtsjahr an die Aufsichtsbehörden gemeldet?',
       'Im Berichtsjahr wurden {N} meldepflichtige Datenschutzvorfälle an die zuständigen Behörden gemeldet. Keiner davon führte zu einem Bußgeld.'],
    ],
  },
  {
    id: 'pruefer', unitId: 'unit-fin', agenda: ['top-5'], stage: ['supervisory_board_chair', 'cfo'],
    qa: [
      ['Wie hoch war das Honorar des Abschlussprüfers im Geschäftsjahr {Y}, und welcher Anteil entfiel auf Nichtprüfungsleistungen?',
       'Das Honorar des Abschlussprüfers betrug im Geschäftsjahr {Y} {N},{N} Millionen Euro; der Anteil der Nichtprüfungsleistungen lag bei {P} Prozent und damit innerhalb der gesetzlichen Grenze.'],
      ['Welche besonders wichtigen Prüfungssachverhalte hat der Abschlussprüfer im Bestätigungsvermerk benannt?',
       'Der Bestätigungsvermerk benennt als besonders wichtige Prüfungssachverhalte die Werthaltigkeit der Geschäfts- oder Firmenwerte und die Bewertung der Rückstellungen für Rechtsstreitigkeiten. Beide sind im Geschäftsbericht abgedruckt.'],
      ['Wann ist der nächste Wechsel des Abschlussprüfers vorgesehen?',
       'Die gesetzliche Höchstlaufzeit des Prüfungsmandats endet mit dem Geschäftsjahr {Y}+3. Der Prüfungsausschuss wird das Auswahlverfahren im Geschäftsjahr {Y}+2 durchführen und der Hauptversammlung einen Vorschlag unterbreiten.'],
      ['Hat der Abschlussprüfer Schwächen im internen Kontrollsystem festgestellt, und welche Maßnahmen wurden ergriffen?',
       'Der Abschlussprüfer hat keine wesentlichen Schwächen des internen Kontrollsystems festgestellt. Hinweise zur Weiterentwicklung wurden mit dem Prüfungsausschuss erörtert und in das Maßnahmenprogramm aufgenommen.'],
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
    // The podium queue is deliberately short (a handful): the podium reads in order, so a freshly
    // staged question must be reachable within a few "weiter" presses. The backlog before the stage
    // (approved, in review, drafting) is where the afternoon pressure sits.
    if (round === 1) return r < 0.55 ? 'closed' : r < 0.78 ? 'delivered' : r < 0.79 ? 'staged' : r < 0.93 ? 'approved' : 'in_review';
    if (round === 2) return r < 0.25 ? 'closed' : r < 0.45 ? 'delivered' : r < 0.462 ? 'staged' : r < 0.68 ? 'approved' : r < 0.8 ? 'in_review' : r < 0.92 ? 'answer_drafted' : 'assigned';
    return r < 0.05 ? 'delivered' : r < 0.07 ? 'staged' : r < 0.22 ? 'approved' : r < 0.42 ? 'in_review' : r < 0.6 ? 'answer_drafted' : r < 0.75 ? 'assigned' : r < 0.9 ? 'classified' : 'captured';
  };

  const speechOf = (count: number): { text: string; parts: { text: string; start: number; end: number; topic: Topic; answer: string }[] } => {
    const opening = pick(rnd, OPENINGS);
    let text = opening + ' ';
    const parts: { text: string; start: number; end: number; topic: Topic; answer: string }[] = [];
    const usedTopics = new Set<string>();
    for (let i = 0; i < count; i++) {
      let topic = pick(rnd, TOPICS);
      if (usedTopics.has(topic.id) && chance(rnd, 0.7)) topic = pick(rnd, TOPICS);
      usedTopics.add(topic.id);
      const pair = pick(rnd, topic.qa);
      const qText = fill(pair[0], rnd, year);
      const connective = i === 0 ? CONNECTIVES[0]! : pick(rnd, CONNECTIVES.slice(1));
      text += connective + ' ';
      const start = text.length;
      text += qText;
      parts.push({ text: qText, start, end: text.length, topic, answer: pair[1] });
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

      const answerText = fill(part.answer, rnd, year);
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
