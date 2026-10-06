# takt-060 — Demo-Drehbuch auf den Stand vom 06.10.2026

**Status:** gebaut · **Risikoklasse:** niedrig (nur Doku, kein Verhalten, keine Daten, keine Rechte) · ca. 0,5 AStd · **Lanes:** docs
**Rolle:** Mechaniker (Abgleich gegen Code); Codex-Review am PR
**Regeln:** AGENTS.md R1, R2, R9, R12 · **Depends on:** – · **Glossar: neue Begriffe:** nein

## Anlass

Der Eigentümer zeigt die Demo am 07.10.2026 Entwicklung, Produktverantwortung, Betrieb und Finanzen. Das Dossier vom 06.10.
(Lesebefund aus dem Repository) fand, dass `docs/demo-skript.md` an mehreren Stellen nicht mehr zum Stand passt: Redezeit-Szene
(seit 080 entfernt), Klassifizieren durch die Erfassung (seit 021b Koordination), Historie in der Rolle Beobachtung (ohne
`history.read`), „Verweigerungspfad nicht in der Oberfläche“ (045 gebaut), falsche Knopfbeschriftungen.

## Ziel

Das Drehbuch beschreibt den heutigen Stand: jede Szene mit Rolle, Klickweg und genauer Beschriftung aus dem i18n-Wörterbuch;
eine Szene Verweigerung mit drei verschiedenen Personen; „Fassungen vergleichen“ als optional (lokales Dienstpaket); eine Zuordnung
„Für wen welche Szene“; Hinweis auf lokalen Start, falls die öffentliche Demo einen älteren Stand zeigt.

## Nicht-Ziele

- Keine Änderung an Code, Seed, Tests oder anderen Dokumenten.

## Abnahme

- Jede Aussage im Drehbuch ist gegen Code, i18n-Dateien oder e2e-Specs belegbar; nicht belegbare Aussagen sind entfernt.
- CI des PR grün (reiner Doku-Commit: kein lokaler Lauf nötig, AGENTS.md R2).

## Files allowed

- `docs/demo-skript.md`
- `docs/slices/takt-060-demo-drehbuch.md`

## Bericht

```
Slice: takt-060-demo-drehbuch
Done: docs/demo-skript.md gegen featureRegistry, DEMO_ACTORS, ROLE_PERMISSIONS, seed, i18n (*.de.ts) und e2e (abnahme,
      045-verweigerung) abgeglichen; Redezeit-Szene entfernt, Koordination klassifiziert, Historie im Versammlungsbüro,
      neue Szene Verweigerung (Koordination → Recht → Freigabe → Bühne), Beschriftungen berichtigt, „Fassungen vergleichen“
      optional, Tabelle „Für wen welche Szene“.
Evidence: reiner Doku-Commit; CI des PR (Job gates) ist der Laufnachweis. Seed-Zählung einmal per temporärem vitest-Test
      gegen CORPUS_DEMO geprüft (Test wieder entfernt).
Open: Klickpfad der Verweigerung und die Zahl „sechsmal Vorgelesen, weiter“ aus Code und e2e abgeleitet, nicht im Browser
      nachgeklickt; vor der Vorführung einmal durchspielen.
Touched: docs/demo-skript.md, docs/slices/takt-060-demo-drehbuch.md
```
