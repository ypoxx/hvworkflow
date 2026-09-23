# takt-002 — Folgebefunde aus dem Review von 014 (N1–N4, N6)

**Status:** spec
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

(vom Bauenden)

## Review findings

(vom Reviewer)
