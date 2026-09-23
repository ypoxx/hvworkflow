# 015 — ADR-Paket 0003–0016 als vorgeschlagen

**Status:** accepted
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
      Nacharbeitsrunde 1 (Opus-Lesebefund: 0 Blocker, 3 major, 12 minor) eingearbeitet, Tabelle unter „Review findings".
Evidence: pnpm gates (Tail unten), EXIT=0. Keine Oberflächenarbeit, kein Screenshot; docs/evidence unverändert.
Open: (1) Lesebefund des Reviewers (Akzeptanzkriterium 4) steht aus. (2) Die README-Zeile zu docs/entscheidungsregister.md zeigt
      bis zum Merge von 014 ins Leere (laut Spec so gewollt). (3) ADR 0012: Der Plan nennt „fünf Anzeigegruppen", aber nicht, welche
      Zustände welche Gruppe bilden; der ADR lässt das offen und es gibt dazu keine Registerzeile. (4) ADR 0015: Plan 4 nennt keinen
      Entscheider; eingetragen ist „Umsetzer" als die Person, die den Prüfpunkt führt (Plan 7). (5) Zwei Konsistenzhinweise für
      den Lesebefund: Rechtekonzept 2.3 nennt „Existenz" als Wirkung der Vertraulichkeitsstufe, die Beta liefert Inhaltsverdeckung
      mit lückenlosen Zählern (ADR 0009, Abgrenzung); Rechtekonzept 2.4 zeigt `refused` als Zustand, ADR 0012 wählt Modell A und
      verweist auf das umbasierte Rechtekonzept (052). (6) Normzitate: § 131 Abs. 3 AktG (0012, aus Recherche Z.24) und Art. 13
      DSGVO (0004, aus Plan 5 Scheibe 029) tragen „ungeprüft (E15)". (7) Nachweis „Register verweist auf jede ADR" hängt an 014.
      (8) Aus der Nacharbeit offen und als Registerzeilen an 014 zu übergeben (keine E-Nummern erfunden): Klarnamenkreis und
      Vier-Augen bei der Auflösung (0009); Zuordnung der fünf Anzeigegruppen (0012); Grund-/Begründungspflicht für
      Verweigerungspfad A (0012, mit E15 an Recht); Mindest-Aggregationsschwelle (0013, E13); dauerhafte Merge- und
      Demo-Build-Regel (0002/0016, E35/E48, Prüfpunkt 1) — bis dahin Übergangsregel des Eigentümers vom 23.09.2026.
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

**`pnpm gates` in `/home/user/wt/015` (Tail, 23.09.2026, Lauf nach Nacharbeitsrunde 1; der erste Lauf vor der
Nacharbeit war ebenfalls grün, EXIT=0):**

```
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  39 passed (39)
packages/domain test:    Start at  10:32:41
packages/domain test:    Duration  2.19s (transform 450ms, setup 0ms, import 913ms, tests 1.97s, environment 0ms)
packages/domain test: Done
apps/web test:  Test Files  3 passed (3)
apps/web test:       Tests  35 passed (35)
apps/web test:    Start at  10:32:44
apps/web test:    Duration  974ms (transform 777ms, setup 0ms, import 961ms, tests 67ms, environment 0ms)
apps/web test: Done
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)
apps/api test:    Start at  10:32:43
apps/api test:    Duration  1.76s (transform 917ms, setup 0ms, import 2.70s, tests 1.47s, environment 0ms)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/wt/015
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

vite v8.2.2 building client environment for production...
transforming...
✓ 1713 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/index-BC8cI4Qz.css                        39.09 kB │ gzip:   8.51 kB
dist/assets/index-CS58249t.js                        525.20 kB │ gzip: 154.17 kB │ map: 2,155.11 kB
(!) Some chunks are larger than 500 kB after minification.
✓ built in 1.08s
EXIT=0
```

## Review findings

Opus-Lesebefund (gegen Recherche, Rechtekonzept, ADR 0001): 0 Blocker, 3 major, 12 minor. Nacharbeitsrunde 1 am
23.09.2026 durch den Architekten; keine neuen Entscheidungen, keine neuen E-Nummern.

| Nr | Schwere | Befund (kurz) | Erledigung |
|---|---|---|---|
| 1 | major | ADR 0012 Kontext bezog die §4-Invariante „keine Verweigerung ohne Grund und Begründung" pauschal auf beide Verweigerungspfade; Modell A verlangt Katalogtreffer und Begründung nur für Verweigerungspfad B | Kontext neu gefasst: Ersteller ≠ Freigeber gilt modellunabhängig; Grund-/Begründungspflicht für Verweigerungspfad A offen, Frage an Recht mit dem Vorabzug vor 044 (E15); E15-Zeile unter „Offene Registerzeilen" ergänzt |
| 2 | major | ADR 0009 zitiert Recherche Z.116 und Rechtekonzept §6, weicht aber ab (Rollenkreis, Vier-Augen, Protokollierung) | Absatz „Abgrenzung zu Recherche Z.116 und Rechtekonzept Abschnitt 6"; `IdentityRevealed` ab 067 in der Entscheidung; engerer Kreis und Vier-Augen nicht im Plan → offen, Entscheider Projektleitung und DSB, „Registerzeile folgt (Übergabe an 014)" |
| 3 | major | ADR 0002 (Ergänzung) vs ADR 0016: Merge und Go für Demo-Builds widersprüchlich; „Regel 11 gewahrt" unqualifiziert | Konflikt in beiden ADRs benannt (Plan 3 „Taktfläche" vs E48/Plan 6.6); Übergangsregel des Eigentümers vom 23.09.2026 aufgenommen (`[skip netlify]` auf jedem Commit inkl. Squash-Merge, Demo-Build nur nach ausdrücklichem Go); dauerhafte Regel offen (E35/E48, Prüfpunkt 1); „Regel 11 gewahrt" entfernt |
| 4 | minor | ADR 0012 „Pfad A/B" kollidiert mit dem Glossar (Antwortpfade A/B/C) | überall „Verweigerungspfad A/B", Hinweis auf die Antwortpfade des Glossars im Kontext |
| 5 | minor | Register-Standards aus Plan 10 innerhalb „Entscheidung" (0007 E22, 0013 E36, 0008 E28, 0004 E38) | 0007, 0013, 0008: nach „Offene Registerzeilen" verschoben, gekennzeichnet „Register-Standard (Plan 10)"; 0004: im Satz als Register-Standard gekennzeichnet (zusammen mit Nr. 12) |
| 6 | minor | Aussagen ohne Planquelle: 0003:50–51, :67; 0005:51, :54–55; 0006:72–73; 0010:40–41; 0011:66–67 (Begründung verdreht); 0014:41; 0015:22–24, :43–44; 0016:9–11, :19–20 | je Stelle gestrichen, mit Quelle versehen oder als „Vorschlag, nicht im Plan" gekennzeichnet; 0011 auf Plan 3 („ohne Umschlag Neuaufbau des Logs") zurückgedreht; 0016: README und Glossar als Lane docs-plan |
| 7 | minor | Entfernen der Übungs-Datenbank (0003, 0009, 0010) vs Rechtekonzept §4 | Abgrenzungssatz an allen drei Stellen: synthetischer Bestand, als Ganzes durch den Plattformbetreiber außerhalb der Anwendung entfernt (Plan 3, B15, 042); §4 schützt den Nachweis einer echten HV |
| 8 | minor | ADR 0013 „unbegrenzt aufbewahrt" | „in der Beta unbegrenzt (keine Löschlogik); Fristen je `retentionClass` offen, E16" |
| 9 | minor | ADR 0013 Mindest-Aggregationsschwelle zitiert, nicht adressiert | Satz im Kontext und Ergänzung der E13-Zeile: offen (Betriebsvereinbarung) |
| 10 | minor | ADR 0012 052-Hinweis ohne die Trennung Empfehlung/Freigabe (Rechtekonzept 2.1/2.4 `answer.approve.legal`, E25) | Rechte-Bullet und Konsequenzen ergänzt; E25-Zeile ergänzt |
| 11 | minor | ADR 0009 Nachweis nennt die Personentabelle nur mit 027 | „Personentabelle als Entität aus 026 (Test „kein displayName in Ereignis-Payloads"), Speicherung in 027" |
| 12 | minor | ADR 0004 TOTP-Geltungsbereich unklar | „Keycloak-Realm aus 088 (Staging, Rückfall E11/E13): Register-Standard (Plan 10, E38) TOTP-Pflicht für Freigabe-, Rechts- und Admin-Rechte" |
| 13 | minor | ADR 0012 fünf Anzeigegruppen ohne Registerzeile | Text beibehalten; „Registerzeile folgt (Übergabe an 014)" in Entscheidung und „Offene Registerzeilen" |
| 14 | minor | Bericht „Open" ohne die 014-Abhängigkeit des Nachweises | „Nachweis ‚Register verweist auf jede ADR' hängt an 014" ergänzt (Punkt 7) |
| 15 | minor | ADR 0014 E22-Anmerkung vermischt das SSE-Ziel | E22 = RPO 0, RTO 15 min, p90 < 300 ms; SSE < 2 s stammt aus B11 |

**Runde 2 — Nachprüfung Opus 5.5** (nur die Nacharbeit, 23.09.2026): Befunde 1–15 alle „erledigt"; keine neue
Entscheidung, keine erfundene Registernummer, kein Widerspruch zum Plan; `pnpm gates` exit 0. Urteil „accept after
minor fixes". Nach E48 mergefähig (kein offener Blocker oder Hauptbefund). Die acht neuen minor bleiben **offen** und
gehen als Kleinänderung in eine Folge-Scheibe (keine zweite Nacharbeitsrunde, Plan 6.3):
- N1 0009:43 — „jede Auflösung protokolliert" geht über 067 hinaus → „Aufdecken per Lookup erzeugt `IdentityRevealed` mit Grund (067)".
- N2 0013:33–35 — „keine personenbezogene Leistungsauswertung" (Plan 4, Zeile 0013) beim Verschieben verloren → zurück in die Entscheidung.
- N3 0003:39–40, 0009:90, 0010:28 — „§4 schützt den Nachweis einer echten HV" ohne Quelle → nur auf Plan 3/042 stützen, Bestätigung durch Recht/DSB (052).
- N4 0014:69 — E22 „im Probefenster" statt „am Dienst".
- N5 0016:94 — „bis dahin" → „bis zur dauerhaften Regel (Prüfpunkt 1)".
- N6 0010:43–44, 0015:24–25 — „Vorschlag (nicht im Plan): <Inhalt>", in 0015 außerhalb der Entscheidung.
- N7 0012:20–22 — „044 macht Katalogtreffer und Begründung nur für Verweigerungspfad B zur Pflicht".
- N8 Spec-Quellentabelle — Zeile 0002 um E48/Plan 6.6, Zeile 0016 um E35 ergänzen.

An 014 (Register) übergeben: zwei neue Registerzeilen ohne Nummer — Pseudonymisierung (engerer Rollenkreis,
Vier-Augen nach Recherche Z.116 / Rechtekonzept §6; Entscheider Projektleitung, DSB) und Zuordnung der fünf
Anzeigegruppen (ADR 0012).
