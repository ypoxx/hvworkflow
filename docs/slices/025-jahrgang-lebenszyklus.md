# Scheibe 025 — Jahrgang, Lebenszyklus und Tagesordnung

**Status:** im Bau · **Lanes:** core, service
**Risikoklasse:** hoch
**Grundlage:** AGENTS.md R1–R8, R11–R12; ADR 0011; Vertrag 0.3.3 aus takt-019; `docs/produktplan-beta.md` Abschnitt 5, 025; R-MTG-01..06.

**Sicherheitsbezug (Bedrohungsmodell Abschnitt 6):** T-G1-E-01 (neues `agenda.manage`: nur ausdrücklicher Grant an `admin`, alle anderen Rollen 403; `meeting025.test.ts`), T-G1-I-04 (F-Nummern/Zähler je Jahrgang; `meeting025.test.ts`), T-G1-I-09 (Jahrgangsgrenze als Grundlage für 035, noch kein SSE-Filter; Kollisions-/Fremd-ID-Tests), T-G1-T-02 und T-G2-T-01 (benannte Payloads, globale Ereigniskette; `meeting025.test.ts` und vorhandene Umschlagtests), T-G1-D-01 (neuer Erfassungspfad berührt die bisher unbegrenzten Bodys; vollständiges Limit-/Rate-/Timeout-Tor ist Scheibe 034 und bleibt offen). Keine dieser IDs wird durch 025 allein vollständig geschlossen.

**Missbrauchsfall MF-04 (Ereignis manipuliert):** Ein veränderter oder hinzugefügter Jahrgangs-/Agenda-Eintrag verändert den sichtbaren Stand. `verifyEventChain` erkennt eine gebrochene globale Hashkette beim Laden; die Wiederherstellung wird gestoppt. Signal ist der Integritätsfehler ohne Frageinhalt oder Kennzahl je Person, Empfänger ist der technische Betrieb; die Alarmweiterleitung folgt in 085. Nachweis: `envelope.test.ts` für Kette und `meeting025.test.ts` für abgewiesene Agenda-Ereignisse. Ein formal gültig, aber unberechtigt geschriebenes Ereignis ist damit nicht erkannt; die Autorisierung neuer HTTP-Schreibwege bleibt zusätzlich über `can()` geprüft.

**Rechteentscheidung vor Bau (SC-02):** Die Wahrheitstabelle erhält eine eigene Spalte `agenda.manage`. Nur `admin` bekommt in Scheibe 025 einen ausdrücklichen Grant, damit die drei kanonischen Agenda-Aktionen bedienbar sind; alle übrigen Rollen sind `deny`. Das ist eine vorläufige Demo-Rollenentscheidung bis 026/040 und kein Freibrief für `admin.override`. Positive und negative Rollenmatrix stehen in `meeting025.test.ts`; der generierte Diff in `policy-truth-table.md` ist Review-Gegenstand.

## Ziel

1. Zwei Jahrgänge bestehen im selben globalen, lückenlos nummerierten Ereignislog. Jedes neu geschriebene Ereignis trägt explizit die richtige `meetingId`; Rekonstruktion, Zähler, Fragennummern F-n, Listen und Schreiboperationen sind auf den angefragten Jahrgang begrenzt. Ein Fremd-ID-Verweis liefert 404 und verändert den anderen Jahrgang nicht. Der Demo-Alias ohne Jahrgang folgt gemäß Vertrag 0.3.3 dem laufenden Jahrgang mit jüngstem Datum; ohne laufenden dem jüngsten Datum, bei Gleichstand der letzten Anlage.
2. `MeetingCreated` projiziert `preparation`, `MeetingStarted` `running`, `MeetingClosed` `closed`; `DebateClosed` setzt nur `debateClosedAt`. Diese vier Ereignisse werden mit synthetischen v2-Fixtures gegen dieselbe Projektion und die R-MTG-Tabelle geprüft. 025 führt keine öffentliche Start-, Debattenschluss- oder Jahrgangsschluss-Operation ein. Die Demo-Seeddaten tragen ein `MeetingStarted`, damit der bisherige Ablauf in `running` bleibt.
3. `AgendaItemOpened`, `VotingOpened`, `VotingClosed` folgen einer expliziten Tabelle mit R-MTG-IDs. Nur `agenda.manage` darf die drei vorhandenen kanonischen Operationen ausführen. Jede Antwort enthält den fortgeschriebenen Tagesordnungspunkt; `Meeting.version` ist der ETag der kanonischen Jahrgangsleseroute und der Agenda-Schreibpfade. `If-Match` bleibt nach dem Vertrag bis 028 optional; ein mitgesendeter falscher Wert wird als 412 abgelehnt.
4. R-MTG-03: Nach `DebateClosed` wird eine neue Erfassung über Alias und kanonische Route als 409 verweigert. Nur `paper`/`transcript` mit zugehörigem `occurredAtSource`, `occurredAt <= debateClosedAt` und nicht leerem `lateEntryReason` sind zulässig; `occurredAt` in der Zukunft ist 422. Das Ereignis hält `lateEntry: true` und den Grund fest; die Projektion zeigt `Contribution.lateEntry`. `recordedAt` bleibt die Serverzeit. Der HTTP-Test injiziert `DebateClosed` als synthetisches v2-Ereignis in denselben Store und ruft danach die echte Route auf.
5. Die 14 Vertragsoperationen aus der 025-Allowlist werden im Dienst gemountet, gegen den Vertrag validiert und aus `allowlist.json` entfernt. Die Web-Oberfläche wird in dieser Scheibe nicht umgebaut.

## R-MTG-Tabelle

| ID | Ereignis / Aktion | Voraussetzung | Ergebnis |
|---|---|---|---|
| R-MTG-01 | `MeetingCreated` | ID existiert noch nicht | `preparation`, Version 1 |
| R-MTG-02 | `MeetingStarted`, `MeetingClosed` | Start nur aus `preparation`, Schluss nur aus `running`; `DebateClosed` schließt den Jahrgang nicht | `running` bzw. `closed`, Version steigt |
| R-MTG-03 | `ContributionCaptured` nach Debattenschluss | Nur Papier/Transkript mit Absenderzeit bis Debattenschluss und Pflichtgrund | `lateEntry: true`; sonst 409, ungültige Zeit 422 |
| R-MTG-04 | `AgendaItemOpened` | Jahrgang `running`, Punkt vorhanden und noch nicht geöffnet | `openedAt` aus Serverzeit, Version steigt |
| R-MTG-05 | `VotingOpened` | Punkt geöffnet, Abstimmung noch nicht geöffnet | `votingOpenedAt` aus Serverzeit, Version steigt |
| R-MTG-06 | `VotingClosed` | Abstimmung geöffnet, noch nicht geschlossen | `votingClosedAt` aus Serverzeit, Version steigt |

## Nicht-Ziele

Kein `createMeeting`/Klonen oder Stammdatenersatz (040), keine öffentliche Start- oder Schlussaktion (040 bzw. eigener späterer Vertrag), keine Debattenschluss-Operation oder Restantenbestätigung (087), keine Rollenereignisse (026), keine persistierte Mehrschreiber-Idempotenz (028), keine neue Oberflächenstrecke für die kanonischen Routen, kein Deploy. Die bestehenden Ansichten erhalten nur Bezeichnungen für neue Ereignisse und die Papierquelle. Der interne Betabereich bekommt die Mehrjahrgangsgrundlage, aber 025 allein ist noch keine betriebsfähige Beta.

## Files allowed

- `docs/slices/025-jahrgang-lebenszyklus.md`
- `packages/domain/src/events.ts`
- `packages/domain/src/types.ts`
- `packages/domain/src/state.ts`
- `packages/domain/src/api.ts`
- `packages/domain/src/store.ts`
- `packages/domain/src/envelope.ts`
- `packages/domain/src/seed.ts`
- `packages/domain/src/transitions.ts`
- `packages/domain/src/rules.ts` (nur R-MTG-01..06 mit ehrlicher Fundstelle, ungeprüft)
- `packages/domain/src/permissions.ts`
- `packages/domain/src/index.ts`
- `packages/domain/src/__tests__/meeting025.test.ts`
- `packages/domain/src/__tests__/transitions.test.ts` (synthetischer Jahrgang für Sprecher-Fixtures und generierte Role-×-Agenda-Tabelle)
- `packages/domain/policy-truth-table.md` (nur generierter Role-×-Agenda-Diff)
- `packages/domain/src/__tests__/api.test.ts` (nur alte Einjahrgangserwartungen)
- `packages/domain/src/__tests__/seed.test.ts` (nur alte Einjahrgangserwartungen)
- `packages/domain/src/__tests__/seed-fictitious-names.test.ts` (nur Abzug des neuen Lebenszyklus-Ereignisses und der expliziten `meetingId` vom historischen RNG-Fingerabdruck)
- `packages/domain/src/__tests__/envelope.test.ts` (nur Ereignistyp-/Jahrgangs-Fixtures)
- `packages/domain/src/__tests__/rules.test.ts` (nur falls der Register-Snapshot angepasst werden muss)
- `apps/api/src/app.ts`
- `apps/api/src/__tests__/meeting025.test.ts`
- `apps/api/src/__tests__/contract.test.ts` (nur kanonische Operationen und Altalias-Abgleich)
- `apps/api/src/__tests__/helpers.ts` (nur Operation-Coverage der 025-Routen)
- `apps/web/src/components/SourceIcon.tsx` (nur Papierquelle der kanonischen Erfassung anzeigen)
- `apps/web/src/i18n/labels.ts` (nur neue R-MTG-Ereignisse und `agenda.manage`)
- `apps/web/src/i18n/shell.de.ts` (nur die dazugehörigen deutschen Bezeichnungen)
- `apps/web/src/i18n/shell.en.ts` (nur die dazugehörigen englischen Bezeichnungen)
- `apps/web/src/i18n/parity.test.ts` (nur die Anzahl beider Wörterbücher nach acht neuen Schlüsseln)
- `packages/contract/allowlist.json` (nur Einträge mit `slice: "025"`)
- `docs/rollen-und-rechtekonzept.md` (nur `agenda.manage`-Gewährung)
- `docs/legal-trace.md` (nur generierte R-MTG-01..06-Zeilen)
- `docs/evidence/025-capture.jpg` (Browser-Nachweis der bestehenden Erfassungsansicht mit Quellenanzeige)

## Tests zuerst und Abnahme

1. Neue fokussierte Tests werden vor der Implementierung rot ausgeführt: zwei Jahrgänge, globale `seq`, getrennte F-Nummern/Listen und 404 bei Fremd-ID; synthetischer v2-Lebenszyklus und Debattenschluss; R-MTG-03 mit spätem Papier/Transkript; R-MTG-04..06 und fehlendes `agenda.manage`; alle 14 kanonischen HTTP-Operationen einschließlich ETag und Vertragsschema.
2. Nach Implementierung sind die fokussierten Tests und `pnpm gates` auf sauberem Commit grün. Browser verfügbar: vollständige E2E-Suite lokal oder in CI; Demo-Ablauf bleibt grün. Unabhängiges Review in frischem Kontext; Blocker/Major sowie Security/Legal/Privacy vor Merge beheben.
3. Bericht im AGENTS.md-Format mit wörtlichem Schluss des Gate-Laufs, Commit, offener Grenze und berührten Dateien. Jeder Commit nennt „Scheibe 025“ und endet mit `[skip netlify]`.

## Bericht

(nach Bau, Test, Gate und Review)
