# Scheibe 036b — Inkrementeller Client-Zustand, Teil 2: Strom-Client, Verbindungszustand, zweiter Browser

**Status:** spec (überarbeitet nach dem Lesebefund vom 30.09.2026 zu `9f2560c`; Teil 2 der geteilten Scheibe 036)
**Risikoklasse:** hoch · 1,5 AStd · 30.10.2026 (W5) · Lanes: web-api; web-shell (nur Verbindungsanzeige); e2e
**Rolle:** web-implementer; Review in frischem Kontext mit Perspektive Security (Sitzungsende im Client) und Betrieb/Resilienz; Lesebefund der Spec vor dem Bau; Sicherheits-Checkliste des Reviewers (Abschnitt unten) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue fachliche Regel; AGENTS.md R2, R4, R6 (`fetch` nur in `apps/web/src/api/http.ts`), R10, R12
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/036; ADR 0014, ADR 0002; Scheiben 035b, 036a, 030, takt-023, takt-030, takt-033b, takt-035 (e2e gegen Produktions-Build hinter `vite preview`), 031a; Lesebefund zu Spec 036 (Opus, 30.09.2026: N5, N6, m4, m5, m6, m8); Bedrohungsmodell T-G1-S-02, T-G1-I-09, T-G1-D-03; Register B11, E33
**Depends on:** 035b und 036a (Voraussetzung: die Bauten von 035b, Spec #97, und 036a, Spec #98, sind gemergt, bevor dieser Bau beginnt; sie liefern `/v1/stream` im Dienst und `liveStore` mit `clear()` und `onStreamMessage`)
**Perspektive:** Security (Sitzungsende), Betrieb, UX/Barrierefreiheit · **Glossar: neue Begriffe:** nein

## Warum hoch

- **Sitzungsentzug im Client.** Der Client reagiert auf `end {session | forbidden | roles_changed}` und auf 401. Er muss
  den Puffer leeren und darf ohne bestätigte Sitzung nicht neu verbinden (T-G1-S-02, T-G1-I-09 c).
- **Netzgrenze.** Lange Verbindungen vom Browser zum Dienst, mit Rückzug, Obergrenzen und Rückfall (T-G1-D-03, E33).

## Befund (Ist-Stand, gelesen auf `59ef4fd`)

- `createHttpApi.subscribe` (`apps/web/src/api/http.ts`) kennt nur den 30-s-Takt.
- **Vertrag (Codex P1):** Die Steuernachrichten `cursor`, `reset` und `end` (Schemas `StreamCursor`, `StreamReset`,
  `StreamEnd`) sowie `change` (`StreamChange`, `StreamTopic`) stehen **nicht** im heutigen `openapi.yaml` (0.3.10). Sie
  kommen mit Vertrag **0.3.11** aus Scheibe 035a und liegen über die Voraussetzung 035b (die auf 035a baut) vor. 036b baut
  gegen den Vertrag in dieser Fassung und ändert selbst nichts am Vertrag, auch nicht `packages/contract/src/types.ts`.
- `createSessionAuth` (`apps/web/src/api/auth.ts`) ruft `onActorChange(actor)`, sobald `/auth/me` die Sitzung bestätigt.
  Das geschieht, **bevor** die Shell Ansichten einhängt (`App.tsx`: Zustand `checking` zeigt `BootScreen`). Bei 401
  bzw. Abmelden ruft es `onActorChange(undefined)`.
- `EventSource` kann keine eigenen Kopfzeilen setzen, bei einer neuen Instanz kein `Last-Event-ID` senden und den Status
  einer Abweisung nicht lesen.
- `apps/web/e2e/031-http-betriebsart.spec.ts`, Kopfkommentar: „The only `page.route` double of this suite lives in
  `030-anmeldung.spec.ts`.“
- Das Projekt `http` läuft seit takt-035 gegen einen Produktions-Build hinter `vite preview`. `/v1` und `/auth` gehen über
  dessen Proxy (`apps/web/playwright.config.ts:17-19, 97`). Ob dieser Proxy `text/event-stream` ungepuffert durchreicht,
  ist nicht geprüft.

## Ziel und Entscheidungen vor Bau

Ein zweiter Browser sieht eine Änderung in unter 2 s. Der Netztrace zeigt je Änderung nur die betroffenen Lesezugriffe.
Der Client endet sauber bei Rechte- oder Sitzungsverlust und fällt ohne Strom auf den 30-s-Takt zurück.

1. **Strom-Leser mit `fetch` statt `EventSource`**, in `http.ts`.
   - `GET /v1/stream` mit `credentials: 'same-origin'` und lesbarem Rumpf.
   - Das Zerlegen übernimmt ein reiner Parser in `apps/web/src/api/sse.ts`, ohne `fetch`.
   - Nachrichten gehen an `liveStore.onStreamMessage` (036a).
   - Unbekannte Nachrichtenarten werden übersprungen (Vertrag: Unbekanntes ignorieren).
   - Nachrichten über 1 MiB → Verbindung verwerfen.
2. **Wann öffnen (N5).**
   - Der Strom öffnet, sobald die Sitzung bestätigt ist (`onActorChange(actor)` in `index.ts`), also **bevor** die
     Ansichten einhängen. Er öffnet ohne Cursor und beginnt damit am Kopf mit `cursor` (035b).
   - Nach der ersten `cursor`-Nachricht macht die Hülle **nur** Einträge ungültig, deren Anfrage **vor dem Senden der
     Stromanfrage** gestartet wurde. Die Hülle merkt sich dazu die Epoche beim Senden.
   - Beim regulären Start gibt es solche Einträge nicht. Es entsteht kein zusätzlicher Abruf, und H10 (ein Abruf beim
     Einhängen) bleibt unverändert grün.
   - `onActorChange(undefined)` schließt den Strom.
3. **Neuaufbau und Stromende.**
   - Neuaufbau mit `Last-Event-ID` = letzte empfangene `id` (nie aus `reset` abgeleitet, dort gibt es keine `id`).
     Rückzug 1 s, 2 s, 4 s … höchstens 30 s mit Zufallsanteil. Während des Neuaufbaus läuft der 30-s-Takt.
   - `reset` → `liveStore` ganz ungültig und einmal Hörer (Vollabruf der eingehängten Ansichten, dokumentierte Ausnahme),
     dann neu ohne Cursor.
   - `end {rotate}` → sofort neu mit `Last-Event-ID`.
   - `end {roles_changed | forbidden | session}` → `liveStore.clear()` (036a Entscheidung 8), danach `sessionAuth` neu
     prüfen (`/auth/me`, Weg aus 030/takt-023). Neu verbinden nur, wenn die Sitzung wieder bestätigt ist.
   - **403 beim Öffnen** (auch beim Wiederöffnen nach verborgenem Tab oder nach Rotation) → wie `end {forbidden}`:
     `liveStore.clear()`, `sessionAuth.refresh()`, kein Neuaufbau ohne neue Bestätigung der Sitzung. Sonst würden nach
     einem Rollenentzug bei geschlossenem Strom gepufferte Entwürfe, Claims und `_actions` weiter ausgeliefert.
   - `end {unavailable}` und 503 → Rückfall, Neuaufbau nach `Retry-After`.
   - 429 → dieser Tab bleibt beim Rückfall und versucht es nach `Retry-After` erneut.
   - **401 beim Öffnen oder Wiederöffnen (m4, Codex P1)** → `liveStore.clear()` wie bei 403 und `end`, dann
     `onUnauthorized` wie jede Anfrage; **kein** Neuaufbau, bis `onActorChange(actor)` die Sitzung erneut bestätigt.
   - **Heartbeat-Wächter (m4):** 45 s ohne Heartbeat oder Nachricht → Verbindung verwerfen, Zustand `reconnecting`,
     Takt aktiv.
   - **Kurzlebige Ströme (m8):** Enden drei Ströme hintereinander innerhalb von je 10 s, ohne andere Nachrichten als
     Heartbeat oder `cursor` (typisch für einen puffernden oder abschneidenden Proxy), bleibt der Tab 5 min im Zustand
     `polling`. Danach versucht er es erneut.
4. **Mehrere Tabs: ein Strom je sichtbarem Tab, kein `BroadcastChannel` (entschieden).**
   - Ein Tab, der länger als 60 s verborgen ist, schließt seinen Strom. Beim Sichtbarwerden öffnet er ihn mit
     `Last-Event-ID` neu.
   - `BroadcastChannel` oder eine Führungswahl ist ein Nicht-Ziel: Lesedaten zwischen Tabs zu teilen wäre bei
     verschiedenen Rollen je Tab (Demo) ein Leck. Zeigt der Lasttest 071 Bedarf, folgt eine eigene Scheibe.
5. **Polling-Rückfall.** Solange kein Strom offen ist, ruft der bestehende 30-s-Takt die Hörer mit `[]` (036a: ganzer
   Puffer ungültig), nur bei sichtbarem Tab und bestätigter Sitzung. Bei offenem Strom ruht der Takt.
6. **Verbindungszustand (`apps/web/src/api/connection.ts`) und Anzeige (`apps/web/src/app/ConnectionStatus.tsx`).**
   - Automat mit Hook `useConnectionState()`: `connecting` → `live`; `reconnecting`; `polling`; `offline`
     (`navigator.onLine === false` oder drei Netzfehler in Folge).
   - Die Anzeige sitzt in `HeaderStrip.tsx` und erscheint nur im HTTP-Modus und nur außerhalb von `live`.
   - Texte DE/EN über `shell.*` mit „Stand von HH:MM:SS“ (Zeitquelle wie 036a Entscheidung 7).
   - `role="status"`, `aria-live="polite"`, keine Farbe als einziges Signal.
7. **Demo (ADR 0002).** Kein Strom, keine Anzeige. 036b ändert am Demo-Pfad nichts.

## Nicht-Ziele

- Keine Änderung an Vertrag, Domäne, Dienst, `liveStore`-Regeln (036a), Seiten, Ladeschlüsseln, takt-032-Signalen.
- Kein `BroadcastChannel`, kein Service Worker, kein dauerhafter Browserspeicher.
- Keine Änderung an `vite preview`, Netlify oder Proxy-Konfiguration; ein puffernder Proxy ist ein Befund.
- Keine Paginierung (takt-038), keine Alarme (085), keine Bühnen-Wiederaufnahme (058).

## Files allowed

- `docs/slices/036b-strom-client.md`
- `apps/web/src/api/sse.ts` (neu, reiner Parser), `apps/web/src/api/sse.test.ts` (neu)
- `apps/web/src/api/connection.ts` (neu), `apps/web/src/api/connection.test.ts` (neu)
- `apps/web/src/api/http.ts` (nur `subscribe`: Strom, Neuaufbau, Wächter, Rückfall; Anbindung an `liveStore`)
- `apps/web/src/api/http.test.ts`
- `apps/web/src/api/index.ts` (nur: Strom bei `onActorChange` öffnen und schließen, `clear()` bei Stromende)
- `apps/web/src/app/ConnectionStatus.tsx` (neu), `apps/web/src/app/ConnectionStatus.test.tsx` (neu, statisch gerendert
  wie `LoginPage.test.tsx`)
- `apps/web/src/app/HeaderStrip.tsx` (nur Einhängen der Anzeige)
- `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts` (nur Texte der Anzeige)
- `apps/web/e2e/031-http-betriebsart.spec.ts` (nur neue Tests H13 und H14 am Dateiende, der Kopfkommentar zu den
  `page.route`-Doubles, m5, und — Bauklärung vom 30.09. — die Strom-503-Route vor `goto` in den takt-039-Tests H11 und
  H12a samt je einer Kommentarzeile; — zweite Bauklärung — in H10 nur der Ersatz der beiden `networkidle`-Wartepunkte
  durch Ruhe der `/v1`-Lesungen ohne `/v1/stream`; keine neue Datei im Projekt `http`, damit die gepinnte Reihenfolge aus
  031b bleibt)
- `apps/web/src/i18n/parity.test.ts` (zweite Bauklärung: nur Schlüsselzahl 510 → 515 an drei Stellen und der veraltete
  Testtitel)
- `apps/web/e2e/support/e2e-texts.ts` (Bauklärung 3: nur die H13-Texte als Konstanten und in `WRITTEN_TEXTS`)
- `docs/evidence/031-h13-zweiter-browser.png`, `docs/evidence/031-h14-verbindungsanzeige.png`
- `docs/folgeliste.md` (nur nicht blockierende Befunde; Sicherheitsbefunde nie)
- `docs/produktplan-beta.md` (nur Stand-Zeile Etappe B nach dem Merge)

Weitere Dateien sind Scope-Befunde (Liste im nächsten Abschnitt).

## Ausdrücklich nicht erlaubt

`apps/web/src/api/liveStore.ts`, `apps/web/playwright.config.ts`, `apps/web/vite.config.ts`, `apps/web/src/features/**`.
Dieser Abschnitt steht bewusst außerhalb von „Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

## Bauklärung (Orchestrator, 30.09.)

- takt-039 (`769df38`) ist nach dieser Spec (`f702822`) gemergt und hat in `031-http-betriebsart.spec.ts` bereits H11
  („Vorgelesen, weiter“ während der Bühnenlesung) und H12a/H12b (Umsortieren per Tastatur) angelegt. Die hier geplanten
  Tests H11 und H12 heißen deshalb **H13** (zweiter Browser) und **H14** (Verbindungsanzeige); die Nachweise heißen
  `docs/evidence/031-h13-zweiter-browser.png` und `docs/evidence/031-h14-verbindungsanzeige.png`. Wo unten H11/H12 im
  Sinn dieser Scheibe steht, sind H13/H14 gemeint.
- takt-039 H11 und H12a steuern die Auffrischung über den 30-s-Takt (`page.clock.install()`, `fastForward('00:30')`). Bei
  offenem Strom ruht der Takt (Entscheidung 5, Test 2); beide Tests liefen dann ins Leere. Entscheidung (a): Beide Tests
  beantworten `**/v1/stream*` vor `goto` mit 503 und `Retry-After: 30` über `page.route` und laufen damit im
  Polling-Rückfall, den sie prüfen. H12b wartet nicht auf den Takt und bleibt unverändert. Entscheidung 5 und Test 2
  bleiben unverändert.
- Der Kopfkommentar der Datei (m5) nennt die tatsächlichen `page.route`-Doubles: 030, G1, takt-039 H11 (und H12a), H14.
- **Zweite Bauklärung (Orchestrator, 30.09.), nach dem Bau:**
  1. `apps/web/src/i18n/parity.test.ts` zählt die Schlüssel fest (Test f). Die fünf neuen `shell.connection.*` verlangen
     515 statt 510; die Pins und der veraltete Titel („507“) werden angepasst, sonst nichts. Das erledigt takt-038 nit 8.
  2. H10 wartete auf `waitForLoadState('networkidle')`; Playwright zählt einen offenen Strom als laufende Anfrage, das
     Ereignis tritt nie ein. Entscheidung (a): nur diese beiden Wartepunkte werden durch Ruhe der `/v1`-Lesungen ohne
     `/v1/stream` ersetzt (Hilfsfunktion `quiet()` wie in H13); die Aussage „genau ein Abruf je Einhängen“ bleibt, H10
     läuft weiter gegen den echten Strom.
  3. Restrisiko „`/auth/me` vor einem Stromende abgeschickt, danach bestätigt, öffnet den Strom wieder“ ist angenommen
     (der Dienst prüft beim Öffnen, der Puffer ist dann leer); es bleibt im Bericht, nicht auf der Folgeliste.
- **Bauklärung 3 (Orchestrator, 30.09.), nach dem Review von `f761931`:**
  1. Review major 1 (T-G1-D-03, MF-SC-2): nach einem Sitzungs- oder Rechteende (end, 403, 401) geht das nächste
     `openStream()` über den Rückzug; `attempt` wird nur nach einem gesunden Strom (≥ 10 s) zurückgesetzt. Nach drei
     solchen Enden ohne gesunden Strom folgt die 5-min-Pause wie bei m8. Kein Neuaufbau ohne neue Bestätigung bleibt.
  2. Review minor 2: `closeStream()` verwirft den Cursor; damit auch beim strukturellen Akteurwechsel und beim Abmelden.
  3. Review minor 3: ein strukturell anderer Akteur schließt den offenen Strom und öffnet neu (`followSessionActor`).
  4. Review minor 4 (Datenschutz): die H13-Texte stehen in `apps/web/e2e/support/e2e-texts.ts` `WRITTEN_TEXTS`, damit die
     Zugriffslog-Prüfung des Harness sie sucht.

## Vor dem Bau prüfen

1. 035b und 036a gemergt; `packages/contract/src/types.ts` enthält Vertrag 0.3.11 aus 035a (`StreamChange`, `StreamCursor`, `StreamReset`, `StreamEnd`). Fehlt das, anhalten.
2. **`vite preview`-Proxy (m6):** Reicht er `text/event-stream` ungepuffert durch? Probe im Projekt `http`: Ein
   Heartbeat oder `cursor` kommt innerhalb von 16 s nach dem Öffnen im Browser an. Puffert der Proxy, ist das ein
   Befund: melden und anhalten, keine Konfigurationsänderung in dieser Scheibe.
3. **Rollen für H11 (N6):** Welche Rollen sehen die Wortmeldeliste laut `featureRegistry.ts`? moderation meldet an und
   ruft auf. Für Kontext A muss eine zweite Rolle mit `speaker.read` die Wortmeldeliste öffnen können, sonst wählt der
   Test für A die Erfassung, die `listSpeakers` liest. Dann melden und die Spec anpassen, nicht still ausweichen.
4. Setzt `onActorChange(actor)` bei jedem stillen Auffrischen ein neues Objekt (takt-033b)? Das Öffnen hängt nicht an
   der Objektidentität und auch nicht allein an `actorChanged`. Ist ein offener Strom vorhanden, bleibt er. Nach einem
   Stromende (`end`, 403) öffnet der Client nach **jedem** erfolgreichen `/auth/me` neu, auch wenn der Akteur strukturell
   gleich ist. Sonst öffnete ein `roles_changed` mit strukturell gleichem Akteur nie wieder.

## Tests zuerst (rot, dann grün)

**Unit:**

1. `sse.test.ts`: Zeilen und Blöcke über Stückgrenzen, `\r\n`, Kommentarzeilen, `retry:`, `id:` ohne `data`, mehrere
   `data:`-Zeilen, unbekannte `event:`-Art übersprungen, `reset`/`end` ohne `id` ändern die letzte `id` nicht, Nachricht
   über 1 MiB → Fehler.
2. `http.test.ts` (gefälschter `fetcher` mit lesbarem Rumpf, gefälschte Timer):
   - Öffnen ohne Cursor nach bestätigter Sitzung, vor dem ersten Lesezugriff (N5);
   - nach der ersten `cursor`-Nachricht werden nur Einträge ungültig, die vor dem Senden der Stromanfrage angefordert
     wurden (N5);
   - Neuaufbau mit `Last-Event-ID` und Rückzugsfolge;
   - `reset` → Vollinvalidierung, Neuaufbau ohne Cursor;
   - `end {rotate}` → sofort neu;
   - `end {roles_changed}`, `forbidden`, `session` → `clear()`, Sitzung neu lesen, Neuaufbau erst nach Bestätigung;
   - 429 → Takt aktiv, erneuter Versuch nach `Retry-After`;
   - 401 beim Öffnen und beim Wiederöffnen → Puffer leer (`clear()` aufgerufen, danach geht ein zuvor gepufferter
     Lesezugriff ins Netz), `onUnauthorized` gerufen, kein Neuaufbau ohne neue Bestätigung (m4, Codex P1);
   - **Wiederöffnen nach verborgenem Tab antwortet 403** → Puffer leer, `/auth/me` wird gerufen, kein weiteres Öffnen
     ohne neue Bestätigung;
   - nach `end {roles_changed}` und erfolgreichem `/auth/me` mit strukturell gleichem Akteur → Strom öffnet neu;
   - 45 s ohne Heartbeat → Verwerfen und `reconnecting` (m4);
   - drei kurzlebige Ströme → 5 min `polling` (m8);
   - der Takt ruht bei offenem Strom;
   - verborgener Tab > 60 s → Strom zu, sichtbar → wieder auf.

   Bestehende takt-030-Tests und 036a-Tests bleiben grün.
3. `connection.test.ts`: Übergänge des Automaten. `ConnectionStatus.test.tsx`: Texte DE und EN je Zustand, nichts in
   `live` und im Demo-Modus, `role="status"`.

**e2e** (Projekt `http`, `031-http-betriebsart.spec.ts`, `@idp`):

4. **H11 zweiter Browser < 2 s mit Netztrace (N6).**
   - Kontext B = moderation auf der Wortmeldeliste, Kontext A = zweite Rolle mit `speaker.read` auf der Ansicht aus
     „Vor dem Bau prüfen“ 3.
   - **Schritt 1:** B meldet eine Wortmeldung an und ruft sie auf. Gemessen wird von der Antwort des Schreibens in B bis
     zur Sichtbarkeit in A; die Zeit muss unter 2000 ms liegen und steht in der Ausgabe. `page.on('request')` in A erlaubt
     im Fenster höchstens einen GET je betroffenem Schlüssel (`/v1/speakers`, `/v1/meeting`), keinen auf
     `/v1/questions`, `/v1/contributions` oder `/v1/stage`.
   - **Schritt 2:** Der Test erfasst vorab eine eigene Einzelfrage in einem dritten Kontext (capture) und wartet auf Ruhe
     in A. Dann ordnet ein Kontext coordination genau diese Frage ein. A holt im Fenster **keinen** GET auf
     `/v1/speakers` und `/v1/contributions`.
   - Die GET-Liste (Methode, Pfad ohne Querywerte, relativer Zeitpunkt) steht als Tabelle in der Ausgabe und gehört in
     den Bericht. Screenshot `docs/evidence/031-h11-zweiter-browser.png`.
5. **H12 Verbindungsanzeige.**
   - `page.route('/v1/stream*')` antwortet 503 mit `Retry-After: 1` → Anzeige „Rückfall“ bzw. „Verbindung wird
     wiederhergestellt“ (DE).
   - Danach wird die Route freigegeben → Anzeige verschwindet (`live`).
   - Das ist die dokumentierte zweite `page.route`-Ausnahme der Suite, im Kopfkommentar der Datei genannt (m5).
   - Screenshot `docs/evidence/031-h12-verbindungsanzeige.png`.
6. **Kein Rückschritt:** H8, H9 und **H10 unverändert** grün; die 031b-Dateien und die in-process-Suite grün.

## Akzeptanzkriterium

1. Unit-Tests 1–3 grün, zuerst rot belegt.
2. H11 und H12 in der PR-CI grün (Job `e2e-http`); Zustellzeit < 2000 ms; Netztrace-Tabelle im Bericht.
3. Kein Rückschritt nach Test 6; `grep -rn "fetch(" apps/web/src` außerhalb von `apps/web/src/api/http.ts` ohne Treffer;
   `i18n-literals`, `role-literals` grün.
4. `pnpm gates` grün auf sauberem Baucommit; `slice-scope` akzeptiert nur die Dateien oben.
5. Lesebefund vor dem Bau; Review in frischem Kontext; Blocker/Major vor dem Merge; Sicherheitsbefunde nie auf die
   Folgeliste. Jeder Commit nennt „Scheibe 036b“ und endet mit `[skip netlify]`.

## Nachweise

Schluss von `pnpm gates`; Unit-Testnamen; PR-CI-Lauf mit H11/H12 und Laufzeiten; Zustellzeit; Netztrace-Tabelle aus H11;
`docs/evidence/031-h11-zweiter-browser.png`, `docs/evidence/031-h12-verbindungsanzeige.png`; Ergebnis der Probe aus
„Vor dem Bau prüfen“ 2.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch
Ausgelöst: [x] Sitzungsentzug im Client [x] Netzgrenze (lange Verbindungen) [x] Oberfläche, Barrierefreiheit [x] Betrieb
Perspektive(n): Security, Betrieb, UX · Nachweise: Tests 1–6, Netztrace · Offene Entscheidung: Eigentümerfrage 3 aus 035b (Produktionsweg), Frage 1 aus 036a

## Wirkung und Risiko

- **Invarianten.**
  1. Nach `end {session | forbidden | roles_changed}`, nach 403 beim Öffnen und nach 401 liefert der Puffer nichts mehr aus, und ohne erneute
     Bestätigung der Sitzung gibt es keinen Neuaufbau.
  2. Nie mehr als ein Strom je sichtbarem Tab.
  3. Ohne Strom gilt der heutige Stand (30-s-Takt).
- **MF-SC-1 (T-G1-S-02), Sitzung gesperrt, Tab bleibt offen.** Der Dienst beendet den Strom (`end {session}`, 035b).
  Der Client leert den Puffer, `/auth/me` liefert 401, die Anmeldeseite erscheint. Kein Neuaufbau ohne Bestätigung.
  Erkennung im Dienst: 401 im Zugriffslog.
- **MF-SC-2 (T-G1-D-03), Wiederverbindungssturm.** Nach einem Ausfall versuchen alle Clients gleichzeitig den Neuaufbau.
  Abwehr: Rückzug mit Zufallsanteil bis 30 s, 429/503 mit `Retry-After`, 5 min `polling` bei kurzlebigen Strömen.
  Erkennung: 429/503 im Zugriffslog.
- **Bekanntes Restrisiko: Wettlauf beim ersten Öffnen.** Ein GET, der nach dem Senden der Stromanfrage abgeschickt wird,
  kann aus einem älteren Snapshot stammen als der Kopf der ersten `cursor`-Nachricht, etwa wegen eines anderen
  Dienstprozesses oder einer langsameren Lesetransaktion. Der Puffer behält ihn dann bis zum nächsten passenden Thema
  oder bis zum 30-s-Takt, falls der Strom ausfällt. Hingenommen: Das Fenster ist kurz, und die nächste Änderung des
  Themas korrigiert es. Kein Leck, nur mögliche kurze Veraltung.
- **Fehlerfall: Strom hängt ohne Fehler** (puffernder Proxy, Eigentümerfrage 3 in 035b): Wächter nach 45 s, dann
  Rückfall.
- **Last.** Je Änderung nur betroffene Schlüssel (Netztrace H11); Messung unter Last in 071.
- **Barrierefreiheit.** Statusbereich mit höflicher Ansage, kein Fokusdiebstahl, DE/EN.

## Sicherheits-Checkliste (Antworten für den Reviewer)

| Punkt | Antwort |
|---|---|
| SC-01 | ja: keine Rechteentscheidung im Client; der Strom liefert, was der Dienst nach R-PERM-04 erlaubt |
| SC-02 | nicht anwendbar (keine neue Aktion) |
| SC-03 | ja: Nachrichten ohne Inhalt außer für `event.read`; der Client zeigt nichts aus dem Strom direkt an, er macht nur ungültig |
| SC-04 | nicht anwendbar (kein Massenlesen im Client über den Vertrag hinaus) |
| SC-05 | ja: Stromende und 401 leeren den Puffer, kein Neuaufbau ohne Bestätigung (Test 2); kein Geheimnis im Diff |
| SC-06 | ja: MF-SC-1, MF-SC-2; Review major 1: keine Schleife Ende → `/auth/me` → Öffnen → Ende — Rückzug nach jedem Sitzungs- oder Rechteende, 5-min-Pause nach drei Enden ohne gesunden Strom (Test „403 on every open …“) |
| SC-07 | nicht anwendbar |
| SC-08 | nicht anwendbar |
| SC-09 | nicht anwendbar |
| SC-10 | ja: keine neue Abhängigkeit (eigener Parser statt Bibliothek) |
| SC-11 | ja: keine Ausgabe von Strominhalten in Konsole oder Log |
| SC-12 | ja: keine Tore berührt; die e2e-Reihenfolge aus 031b bleibt |
| SP-2 | ja: Nachrichtengröße ≤ 1 MiB, Rückzug mit Obergrenze, ein Strom je Tab |
| SP-3 | ja: Cookie `same-origin`, kein Token im Browser, 401-Weg unverändert, kein Neuaufbau ohne Sitzung |
| SP-4 | ja: keine HTML-Ausgabe aus Stromdaten, kein neuer Ursprung (gleiche Herkunft) |
| SP-5 | ja: kein Geheimnis im Diff; der Client hält kein Sitzungstoken (HttpOnly-Cookie), das CSRF-Token geht nicht in die Stromanfrage |
| SP-6 | ja: T-G1-S-02, T-G1-I-09 (c, clientseitig), T-G1-D-03 |
| SP-7 | ja, clientseitig: nach `end {session}` kein Neuaufbau ohne neue Bestätigung (Test 2) |

## Offene Eigentümerfragen

Keine eigenen. Es gelten 035b Frage 3 (Produktionsweg für lange Verbindungen) und 036a Frage 1 (Wortlaut ADR 0014).

## Bericht (nach Bau ausfüllen)

```
Slice: 036b-strom-client
Done: Strom-Leser mit fetch in http.ts (reiner Parser sse.ts), geöffnet bei jeder bestätigten Sitzung vor dem Einhängen,
Neuaufbau mit Last-Event-ID, Rückzug 1–30 s mit Zufallsanteil nach unten, Wächter 45 s, 5 min Rückfall bei kurzlebigen
Strömen, 60-s-Regel für verborgene Tabs, Takt nur ohne offenen Strom; Sitzungs-/Rechteende (end, 403, 401) leert den
Puffer und öffnet erst nach neuer Bestätigung. Verbindungsautomat (connection.ts) und Anzeige (DE/EN) im Kopf.
e2e H13 (zweiter Browser) und H14 (Anzeige) geschrieben; takt-039 H11/H12a laufen im Rückfall (Bauklärung).
Evidence: Baucommit 62c7c4a, Bauklärung 2 in 3bb3a61; `pnpm gates` grün auf 3bb3a61 (Auszug unten); PR-CI-Lauf mit
H13/H14 steht aus;
Zustellzeit und Netztrace-Tabelle erst aus der PR-CI (H13 druckt sie); docs/evidence/031-h13-zweiter-browser.png,
docs/evidence/031-h14-verbindungsanzeige.png entstehen in der PR-CI (Artefakt evidence-031-http, E56).
Open: Lasttest 071; Produktionsweg (035b Frage 3); H13/H14 und das geänderte H10 laufen erst in der PR-CI.
(Die beiden Scope-Befunde sind mit der zweiten Bauklärung in 3bb3a61 erledigt.)
Touched: siehe Liste unten.
```

**Vor dem Bau prüfen (Ergebnisse).**
1. Vertrag 0.3.12 mit `StreamTopic`, `StreamChange`, `StreamCursor`, `StreamReset`, `StreamEnd` in
   `packages/contract/src/types.ts`; 035b und 036a gemergt: erfüllt.
2. `vite preview`-Proxy (m6): gegen einen Stellvertreter-Dienst (Node-Stub mit `text/event-stream`, `HV_API_ORIGIN`,
   HTTP-Build in einem privaten Verzeichnis, keine Konfigurationsänderung) ungepuffert und unkomprimiert: in Chromium
   kommt `cursor` nach 60 ms, danach je Heartbeat ein Stück (2014, 4014, 6015 ms), `content-encoding` fehlt. Den echten
   Dienst hinter `vite preview` belegt erst der PR-CI-Lauf von H13/H14.
3. Rollen für H13 (N6): die Wortmeldeliste hat kein `requires` in `featureRegistry.ts`; capture und coordination halten
   `speaker.read`. Kontext A = capture auf `/speakers`.
4. `onActorChange(actor)` kommt bei jedem erfolgreichen `/auth/me` (neues Objekt); `openStream()` öffnet nur ohne offenen
   Strom und ohne anstehenden Wiederholversuch, nach einem Sitzungsende bei jeder Bestätigung (Test „structurally equal
   actor“).

**Schluss von `pnpm gates` auf 3bb3a61 (sauberer Baum, Postgres-Variablen gesetzt), grün, echter Auszug:**

```
apps/web test:       Tests  436 passed (436)
apps/api test:       Tests  586 passed (586)
packages/domain test:       Tests  261 passed (261)
slice-scope: 16 changed file(s), all within "docs/slices/036b-strom-client.md"'s "Files allowed" list (30 pattern(s)).
✓ built in 1.87s
mark-test-run: wrote /home/user/wt/s036b/.claude/state/last-test-run (clean tree) at commit 3bb3a61, tree 8f6433adefb5…
```

**Früherer Lauf auf 62c7c4a (vor der zweiten Bauklärung), rot am Paritäts-Pin:**

```
apps/web test:  FAIL  src/i18n/parity.test.ts > i18n parity checks > (f) Total key count is 507 across all modules and matches de and en
apps/web test: AssertionError: expected 515 to be 510 // Object.is equality
apps/web test:  ❯ src/i18n/parity.test.ts:166:23
apps/web test:  Test Files  1 failed | 22 passed (23)
apps/web test:       Tests  1 failed | 435 passed (436)
/home/user/wt/s036b/apps/web:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @hv/web@0.0.0 test: `vitest run --passWithNoTests`
Exit status 1
 ELIFECYCLE  Command failed with exit code 1.
```

Davor grün: `contract:lint`, `typecheck`, `lint`; `packages/domain` 261/261. Die Schritte nach `test` einzeln auf
demselben Commit: `apps/api` 39 Dateien, 586/586 Tests; vocabulary, arch, role-literals, now-check, plan-honesty,
i18n-literals, slice-scope („14 changed file(s), all within … Files allowed“, Warnung wegen der Bauklärung),
downgrade-check, metrics-allowlist, plan-graph, test:scripts, web build: alle grün. In-process-e2e: 131 passed (7,0 min).

**Tests zuerst.** Rot vor dem Bau: `sse.test.ts` 9 failed (Stub mit leeren Funktionen), `connection.test.ts` 7 failed,
`http.test.ts` 21 failed | 64 passed (bestehende grün), `ConnectionStatus.test.tsx` rot (Modul fehlt). Grün danach:
`src/api` und `src/app` 180/180; die takt-030- und 036a-Tests unverändert grün.

**Mutationen (je eine, Datei danach zurückgesetzt; alle getötet):**

| Wächter | Mutation | getötet von |
|---|---|---|
| kein Neuaufbau ohne Bestätigung | `endForSession` plant einen Neuaufbau statt `wanted = false` | end {roles_changed, forbidden, session}, „structurally equal actor“ (5 rot) |
| dto. | 401 beim Öffnen wie ein Verlust | „401 on open and on reopen“ |
| dto. | 403 beim Öffnen wie ein Verlust | „reopen after a hidden tab answered 403“ |
| `clear()` bei Stromende | `onStreamEnd` nicht gerufen | 6 rot (end ×3, equal actor, 401, 403) |
| Cursor / `Last-Event-ID` | Kopfzeile nicht gesetzt | 7 rot (Rückzug, rotate, end ×3, …) |
| dto. | `reset` behält den Cursor | „reset: … without a cursor“ |
| dto. (N5) | erste `cursor`-Nachricht invalidiert nichts | „after the first cursor only entries …“ |
| Rückzug, Obergrenzen | Obergrenze 60 s | „reconnects … at most 30 s“ |
| dto. | Zufallsanteil über der Stufe | „draws the jitter below the step“ |
| dto. | `Retry-After` ignoriert | 429, 503 |
| dto. | keine 5-min-Pause nach kurzlebigen Strömen | „three short-lived streams“ |
| dto. (SP-2) | Nachrichtengrenze 10 MiB | Parser 1 MiB, „message over 1 MiB drops the connection“ |
| Rückfall auf den 30-s-Takt | Takt ruht nicht bei offenem Strom | „poll rests …“, „45 s without a heartbeat“ |
| dto. | Takt läuft nie | 5 rot (takt-030-Takt, 429, 503, Wächter, …) |
| dto. | Wächter 450 s | „45 s without a heartbeat“ |

**Bauentscheidungen (im Rahmen der Spec, für den Review):**
1. N5-Genauigkeit: `liveStore.ts` ist gesperrt und kennt keine epochgebundene Invalidierung. `http.ts` merkt sich die
   Lesezugriffe (Methode, Argumente), die ohne synchronen Strom starten, schnappt sie beim Senden einer Stromanfrage ohne
   Cursor ab und invalidiert sie nach der ersten `cursor`-Nachricht über `onStreamMessage([], {topics, subjects})`:
   Einzellesungen genau je Kennung, Listenlesungen eines betroffenen Themas ganz (auch solche nach dem Senden; nur zu
   viel, nie zu wenig). Über 200 Einträge: alles. Beim regulären Start ist der Schnappschuss leer, es entsteht kein Abruf.
2. Ein bei Start verborgener Tab öffnet erst beim Sichtbarwerden; ein Neuaufbau, der in einen verborgenen Tab fällt,
   wartet ebenso (ein Strom je sichtbarem Tab). Nebenwirkung: H8 (verborgen per `defineProperty`) bleibt ohne Strom.
3. `reset` und `end {rotate}` bauen sofort neu auf, wenn der Strom mindestens 10 s lebte, sonst nach Rückzug (Schutz
   gegen eine Rotations- oder Reset-Schleife, MF-SC-2).
4. Eine fehlerhafte Nachricht bekannter Art invalidiert alles; ein 422 beim Öffnen verwirft den Cursor.
5. `Retry-After` wird auf 1–300 s begrenzt; nach `end {unavailable}` gilt das Größere aus `retry:` (sonst 3 s) und Rückzug.
6. Jeder 401 einer Lesung schließt auch den Strom; nach `end`/403 wird mit der letzten `id` neu verbunden (Vertrag).
7. „Stand von“: letzte Nachricht oder Heartbeat bei offenem Strom, sonst letzte erfolgreiche Lesung oder Takt.
8. Die Anzeige hängt als Geschwister vor der `lg:`-Gruppe in `HeaderStrip.tsx`, damit sie auf jeder Breite sichtbar ist; in
   `live`/`idle` bleibt ein leerer `role="status"`-Bereich (`sr-only`), damit spätere Wechsel angesagt werden.
9. H13 Schritt 1b: der Aufruf kann zuerst eine laufende Rede beenden (zwei PATCH); die Regel lautet daher höchstens ein GET
   je Schlüssel **und je Schreibvorgang**. H13 klassifiziert in `fast_track` (nicht Bühne), damit die Bühnenliste für
   `abnahme` unverändert bleibt.
10. Restrisiko: ein `/auth/me`, das vor einem Stromende abgeschickt war und danach bestätigt, öffnet den Strom wieder; der
    Dienst prüft Sitzung und Rechte beim Öffnen (403/401/end), der Puffer ist dann bereits leer.

**Scope-Befunde (nicht umgangen; mit der zweiten Bauklärung in 3bb3a61 erledigt):**
1. `apps/web/src/i18n/parity.test.ts` zählt die Schlüssel fest (Test f: 510). Die fünf neuen `shell.connection.*`
   verlangen 515 und je eine Kommentarzeile; die Datei steht nicht in „Files allowed“. Einziger roter Schritt von `gates`.
2. H10 (`031-http-betriebsart.spec.ts`) wartet zweimal auf `waitForLoadState('networkidle')`. Playwright zählt eine offene
   Strom-Anfrage als laufend. Probe (Chromium, Stub): ohne Strom `networkidle` nach 501 ms, mit offenem Strom „NOT reached
   within 8000 ms“. H10 läuft damit in der PR-CI in den Timeout. Die Spec verlangt H10 unverändert. Vorschlag: H10 wartet
   auf Ruhe der `/v1`-Lesungen ohne den Strom (wie `quiet()` in H13) statt `networkidle`, oder die Strom-503-Route wie in
   H11/H12a (dann prüft H10 nur den Rückfall).

**Lehre:** `networkidle` ist unbrauchbar, sobald ein langlebiger Strom existiert (Playwright zählt ihn als laufende
Anfrage); passt zur früheren Lehre, dass `networkidle` kein Ersatz für das Warten auf ein konkretes Signal ist.

**Restrisiko (angenommen, zweite Bauklärung 3):** Bauentscheidung 10 oben.

**Touched:** `docs/slices/036b-strom-client.md`, `docs/folgeliste.md`, `apps/web/src/i18n/parity.test.ts`, `apps/web/src/api/sse.ts`, `sse.test.ts`,
`connection.ts`, `connection.test.ts`, `http.ts`, `http.test.ts`, `index.ts`, `apps/web/src/app/ConnectionStatus.tsx`,
`ConnectionStatus.test.tsx`, `HeaderStrip.tsx`, `apps/web/src/i18n/shell.de.ts`, `shell.en.ts`,
`apps/web/e2e/031-http-betriebsart.spec.ts`.

## Review findings

Lesebefund zu Spec 036 (Opus, frischer Kontext, `9f2560c`): nicht baureif. In dieser Fassung eingearbeitet: N5
(Entscheidung 2, Test 2), N6 (Test 4, Vor dem Bau prüfen 3), m4 (Entscheidung 3, Test 2), m5 (Test 5, Files allowed), m6
(Vor dem Bau prüfen 2), m8 (Entscheidung 3, Test 2).
