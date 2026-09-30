# Scheibe 036 — Inkrementeller Client-Zustand statt Vollabruf

**Status:** spec
**Risikoklasse:** mittel · 2,5 AStd (Plan: 2 AStd) · 29.10.2026 (W5) · Lanes: web-api; web-shell (nur Verbindungsanzeige), web-history (nur Paginierung), e2e
**Rolle:** web-implementer; Review in frischem Kontext mit Perspektive Nebenläufigkeit/Lesezustand (010c, 010d, takt-030, takt-032) und Betrieb (Last); Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue fachliche Regel; AGENTS.md R2, R4 (Rechte nur aus `_actions` und aus dem Dienst), R6 (nur `HvApi`, `fetch` nur in `apps/web/src/api/http.ts`), R8 (Zeit aus `time.ts`), R10 (DE/EN), R12; R-PERM-04 (035) wird nur konsumiert
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/036; ADR 0014, ADR 0002; Scheiben 030, 035, 010c, 010d, takt-030, takt-032, takt-033b; Bedrohungsmodell T-G1-D-03, T-G1-I-08; Register B11, E33
**Depends on:** 035 (gemergt, Vertrag 0.3.11 und erweitertes `HvApi.subscribe`), 030; takt-030, takt-032, takt-033b (im Code auf `59ef4fd`)
**Perspektive:** Qualität/Nebenläufigkeit, Betrieb · **Glossar: neue Begriffe:** nein

## Warum mittel

036 ändert Verhalten im Web: wann und was die Oberfläche nachlädt, eine neue Verbindungsanzeige und Paginierung der
Historie. Kein Hoch-Auslöser nach Leitplanken §4 ist berührt:

- Die Rechte entscheidet weiter der Dienst (035, R-PERM-04). Der Client zeigt nur, was er gelesen hat.
- Sitzungsablauf und 401 laufen über den bestehenden Weg aus 030.
- Es gibt keine persistierten Daten und keinen neuen Speicherort.

Die Klasse gilt nur unter diesen Grenzen. Braucht der Bau dauerhaften Browserspeicher (`localStorage`, IndexedDB),
`BroadcastChannel`, eine Änderung am 401- oder Abmeldeablauf oder eine Vertragsänderung, dann ist das ein Hoch-Auslöser
(vertrauliche Daten auf dem Gerät, T-G1-I-08; Sitzungsentzug). In dem Fall anhalten und die Spec neu einstufen.

## Befund (Ist-Stand, gelesen auf `59ef4fd`)

- `useApiVersion()` (`apps/web/src/api/useApiVersion.ts`) liefert eine Zahl. Sie zählt bei jedem Aufruf der Hörer von
  `subscribeToChanges` → `api.subscribe` und bei einem echten Akteurwechsel (takt-033b). Jede eingehängte Ansicht lädt
  bei jeder Zählung **alle** ihre Daten neu (Vollabruf je Änderung).
- HTTP-Adapter (`apps/web/src/api/http.ts`): `subscribe` startet einen 30-s-Takt, nur bei sichtbarem Tab und
  bestätigter Sitzung, der die Hörer mit `[]` ruft. `write` ruft nach jedem eigenen 2xx die Hörer (takt-030), nachdem
  `writeEtag` gesetzt ist.
- Demo-Adapter: `subscribe` meldet jedes angehängte Ereignis synchron. Ab 035 kommt zusätzlich `change`
  (Themen, Kennungen) mit derselben Sichtbarkeitsfunktion wie im Dienst.
- takt-032 verlässt sich darauf, dass eine Liste, die **nach** der Antwort eines eigenen Schreibens angefordert wurde,
  mindestens so neu ist wie diese Antwort (Version aus der Antwort gilt bis dahin; `data-busy`/`aria-busy` bis dahin).
  010c/010d verlassen sich darauf, dass Antworten asynchron eintreffen und einem Ladeschlüssel je Akteur und Version
  gehören.
- Historie (`apps/web/src/features/history/Page.tsx`): Die Ergebnisliste lädt `listQuestions({limit: RESULT_LIMIT})` mit
  200 Einträgen ohne „weitere“. Der Korpus für die Kurve lädt `listQuestions({limit: 2000})` bei jeder Zählung. Der
  Ereignisstrom-Reiter liest ein Fenster über `listEvents(after, limit)`.
- `EventSource` kann keine eigenen Kopfzeilen setzen, beim Neuaufbau einer neuen Instanz kein `Last-Event-ID` senden und
  den Status einer abgewiesenen Antwort nicht lesen (401, 429, 503 sind nicht unterscheidbar).
- Im Plan steht 036 in Lane web-api mit „Aufrufer unverändert“, zugleich aber mit „Historie paginiert“ und
  „Lade-/Offline-/Wiederverbindungszustände“. Beides braucht Dateien außerhalb von `api/` (siehe Entscheidungen 8 und 9).

## Ziel und Entscheidungen vor Bau

Ein zweiter Browser sieht eine Änderung in unter 2 s. Nach dem ersten Laden holt die Oberfläche je Änderung nur, was die
Änderung betrifft, und das höchstens einmal je betroffenem Lesezugriff und Stapel. Signatur von `useApiVersion` und
Aufrufer bleiben unverändert.

1. **Gepufferter Lesezugriff hinter `HvApi` (`apps/web/src/api/liveStore.ts`).** Eine Hülle
   `createLiveStore(adapter: HvApi): HvApi` liegt über **beiden** Adaptern (Demo und HTTP, `index.ts`). So verhalten sich
   beide Betriebsarten gleich (ADR 0002). Sie puffert die **erfolgreichen** Antworten der lesenden Methoden, Schlüssel =
   Methode plus Argumente, und gibt einen gepufferten Eintrag als neues, **asynchron** aufgelöstes Promise zurück (nie
   synchron, 010c). Fehlerantworten (403, 404, 5xx, Netz) werden nie gepuffert. `listEvents` wird nie gepuffert
   (Cursor-Lesezugriff). Höchstens 200 Einträge, älteste zuerst verworfen. Schreibende Methoden, `lastWriteEtag` und
   `seedDemo` werden durchgereicht.
2. **Ungültig machen statt Ereignisse anwenden (Themen → Lesezugriffe als Daten).** Eine Tabelle
   `READ_TOPICS: Record<ReadMethodName, readonly StreamTopic[]>` in `liveStore.ts` ordnet jede lesende Methode ihren
   Themen zu:

   | Thema (035) | Lesezugriffe |
   |---|---|
   | `meeting` | `getMeeting`, `listMeetings`, `getMeetingById`, `listMeetingAgendaItems`, `listMeetingUnits`, `listAgendaItems`, `listUnits` |
   | `speakers` | `listSpeakers`, `getSpeaker` |
   | `contributions` | `listContributions`, `getContribution` |
   | `questions` | `listQuestions`, `getQuestion`, `getQuestionHistory`, `getStage` |
   | `stage` | `getStage` |
   | `roles` | `listRoleAssignments` |

   - Eine `change`-Nachricht macht jeden gepufferten Eintrag der betroffenen Themen ungültig. Bei Einzelzugriffen
     (`getQuestion`, `getQuestionHistory`, `getSpeaker`, `getContribution`) gilt das nur für die Kennungen in
     `subjects`. Fehlt `subjects`, gilt es für alle.
   - Eine `event`-Nachricht (Leser mit `event.read`) wird über `EVENT_TOPICS` aus `@hv/domain` und `subjectId` auf
     dieselbe Weise abgebildet.
   - Danach werden die Hörer **einmal je Stapel** gerufen. `useApiVersion` zählt, die Ansichten rufen ihre Methoden, und
     nur die ungültigen Schlüssel gehen ins Netz.
   - **Bewusst nicht** gewählt: Ereignisse im Client auf gefilterte Listen anwenden. Das würde Filter, Sortierung,
     Volltextsuche, Leseumfang und `_actions` im Browser nachbauen, und Rechte gehören in den Dienst (R4). Das weicht
     vom Wortlaut in ADR 0014 und im Plan ab („Ereignisse auf gepufferte Listen anwenden“). Siehe offene Frage 1.
3. **Stapel und Zusammenfassen.** Nachrichten, die innerhalb von 100 ms eintreffen, bilden einen Stapel. Je Stapel wird
   höchstens einmal ungültig gemacht und benachrichtigt. Ein Eintrag, dessen Anfrage vor dem Ungültigmachen gestartet
   wurde, wird bei Ankunft **nicht** gepuffert (Generationszähler je Schlüssel). Der Aufrufer erhält die Antwort
   trotzdem; seine Ladeschlüssel (010c) entscheiden über die Anzeige.
4. **Eigene Schreibvorgänge (takt-030, takt-032) ohne Rückschritt.**
   - **Nach einem eigenen 2xx:** Reihenfolge wie takt-030. Erst ist `writeEtag` gesetzt, dann wird **der ganze Puffer**
     ungültig (neue Generation für alle Schlüssel), dann werden die Hörer gerufen. So ist jede Liste, die nach der Antwort
     angefordert wird, wirklich nach der Antwort gelesen, und die Annahme aus takt-032 gilt weiter (Version aus der
     Antwort bis zu einer danach angeforderten Liste; `data-busy`/`aria-busy` enden erst dann).
   - **Nach einem fehlgeschlagenen Schreiben** mit Serverantwort (409, 412, 422, 5xx): der ganze Puffer wird ungültig,
     **ohne** Hörer zu rufen (takt-030 Ziel 2). Das `reload()` der Seite nach einem 412 liest dann frisch, nicht den
     veralteten Stand, der den 412 verursacht hat. Ein lokal abgelehntes Schreiben ohne Anfrage ändert nichts.
   - Das Ereignis des eigenen Schreibens kommt kurz danach noch einmal über den Strom. Das kostet höchstens einen
     weiteren gezielten Abruf der betroffenen Themen und wird hingenommen (`seq` steht nicht in der Schreibantwort).
   - Die Busy-Signale und Versionsmarken aus takt-032 bleiben in den Seiten, unverändert. 036 fasst keine Seite der
     Wortmeldeliste oder Erfassung an.
5. **Akteur und Sitzung.** Der Puffer gehört einem Akteur. Bei einem echten Akteurwechsel (`actorChanged` aus takt-033b,
   auch Rollenwechsel im Demo-Umschalter), bei 401 (`onUnauthorized`) und beim Abmelden wird er **vollständig geleert**,
   laufende Anfragen des alten Akteurs werden nicht mehr gepuffert (010d). Der Puffer liegt nur im Speicher des Tabs.
6. **Strom im HTTP-Adapter (`http.ts`) mit eigenem Leser statt `EventSource`.** `subscribe` öffnet `GET /v1/stream` per
   `fetch` mit lesbarem Rumpf, `credentials: 'same-origin'`. Das Zerlegen in Nachrichten erledigt ein reiner Parser in
   `apps/web/src/api/sse.ts` (kein `fetch` dort; R6 bleibt: `fetch` nur in `http.ts`). Gewählt, weil nur so Status,
   `Retry-After` und Problem-Details lesbar sind und `Last-Event-ID` beim Neuaufbau gesetzt werden kann.
   - **Erstes Öffnen:** ohne Cursor (035 Entscheidung 4: der Strom beginnt am Kopf mit `cursor`). Damit zwischen dem
     ersten Laden der Ansichten und dem Öffnen nichts verloren geht, macht die Hülle nach der ersten `cursor`-Nachricht
     den ganzen Puffer einmal ungültig und benachrichtigt, falls schon Antworten gepuffert sind. Das ist Teil des ersten
     Ladens, kein Vollabruf je Ereignis. Test in `http.test.ts`.
   - **Neuaufbau:** mit `Last-Event-ID` = letzte empfangene `id`, Rückzug 1 s, 2 s, 4 s … höchstens 30 s mit Zufallsanteil.
     Während des Neuaufbaus läuft der 30-s-Takt als Rückfall.
   - `reset` → ganzer Puffer ungültig, Hörer einmal rufen (Vollabruf der eingehängten Ansichten, dokumentierte Ausnahme),
     neu verbinden mit `after = lastSeq`.
   - `end {rotate}` → sofort neu verbinden. `end {roles_changed | forbidden | session}` → `sessionAuth` fragt `/auth/me`
     (bestehender Weg aus 030 und takt-023). Der Akteurwechsel bzw. 401 leert den Puffer (Entscheidung 5), dann neu
     verbinden, wenn noch angemeldet. `end {unavailable}` und 503 → Rückfall, Neuaufbau nach `Retry-After`.
   - 429 (Obergrenze je Sitzung) → **dieser Tab bleibt beim Rückfall** und versucht den Strom nach `Retry-After` erneut.
     401 → `onUnauthorized` wie jede Anfrage.
7. **Mehrere Tabs: ein Strom je sichtbarem Tab, kein `BroadcastChannel` (entschieden).**
   - Jeder Tab hat Puffer und Strom für sich. Ein Tab, der länger als 60 s verborgen ist, schließt seinen Strom. Beim
     Sichtbarwerden öffnet er ihn mit `after` = letzte `id` neu, gegebenenfalls über `reset`.
   - So bleiben meist ein bis zwei Ströme je Sitzung, unter der Grenze von 3 aus 035. Unter HTTP/1.1 würde jeder offene
     Strom eine der sechs Verbindungen je Herkunft belegen (offene Frage 2 in 035).
   - `BroadcastChannel` oder eine Führungswahl zwischen Tabs ist ein Nicht-Ziel. Es würde Lesedaten zwischen Tabs
     teilen, und im Demo-Modus kann jeder Tab eine andere Rolle haben: Das wäre ein Leck. Es wäre außerdem ein
     Hoch-Auslöser (Warum mittel). Zeigt der Lasttest 071 Bedarf, folgt eine eigene Scheibe.
8. **Polling-Rückfall.** Solange kein Strom offen ist (Aufbau, Neuaufbau, 429, 503, `unavailable`, Browser ohne lesbaren
   Rumpf), ruft der bestehende 30-s-Takt wie heute alle Hörer mit `[]` und ohne `change`: ganzer Puffer ungültig, nur
   sichtbarer Tab, nur mit bestätigter Sitzung. Bei offenem Strom ruht der Takt. Nach einem gelungenen Neuaufbau ohne
   `reset` gibt es keinen Vollabruf: Der Nachlauf aus 035 liefert die Themen.
9. **Lade-, Offline- und Wiederverbindungszustände (`apps/web/src/api/connection.ts`, Anzeige
   `apps/web/src/app/ConnectionStatus.tsx`).** Ein kleiner Zustandsautomat mit Hook `useConnectionState()`:
   `connecting` → `live`; `reconnecting` (Neuaufbau läuft); `polling` (Strom abgewiesen oder nicht verfügbar);
   `offline` (`navigator.onLine === false` oder die letzten drei Anfragen scheiterten am Netz). Die Anzeige sitzt in der
   Kopfzeile und erscheint nur im HTTP-Modus und nur außerhalb von `live`. Text DE/EN über i18n, mit „Stand von HH:MM:SS“
   aus der Serverzeit-Quelle (`time.ts`, 032). `role="status"`, `aria-live="polite"`, keine Farbe als einziges Signal. Im
   Demo-Modus gibt es keine Anzeige (kein Netz). Ansichten ändern sich nicht; ihre eigenen Lade- und Fehlerzustände
   (010b/010c) bleiben.
10. **Historie paginiert (nur `features/history`).** Die Ergebnisliste lädt seitenweise über das bestehende
    `limit`/`offset` von `listQuestions` (Seite = `RESULT_LIMIT`, Knopf „Weitere laden“). Der Ereignisstrom-Reiter lädt
    ältere Fenster über das bestehende `listEvents(after, limit)` nach. Die Korpusabfrage für die Kurve bleibt, kommt
    nach dem ersten Laden aber aus dem Puffer und wird nur bei `questions` neu geholt. Keine Vertragsänderung; eine neue
    Seitengröße oder ein neuer Parameter wäre ein Scope-Befund.
11. **Demo (ADR 0002).** Dieselbe Hülle und dieselbe Invalidierung über `change` aus dem In-Process-`subscribe`. Die
    Demo hat keinen Strom, keinen Takt, keine Anzeige. Mehrere Tabs der Demo teilen weiter keinen Stand (ADR 0002,
    unverändert).

## Nicht-Ziele

- Keine Änderung an Vertrag, Domäne, Dienst, `useApiVersion`-Signatur oder den Aufrufern in web-shell und den
  Feature-Ordnern (außer `features/history` für Entscheidung 10 und der Kopfzeile für Entscheidung 9).
- Keine Anwendung von Ereignissen auf Listen im Client, keine optimistische Anzeige, keine Berechnung von `_actions` im
  Browser.
- Kein `BroadcastChannel`, kein Service Worker, kein dauerhafter Browserspeicher.
- Keine Änderung an takt-032 (Busy-Signale, Versionsmarken), an 010c/010d (Ladeschlüssel, `readVerdict`) oder am
  401- und Abmeldeablauf.
- Keine Bühnen-Wiederaufnahme (058), keine Alarme (085), kein Lasttest (071).

## Teilung (vorbereitet)

Überschreitet der Bau einen Agententag, wandert Entscheidung 10 (Historie paginiert) in einen eigenen Takt der Lane
web-history. Die übrigen Entscheidungen bleiben in 036.

## Files allowed

- `docs/slices/036-inkrementeller-client-zustand.md`
- `apps/web/src/api/liveStore.ts` (neu), `apps/web/src/api/liveStore.test.ts` (neu)
- `apps/web/src/api/sse.ts` (neu, reiner Parser), `apps/web/src/api/sse.test.ts` (neu)
- `apps/web/src/api/connection.ts` (neu), `apps/web/src/api/connection.test.ts` (neu)
- `apps/web/src/api/http.ts` (nur `subscribe`: Strom, Neuaufbau, Rückfall; Weitergabe von Schreibausgang und 401 an die
  Hülle)
- `apps/web/src/api/http.test.ts`
- `apps/web/src/api/index.ts` (nur: Hülle über beide Adapter legen, Leeren bei Akteurwechsel und Abmelden verdrahten)
- `apps/web/src/api/useApiVersion.ts` und `apps/web/src/api/useApiVersion.test.ts` (nur falls das Zusammenfassen dort
  nötig ist; Signatur unverändert)
- `apps/web/src/app/ConnectionStatus.tsx` (neu), `apps/web/src/app/ConnectionStatus.test.tsx` (neu, statisch gerendert
  wie `LoginPage.test.tsx`)
- `apps/web/src/app/HeaderStrip.tsx` (nur Einhängen der Anzeige)
- `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts` (Texte der Anzeige)
- `apps/web/src/features/history/Page.tsx`, `apps/web/src/features/history/lib.ts` (nur Paginierung, Entscheidung 10)
- `apps/web/src/i18n/history.de.ts`, `apps/web/src/i18n/history.en.ts` (nur „Weitere laden“ und Verwandtes)
- `apps/web/e2e/031-http-betriebsart.spec.ts` (nur neue Tests H11 und H12 am Dateiende; keine neue Datei im Projekt
  `http`, damit die gepinnte Reihenfolge aus 031b unverändert bleibt)
- `docs/evidence/031-h11-zweiter-browser.png`, `docs/evidence/031-h12-verbindungsanzeige.png` (Präfix 031-, damit der
  Upload im Job `e2e-http` sie mitnimmt)
- `docs/folgeliste.md` (nur nicht blockierende Reviewbefunde)
- `docs/produktplan-beta.md` (nur Stand-Zeile Etappe B nach dem Merge)

Weitere Dateien sind Scope-Befunde. Das gilt besonders für Seiten in `features/speakers`, `features/capture`,
`features/answers`, `features/stage`, für `app/useMeeting.ts` und für `packages/*`. Braucht eine Ansicht doch eine
Änderung, weil sie sich auf den Vollabruf verlassen hat, dann melden und anhalten.

## Vor dem Bau prüfen

1. 035 gemergt: Vertrag 0.3.11 in `packages/contract/src/types.ts`, `HvApi.subscribe` mit `change`, `EVENT_TOPICS`
   exportiert.
2. **Verlässt sich eine Ansicht auf den Vollabruf?** Liest eine Seite bei Zählung Daten, deren Thema sich nicht
   geändert hat, und erwartet dennoch neue Werte, etwa abgeleitete Zeit, Alter oder Fristen? Diese kommen aus der Uhr
   (032), nicht aus einem Abruf, dürfen also nicht betroffen sein. `readStableSpeakerList` (drei GETs) muss mit Puffer
   weiter stabil lesen. Fund → melden und anhalten.
3. Liefert der gepufferte Weg dieselben Objekte zweimal aus? Dann wäre eine Veränderung durch eine Ansicht ein
   Querschläger. Entweder tief einfrieren oder je Aufruf kopieren; entscheiden und testen.
4. Nutzt `readStableSpeakerList` oder eine andere Stelle `getMeeting` als Versionsquelle zwischen zwei Lesezugriffen?
   Nach Entscheidung 1 kommt `getMeeting` aus dem Puffer; das Verhalten muss gleich bleiben.
5. `apps/web/src/api/http.ts` hat heute keinen Zugriff auf `sessionAuth`; die Verdrahtung läuft über `index.ts` wie bei
   `onUnauthorized`.

## Tests zuerst (rot, dann grün)

**Unit** (Vitest, reine Funktionen und Hülle über einem gefälschten `HvApi`):

1. `liveStore.test.ts`:
   (a) zweimal `listSpeakers()` ohne Änderung → ein Aufruf am Adapter, beide Promises lösen asynchron auf;
   (b) `change {topics:[questions], subjects:[q1]}` → `listQuestions` und `getQuestion(q1)` neu, `getQuestion(q2)` und
       `listSpeakers` aus dem Puffer;
   (c) `change` ohne `subjects` → alle `getQuestion` neu;
   (d) `event`-Nachricht → über `EVENT_TOPICS` gleich wie (b);
   (e) mehrere Nachrichten innerhalb von 100 ms → einmal ungültig, einmal benachrichtigt;
   (f) Anfrage gestartet vor dem Ungültigmachen, Antwort danach → nicht gepuffert, nächster Aufruf geht ins Netz;
   (g) eigenes 2xx-Schreiben → ganzer Puffer ungültig, **dann** Hörer; ein Hörer, der `lastWriteEtag()` liest, sieht den
       neuen Wert; eine Liste, die vor dem Schreiben gepuffert war, wird danach nicht ausgeliefert (takt-032);
   (h) 412 bzw. 5xx eines Schreibens → Puffer ungültig, **kein** Hörer; lokal abgelehntes Schreiben → nichts;
   (i) Fehlerantworten werden nicht gepuffert; `listEvents` nie;
   (j) Akteurwechsel, 401, Abmelden → Puffer leer, Antworten laufender Anfragen des alten Akteurs nicht gepuffert;
   (k) Obergrenze 200 Einträge;
   (l) Hörer mit `[]` ohne `change` (Takt, alter Adapter) → ganzer Puffer ungültig.
2. `sse.test.ts`: Zeilen und Blöcke über Stückgrenzen, `\r\n`, Kommentarzeilen, `retry:`, `id:` ohne `data`, mehrere
   `data:`-Zeilen, unbekannte `event:`-Art wird übersprungen (Vertrag: Unbekanntes ignorieren), zu große Nachricht
   (über 1 MiB) → Verbindung verwerfen.
3. `http.test.ts` (gefälschter `fetcher` mit lesbarem Rumpf): Öffnen mit `after`; Neuaufbau mit `Last-Event-ID`;
   Rückzugsfolge; `reset` → Vollinvalidierung und `after = lastSeq`; `end {rotate}` → sofortiger Neuaufbau;
   `end {roles_changed}` → Sitzung neu lesen; 429 → Takt aktiv und erneuter Versuch nach `Retry-After`; 401 →
   `onUnauthorized`; Takt ruht bei offenem Strom; verborgener Tab > 60 s → Strom zu; sichtbar → wieder auf.
   Bestehende Tests zu takt-030 bleiben grün.
4. `connection.test.ts`: Übergänge des Automaten. `ConnectionStatus.test.tsx`: Text DE und EN je Zustand, nichts in
   `live` und im Demo-Modus, `role="status"`.

**e2e** (Projekt `http`, `031-http-betriebsart.spec.ts`, `@idp`):

5. **H11 zweiter Browser < 2 s mit Netztrace.** Zwei Browserkontexte mit verschiedenen Rollen aus `http-setup`,
   Kontext A auf der Wortmeldeliste, Kontext B auf der Erfassung.
   - B meldet eine Wortmeldung an. Gemessen wird von der Antwort des Schreibens in B bis zur Sichtbarkeit in A; die Zeit
     muss unter 2000 ms liegen und steht in der Testausgabe.
   - `page.on('request')` in A zählt die GETs im Zeitfenster. Erlaubt ist höchstens ein GET je betroffenem Schlüssel
     (`/v1/speakers`, gegebenenfalls `/v1/meeting`). Kein GET auf `/v1/questions`, `/v1/contributions` oder `/v1/stage`.
   - Danach ordnet B in einem zweiten Schritt eine Einzelfrage ein: A (Wortmeldeliste) holt keinen GET auf
     `/v1/speakers`.
   - Die Liste der GETs (Methode, Pfad ohne Querywerte, Zeitpunkt relativ) schreibt der Test als Tabelle in die
     Ausgabe; sie gehört in den Bericht (Netztrace). Screenshot
     `docs/evidence/031-h11-zweiter-browser.png`.
6. **H12 Verbindungsanzeige.** `page.route('/v1/stream*')` antwortet 503 mit `Retry-After: 1` → Anzeige „Rückfall“
   bzw. „Verbindung wird wiederhergestellt“ (DE), danach Freigabe der Route → Anzeige verschwindet (`live`).
   Screenshot `docs/evidence/031-h12-verbindungsanzeige.png`.
7. **Kein Rückschritt:** H8 (echtes 412), H9 (eigene Schreibvorgänge sofort sichtbar) und H10 (ein Abruf beim
   Einhängen) bleiben grün. Die fünf gemeinsamen Dateien aus 031b (falls gemergt) bleiben grün, die in-process-Suite
   vollständig.

## Akzeptanzkriterium

1. Unit-Tests 1–4 grün, zuerst rot belegt (Commit der Tests vor der Umsetzung oder Lauf im Bericht).
2. H11 und H12 in der PR-CI grün (Job `e2e-http`); Zustellzeit < 2000 ms; Netztrace-Tabelle im Bericht.
3. H8–H10, 031b-Dateien und die in-process-Suite ohne Rückschritt; `grep -rn "fetch(" apps/web/src` trifft außerhalb von
   `apps/web/src/api/http.ts` nichts (030); `i18n-literals`, `now-check`, `role-literals` grün.
4. `pnpm gates` grün auf sauberem Baucommit; `slice-scope` akzeptiert nur die Dateien oben.
5. Review in frischem Kontext; Blocker/Major vor dem Merge, übrige Befunde in `docs/folgeliste.md`. Jeder Commit nennt
   „Scheibe 036“ und endet mit `[skip netlify]`.

## Nachweise

Schluss von `pnpm gates`; Unit-Testnamen; PR-CI-Lauf mit H11/H12 und Laufzeiten; gemessene Zustellzeit; Netztrace-Tabelle
aus H11; `docs/evidence/031-h11-zweiter-browser.png`, `docs/evidence/031-h12-verbindungsanzeige.png`.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: mittel
Ausgelöst: [x] Oberfläche, Barrierefreiheit (Verbindungsanzeige) [x] Nebenläufigkeit im Client (Puffer, Generationen, eigene Schreibvorgänge) [x] Betrieb (Last je Änderung)
Nicht ausgelöst, mit Grund: Rechte (Dienst entscheidet), Sitzungsentzug (bestehender Weg), personenbezogene Daten auf dem Gerät (nur Speicher des Tabs)
Perspektive(n): Nebenläufigkeit/Lesezustand, Betrieb, UX · Nachweise: Tests 1–7, Netztrace · Offene Entscheidung: Frage 1

## Wirkung und Risiko

- **Invarianten.** (1) Keine Antwort eines Akteurs wird einem anderen ausgeliefert (Leeren bei Wechsel, Generationen).
  (2) Nach einem eigenen Schreiben wird keine Antwort ausgeliefert, die vor dessen Antwort angefordert wurde. (3)
  Fehlerantworten werden nicht gepuffert, ein 403 bleibt also bei jeder Zählung ein 403 (010b). (4) Ist der Strom weg,
  gilt der heutige Stand: 30-s-Takt mit ganzer Invalidierung.
- **Fehlerfall: Invalidierung zu eng.** Eine Ansicht zeigt dann veraltete Daten bis zum nächsten passenden Thema, zum
  Takt oder zum Neuladen. Abwehr: Domänentest 2 aus 035 (Themen nie zu eng), `READ_TOPICS` im Zweifel weiter; Unit-Test
  1 (b).
- **Fehlerfall: Strom hängt ohne Fehler** (Proxy puffert, 035 offene Frage 2). Erkennung: kein Heartbeat innerhalb von
  45 s → Verbindung verwerfen, Zustand `reconnecting`, Takt aktiv. Test in `http.test.ts`.
- **Wiederherstellung.** `reset`, `end` und Neuaufbau führen zu höchstens einem Vollabruf der eingehängten Ansichten, nie
  zu einer Schleife: Rückzug mit Obergrenze, `reset` höchstens einmal je Neuaufbau.
- **Last.** Heute lädt jeder Client je Änderung alle eingehängten Ansichten. Danach lädt er je Stapel nur die betroffenen
  Schlüssel. Messung unter Last in 071.
- **Speicher im Browser.** Höchstens 200 Antworten im Speicher des Tabs. Beim Abmelden und bei 401 geleert, nie auf
  dem Datenträger (T-G1-I-08 unverändert).
- **Barrierefreiheit.** Die Anzeige ist ein Statusbereich mit höflicher Ansage, ohne Fokusdiebstahl, und in beiden
  Sprachen.

## Offene Eigentümerfragen

1. **ADR 0014, Prüfpunkt 3 (Wortlaut „Ereignisse auf gepufferte Listen anwenden“).** Gilt als Erfüllung: gepufferte
   Lesezugriffe, gezielt je Thema und Kennung ungültig gemacht und einmal je Stapel neu gelesen (Entscheidung 2)? Oder
   verlangt der Eigentümer die Anwendung von Ereignissen im Client? Die bräuchte Deltasichten je Leser vom Dienst, also
   eine Vertragsänderung und eine neue Scheibe. Gebaut wird der erste Fall; die ADR-Ergänzung folgt nach der Antwort.

## Bericht (nach Bau ausfüllen)

```
Slice: 036-inkrementeller-client-zustand
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; PR-CI-Lauf <id> (H11, H12); Zustellzeit; Netztrace-Tabelle;
docs/evidence/031-h11-zweiter-browser.png, docs/evidence/031-h12-verbindungsanzeige.png
Open: Eigentümerfrage 1; Lasttest 071
Touched: <Dateiliste>
```

## Review findings

folgt
