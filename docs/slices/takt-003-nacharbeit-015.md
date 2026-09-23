# takt-003 — Folgebefunde aus dem Review von 015 (N1–N8, ADR-Feinschliff)

**Status:** spec
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lane: docs-adr (keine laufende Scheibe
hält sie; 039 liest die ADRs nur)
**Rolle/Modell:** Implementierer · Sonnet 5 baut (Wortlaut in ADRs, deshalb nicht Haiku); Review Opus 5.5
**Rule ids:** AGENTS.md Regeln 1, 2, 12; Leitplanken 11 (nichts entscheiden, was dem Eigentümer gehört)
**Quellen-IDs:** `docs/slices/015-adr-paket.md`, Review findings Runde 2, N1–N8

## Ziel

Nur Wortlaut; kein Status, kein Datum, keine Entscheidung ändert sich. Die Zeilenangaben beziehen sich auf den Stand
`d90c25f`; suche die Stelle am zitierten Text.

1. **N1 `docs/adr/0009-…`** (Abschnitt Entscheidung, Klarnamen): „Ab 067 ist jede Auflösung ein protokolliertes
   Ereignis `IdentityRevealed` mit Grund" → „Ab 067 erzeugt das Aufdecken per Lookup ein Ereignis
   `IdentityRevealed` mit Grund (067)". Der Rest des Satzes bleibt.
2. **N2 `docs/adr/0013-…`** (Abschnitt Entscheidung): Der Punkt „Keine Kennzahl je Person." beginnt mit „Keine
   personenbezogene Leistungsauswertung (Plan 4, Zeile 0013)." und fährt dann mit dem bisherigen Text fort.
3. **N3** an drei Stellen (`0003` Abgrenzung, `0009` Abgrenzung, `0010` Abgrenzung) wird der Halbsatz
   „Rechtekonzept Abschnitt 4 (keine physische Löschung) schützt den Nachweis einer echten HV" bzw. „Abschnitt 4
   schützt den Nachweis einer echten HV" ersetzt durch: „dass Rechtekonzept Abschnitt 4 (keine physische Löschung)
   diesen Bestand nicht erfasst, bestätigen Recht und DSB mit dem Rechtekonzept in 052". Die Stütze bleibt Plan 3,
   B15, 042.
4. **N4 `docs/adr/0014-…`** Abschnitt „Offene Registerzeilen", E22: „p90 < 300 ms am Dienst" → „p90 < 300 ms im
   Probefenster" (Wortlaut des Registers, E22).
5. **N5 `docs/adr/0016-…`**: In der Zeile zu E35 wird „bis dahin" ersetzt durch „bis zur dauerhaften Regel
   (Prüfpunkt 1)".
6. **N6** `0010` (Abschnitt Risiko) und `0015` (Abschnitt Entscheidung): Vorschläge ohne Planstütze stehen in der Form
   „Vorschlag (nicht im Plan): <Inhalt>." In `0015` wandert der Satz zur allgemeinen Veraltungsregel aus dem
   Abschnitt „Entscheidung" in den Abschnitt „Konsequenzen" unter „Risiko" (die Entscheidung enthält nur, was der
   Plan trägt).
7. **N7 `docs/adr/0012-…`**: „laut 044 verlangt nur Verweigerungspfad B Katalogtreffer und Begründung" → „044 macht
   Katalogtreffer und Begründung nur für Verweigerungspfad B zur Pflicht".
8. **N8 `docs/slices/015-adr-paket.md`**, Quellentabelle: Zeile „0002 (Ergänzung)" nennt zusätzlich „E48, Plan 6.6";
   Zeile „0016 Agenten-Arbeitsmodell" nennt zusätzlich „E35".
9. In `docs/slices/015-adr-paket.md`, Review findings Runde 2: hinter jeden der Punkte N1–N8 „— erledigt in takt-003".

## Nicht-Ziele

Keine weiteren Umformulierungen, keine neuen Aussagen, keine Änderung an Status, Datum, Entscheider, Register.

## Files allowed

`docs/adr/0003-*.md`, `0009-*.md`, `0010-*.md`, `0012-*.md`, `0013-*.md`, `0014-*.md`, `0015-*.md`, `0016-*.md`,
`docs/slices/015-adr-paket.md`, diese Datei (Bericht).

## Nachweis

`git diff --word-diff` je Datei im Bericht (gekürzt auf die geänderten Sätze); Tail von `pnpm gates`.

## Bericht

(vom Bauenden)

## Review findings

(vom Reviewer)
