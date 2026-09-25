# 089 — Zielbild Oberfläche als Quelle: Prototyp im Repositorium, Register E50–E54, Zuordnung zu den Scheiben

**Status:** review (Nachprüfung nach Runde 1)
**Risikoklasse:** niedrig · 1,5 AStd · Kalender 02.10.2026 (W1), vorgezogen auf 25.09.2026 · Lanes: docs-feedback,
docs-register, docs-plan (dazu das neue Verzeichnis `docs/zielbild/`, das dieser Scheibe gehört)
**Rolle:** Architekt; Review in frischem Kontext (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** AGENTS.md Regeln 1, 2, 3, 9, 11, 12; Plan 5.0 (Abdeckungsmatrix), 5.9 (Takt-Spur), 5.10 (B-Liste)
**Quellen-IDs:** UI-Bewertung und Prototyp vom 25.09.2026 (Wunsch des Eigentümers in der Sitzung), U1–U11 und
Z1–Z26 in `docs/feedback/2026-09-zielbild-oberflaeche.md`; Feedback-Auswertung #3, #6, #7, #9–#11, #24–#32;
Recherche Z.21, Z.27, Z.74, Z.78, Z.116, Z.175, Z.240, Z.247, Z.250, Z.253, Z.261; Register E5–E7, S4
**Depends on:** 014 (gemergt)
**Perspektive:** Oberfläche und Planung · **Glossar: neue Begriffe:** nein (Erwartungskarte, Rednerwand, Setliste
und Faden kommen ins Glossar mit der Scheibe, die sie in die Oberfläche bringt)

## Ziel

Die Vorschläge aus UI-Bewertung und Prototyp werden eine Quelle des Plans mit genau einem Ort je Punkt, und die
Agenten der Oberflächen-Scheiben finden den Prototyp im Repositorium, statt bei null anzufangen.

1. **Quelle** `docs/feedback/2026-09-zielbild-oberflaeche.md`: Befunde U1–U11 und Zielbild Z1–Z26 mit
   Begründung, Status (Schlüssel wie in `2026-09-quickview-projektleitung.md`), Ort und Aufwand; Abschnitt mit
   den neuen Entscheidungen E50–E54 als Fragen an die Projektleitung; Abschnitt, wie die Scheiben das Zielbild
   nutzen.
2. **Prototyp** in `docs/zielbild/` als lesbare Referenz: `index.html`, `zielbild.css`, je Ansicht eine Datei
   unter `js/`, Schriften per relativem Pfad aus `apps/web/src/styles/fonts/` (kein Base64). `README.md`
   erklärt Herkunft, Öffnen über einen lokalen Webserver, Aufbau je Datei mit Zielscheiben und Z-Punkten, was
   übernommen wird und was nicht (Regeln 4, 5, 6, 8, 10) und wie Design-Kritik und Review die Bilder nutzen.
3. **Bilder** `docs/evidence/089-*.png`: Schreibraum, Rundgang Schritt 2, Lagebild (ganze Seite), Teleprompter,
   Schreibraum und Teleprompter bei 390 px, alle aus der Repo-Fassung über den lokalen Webserver.
4. **Abdeckungsmatrix**: eine Zeile „Zielbild Oberfläche" in Plan 5.0 und in `docs/abdeckungsmatrix.md` (dort
   mit Stand), die jeden der 37 Punkte auflöst: Scheibe, Takt-Spur, Registerzeile, bewusstes Nein oder gebaut.
5. **Register** `docs/entscheidungsregister.md`: E50 (Erwartungskarte), E51 (Zahlenprüfung), E52 (Halten statt
   Leertaste; Rückgängig-Fenster im Standard), E53 (Kontrastmodus der Bühne als Standard des Podiums), E54
   (Rückkanal zur Bühne), je mit allen neun Spalten; Status `offen`, E53 `auf Standard gebaut am 03.09.2026 in 007`
   (der Kontrastmodus steht im Code); Überschrift, Stand und Abschnitt 5 (Rückfalltrigger) nachgeführt.
6. **Plan** `docs/produktplan-beta.md`: diese Scheibe als Zeile in M1 (5.3) nach 020; in 050, 054, 055, 056,
   058, 061, 062 und 087 je eine Unterzeile *Zielbild (089)* mit den Z-Nummern, dem Verweis auf Quelle und Bild
   und dem Satz, dass die Spec die Punkte als Text übernimmt.

## Nicht-Ziele

- Keine Änderung an `apps/**`, `packages/**`, Tests oder Toren; der Prototyp wird nicht gebaut, nicht verlinkt
  und nicht ausgeliefert (Netlify baut nur `apps/web`).
- Keine Entscheidung: E50–E54 bleiben `offen`, jede mit Standardannahme. Keine Änderung an
  `docs/design-prinzipien.md`, bevor E52 und E53 beantwortet sind.
- Keine Takt-Specs für U1, U2, U4, U6–U9: die entstehen beim Bau (Plan 5.9).
- Keine neuen Scheiben außer 089; keine Änderung an Terminen, Abhängigkeiten oder Aufwänden bestehender Scheiben.
- Keine echten Personen- oder Firmennamen: der Prototyp nutzt nur Namen aus dem synthetischen Seed.

## Files allowed

- `docs/feedback/2026-09-zielbild-oberflaeche.md` (neu)
- `docs/zielbild/**` (neu)
- `docs/evidence/089-*.png` (neu)
- `docs/abdeckungsmatrix.md`
- `docs/entscheidungsregister.md`
- `docs/produktplan-beta.md`
- diese Datei (`docs/slices/089-zielbild-oberflaeche.md`)

## Akzeptanzkriterium

1. Jeder der 37 Punkte (U1–U11, Z1–Z26) steht in der Quelle mit Status und Ort, und die Matrixzeile nennt jeden
   Punkt genau einmal.
2. `docs/zielbild/index.html` lädt über `python3 -m http.server` aus der Wurzel ohne Skriptfehler, mit geladenen
   Schriften (Nachweis im Bericht); die Datei enthält kein Base64.
3. E50–E54 im Register mit neun Spalten, Status wie in Ziel 5; die Matrix-, Register- und Planzeilen verweisen
   aufeinander.
4. `node scripts/slice-scope.mjs --slice 089` und `pnpm gates` grün.

## Nachweise

`docs/evidence/089-*.png`; Ausgabe des Ladelaufs (Skriptfehler, Schriften); `pnpm gates`; Scheibenumfang mit
`--slice 089` (der Branch `claude/lucid-mendel-1dctol` folgt nicht dem Schema `claude/slice-NNN-…`, deshalb prüft
das Tor ihn in CI nicht von selbst).

## Bericht

## Review findings

### Runde 1 (Review in frischem Kontext, auf `6f9ea44`) — Urteil: Nacharbeit

Tore, Umfang (`--slice 089`), Plan-Graph, Semgrep 1.177.0 mit `scripts/semgrep/rules.yml` (0 Befunde),
Ladelauf und Namensprüfung vom Reviewer grün bestätigt. Befunde und Erledigung:

| Nr. | Schwere | Befund | Erledigung |
|---|---|---|---|
| 1 | major | E53/Z20 beruhten auf falscher Annahme: die Bühne hat seit 005–007 einen Kontrastmodus je Gerät (`.stage-contrast`, Standard hell) | E53 als Frage nach dem Standardwert, Status `auf Standard gebaut am 03.09.2026 in 007`, Kosten Minuten; Z20, README, Plan-Zeilen 089 und 056 angepasst |
| 2 | major | E52: Standard „Ja" war die Entscheidung selbst und widersprach Nicht-Ziel und Plan-Zeilen | Standard: Leertaste wie D7; Rückgängig-Fenster (058) in jedem Fall; Rückfalltrigger 13.11.2026 / 056; Quelle, 056 und 058 angeglichen; Bauordnung (Halten 056, Fenster 058) genannt |
| 3 | major | Aufwand in S/M statt AStd; zugeschlagener Umfang in M4 verdeckt | Aufwand in AStd je Punkt, Summen je Scheibe in Quelle Abschnitt 4 (+3,75 AStd M4, 2,25 AStd Takt), Neuschätzung und Weg über Prüfpunkt 2 und Plan 6.5 |
| 4 | minor | U3 ungenau (Podium schließt sofort ab; R-TRANS-06 führt zum Antwortentwurf) | U3 neu formuliert |
| 5 | minor | Z16 teils gebaut (Vorschau, „noch n" aus 020) | Status und Matrix-Stand ergänzt |
| 6 | minor | Matrix-Stand ohne 020, 089 fehlt in Spalte Scheibe(n) | ergänzt |
| 7 | minor | Register: Überschrift, Stand, Rückfalltrigger als Bedingung | Überschrift E1–E54, Stand-Vermerk, Rückfalltrigger als Datum/Scheibe oder „keiner (Standard ist Nichtbau)", Zeile in Abschnitt 5 |
| 8 | minor | Z1 enthielt Treffer-Kennzeichen (hängt an E50) | nach Z2 verschoben, Plan-Zeile 054 angepasst |
| 9 | minor | Z9 und 054 nannten verschiedene primäre Aktionen | Z9 an E5 gebunden, Übergabe an anderen Fachbereich als zweite Aktion; Plan-Zeile 054 |
| 10 | minor | Vokabular: Ansichtsnamen, „Legal" als Rolle, „Backoffice"; Glossarpflicht nur in der Spec | README-Abschnitt „Namen im Prototyp", Begriffszeile in Quelle Abschnitt 4 und in allen Plan-Zeilen; Prototyp-Texte auf „Recht", „Legal Clearing", „Versammlungsbüro" |
| 11 | minor | CSS schaltet alle Ansichten dunkel; Z25 fehlte im README-Aufbau | als „nicht übernehmen" geführt; Z25 ergänzt |
| 12 | minor | U-Tabelle ohne Aufwand | Spalte ergänzt |
| 13 | minor | Abschnitt 4 behauptete Plan-Zeilen für alle Scheiben | auf die acht Scheiben eingeschränkt, übrige genannt |
| 14 | minor | sechs Stationen im Prototyp verschmelzen Freigabe und Rechtsfreigabe | Zeile in „nicht übernehmen" (S6, R-GUARD-07), Hinweis in Z12 |
| 15 | minor | Bericht leer | gefüllt nach dem Torlauf auf dem Nacharbeits-Commit |
| 16 | nit | Plan-Zeile ohne „vorgezogen", Nachweise unvollständig | ergänzt (Datum im Kalenderfeld unverändert, damit Plan-Graph es liest) |
| 17 | nit | Z21 Ort | „— (bei Ja 056, 085)" |
| 18 | nit | keine Lane für `docs/zielbild/**` | Plan 5.1, Lane docs-feedback |
| 19 | nit | unprüfbarer Satz zur veröffentlichten Fassung | ersetzt: maßgeblich ist das Verzeichnis |
| 20 | nit | `innerHTML` auch für Entwürfe und Rückgängig | in „nicht übernehmen" ergänzt, Verweis auf 055 |
| 21 | nit | Bauordnung E52 | in Register und Plan-Zeilen 056/058 |
| 22 | nit | Server auf 8089 lief noch | beendet |

