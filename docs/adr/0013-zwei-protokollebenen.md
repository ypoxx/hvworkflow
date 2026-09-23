# ADR 0013 — Zwei Protokollebenen

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Eigentümer, HR, Betriebsrat, DSB (Plan 3 „Betriebsrat und DSFA"; E13, E14); Recht und DSB für die Log-Aufbewahrung (E16) · **Annahme:** Prüfpunkt 4 (Plan 4)

## Kontext

Das Tool erfasst Bearbeitungszeiten und Rückstände; seine objektive Eignung zur Verhaltens- und
Leistungskontrolle macht die Mitbestimmung zum kritischen Pfad (Recherche Z.128). Die Recherche
verlangt zwei getrennte Protokollebenen (Z.130, MUSS) und einen echten Schutzmaßnahmenkatalog:
Verbot individualbezogener Leistungsauswertung, Mindest-Aggregationsschwelle, Zwei-Schlüssel-Prinzip
für jede personenbezogene Log-Auswertung, Log-Löschfristen (Z.129). Das Rechtekonzept
(Abschnitt 6) macht daraus die Anforderung, dass der Auswertungskatalog aus dem System generiert
wird und Drill-down auf Einzelpersonen technisch deaktiviert ist, nicht organisatorisch untersagt.
Der Betriebsrat-Prozess startet am 25.09.2026; bis zum Abschluss läuft die Beta nur mit
synthetischen Fragen (E13, E14). Der Termin blockiert den Produktivstart, nicht die Beta. Die
Mindest-Aggregationsschwelle aus Z.129 adressiert der Plan nicht: offen (E13, Betriebsvereinbarung).

## Entscheidung

Standardannahme aus Plan 3 („Betriebsrat und DSFA", „Vertraulichkeitsstufe") und Plan 4
(Zeile 0013):

- **Ebene 1, fachliche Vorgangshistorie:** das Ereignislog — in der Beta unbegrenzt aufbewahrt
  (keine Löschlogik; Fristen je `retentionClass` offen, E16), nicht abschaltbar (Rechtekonzept
  Abschnitt 4), mit `personId` statt Klarname (ADR 0009).
- **Ebene 2, technisches Zugriffslog:** strukturiert (Korrelations-ID, Subject-Hash, Operation,
  Status, Latenz, `seq`), **ohne Nutzdaten** — nie Fragetext —, in einer getrennten Senke,
  Aufbewahrung als Konfiguration mit Standard 30 Tage.
- **Auswertung nur zu zweit.** Das Zugriffslog und die personenbezogenen Felder der Historie
  (`event.read.personal`) sind nur im Vier-Augen-Verfahren auswertbar: Ereignis
  `AuditAccessGranted` mit Zweck und Frist; das Verfahren ist dokumentiert (033), die technische
  Sperre liegt in `can()` (047): `personId`-Auswertung ohne zweite Freigabe → 403.
- **Keine Kennzahl je Person.** Keine personenbezogene Leistungsauswertung (Plan 4, Zeile 0013). Es
  gibt fünf fachliche Kennzahlen (Alter der ältesten offenen
  Frage, Rückstand je Fachbereich, Zulauf je 5 min, Fragen in Rechtsfreigabe > 10 min, Ereignisse
  je Minute) und ein Kennzahlen-Allowlist-Tor: keine Kennzahl je Subject ohne Spec-Eintrag.
- **Rate-Limit-Zähler sind flüchtig** und nicht auswertbar; sie stehen nicht im Katalog.
- **Der Auswertungskatalog wird generiert**, nicht gepflegt: welche Kennzahlen existieren, keine je
  Person; als CI-Artefakt mit Diff-Tor (033, vervollständigt in 073).

## Konsequenzen

**Positiv.** Die Software ist BV-verträglich geschnitten, unabhängig vom Verhandlungsstand. Die
Antwort an den Betriebsrat lautet „diese Auswertungen — und zwar abschließend", belegt durch ein
Build-Artefakt, das sich bei jedem Release mitändert. Ein aktienrechtlicher Nachweis (Historie) wird
nicht zur Leistungskontrolle, weil die Ebenen getrennt bleiben.

**Negativ.** Auch Support und Betrieb bekommen keine Kennzahl je Person; die Analyse eines Vorfalls
im Zugriffslog braucht zwei Personen und ein Ereignis mit Zweck und Frist (Runbook). Die
Betriebsauswertung (037) alarmiert außerhalb des Tools und darf nur fachliche Kennzahlen kennen.

**Risiko.** Ein Release könnte still eine Kennzahl je Person einführen; deshalb ist das
Allowlist-Tor ein Tor und der Katalog ein Diff, nicht eine Zusage.

## Kosten bei Änderung

- Zusätzliche Schutzmaßnahmen aus der Betriebsvereinbarung sind Konfiguration (Aufbewahrung) oder
  das Entfernen von Kennzahlen (Plan 3).
- Der Rückfall gepoolter Stationsidentitäten (E13) schränkt B1, B6, B9 und B15 ein und steht mit
  Bedingung in der Restliste (B18).

## Verworfene Alternativen

- **Ein Log für alles** (Historie und Zugriffe in einer Senke). Verworfen: Recherche Z.130 — die
  Vermischung macht aus einem aktienrechtlichen Nachweis eine Leistungskontrolle.
- **Fragetext im Zugriffslog** (zur Fehlersuche). Verworfen: das Zugriffslog trägt nie Nutzdaten;
  Test „Log-Zeile ohne Fragetext trotz Body".
- **Kennzahl je Person, organisatorisch untersagt.** Verworfen: Rechtekonzept Abschnitt 6 —
  technisch deaktiviert, nicht organisatorisch untersagt.
- **Abschaltbare Historie oder abschaltbares Zugriffslog** für eine Rolle oder einen Zeitraum.
  Verworfen: Rechtekonzept Abschnitt 4.
- **Persistente Rate-Limit-Zähler je Subject.** Verworfen: flüchtig und aus dem Katalog
  ausgeschlossen (Plan 3).
- **Handgepflegter Auswertungskatalog als Anlage.** Verworfen: Rechtekonzept Abschnitt 6 — generiert
  aus dem System.

## Nachweis

Scheiben **033** und **047** (Plan 4): Test Log-Zeile ohne Fragetext trotz Body; Katalog als
CI-Artefakt; Allowlist-Tor rot bei absichtlicher Kennzahl je Person; Test `personId`-Auswertung ohne
zweite Freigabe → 403. Katalog vervollständigt und Dokumentation „Auswertung nur zu zweit" in 073;
Zulieferungen an Betriebsrat und DSB in 083. Aus B5: Zugriffslog-Tor, Kennzahlen-Allowlist-Tor.

## Offene Registerzeilen

- **E13** Mitbestimmung: Betriebsrat-Prozess und Identitäten in der Probe; Mindest-
  Aggregationsschwelle (Recherche Z.129) offen für die Betriebsvereinbarung.
- **E14** DSFA als Vorbedingung für Personenidentitäten auf Staging.
- **E16** Aufbewahrung — Löschfristen des Zugriffslogs (Standard 30 Tage als Konfiguration).
- **E36** Personenzuweisung von Einzelfragen — Register-Standard (Plan 10): Zuweisung an den
  Fachbereich, eine Person nur über die Übernahme (Claim) sichtbar, keine automatisierte
  Personenzuweisung (BV).
