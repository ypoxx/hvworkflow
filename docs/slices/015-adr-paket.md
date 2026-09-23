# 015 — ADR-Paket 0003–0016 als vorgeschlagen

**Status:** spec
**Risikoklasse:** niedrig · 2,5 AStd · Kalender 30.09.2026 (W1) · Lanes: docs-adr (+ `README.md` Indexzeilen;
keine andere laufende Scheibe ändert das README)
**Rolle/Modell:** Architekt-Text · Fable 5.1; Review (Lesebefund) Opus 5.5 gegen Recherche, Rechtekonzept und ADR 0001
**Rule ids:** AGENTS.md Regeln 1, 5, 6, 7, 11, 12; Leitplanken 1.3 (ADR 0001 operativ bindend, Regel 7)
**Quellen-IDs:** Plan 4 (Tabelle ADR 0001–0016, Regel für den ADR-Status); Plan 3 (Standardannahmen mit Kosten);
Plan 5.2 Scheibe 015; Plan 1 (B-Kriterien als Nachweisbezug)
**Depends on:** 009 (gemergt)
**Perspektive:** Architektur, Security, Datenschutz, Legal (je ADR, siehe unten) · **Glossar: neue Begriffe:** nein

## Ziel

1. **Vierzehn ADR-Dateien** in `docs/adr/` mit genau diesen Namen (Scheibe 014 verweist parallel darauf):
   `0003-persistenz-ereignislog.md`, `0004-identitaet-oidc-bff.md`, `0005-antwortformat.md`,
   `0006-buehne-je-geraet-und-antwortbuendel.md`, `0007-deployment-hosting-umgebungen.md`,
   `0008-integrationen.md`, `0009-aufbewahrung-vertraulichkeit-personentabelle.md`,
   `0010-pilotmodus-uebungsbetrieb.md`, `0011-ereignis-umschlag-v2.md`,
   `0012-zustandsmodell-und-verweigerung.md`, `0013-zwei-protokollebenen.md`, `0014-realtime-sse.md`,
   `0015-vertragsversionierung.md`, `0016-agenten-arbeitsmodell.md`.
2. **Aufbau je ADR** (Form wie ADR 0001/0002, Deutsch): Kopfzeile `**Status:** vorgeschlagen · **Datum:** 23.09.2026 ·
   **Entscheider:** <aus Plan 4/10> · **Annahme:** Prüfpunkt <n> (Plan 4)`; Abschnitte Kontext · Entscheidung (die
   Standardannahme aus Plan 3 und Plan 4, nicht mehr) · Konsequenzen · Kosten bei Änderung (aus Plan 3/10, in AStd) ·
   Verworfene Alternativen (mit Grund) · Nachweis (die Scheibe(n), deren Nachweise die Annahme tragen, Plan 4 Spalte
   „Nachweis in") · Offene Registerzeilen (E-Nummern).
3. **ADR 0012** beschreibt beide Verweigerungsmodelle mit Preis: (A) Verweigerung als Antwortart
   (`answerKind`, `refusalGroundId`) durch die bestehende Kette in_review → approved → staged → delivered
   (Standard), (B) zwei Hauptzustände `refusal_proposed`/`refused` (2,5 AStd), dazu Kennzeichen statt Zustände
   (deferred, correctionOpen, followUp), fünf Anzeigegruppen, Reform erst nach der Beta; der ADR geht vor 044 an Recht
   (Plan 3, Zeile „Zustandsmodell und Verweigerung").
4. **ADR 0002, Ergänzung** (Plan 4 Zeile 0002): neuer Abschnitt „Ergänzung (vorgeschlagen, 23.09.2026; Annahme
   Prüfpunkt 1)" am Ende von `docs/adr/0002-demo-betriebsart-in-process.md`: Demo-Betriebsart bleibt bis beta-1
   Taktfläche, besteht dieselbe e2e-Suite wie die HTTP-Betriebsart, Reset-Banner statt Upcaster, localStorage-Adapter
   bleibt Wegwerfcode, Ende nach beta-1 durch Eigentümerentscheid; Nachweis in 015 und 031. Der bestehende Text von
   ADR 0002 bleibt unverändert; Status „angenommen" gilt für den bisherigen Teil.
5. **ADR 0001** bleibt unverändert (Annahmevorlage liegt seit 009 in `docs/adr/0001-vorlage-annahme.md`).
6. **Konsistenz**: Jede Aussage eines ADR steht so in Plan 3 oder 4 (oder folgt zwingend daraus); kein ADR trifft eine
   Entscheidung, die der Plan offenlässt (dann: „offen, Register E<n>"). Kein Widerspruch zu ADR 0001, AGENTS.md
   Regel 7 (nur anhängend, nicht verhandelbar), dem Rechtekonzept oder den Leitplanken. Normzitate aus der Recherche
   nur mit dem Hinweis „ungeprüft (E15)".
7. **README-Index**: eine Zeile „`docs/adr/`" bzw. je eine kurze Zeile für das ADR-Paket (ein Eintrag „ADR 0003–0016,
   vorgeschlagen" reicht), eine Zeile für `docs/entscheidungsregister.md` (entsteht parallel in 014) und — falls noch
   nicht vorhanden — den Plan. Kein anderer README-Inhalt ändert sich.

## Nicht-Ziele

- Kein ADR wird „angenommen" (das tut nur eine benannte Person an einem Prüfpunkt, Plan 4).
- Keine Änderung an Plan, AGENTS.md, Leitplanken, Register, Rechtekonzept, Code.
- Keine neuen Entscheidungen, keine neuen Standardannahmen, keine neuen Registernummern.

## Files allowed

- `docs/adr/0003-…md` bis `docs/adr/0016-…md` (neu, Namen wie oben)
- `docs/adr/0002-demo-betriebsart-in-process.md` (nur neuer Abschnitt am Ende)
- `README.md` (nur Indexzeilen)
- diese Datei (`docs/slices/015-adr-paket.md`, Abschnitt „Bericht")

## Akzeptanzkriterium

1. 14 Dateien mit den festgelegten Namen, jede mit allen Abschnitten aus Ziel 2 und Status „vorgeschlagen".
2. ADR 0012 enthält beide Modelle mit Preis; ADR 0002 enthält die Ergänzung; ADR 0001 unverändert (`git diff` leer).
3. Eine Tabelle im Bericht: ADR → Quellstellen in Plan 3/4 → offene E-Nummern → Annahme-Prüfpunkt.
4. Lesebefund des Reviewers ohne Blocker (Plan 5.2: „Opus-Lesebefund ohne Blocker").
5. `pnpm gates` grün.

## Nachweise

14 Dateien plus Ergänzung 0002, Quellentabelle im Bericht, Lesebefund, `pnpm gates`.

## Arbeitsweise

- Worktree `/home/user/wt/015`, Branch `claude/slice-015-adr`. Absolute Pfade.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`.
- Playwright-Läufe erzeugen die Bilder unter `docs/evidence/` neu: solche Änderungen nicht committen, außer diese Spec
  verlangt das Bild ausdrücklich (`git checkout -- docs/evidence` vor dem Commit). Nicht pushen.

## Bericht

(vom Umsetzer)

## Review findings

(vom Reviewer)
