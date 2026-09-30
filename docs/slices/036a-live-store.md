# Scheibe 036a — Inkrementeller Client-Zustand, Teil 1: gepufferter Lesezugriff hinter HvApi

**Status:** spec (überarbeitet nach dem Lesebefund vom 30.09.2026 zu `9f2560c`; Teil 1 der geteilten Scheibe 036)
**Risikoklasse:** hoch · 1,5 AStd · 29.10.2026 (W5) · Lanes: web-api
**Rolle:** web-implementer; Review in frischem Kontext mit Perspektive Security (Daten je Akteur) und Nebenläufigkeit/Lesezustand (010c, 010d, takt-030, takt-032); Lesebefund der Spec vor dem Bau; Sicherheits-Checkliste des Reviewers (Abschnitt unten) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue fachliche Regel; R-PERM-04 (035a) wird nur konsumiert; AGENTS.md R2, R4, R6, R10, R12
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/036 (am 30.09.2026 vom Orchestrator in 036a/036b und takt-038 geteilt); ADR 0014, ADR 0002; Scheiben 035a, 030, 010c, 010d, takt-030, takt-032, takt-033b; Lesebefund zu Spec 036 (Opus, 30.09.2026: N1–N4, N7, m1, m2, m3, m7); Bedrohungsmodell T-G1-I-08, T-G1-D-03
**Depends on:** 035a (Voraussetzung: der Bau von 035a, Spec #96, ist gemergt, bevor dieser Bau beginnt; liefert `HvApi.subscribe` mit `change`, `EVENT_TOPICS`, `EVENT_SUBJECTS`); 030, takt-030, takt-032, takt-033b (im Code auf `59ef4fd`)
**Perspektive:** Security (Daten je Akteur), Nebenläufigkeit, Betrieb · **Glossar: neue Begriffe:** nein

## Teilung und Zuschnitt

Scheibe 036 aus dem Plan ist geteilt:

- **036a (diese Spec):** gepufferter Lesezugriff (`liveStore`) über beiden Adaptern, Invalidierung aus
  `subscribe`/`change`, Demo, Rückfall-Invalidierung beim 30-s-Takt. Kein Strom im HTTP-Adapter.
- **036b** (`docs/slices/036b-strom-client.md`): Strom-Client im HTTP-Adapter, Verbindungszustand und Anzeige, e2e H11/H12.
- **takt-038** (`docs/slices/takt-038-historie-paginierung.md`): Historie paginiert.

## Warum hoch (Hochstufung durch den Orchestrator, N1)

- **Daten je Akteur im Client.** Der Puffer hält Antworten, deren Inhalt von Rolle, Fachbereich und Person abhängt:
  Entwürfe, Identitäten, `_actions`. Ein Fehler im Schlüssel oder beim Leeren zeigt einem Akteur die Daten eines anderen
  (010d, SG1, SG3; im Demo-Modus mit Rollenumschalter besonders nahe). Das ist eine Rechtewirkung im Sinne von
  Leitplanken §4, auch wenn der Dienst weiter entscheidet.
- **Sitzungsentzug.** Nach 401, Abmelden und Rechteverlust darf der Puffer nichts mehr ausliefern.

Die Plan-Klasse „mittel“ wird damit hochgestuft.

## Befund (Ist-Stand, gelesen auf `59ef4fd`)

- `useApiVersion()` liefert eine Zahl und zählt bei jedem Hörer-Aufruf von `api.subscribe` und bei echtem Akteurwechsel
  (takt-033b). Jede eingehängte Ansicht lädt bei jeder Zählung **alle** ihre Daten neu.
- HTTP-Adapter: 30-s-Takt ruft die Hörer mit `[]`. `write` ruft nach eigenem 2xx die Hörer, nachdem `writeEtag` gesetzt
  ist (takt-030). Ein lokal abgelehntes Schreiben (ohne CSRF-Token, `updateSpeaker` mit `reason`) rejectet ohne Anfrage;
  von außen ist es nicht von einer Serverablehnung zu unterscheiden.
- Demo-Adapter: `subscribe` meldet synchron, ab 035a mit `change`.
- `readStableSpeakerList` (`apps/web/src/features/speakers/useSpeakers.ts:50-60`) liest `getMeeting` →
  `listSpeakers` → `getMeeting` und nimmt die Liste nur bei gleicher `speakerListVersion`. Mit einem Puffer könnte ein
  frisches `getMeeting` (neue Version) neben einer gepufferten alten Liste stehen. Dann würde die Seite alte Zeilen mit
  neuer Version schreiben, und der Dienst akzeptierte ein Umsortieren auf veraltetem Stand (Lesebefund N3).
- `Claim.expiresAt` (`packages/domain/src/types.ts:228-233`): Ein Claim läuft durch Zeit ab, ohne Ereignis (Lesebefund N7).
- takt-032 verlässt sich darauf, dass eine nach der Antwort eines eigenen Schreibens angeforderte Liste mindestens so neu
  ist wie diese Antwort. 010c/010d verlassen sich auf asynchrone Antworten und Ladeschlüssel je Akteur.
- Eine Web-Zeitquelle aus 032 (`apps/web/src/time.ts`) gibt es auf `59ef4fd` noch nicht.

## Ziel und Entscheidungen vor Bau

Nach dem ersten Laden holt die Oberfläche je Änderung nur die betroffenen Lesezugriffe, höchstens einmal je Stapel. Kein
Akteur sieht je eine gepufferte Antwort eines anderen. Signatur von `useApiVersion` und die Aufrufer bleiben unverändert.

1. **Hülle `createLiveStore(adapter, options): HvApi & LiveStoreControl`** in `apps/web/src/api/liveStore.ts`, über
   **beiden** Adaptern (`index.ts`, ADR 0002).
   - Gepuffert werden nur **erfolgreiche** Antworten lesender Methoden.
   - Schlüssel = **struktureller Akteurschlüssel** (alle Felder des aktuellen `Actor`, dieselbe Feldliste wie
     `actorChanged`) + Methode + Argumente (N2).
   - Ein gepufferter Eintrag geht immer als neues, **asynchron** aufgelöstes Promise zurück (010c); die Objekte sind tief
     eingefroren.
   - Fehlerantworten werden nie gepuffert. Höchstens 200 Einträge, älteste zuerst verworfen.
   - Schreibende Methoden, `lastWriteEtag`, `seedDemo` und `listEvents` werden durchgereicht.
   - `LiveStoreControl` bietet `clear()` für 036b (Stromende) und `onStreamMessage(...)`.
2. **Themen → Lesezugriffe als Daten (m7).**
   `READ_TOPICS = {...} satisfies Record<Exclude<ReadMethodName, 'listEvents'>, readonly StreamTopic[]>`, vollständig
   durch den Typ; `listEvents` ist ausdrücklich ausgenommen (Cursor-Lesezugriff, nie gepuffert).

   | Thema | Lesezugriffe |
   |---|---|
   | `meeting` | `getMeeting`, `listMeetings`, `getMeetingById`, `listMeetingAgendaItems`, `listMeetingUnits`, `listAgendaItems`, `listUnits` |
   | `speakers` | `listSpeakers`, `getSpeaker` |
   | `contributions` | `listContributions`, `getContribution` |
   | `questions` | `listQuestions`, `getQuestion`, `getQuestionHistory`, `getStage` |
   | `stage` | `getStage` |
   | `roles` | `listRoleAssignments` |

3. **Invalidierung aus Nachrichten (N4).**
   - `change`: Einträge der Themen werden ungültig. Einzelzugriffe (`getQuestion`, `getQuestionHistory`, `getSpeaker`,
     `getContribution`) nur für die Kennungen in `subjects`, ohne `subjects` alle.
   - `event` (Leser mit `event.read`): Themen über `EVENT_TOPICS`, Kennungen über **`EVENT_SUBJECTS`** aus
     `@hv/domain`, also dieselben Nebenwirkungen wie im Dienst (z. B. `QuestionCaptured` → Redebeitrag und Wortmeldung).
   - Hörer-Aufruf mit `[]` **ohne** `change` (30-s-Takt, ältere Aufrufer) → ganzer Puffer ungültig.
   - Nachrichten innerhalb von 100 ms bilden einen Stapel: einmal ungültig machen, einmal benachrichtigen. Ausnahme: eigene
     Schreibvorgänge (Entscheidung 5).
   - Die Hülle ist der **einzige** Abonnent des Adapters. Die Hörer von `useApiVersion` hängen an der Hülle und laufen erst
     nach dem Ungültigmachen.
4. **Generationen, genau definiert (m2).**
   - Die Hülle führt eine **Akteur-Epoche** `A`, eine Daten-Epoche `E` und je Schlüssel eine Generation `g(k)`, alle
     beginnen bei 0.
   - Ungültigmachen von `k` erhöht `g(k)`. Ganzes Ungültigmachen (eigenes Schreiben, Takt, `reset`) erhöht `E`.
     `clear()` (Entscheidung 8: Akteurwechsel, 401, Abmelden, Stromende) erhöht `A` **und** `E`.
   - Eine Anfrage merkt sich beim Start `(A, E, g(k))`. Ihre Antwort wird nur gepuffert, wenn alle drei bei Ankunft
     unverändert sind.
   - **Auslieferung (Codex P1, Sicherheit):**
     - Hat sich nur `E` oder `g(k)` geändert, erhält der Aufrufer die Antwort (derselbe Akteur), und seine
       Ladeschlüssel (010c) entscheiden über die Anzeige.
     - Hat sich **`A` geändert**, wird die Antwort dem Aufrufer **nie** ausgeliefert: Das Promise bleibt unerledigt, es
       wird weder erfüllt noch abgewiesen. Grund: Die Ladeschlüssel der Seiten vergleichen nur `getActor().id`
       (z. B. `useSpeakers.ts`). Nach einem Wechsel von Rolle oder Fachbereich bei gleicher `id` könnten sonst geschützte
       Felder oder `_actions` der alten Berechtigung erscheinen.
     - Unerledigt statt abgewiesen, weil die Fehlerzweige der Seiten sonst eine Meldung zeigen würden. Die Seite lädt
       ohnehin neu, denn `useApiVersion` zählt beim Akteurwechsel (takt-033b) und bei den übrigen Anlässen von `clear()`
       über den Hörer-Aufruf nach `clear()`.
     - Die Hülle hält keine Referenz auf das unerledigte Promise; es wird mit dem Aufrufer freigegeben.
   - Zwei gleichzeitige Aufrufe desselben Schlüssels in derselben Generation teilen eine Anfrage.
5. **Eigene Schreibvorgänge (takt-030, takt-032; m1, m3).**
   - Der HTTP-Adapter meldet jeden Schreibausgang über einen neuen Haken `onWriteSettled(outcome)` mit
     `outcome ∈ success | server_error | local_reject`. Er wird in `write` gerufen und zusätzlich im lokalen
     Abweisungszweig von `updateSpeaker` (Eingabe mit `reason`, abgewiesen vor `write`; Codex P2). Das sind die einzigen
     Änderungen an `http.ts` in 036a. Den
     Demo-Adapter beobachtet die Hülle direkt: Erfolg → `success`, `ApiProblem` des Kerns → `server_error`.
   - **`success`:** synchron `E` erhöhen (ganzer Puffer ungültig) und die Hörer **sofort** rufen, ohne 100-ms-Stapel
     (m1). Die Reihenfolge aus takt-030 bleibt: Erst ist `writeEtag` gesetzt, dann ungültig, dann Hörer. Den doppelten
     Hörer-Aufruf aus `write` (takt-030) fasst die Hülle zu einem zusammen.
   - **`server_error`** (409, 412, 422, 5xx, Netzfehler nach dem Senden): `E` erhöhen, **keine** Hörer (takt-030 Ziel 2).
     Das `reload()` der Seite nach 412 liest frisch.
   - **`local_reject`:** nichts.
   - Busy-Signale und Versionsmarken aus takt-032 bleiben in den Seiten, unverändert.
6. **Versionswasserzeichen (N3).** Gewählt ist das Wasserzeichen, kein Umgehen des Puffers; `useSpeakers.ts` bleibt
   unverändert.
   - Datentabelle `WATERMARKS: { speakerListVersion: ['listSpeakers', 'getSpeaker'], version: [Lesezugriffe des Themas
     meeting außer getMeeting] }`, allgemein: Zähler des `Meeting` → abhängige Lesezugriffe.
   - Jeder Eintrag eines abhängigen Lesezugriffs speichert das Wasserzeichen, also den Zählerwert des zuletzt gepufferten
     `getMeeting` beim Start seiner Anfrage.
   - Trifft ein frisches `getMeeting` mit einem **höheren** Zählerwert ein, werden alle abhängigen Einträge mit kleinerem
     Wasserzeichen ungültig, **bevor** das `getMeeting`-Promise auflöst.
   - Ein abhängiger Eintrag wird nur ausgeliefert, wenn sein Wasserzeichen gleich dem Zählerwert des aktuell gepufferten
     `getMeeting` ist.
   - Damit liefert `readStableSpeakerList` nie alte Zeilen mit neuer Version. Der verbleibende Fall „neuere Zeilen, ältere
     Version“ endet mit 412, also sicher.
7. **Ablauf ohne Ereignis (N7).** Einträge, deren Antwort einen `claim` enthält, werden zum frühesten `claim.expiresAt`
   ungültig, spätestens aber 30 s nach dem Eintreffen, und die Hörer werden gerufen.
   - Zeitquelle ist die Uhr aus 032 (`apps/web/src/time.ts`), falls gemergt. Sonst die als Option injizierte Uhr der Hülle;
     `index.ts` verdrahtet die Browseruhr, Tests eine gefälschte.
   - Einträge ohne `claim` haben kein Höchstalter.
8. **Akteur und Sitzung (N2).** Ganzer Puffer leer (`clear()`, `E` erhöhen) bei:
   - echtem Akteurwechsel (`actorChanged`, auch im Demo-Umschalter);
   - 401 (`onUnauthorized`) und Abmelden;
   - jeder Meldung von 036b über ein Stromende `end {roles_changed | forbidden | session}`.

   Dazu kommt der strukturelle Akteurschlüssel aus Entscheidung 1: Ein Eintrag von Akteur A wird auch dann nie an A′
   (gleiche `id`, andere Rolle oder anderer Fachbereich) ausgeliefert, wenn das Leeren einmal zu spät käme. Der Puffer
   liegt nur im Speicher des Tabs.
9. **Demo (ADR 0002).** Dieselbe Hülle, Invalidierung über `change` aus dem In-Process-`subscribe`. Kein Strom, kein Takt.
10. **Rückfall in 036a.** Bis 036b gemergt ist, arbeitet der HTTP-Modus mit dem 30-s-Takt (ganzer Puffer ungültig) und
    den eigenen Schreibvorgängen. Das Verhalten entspricht heute, nur ohne doppelte GETs innerhalb derselben Generation.

## Nicht-Ziele

- Kein Strom, keine Verbindungsanzeige, kein e2e H11/H12 (036b). Keine Paginierung (takt-038).
- Keine Anwendung von Ereignissen auf Listen im Client, keine optimistische Anzeige, keine `_actions` im Browser.
- Kein `BroadcastChannel`, kein Service Worker, kein dauerhafter Browserspeicher.
- Keine Änderung an Vertrag, Domäne, Dienst, `useApiVersion`-Signatur, Seiten (auch nicht `useSpeakers.ts`), Ladeschlüsseln
  (010c/010d), takt-032-Signalen, 401- oder Abmeldeablauf.

## Files allowed

- `docs/slices/036a-live-store.md`
- `apps/web/src/api/liveStore.ts` (neu), `apps/web/src/api/liveStore.test.ts` (neu)
- `apps/web/src/api/http.ts` (nur Haken `onWriteSettled` in `write`, im lokalen Abweisungszweig von `updateSpeaker` und
  die Option dafür)
- `apps/web/src/api/http.test.ts` (nur Tests zum Haken)
- `apps/web/src/api/index.ts` (nur: Hülle über beide Adapter, Verdrahtung von `onWriteSettled`, `clear()` bei
  Akteurwechsel, 401, Abmelden; Uhr als Option)
- `apps/web/src/api/useApiVersion.ts`, `apps/web/src/api/useApiVersion.test.ts` (nur falls die Hülle den Hörerweg dort
  braucht; Signatur unverändert)
- `docs/folgeliste.md` (nur nicht blockierende Befunde; Sicherheitsbefunde nie)
- `docs/produktplan-beta.md` (nur Stand-Zeile Etappe B nach dem Merge)

Weitere Dateien sind Scope-Befunde (Liste im nächsten Abschnitt).

## Ausdrücklich nicht erlaubt

`apps/web/src/features/**` (auch `useSpeakers.ts`), `apps/web/src/app/**`, `packages/**`. Dieser Abschnitt steht bewusst
außerhalb von „Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. 035a gemergt: `HvApi.subscribe(listener(events, change?))`, `EVENT_TOPICS`, `EVENT_SUBJECTS`, `StreamChange` exportiert.
2. **Verlässt sich eine Ansicht auf den Vollabruf?** Alle Aufrufer von `useApiVersion` durchgehen (`useSpeakers.ts`,
   `useCapture.ts`, `answers/*`, `history/*`, `stage/Page.tsx`, `app/useMeeting.ts`): Erwartet eine Seite neue Werte ohne
   passendes Thema? Fund → melden und anhalten.
3. Verändert eine Ansicht gelesene Objekte (würde mit eingefrorenen Objekten werfen)? Fund → melden und anhalten, nicht
   auftauen.
4. Welche Lesezugriffe hängen außer `listSpeakers`/`getSpeaker` an einem Zähler des `Meeting` (`version`,
   `speakerListVersion`)? Liste in `WATERMARKS` vollständig machen.
5. Ist 032 gemergt (`apps/web/src/time.ts`)? Das bestimmt die Zeitquelle aus Entscheidung 7.

## Tests zuerst (rot, dann grün; Vitest, gefälschter `HvApi`)

1. `liveStore.test.ts`:
   - (a) zweimal `listSpeakers()` ohne Änderung → ein Aufruf am Adapter, beide Promises asynchron;
   - (b) `change {topics:[questions], subjects:[q1]}` → `listQuestions` und `getQuestion(q1)` neu, `getQuestion(q2)` und
     `listSpeakers` aus dem Puffer;
   - (c) `change` ohne `subjects` → alle `getQuestion` neu;
   - (d) `event`-Nachricht → über `EVENT_TOPICS` und `EVENT_SUBJECTS` gleich wie (b). **Erweitert (N4):**
     `QuestionCaptured` macht `getContribution(c)` und `getSpeaker(s)` ungültig, `QuestionMerged` beide Fragen;
   - (e) mehrere Nachrichten innerhalb von 100 ms → einmal ungültig, einmal benachrichtigt;
   - (f) Anfrage vor dem Ungültigmachen gestartet, Antwort danach → nicht gepuffert;
   - (g) (m1) `onWriteSettled(success)` → synchron ganzer Puffer ungültig und **sofort** Hörer, ohne Wartezeit; ein Hörer,
     der `lastWriteEtag()` liest, sieht den neuen Wert; eine vor dem Schreiben gepufferte Liste wird danach nicht
     ausgeliefert (takt-032); zwei Hörer-Aufrufe (Haken plus `write`) → ein Hörer-Durchlauf;
   - (h) `server_error` → ungültig, **kein** Hörer; `local_reject` → nichts (m3);
   - (i) Fehlerantworten nie gepuffert; `listEvents` nie;
   - (j) Akteurwechsel, 401, Abmelden → Puffer leer, laufende Antworten des alten Akteurs nicht gepuffert;
   - (j2) (N2) Akteur A puffert `listQuestions`; A′ mit gleicher `id`, anderer Rolle oder anderem `unitId`, **ohne**
     vorheriges `clear()` → Anfrage geht ins Netz, der Eintrag von A wird nie ausgeliefert;
   - (j2b) (Codex P1) laufende Anfrage `listQuestions` von Akteur A; dann Wechsel auf A′ (gleiche `id`, andere Rolle),
     `clear()`; dann trifft die Antwort ein → das Promise des Aufrufers bleibt unerledigt (nach Durchlauf aller
     Mikrotasks und gefälschter Timer weder erfüllt noch abgewiesen), die Antwort wird nicht gepuffert, und der nächste
     Aufruf `listQuestions` geht ins Netz. Gegenprobe: dieselbe Lage mit nur erhöhtem `E` (eigenes Schreiben) → der
     Aufrufer erhält die Antwort;
   - (j3) (N2) `clear()` mit Grund `roles_changed`, `forbidden` bzw. `session` → Puffer leer, laufende Antworten nicht
     gepuffert;
   - (k) Obergrenze 200 Einträge;
   - (l) Hörer mit `[]` ohne `change` → ganzer Puffer ungültig;
   - (m) (m2) Ungültigmachen eines anderen Schlüssels verwirft eine laufende Antwort nicht; Ungültigmachen desselben
     Schlüssels oder Erhöhen von `E` verwirft sie; zwei gleichzeitige Aufrufe teilen eine Anfrage;
   - (n) (N3) **„nie alte Zeilen mit neuer Version“**: `readStableSpeakerList` gegen die Hülle, Adapter liefert erst
     Version 5 mit Zeilen 5, dann neues `getMeeting` mit 6 → die gepufferte Liste der Version 5 wird nie zusammen mit 6
     ausgeliefert; das Ergebnis hat Zeilen und Version desselben Stands oder scheitert sicher;
   - (o) (N7) Eintrag mit `claim.expiresAt` in 10 s → nach 10 s (gefälschte Uhr) ungültig und Hörer gerufen, der nächste
     Aufruf holt neu; Eintrag mit Claim ohne frühen Ablauf → nach 30 s ungültig; Eintrag ohne Claim → bleibt;
   - (p) `READ_TOPICS` ist vollständig (Typprüfung über `satisfies`, Laufzeitprüfung über die Methodenliste; `listEvents`
     fehlt ausdrücklich).
2. `http.test.ts`: `onWriteSettled` mit `success` nach 2xx (nach `writeEtag`), `server_error` bei 412/500/Netzfehler,
   `local_reject` ohne CSRF-Token und bei `updateSpeaker` mit `reason`. Bestehende takt-030-Tests bleiben grün.
3. **e2e ohne Rückschritt:** in-process-Suite vollständig grün; im Projekt `http` H8 (412), H9 (eigene Schreibvorgänge)
   und H10 (ein Abruf beim Einhängen) unverändert grün; die gemeinsamen Dateien aus 031b grün, falls gemergt.

## Akzeptanzkriterium

1. Tests 1–2 grün, zuerst rot belegt; e2e wie Test 3 in der PR-CI grün.
2. `grep -rn "fetch(" apps/web/src` außerhalb von `apps/web/src/api/http.ts` ohne Treffer; `grep -rn -e localStorage -e
   sessionStorage apps/web/src/api/liveStore.ts` ohne Treffer.
3. `pnpm gates` grün auf sauberem Baucommit; `slice-scope` akzeptiert nur die Dateien oben.
4. Lesebefund vor dem Bau; Review in frischem Kontext (Security und Nebenläufigkeit); Blocker/Major vor dem Merge;
   Sicherheitsbefunde nie auf die Folgeliste. Jeder Commit nennt „Scheibe 036a“ und endet mit `[skip netlify]`.

## Nachweise

Schluss von `pnpm gates`; Testnamen aus 1–2; PR-CI-Lauf mit H8–H10 und in-process-Suite. Kein neuer Screenshot (keine
sichtbare Änderung).

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch
Ausgelöst: [x] Rolle, Recht (Daten je Akteur im Client, 010d) [x] Sitzungsentzug (Leeren bei 401, Abmelden, Stromende) [x] Nebenläufigkeit im Client [x] Betrieb (Last)
Perspektive(n): Security, Nebenläufigkeit/Lesezustand · Nachweise: Tests 1–3 · Offene Entscheidung: Eigentümerfrage 1

## Wirkung und Risiko

- **Invarianten.**
  1. Keine gepufferte Antwort wird einem strukturell anderen Akteur ausgeliefert.
  2. Nach einem eigenen erfolgreichen Schreiben wird keine vorher angeforderte Antwort ausgeliefert.
  3. Keine Fehlerantwort wird gepuffert.
  4. Kein abhängiger Eintrag mit kleinerem Wasserzeichen als das gepufferte `getMeeting`.
  5. Nichts auf dem Datenträger.
- **Missbrauchs- bzw. Fehlerfall MF-LS-1 (010d, SG1/SG3), Rollenwechsel am geteilten Gerät.** Abwehr: struktureller
  Schlüssel plus `clear()`. Erkennung: Tests j, j2, j3 als Tor; im Betrieb nicht beobachtbar, daher Pflicht-Tor.
- **Fehlerfall: Invalidierung zu eng.** Veraltete Anzeige bis zum nächsten Thema oder Takt. Abwehr: 035a Test 2b,
  `EVENT_SUBJECTS`, Test 1 (d).
- **Fehlerfall: alte Liste, neue Version (N3).** Abwehr: Wasserzeichen, Test 1 (n).
- **Last.** Je Stapel nur betroffene Schlüssel; in 036a ohne Strom noch der 30-s-Takt. Messung in 036b (H11) und 071.
- **Speicher.** Höchstens 200 eingefrorene Antworten im Speicher des Tabs; geleert bei 401, Abmelden, Rechteverlust.

## Sicherheits-Checkliste (Antworten für den Reviewer)

| Punkt | Antwort |
|---|---|
| SC-01 | ja: keine Rechteentscheidung im Client; die Hülle zeigt nur, was der Dienst geliefert hat; kein Rollenname (`role-literals`) |
| SC-02 | nicht anwendbar (keine neue Aktion) |
| SC-03 | ja: Einträge sind an den strukturellen Akteur gebunden (j2); Fehlerantworten werden nicht gepuffert, ein 403 bleibt 403 |
| SC-04 | ja: höchstens 200 Einträge |
| SC-05 | ja: Leeren bei 401, Abmelden und Stromende (j, j3); kein Geheimnis im Diff |
| SC-06 | ja: MF-LS-1 |
| SC-07 | nicht anwendbar (keine Ereignisse erzeugt) |
| SC-08 | nicht anwendbar (keine Persistenz) |
| SC-09 | nicht anwendbar |
| SC-10 | ja: keine neue Abhängigkeit |
| SC-11 | ja: keine Log-Ausgabe mit Inhalt, keine Kennzahl |
| SC-12 | ja: keine Tore oder Hooks berührt |
| SP-2 | ja: Obergrenze 200, Höchstalter für Claim-Einträge, Generationen statt wachsender Listen |
| SP-3 | ja: kein Token im Browserspeicher, CSRF und 401-Weg unverändert; der Puffer liegt nur im Speicher |
| SP-4 | ja: keine HTML-Ausgabe, kein neuer Ursprung |
| SP-5 | ja: kein Geheimnis im Diff; das CSRF-Token wird nicht gepuffert (`/auth/me` läuft nicht über die Hülle) |
| SP-6 | ja: T-G1-I-08 (nichts auf dem Datenträger), T-G1-D-03 (Last) |
| SP-7 | ja, clientseitig: Leeren bei 401 und bei Stromende `session` (Meldung aus 036b) |

## Offene Eigentümerfragen

1. **ADR 0014, Prüfpunkt 3 (Wortlaut „Ereignisse auf gepufferte Listen anwenden“).** Gilt als Erfüllung: gepufferte
   Lesezugriffe, gezielt je Thema und Kennung ungültig gemacht und einmal je Stapel neu gelesen? Oder verlangt der
   Eigentümer Deltasichten je Leser vom Dienst (Vertragsänderung, neue Scheibe)? Gebaut wird der erste Fall.

## Bericht (nach Bau ausfüllen)

```
Slice: 036a-live-store
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; Testnamen; PR-CI-Lauf <id> (H8–H10, in-process)
Open: Eigentümerfrage 1; Strom-Client in 036b
Touched: <Dateiliste>
```

## Review findings

Lesebefund zu Spec 036 (Opus, frischer Kontext, `9f2560c`): nicht baureif. In dieser Fassung eingearbeitet: N1
(Hochstufung), N2 (Entscheidungen 1 und 8, Tests j2/j3), N3 (Entscheidung 6, Test n), N4 (Entscheidung 3, Test d), N7
(Entscheidung 7, Test o), m1 (Test g), m2 (Entscheidung 4, Test m), m3 (Entscheidung 5, Test h), m7 (Entscheidung 2,
Test p). N5, N6, m4, m5, m6, m8 stehen in 036b.
