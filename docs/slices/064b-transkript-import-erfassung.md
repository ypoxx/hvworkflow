# Scheibe 064b — Transkript-Ingest, Teil 2: Import und Übernahme in der Erfassung, Demoszenario

**Status:** spec (03.10.2026; gelesen auf `2fc3153`; Teil 2 der geteilten Scheibe 064, Zuschnitt in Spec 064a)
**Risikoklasse:** hoch · 2 AStd · frühestens nach dem Merge von 064a; für die Freigabe-Demo (Plan §11 Punkt 2, Register E57); den Tag legt der Orchestrator fest · Lanes: web-capture; e2e (nur die eigene Datei und eine Zeile in `playwright.config.ts`); docs-plan (nur Glossarzeilen); docs-integration (nur ein Abschnitt)
**Rolle:** implementierer-oberflaeche. Review in frischem Kontext mit den Perspektiven **Security** (fremde Datei im Browser, Anzeige feindlichen Wortlauts) und **Oberfläche/Barrierefreiheit** (6.9). Der schlankere Ablauf aus E57 gilt nicht: Die Klasse ist hoch (Partnereingabe, Leitplanken §4 „externer Datentransfer“; bei unklarer Zuordnung gilt hoch). Lesebefund der Spec vor dem Bau; nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue. Angewandt und in der Oberfläche sichtbar: R-ING-01..05 (aus 064a), R-MTG-03, R-PERM-01, R-PERM-02. Dazu AGENTS.md R2, R4, R5, R9, R10, R11, R12
**Quellen-IDs:** Spec 064a (Entscheidungen 6, 7, 9; „Hinweise an Folgescheiben: 064b“); `docs/produktplan-beta.md` Eintrag 064 (Nachweis „Playwright Import → Redebeitrag → Einzelfragen“), §11 Punkt 2; ADR 0002 (Demo im Browser, gemeinsame e2e-Suite); ADR 0008; Spec 080b (Korpus eine Quelle); Spec 090 (Eingaben je Akteur); Spec 013 (Tastaturpfad); takt-032 (Schreibsperre der Erfassung); `docs/glossar.md`; Bedrohungsmodell T-G3-T-01
**Depends on:** 064a (gemergt)
**Perspektive:** Security, Oberfläche · **Glossar: neue Begriffe:** ja — „Transkriptabschnitt“ / „Transcript segment“ (`SpeechSegment`), „übernehmen“ / „adopt“ (`segmentIds`), „Transkript importieren“ / „Import transcript“

## Ziel

Die Erfassung sieht gelieferte Transkriptabschnitte, spielt eine Transkriptdatei ein und übernimmt ausgewählte
Abschnitte in einen Redebeitrag. Ab dort läuft die gewohnte Atomisierung. Alles geht über `HvApi`; die Demo im Browser
und der Dienst zeigen dasselbe (ADR 0002).

### Entscheidungen vor Bau

1. **Ort.** Ein einklappbarer Bereich „Transkript“ oben in der linken Hälfte der Erfassung (über dem Redebeitrag), neue
   Komponente `TranscriptPanel.tsx`. Eingeklappt zeigt er die Zahl unbestätigter Abschnitte, ausgeklappt die Liste.
   Keine neue Route, keine Zeile im Feature-Register.
2. **Liste.** `api.listSpeechSegments({ status: 'unconfirmed' })`; Umschalter „auch übernommene zeigen“ lädt ohne
   Filter. Je Abschnitt: Uhrzeit Anfang–Ende (Europe/Berlin, wie `timeOf` in `ContributionPane.tsx`), Sprecherhinweis
   als Nummer und Name aus der schon geladenen Wortmeldeliste (nur wenn die Wortmeldung dort steht; sonst
   „ohne Zuordnung“), Quelle als Abzeichen, Wortlaut. Der Wortlaut steht in einem eigenen Element mit `dir="auto"` und
   `unicode-bidi: isolate`, nur als Text (kein `dangerouslySetInnerHTML`). Neu geladen wird bei `useApiVersion()`.
3. **Rechte als Daten (R4, R5).** Der Knopf „Transkript importieren“ erscheint genau dann, wenn die Listen-`_actions`
   `ingest.write` enthalten. Ein Auswahlkästchen je Abschnitt erscheint genau dann, wenn dessen `_actions`
   `contribution.capture` enthalten. Die Oberfläche liest keinen Status und vergleicht keinen Rollennamen. Antwortet die
   Liste 403, bleibt der Bereich weg (Rollen ohne `contribution.read`).
4. **Übernahme.** Mindestens ein ausgewählter Abschnitt → „In Redebeitrag übernehmen“ öffnet `AdoptDialog.tsx`:
   - Textfeld, vorbelegt mit den Wortlauten in Zeitfolge, getrennt durch eine Leerzeile; die Person darf Hörfehler
     berichtigen;
   - Wortmeldung, vorbelegt mit dem gemeinsamen Sprecherhinweis der Auswahl, sonst mit der Wortmeldung des Tisches;
     die Person bestätigt oder wählt um;
   - Feld „Grund der Nacherfassung“ nur, wenn die HV `debateClosedAt` trägt (Anzeige einer Tatsache; ob der Grund
     reicht, entscheidet R-MTG-03 im Kern);
   - Bestätigen ruft `api.captureMeetingContribution({ speakerId, text, source: 'transcript', segmentIds, … })` mit
     `If-Match` der Wortmeldung und einem `Idempotency-Key` je Absicht (takt-032, Doppelklickschutz). Danach öffnet der
     Tisch die Wortmeldung und den neuen Redebeitrag; die Atomisierung ist sofort möglich.
   - Ein 409 R-ING-04 („schon übernommen“, etwa von einem zweiten Platz) zeigt den Problemtext und lädt die Liste neu.
5. **Import-Dialog** (`ImportDialog.tsx`), drei Wege zu demselben Ablauf:
   - Datei wählen (`accept=".json,application/json"`);
   - JSON in ein Textfeld einfügen (Zwischenablage);
   - **„Beispieldatei verwenden“, nur in der Demo-Betriebsart** (`DEMO_MODE` aus `apps/web/src/api/mode.ts`): baut den
     Body mit `transcriptSampleBody(new Date())` aus `@hv/domain` (eine Quelle mit Seed und
     `docs/integration/beispiele/transkript-beispiel.json`, 080b). In der HTTP-Betriebsart fehlt der Knopf: Ein Pilot mit
     echten Daten soll keine erfundenen Abschnitte per Klick bekommen.
   - Vor dem Senden zeigt der Dialog eine Vorschau (Zahl der Abschnitte, Zeitraum, Fehler der Vorprüfung). „Einspielen“
     sendet; das Ergebnis lautet „N neu, M bereits vorhanden“.
6. **Datei-Adapter** (`transcriptImport.ts`, rein, ohne React), das ist der erste Adapter nach E3b:
   - nimmt nur das kanonische Format `{ "segments": [ … ] }`, dasselbe wie der Endpunkt (kein Fremdformat, ADR 0001
     Grenze 3; WebVTT folgt nach E3b, Folgeliste 064a);
   - lehnt Dateien über 5 MiB ab, bevor er sie liest (`File.size`), und Dateien mit mehr als 5 000 Abschnitten nach dem
     Parsen;
   - prüft vor dem Senden nur die Form (Objekt, Feldtypen, Pflichtfelder), damit die Person Fehler mit Abschnittsnummer
     sieht; maßgeblich bleibt die Prüfung im Kern und im Dienst;
   - zerlegt in Stapel von höchstens 100 Abschnitten und höchstens 200 000 Byte UTF-8 (`TextEncoder`), damit das
     Body-Limit von 262 144 Byte nie greift;
   - sendet die Stapel nacheinander über `api.ingestSpeechSegments`, hält beim ersten Fehler an und meldet die Nummer
     des betroffenen Abschnitts in der Datei (Stapelversatz + Index aus `detail`). Schon gesendete Stapel bleiben
     gespeichert; der Dialog sagt, dass ein erneuter Import sicher ist (Idempotenz je `segmentId`).
7. **Texte** über das i18n-Modul der Erfassung (`capture.de.ts`, `capture.en.ts`), DE und en-US, keine Literale.
   Problemtexte über das vorhandene `showProblem`.
8. **Tastatur und Barrierefreiheit:** Bereich als `region` mit Überschrift; Liste mit Kästchen und Beschriftung je
   Abschnitt (Uhrzeit und Anfang des Wortlauts); Dialoge über die vorhandene `Dialog`-Komponente (Fokusfalle, Escape);
   Ergebnis des Imports als höfliche Live-Meldung. Kein neues Tastenkürzel.

## Demoszenario (Freigabe-Demo, Plan §11 Punkt 2)

**A. Netlify-Demo (Kern im Browser, ADR 0002), ohne Server und ohne Zugangsdaten.** Die Schnittstelle ist hier der
In-Process-Kern hinter `HvApi`, der den Vertrag 1:1 umsetzt; der Import ruft dieselbe Operation `ingestSpeechSegments`
wie der Dienst.

1. Demo öffnen, Rollenwechsler „Erfassung“, Seite Erfassung.
2. Bereich „Transkript“: **6 unbestätigte Abschnitte** aus dem Seed (Quelle `demo-transkript`). Drei tragen den Hinweis
   auf die Person am Mikrofon, drei sind ohne Zuordnung.
3. „Transkript importieren“ → „Beispieldatei verwenden“ → Vorschau „5 Abschnitte“ → „Einspielen“ → „5 neu, 0 bereits
   vorhanden“. Die Liste zeigt 11.
4. Noch einmal einspielen → „0 neu, 5 bereits vorhanden“. Die Idempotenz ist sichtbar; die Liste bleibt bei 11.
5. Die 5 Beispielabschnitte auswählen → „In Redebeitrag übernehmen“ → Wortmeldung wählen → bestätigen. Der Redebeitrag
   erscheint mit dem Quellsymbol „Transkript“; die 5 Abschnitte sind übernommen und aus der Standardansicht verschwunden.
6. Im Wortlaut zwei Fragen markieren (gewohnte Atomisierung) → zwei Einzelfragen rechts, Restabdeckung sinkt.
7. Rollenwechsler „Koordination“: die neuen Einzelfragen stehen zur Klassifizierung bereit.

**B. Entwickler, lokal gegen den Dienst** (Leitfaden `docs/integration/transkript.md`, Schnellstart):

1. `pnpm install`, dann `pnpm --filter @hv/api dev` (Demo-Modus, Port 8787, Seed mit den 6 Abschnitten).
2. Laufende HV holen: `curl -s 'http://localhost:8787/v1/meetings?status=running' -H 'X-Actor: u-cap-1:capture'`.
3. Beispieldatei einspielen: `curl -s -X POST "http://localhost:8787/v1/meetings/$HV/speech-segments" -H 'X-Actor: u-cap-1:capture' -H 'Content-Type: application/json' --data @docs/integration/beispiele/transkript-beispiel.json` → `"created": 5`.
4. Dasselbe noch einmal → `"duplicates": 5`; mit geändertem Wortlaut → `409` mit `ruleId` `R-ING-01`; mit
   `X-Actor: o-1:observer` → `403`.
5. Liste lesen: `curl -s "http://localhost:8787/v1/meetings/$HV/speech-segments?status=unconfirmed" -H 'X-Actor: u-cap-1:capture'` → 11 Abschnitte.

Die Oberfläche gegen den lokalen Dienst braucht eine Anmeldung (HTTP-Betriebsart ohne `X-Actor`); sie läuft im CI-Job
`e2e-http` und später mit dem lokalen Paket aus 037. Der Leitfaden sagt das, statt einen ungeprüften Weg zu nennen.

**C. Was die Demo nicht zeigt:** keinen Push eines echten Werkzeugs (E3b), keine Webhooks (065), keinen Systemakteur.

## Nicht-Ziele

- Kein Kern-, Dienst- oder Vertragscode (064a). Ist dort etwas falsch oder fehlt etwas: anhalten und melden.
- Kein Fremdformat (WebVTT, SRT, Werkzeugexport), kein Zerlegen von Fließtext in Abschnitte.
- Kein Verwerfen einzelner Abschnitte, kein Bearbeiten eines Abschnitts (unveränderlich).
- Keine Änderung am Erfassen über den Alias, an der Atomisierung, an `SuggestDialog`.
- Kein Beispielknopf in der HTTP-Betriebsart.
- Kein Netlify-Build: Screenshots entstehen lokal aus dem Projekt `in-process`; ein Demo-Build braucht das Go des
  Eigentümers (R11, ADR 0002 Ergänzung).

## Files allowed

Oberfläche der Erfassung:

- `apps/web/src/features/capture/TranscriptPanel.tsx` (neu)
- `apps/web/src/features/capture/TranscriptPanel.test.tsx` (neu)
- `apps/web/src/features/capture/ImportDialog.tsx` (neu)
- `apps/web/src/features/capture/AdoptDialog.tsx` (neu)
- `apps/web/src/features/capture/transcriptImport.ts` (neu)
- `apps/web/src/features/capture/transcriptImport.test.ts` (neu)
- `apps/web/src/features/capture/Page.tsx` (nur Einbau des Bereichs und Öffnen des neuen Redebeitrags nach der Übernahme)
- `apps/web/src/features/capture/useCapture.ts` (nur Hilfen für den Übernahme-Schreibvorgang, falls `Page.tsx` sonst doppelt)
- `apps/web/src/i18n/capture.de.ts` und `apps/web/src/i18n/capture.en.ts` (nur neue Schlüssel)
- `apps/web/src/i18n/parity.test.ts` (nur Zahl und Kommentar)

e2e:

- `apps/web/e2e/064b-transkript.spec.ts` (neu)
- `apps/web/playwright.config.ts` (nur `064b-transkript.spec.ts` in `SHARED_SPECS`)
- `apps/web/e2e/support/e2e-texts.ts` (nur neue Einträge, falls die Suite Texte dort bündelt)

Dokumente und Nachweise:

- `docs/glossar.md` (nur die drei Zeilen aus dem Kopf)
- `docs/evidence/064b-*.png`
- `docs/integration/transkript.md` (nur Abschnitt „In der Oberfläche“ mit Verweis auf die Screenshots)
- `docs/folgeliste.md` (nur neue nicht blockierende Befunde)
- `docs/slices/064b-transkript-import-erfassung.md` (diese Spec: Bericht, Review findings)
- `docs/adr/0002-demo-betriebsart-in-process.md` (nur durch Architekt oder Orchestrator mit dem Merge: `064b-transkript.spec.ts` in die Liste „In beiden Projekten“)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/**`, `apps/api/**`, `apps/web/src/api/**`, `apps/web/src/components/**`, `apps/web/src/app/**`,
`scripts/**`, andere e2e-Dateien. Dieser Abschnitt steht bewusst außerhalb von „Files allowed“, damit `slice-scope` die
Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. **064a gemergt?** `HvApi` hat `ingestSpeechSegments` und `listSpeechSegments`; `transcriptSampleBody` ist aus
   `@hv/domain` exportiert; die Beispieldatei liegt unter `docs/integration/beispiele/`. Sonst anhalten.
2. **HTTP-Bootstrap:** Legt der Harness des Projekts `http` (`scripts/e2e-http-031.mjs`, Schritt 3) den Korpus über
   `seedDemo` an, also mit den 6 Abschnitten? Wenn nein, läuft P1 nur im Projekt `in-process`; P2–P5 importieren zuerst
   und laufen in beiden. Ergebnis in den Bericht.
3. **Wortmeldung für die Übernahme:** Welche Wortmeldung der Demo eignet sich (Status `finished`, nicht gesperrt nach
   takt-032)? Im Bericht nennen.
4. **Dialog:** Trägt `Dialog.tsx` Fokusfalle und Escape? Wenn nein, ist das ein Befund an web-components, kein Umbau hier.
5. Weichen Zeilenangaben ab: melden.

## Tests zuerst (rot, dann grün)

**Einheit** (`transcriptImport.test.ts`, `TranscriptPanel.test.tsx`):

- U1. Gültige Datei → ein Stapel mit allen Abschnitten; ungültiges JSON, Wurzel ohne `segments`, Abschnitt ohne
  `segmentId`, 5 001 Abschnitte → Fehler mit Abschnittsnummer, kein Aufruf von `HvApi`.
- U2. Datei über 5 MiB → abgelehnt, ohne `text()` zu lesen.
- U3. Zerlegung: 250 Abschnitte → Stapel 100/100/50; 100 Abschnitte mit je 3 000 Zeichen „ä“ → mehrere Stapel, keiner
  über 200 000 Byte UTF-8.
- U4. Senden: zweiter Stapel antwortet 422 mit Index 7 im `detail` → Ablauf hält an, gemeldet wird Abschnitt 107; die
  Summen enthalten nur den ersten Stapel.
- U5. Bereich: Wortlaut `<img src=x onerror="window.__pwned=1">` erscheint als Text, kein `img`-Element; Element mit
  `dir="auto"`.
- U6. Bereich: Listen-`_actions` ohne `ingest.write` → kein Import-Knopf; Abschnitts-`_actions` ohne
  `contribution.capture` → kein Kästchen.

**Playwright** (`064b-transkript.spec.ts`, Rollen über `asRole`):

- P1. (beide Projekte, siehe Vor-dem-Bau-Punkt 2) Erfassung sieht 6 unbestätigte Abschnitte, drei mit Sprecherhinweis.
- P2. (beide) Import über das Dateifeld mit `docs/integration/beispiele/transkript-beispiel.json` → „5 neu, 0 bereits
  vorhanden“.
- P3. (beide) derselbe Import erneut → „0 neu, 5 bereits vorhanden“; die Zahl der Abschnitte bleibt.
- P4. (beide) die 5 Beispielabschnitte auswählen, übernehmen, Wortmeldung bestätigen → Redebeitrag mit Quelle
  „Transkript“ auf dem Tisch; die 5 Abschnitte stehen nicht mehr unter „unbestätigt“.
- P5. (beide) zwei Fragen im übernommenen Wortlaut markieren → zwei Einzelfragen; als Koordination stehen sie zur
  Klassifizierung bereit (Planbeleg „Import → Redebeitrag → Einzelfragen“).
- P6. „Beispieldatei verwenden“: in `in-process` vorhanden und führt zu „5 neu“; in `http` fehlt der Knopf.
- P7. (beide) Versammlungsbüro sieht den Bereich, aber keinen Import-Knopf und keine Kästchen; Fachbereich und
  Beobachter sehen den Bereich nicht.
- P8. (`in-process`) feindliche Datei mit HTML im Wortlaut und U+202E → Anzeige als Text, `window.__pwned` bleibt
  `undefined`; ungültiges JSON → Fehlermeldung, Liste unverändert; Datei mit 5 MiB + 1 Byte → abgelehnt.
- P9. (`in-process`) Sprache en-US: Bereich, Dialoge und Ergebnis englisch.
- P10. (`in-process`) axe auf der Erfassung mit offenem Bereich, offenem Import- und Übernahme-Dialog: keine Meldung
  „moderate“ oder höher.

**Mutationsproben** (im Bericht mit dem Ergebnis „rot“ belegt, danach zurückgesetzt):

- M1. Kästchen ohne Blick auf `_actions` → U6 und P7 rot.
- M2. Wortlaut über `dangerouslySetInnerHTML` → U5 und P8 rot.
- M3. Zerlegung ohne Bytegrenze → U3 rot.
- M4. Beispielknopf ohne `DEMO_MODE` → P6 im Projekt `http` rot.

## Akzeptanzkriterium

1. U1–U6 und P1–P10 grün in den Projekten, die oben stehen; M1–M4 rot belegt.
2. Screenshots in `docs/evidence/`: `064b-abschnitte-de.png` (Bereich mit 6 Abschnitten), `064b-import-ergebnis-de.png`
   („5 neu“), `064b-import-wiederholt-de.png` („5 bereits vorhanden“), `064b-uebernahme-de.png` (Dialog),
   `064b-redebeitrag-fragen-de.png` (Redebeitrag mit Einzelfragen), `064b-abschnitte-en.png`; nur synthetische Daten.
3. Das Demoszenario A läuft im Projekt `in-process` Schritt für Schritt (P1–P6 decken es ab); der Bericht ordnet jedem
   Schritt den Test zu.
4. `git diff` gegen die Merge-Basis zeigt nur Dateien aus „Files allowed“.
5. `pnpm gates` grün (mit `i18n-literals` und `vocabulary`), einschließlich `slice-scope` auf `claude/slice-064b-…`; der
   Schluss der Ausgabe steht einmal im Bericht. Läuft ein Test nur im CI-Job `e2e-http`, nennt der Bericht Artefaktname,
   Run-id, Artefakt-id und Digest (E56).

## Nachweise

- Screenshots aus Akzeptanzkriterium 2.
- Playwright-Ausgabe beider Projekte (Auszug) oder CI-Artefakt nach E56.
- Ergebnis der Mutationsproben.
- Schluss von `pnpm gates` mit Commit-Hash.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch

Ausgelöst:
- [ ] Fachregel, Status (keine neue Regel; Anzeige von R-ING-*)
- [ ] Vertrag, Ereignis
- [x] personenbezogene Daten (Wortlaut im Browser, Anzeige)
- [x] Nachbarsystem (Datei aus einem Fremdsystem, erster Adapter nach E3b)
- [x] Oberfläche, Barrierefreiheit
- [x] Dokumentation, Schulung (Glossar, Leitfaden-Abschnitt, Demoszenario)

Perspektiven: Security, Oberfläche · Nachweise: U1–U6, P1–P10, Screenshots · Offene Entscheidung: E3b (Standard)

## Wirkung und Risiko

- **Feindliche Datei:** Die Datei kommt aus einem Fremdsystem oder von einem Datenträger. Der Adapter liest sie nur als
  JSON, begrenzt Größe und Menge, zeigt Wortlaut nur als Text und isoliert die Schreibrichtung. Die Prüfung im Kern
  (064a, K8) bleibt maßgeblich, auch in der Demo.
- **Zwei Plätze übernehmen gleichzeitig:** Der zweite erhält 409 R-ING-04 und eine neu geladene Liste; kein doppelter
  Redebeitrag.
- **Teilimport nach Fehler:** sichtbar benannt; Wiederholung sicher.
- **Rechte:** ausschließlich `_actions`; kein Rollenname (Tor `vocabulary` und `role-literals`).
- **Datenschutz:** keine Wortlaute in Logs oder Fehlermeldungen des Clients; Screenshots nur mit Seed und Beispieldatei.
- **Rückweg:** Bereich und Dialoge sind neue Dateien; der Rückbau entfernt sie und eine Zeile in `Page.tsx`.

## Sicherheits-Checkliste (Antworten für den Reviewer)

1. `grep -n "dangerouslySetInnerHTML" apps/web/src/features/capture` ist leer.
2. Import-Knopf und Kästchen hängen nur an `_actions` (U6, P7).
3. Der Beispielknopf hängt an `DEMO_MODE` (P6).
4. Größen- und Mengengrenzen greifen vor dem Lesen bzw. vor dem Senden (U2, U3).
5. Kein Wortlaut in `console.*`.

## Offene Eigentümerfragen

Keine eigene. Es gelten Eigentümerfragen 1 und 2 aus 064a (Bau auf Standard, Zuschnitt und Budget).

## Hinweise an Folgescheiben

- **Formatadapter nach E3b:** setzt in `transcriptImport.ts` vor dem kanonischen Format an (Fremdformat → kanonisches
  JSON) und nutzt dieselbe Zerlegung und denselben Sendeablauf.
- **062 (Kontexthilfe):** Hilfeschlüssel für den Bereich „Transkript“.
- **075 (Dokumentationssatz):** übernimmt `docs/integration/transkript.md` in den Integrationsteil.

## Bericht (nach Bau ausfüllen)

```
Slice: 064b-transkript-import-erfassung
Done:
Evidence:
Open:
Touched:
```

**Vor dem Bau prüfen (Ergebnisse).**
1.
2.
3.
4.
5.

**Demoszenario A: Schritt → Test.**

**Mutationsproben (Ergebnis).**

**`pnpm gates` (Schluss, Commit):**

```
```

## Review findings
