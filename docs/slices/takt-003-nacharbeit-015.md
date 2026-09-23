# takt-003 — Folgebefunde aus dem Review von 015 (N1–N8, ADR-Feinschliff)

**Status:** review
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

Slice: takt-003-nacharbeit-015
Done:
- N1–N5, N7 in den ADRs 0009, 0013, 0003, 0009 (zweite Stelle), 0010, 0014, 0016, 0012 per Wortlautänderung an der
  zitierten Stelle umgesetzt; nichts an Status, Datum, Entscheider oder Register geändert.
- N6 in 0010 (Abschnitt Risiko) und 0015 (Abschnitt Entscheidung → Konsequenzen/Risiko) auf die Form
  „Vorschlag (nicht im Plan): <Inhalt>." gebracht; in 0015 wandert der Satz zur allgemeinen Veraltungsregel aus der
  Entscheidung in die Konsequenzen unter „Risiko", die Entscheidung-Aufzählung bleibt grammatisch vollständig.
- N8 in der Quellentabelle von `docs/slices/015-adr-paket.md` ergänzt (Zeile 0002 um „E48, Plan 6.6", Zeile 0016 um
  „E35") und hinter jeden Punkt N1–N8 in den Review findings Runde 2 „— erledigt in takt-003" gesetzt.

Evidence:

`git diff --stat 909bff6`:
```
 docs/adr/0003-persistenz-ereignislog.md              |  4 ++--
 ...9-aufbewahrung-vertraulichkeit-personentabelle.md |  5 +++--
 docs/adr/0010-pilotmodus-uebungsbetrieb.md           |  7 ++++---
 docs/adr/0012-zustandsmodell-und-verweigerung.md     |  4 ++--
 docs/adr/0013-zwei-protokollebenen.md                |  3 ++-
 docs/adr/0014-realtime-sse.md                        |  2 +-
 docs/adr/0015-vertragsversionierung.md               |  4 ++--
 docs/adr/0016-agenten-arbeitsmodell.md               |  2 +-
 docs/slices/015-adr-paket.md                         | 20 ++++++++++----------
 9 files changed, 27 insertions(+), 24 deletions(-)
```

`git diff --word-diff 909bff6 -- <file>` (gekürzt auf die geänderten Sätze):

`docs/adr/0009-aufbewahrung-vertraulichkeit-personentabelle.md` (N1):
```
Ab 067 [-ist jede Auflösung-]{+erzeugt das Aufdecken per Lookup+} ein[-protokolliertes-] Ereignis `IdentityRevealed` mit [-Grund;-]{+Grund (067);+} bis dahin
löst die Projektion den Namen beim Lesen über das Recht auf (026).
```

`docs/adr/0009-aufbewahrung-vertraulichkeit-personentabelle.md` (N3):
```
Anwendung entfernt (Plan 3, B15, 042); {+dass Rechtekonzept+} Abschnitt 4 [-schützt den Nachweis einer echten HV.-]{+(keine physische Löschung)+}
{+  diesen Bestand nicht erfasst, bestätigen Recht und DSB mit dem Rechtekonzept in 052.+}
```

`docs/adr/0003-persistenz-ereignislog.md` (N3):
```
B15, 042); {+dass+} Rechtekonzept Abschnitt 4 (keine physische Löschung) [-schützt den Nachweis einer echten-]
[-  HV.-]{+diesen Bestand nicht+}
{+  erfasst, bestätigen Recht und DSB mit dem Rechtekonzept in 052.+}
```

`docs/adr/0010-pilotmodus-uebungsbetrieb.md` (N3 + N6):
```
042); {+dass+} Rechtekonzept Abschnitt 4 (keine physische Löschung) [-schützt den Nachweis einer echten HV.-]{+diesen Bestand nicht erfasst,+}
{+  bestätigen Recht und DSB mit dem Rechtekonzept in 052.+}
...
live" fest; 042 weist Banner, Seed-Sperre und Löschprotokoll nach. [-Ein-]{+Vorschlag (nicht im Plan): ein+}
eigener Test der [-Push-Sperre-]
[-steht nicht im Plan (Vorschlag, nicht im Plan).-]{+Push-Sperre.+}
```

`docs/adr/0014-realtime-sse.md` (N4):
```
- **E22** RPO/RTO/SLO — Register-Standard (Plan 10): RPO 0, RTO 15 min, p90 < 300 ms [-am Dienst.-]{+im Probefenster.+}
```

`docs/adr/0016-agenten-arbeitsmodell.md` (N5):
```
- **E35** Taktfläche nach Umstellung auf HTTP — bis [-dahin-]{+zur dauerhaften Regel (Prüfpunkt 1)+} Übergangsregel vom 23.09.2026
```

`docs/adr/0015-vertragsversionierung.md` (N6, Entscheidung → Konsequenzen/Risiko):
```
`requestedMinutes` auf `Speaker`, veraltet in 0.2.0, gelöscht in [-080); eine allgemeine-]
[-  Veraltungsregel steht nicht im Plan (Vorschlag, nicht im Plan).-]{+080).+}
...
Kopplung an volatile Logik (ADR 0001); das Versions- und Changelog-Tor aus 019 fängt das ab.
{+Vorschlag (nicht im Plan): eine allgemeine Veraltungsregel.+}
```

`docs/adr/0012-zustandsmodell-und-verweigerung.md` (N7):
```
zugeordneten Grund und Begründung" (Abschnitt 4) auch für Verweigerungspfad A gilt —[-laut-] 044 [-verlangt-]{+macht+}
{+Katalogtreffer und Begründung+} nur {+für+} Verweigerungspfad B [-Katalogtreffer und Begründung,-]{+zur Pflicht,+} `refusal_no_claim` hat beides
```

`docs/slices/015-adr-paket.md` (N8):
```
| 0002 (Ergänzung) | Plan 3 „Taktfläche für Kleinänderungen"; Plan 4 Zeile 0002; [-B17-]{+B17; E48, Plan 6.6+} | E35 | 1 (Ergänzung), Eigentümer |
...
| 0016 Agenten-Arbeitsmodell | Plan 4 Zeile 0016; Plan 10 E44, E47, E48; Plan 8 (berechneter [-Kalender)-]{+Kalender); E35+} | E48, E44, E47 | 1 |
```

Tail von `pnpm gates`:
```
> hvworkflow@0.1.0 vocabulary /home/user/wt/takt
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/wt/takt/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1713 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-BC8cI4Qz.css                        39.09 kB │ gzip:   8.51 kB
dist/assets/index-CS58249t.js                        525.20 kB │ gzip: 154.17 kB │ map: 2,155.11 kB
✓ built in 1.68s
```
EXIT=0. Contract-Gate zuvor: `(c) openapi.yaml unchanged against merge base 0483f32` ok; `packages/domain test` 39
passed; `apps/api test` 25 passed; `apps/web test` 35 passed; `apps/web lint` nur bekannte Alt-Warnungen
(react/set-state-in-effect, only-export-components), keine neuen Befunde durch diese Scheibe (nur Markdown geändert).

Open: keine.

Touched: docs/adr/0003-persistenz-ereignislog.md, docs/adr/0009-aufbewahrung-vertraulichkeit-personentabelle.md,
docs/adr/0010-pilotmodus-uebungsbetrieb.md, docs/adr/0012-zustandsmodell-und-verweigerung.md,
docs/adr/0013-zwei-protokollebenen.md, docs/adr/0014-realtime-sse.md, docs/adr/0015-vertragsversionierung.md,
docs/adr/0016-agenten-arbeitsmodell.md, docs/slices/015-adr-paket.md, docs/slices/takt-003-nacharbeit-015.md

## Review findings

(vom Reviewer)
