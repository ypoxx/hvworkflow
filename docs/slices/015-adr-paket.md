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

```
Slice: 015-adr-paket
Done: Vierzehn ADR-Dateien 0003–0016 in docs/adr/ mit den festgelegten Namen, je Kopfzeile (vorgeschlagen · 23.09.2026 ·
      Entscheider aus Plan 3/4/10 · Annahme Prüfpunkt n) und den Abschnitten Kontext · Entscheidung · Konsequenzen · Kosten bei
      Änderung · Verworfene Alternativen · Nachweis · Offene Registerzeilen; ADR 0012 mit Modell A (Standard) und Modell B (2,5 AStd);
      Ergänzung an ADR 0002 als neuer Schlussabschnitt; zwei README-Indexzeilen (docs/adr/ und docs/entscheidungsregister.md).
Evidence: pnpm gates (Tail unten), EXIT=0. Keine Oberflächenarbeit, kein Screenshot; docs/evidence unverändert.
Open: (1) Lesebefund des Reviewers (Akzeptanzkriterium 4) steht aus. (2) Die README-Zeile zu docs/entscheidungsregister.md zeigt
      bis zum Merge von 014 ins Leere (laut Spec so gewollt). (3) ADR 0012: Der Plan nennt „fünf Anzeigegruppen", aber nicht, welche
      Zustände welche Gruppe bilden; der ADR lässt das offen und es gibt dazu keine Registerzeile. (4) ADR 0015: Plan 4 nennt keinen
      Entscheider; eingetragen ist „Umsetzer" als die Person, die den Prüfpunkt führt (Plan 7). (5) Zwei Konsistenzhinweise für
      den Lesebefund: Rechtekonzept 2.3 nennt „Existenz" als Wirkung der Vertraulichkeitsstufe, die Beta liefert Inhaltsverdeckung
      mit lückenlosen Zählern (ADR 0009, Abgrenzung); Rechtekonzept 2.4 zeigt `refused` als Zustand, ADR 0012 wählt Modell A und
      verweist auf das umbasierte Rechtekonzept (052). (6) Normzitate: § 131 Abs. 3 AktG (0012, aus Recherche Z.24) und Art. 13
      DSGVO (0004, aus Plan 5 Scheibe 029) tragen „ungeprüft (E15)".
Touched: docs/adr/0003-persistenz-ereignislog.md, 0004-identitaet-oidc-bff.md, 0005-antwortformat.md,
      0006-buehne-je-geraet-und-antwortbuendel.md, 0007-deployment-hosting-umgebungen.md, 0008-integrationen.md,
      0009-aufbewahrung-vertraulichkeit-personentabelle.md, 0010-pilotmodus-uebungsbetrieb.md, 0011-ereignis-umschlag-v2.md,
      0012-zustandsmodell-und-verweigerung.md, 0013-zwei-protokollebenen.md, 0014-realtime-sse.md, 0015-vertragsversionierung.md,
      0016-agenten-arbeitsmodell.md (neu); docs/adr/0002-demo-betriebsart-in-process.md (nur neuer Abschnitt am Ende);
      README.md (zwei Indexzeilen); docs/slices/015-adr-paket.md (dieser Abschnitt). ADR 0001: git diff leer.
```

**Quellentabelle (Akzeptanzkriterium 3):**

| ADR | Quellstellen in Plan 3 / Plan 4 | Offene E-Nummern | Annahme-Prüfpunkt |
|---|---|---|---|
| 0002 (Ergänzung) | Plan 3 „Taktfläche für Kleinänderungen"; Plan 4 Zeile 0002; B17 | E35 | 1 (Ergänzung), Eigentümer |
| 0003 Persistenz | Plan 3 „Persistenzform des Ereignislogs", „Hosting-Plattform" (Datenmigration); Plan 4 Zeile 0003; B3; Leitplanken 1.3 | E27, E22, E10, E16 | 3 |
| 0004 Identität | Plan 3 „Identity Provider und Client-Typ", „Rollenzuweisungspfad"; Plan 4 Zeile 0004, Baustein 2; B1 | E11, E8, E13/E10b, E14, E38, E24 | 3 |
| 0005 Antwortformat | Plan 3 „Formatierungsumfang"; Plan 4 Zeile 0005 | E6, E21 | 5 |
| 0006 Bühne, Antwortbündel | Plan 3 „Zusammenstellung der Antwortrunde", „Sieht das Podium nur eigene Fragen"; Plan 4 Zeile 0006, Baustein 5; B7, B9 | E2, E7, E33, E41 | 5 |
| 0007 Deployment | Plan 3 „Hosting-Plattform", „Taktfläche für Kleinänderungen"; Plan 4 Zeile 0007, „Drei Umgebungen"; B10 | E10, E10b, E39, E22, E27, E35 | 3 |
| 0008 Integrationen | Plan 3 „Exportpfad des Transkriptionstools", „KI-Funktionen und Anbieter"; Plan 4 Zeile 0008, „Nachbarsysteme" | E3a, E3b, E18, E28 | 5 |
| 0009 Aufbewahrung, Vertraulichkeit | Plan 3 „Aufbewahrung, Löschung, Krypto-Umschlag", „Vertraulichkeitsstufe und geschützte Fragen", „Pseudonymisierung gegenüber Fachbereichen", „Notiz-/Rückfragefeld"; Plan 4 Zeile 0009, Baustein 4 | E16, E17, E14, E4, E29, E40 | 4, ergänzt nach 073 |
| 0010 Pilotmodus | Plan 3 „Pilotmodus", „Taktfläche" (Freeze); Plan 4 Zeile 0010, „Drei Umgebungen"; B15 | E12, E10b, E13, E49 | 3 |
| 0011 Ereignis-Umschlag v2 | Plan 3 „Jahrgang und Tagesordnung", „Persistenzform", „Aufbewahrung"; Plan 4 Zeile 0011, Baustein 1; B3, B4, B9 | E16 (zweiter Rechtsträger: B-Liste, keine E-Nummer) | 3 |
| 0012 Zustandsmodell | Plan 3 „Zustandsmodell und Verweigerung", „Letztverantwortung Freigabe und Rechtstor"; Plan 4 Zeile 0012; B6; Risikozeile „Zustandsautomat wächst über 15 Zustände" | E15, E25, E30, E37, E40 | 4, Umsetzer und Recht |
| 0013 Zwei Protokollebenen | Plan 3 „Betriebsrat und DSFA", „Vertraulichkeitsstufe" (`event.read.personal`); Plan 4 Zeile 0013; B5 | E13, E14, E16, E36 | 4 |
| 0014 Realtime | Plan 3 „Realtime-Kanal", „Benachrichtigungen und Alarme"; Plan 4 Zeile 0014, Baustein 3; B10, B11 | E22, E33 | 3 |
| 0015 Vertragsversionierung | Plan 4 Zeile 0015; Plan 3 „Exportpfad des Transkriptionstools" (zwei Zyklen, 1 AStd je Zyklus), „Jahrgang und Tagesordnung" (Alias bis 0.5) | keine eigene; abhängig E3a, E20 | 1 |
| 0016 Agenten-Arbeitsmodell | Plan 4 Zeile 0016; Plan 10 E44, E47, E48; Plan 8 (berechneter Kalender) | E48, E44, E47 | 1 |

**`pnpm gates` in `/home/user/wt/015` (Tail, 23.09.2026):**

```
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  39 passed (39)
apps/web test:  Test Files  3 passed (3)
apps/web test:       Tests  35 passed (35)
apps/web test:    Start at  10:08:23
apps/web test:    Duration  699ms (transform 396ms, setup 0ms, import 560ms, tests 88ms, environment 0ms)
apps/web test: Done
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)
apps/api test:    Start at  10:08:23
apps/api test:    Duration  1.24s (transform 633ms, setup 0ms, import 1.75s, tests 866ms, environment 0ms)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/wt/015
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/wt/015/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1713 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/index-BC8cI4Qz.css                        39.09 kB │ gzip:   8.51 kB
dist/assets/index-CS58249t.js                        525.20 kB │ gzip: 154.17 kB │ map: 2,155.11 kB
(!) Some chunks are larger than 500 kB after minification.
✓ built in 1.15s
EXIT=0
```

## Review findings

(vom Reviewer)
