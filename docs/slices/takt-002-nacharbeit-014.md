# takt-002 — Folgebefunde aus dem Review von 014 (N1–N4, N6)

**Status:** angenommen
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: docs-register, docs-datenschutz,
`scripts/takt.mjs` (keine davon hält gerade eine Scheibe)
**Rolle/Modell:** Mechaniker · Haiku 4.5 baut; Review Sonnet 5
**Rule ids:** AGENTS.md Regeln 1, 2, 12
**Quellen-IDs:** `docs/slices/014-entscheidungsregister.md`, Review findings Runde 2, N1–N4 und N6 (N5 fällt mit
dem neuen Screenshot aus der Seed-Kleinänderung weg und ist nicht Teil dieser Änderung)

## Ziel

1. **N1 `scripts/takt.mjs`:** Nach dem Parsen einer Zeit (`JJJJ-MM-TT HH:MM`) prüfen: Monat 1–12, Tag innerhalb des
   Monats (Schaltjahr beachten), Stunde 0–23, Minute 0–59. Scheitert die Prüfung, gibt das Skript dieselbe
   Formatwarnung aus wie bei einem falschen Format (mit Punkt-ID) und zählt die Zeile als offen. Beispiele, die jetzt
   warnen müssen: `2026-10-32 10:00`, `2026-10-01 25:00`, `2026-13-45 10:00`, `2026-02-29 10:00`; `2028-02-29 10:00`
   ist gültig.
2. **N6 `scripts/takt.mjs`:** Einzahl: „1 Punkt" statt „1 Punkte" (alle anderen Zahlen bleiben „n Punkte").
3. **N2 `docs/datenschutz/dsfa-vorentwurf.md`:**
   - Tabelle 2.1, Zeile „Historie", Spalte Empfänger: „Recht, Freigabe (lesend); Beobachter nur Zähler und
     Vorgelesenes (Plan B2, Scheibe 010); Revision hat in der Beta kein Konto (E24); personenbezogene Auswertung nur
     mit zweiter Freigabe".
   - V9, Spalte Empfänger: „Recht, Freigabe (lesend); Beobachter nur Zähler und Vorgelesenes (Plan B2, Scheibe 010);
     Notar (Export); Revision ohne Konto in der Beta (E24)".
   - V12, Spalte Empfänger: „Administration; Revision ohne Konto in der Beta (E24)".
   - Rollentabelle, Zeile Beobachter (`observer`), zweite Spalte: „Zähler und Vorgelesenes (Plan B2, Scheibe 010)".
4. **N4 `docs/datenschutz/dsfa-vorentwurf.md` V13**, letzte Spalte: „Eigenes Recht, jede Auflösung protokolliert (Recht
   aus 026, Protokoll aus 067)".
5. **N3 `docs/entscheidungsregister.md`**, Abschnitt 2a, Zeile „o. Nr. 2", Spalte Standardannahme: „offen; kein
   Vorschlag im Plan, Zuordnung vor 044 mit ADR 0012 an Recht".

## Nicht-Ziele

Keine anderen Zeilen, keine Umformulierung darüber hinaus, kein Screenshot, kein Seed.

## Files allowed

`scripts/takt.mjs`, `docs/datenschutz/dsfa-vorentwurf.md`, `docs/entscheidungsregister.md`, diese Datei (Bericht).

## Nachweis

Ausgabe von `node scripts/takt.mjs <Beispieldatei>` mit den fünf Zeiten aus Ziel 1 (vier Warnungen, eine gültige
Zeile) und mit genau einer abgeschlossenen Zeile („1 Punkt"); die Beispieldateien liegen nur im Scratch.
`git diff --stat` zeigt nur die erlaubten Dateien; Tail von `pnpm gates`.

## Bericht

Slice: takt-002-nacharbeit-014

Done: Datumsbereichsprüfung nach Format-Check in `parseBerlinTime()` für N1
(Monat 1–12, Tag innerhalb des Monats mit Schaltjahr, Stunde 0–23, Minute 0–59);
Singular-Form „1 Punkt" für N6; DSFA und Entscheidungsregister aktualisiert für N2–N4.

Evidence:
```
Commit 7a6d00c (vorher 77eb2db; Betreffzeile um [skip netlify] ergänzt)

Test 1: Vier ungültige Dateien und eine gültige (5 Punkte, 4 offen):
Warnung: Punkt "P001": Nachricht oder Live nicht im Format "JJJJ-MM-TT HH:MM" lesbar — zählt als offen.
Warnung: Punkt "P002": Nachricht oder Live nicht im Format "JJJJ-MM-TT HH:MM" lesbar — zählt als offen.
Warnung: Punkt "P003": Nachricht oder Live nicht im Format "JJJJ-MM-TT HH:MM" lesbar — zählt als offen.
Warnung: Punkt "P004": Nachricht oder Live nicht im Format "JJJJ-MM-TT HH:MM" lesbar — zählt als offen.
5 Punkte
4 offen
Median gesamt: 1.00 h
Median S: 1.00 h

Test 2: Singular-Form mit 1 Punkt:
1 Punkt
0 offen
Median gesamt: 1.00 h
Median S: 1.00 h

git diff --stat HEAD~0:
docs/datenschutz/dsfa-vorentwurf.md | 10 +++++-----
docs/entscheidungsregister.md       |  2 +-
scripts/takt.mjs                    | 26 ++++++++++++++++++++++++--

pnpm gates (Orchestrator, nach Berichtigung der Commit-Nachricht, Exit 0), Auszug — Zeilen wörtlich aus dem Lauf:
packages/contract test: contract gate: packages/contract/openapi.yaml (info.version 0.2.0, 29 operations)
packages/contract test: contract gate: ok
packages/domain test:       Tests  39 passed (39)
apps/web test:       Tests  35 passed (35)
apps/api test:       Tests  25 passed (25)
> node scripts/vocabulary-check.mjs
vocabulary-check: ok
✓ built in 1.12s
```

Open: keine

Touched: `scripts/takt.mjs`, `docs/datenschutz/dsfa-vorentwurf.md`, `docs/entscheidungsregister.md`

## Review findings

**Sonnet 5 · 23.09.2026 · Urteil: annehmen (0 Blocker, 0 major, 0 minor, 2 nits).** Wortlaut aller fünf Zellen
byteweise geprüft; Spaltenzahl unverändert; nur erlaubte Dateien. Datumsprüfung selbst getestet: `2026-10-32`,
`2026-10-01 25:00`, `2026-13-45`, `2026-02-29`, `1900-02-29`, `2026-04-31` warnen; `2028-02-29`, `2000-02-29` und
`2026-10-25 02:30` (Tag der Zeitumstellung) gelten; eine abgeschlossene Zeile → „1 Punkt". `pnpm gates` Exit 0.

1. nit · `scripts/takt.mjs:170–172`: Variablennamen `y_num` usw. in snake_case statt camelCase — bleibt (kosmetisch).
2. nit · `scripts/takt.mjs:170–181`: die umbenannten Zwischenvariablen sind entbehrlich — bleibt (kosmetisch).

Beide nits bleiben stehen; sie gehen mit der nächsten Änderung an `takt.mjs` mit.
