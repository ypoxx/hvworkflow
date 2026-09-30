# Scheibe 036b — Inkrementeller Client-Zustand, Teil 2: Strom-Client, Verbindungszustand, zweiter Browser

**Status:** spec (überarbeitet nach dem Lesebefund vom 30.09.2026 zu `9f2560c`; Teil 2 der geteilten Scheibe 036)
**Risikoklasse:** hoch · 1,5 AStd · 30.10.2026 (W5) · Lanes: web-api; web-shell (nur Verbindungsanzeige); e2e
**Rolle:** web-implementer; Review in frischem Kontext mit Perspektive Security (Sitzungsende im Client) und Betrieb/Resilienz; Lesebefund der Spec vor dem Bau; Sicherheits-Checkliste des Reviewers (Abschnitt unten) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue fachliche Regel; AGENTS.md R2, R4, R6 (`fetch` nur in `apps/web/src/api/http.ts`), R10, R12
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/036; ADR 0014, ADR 0002; Scheiben 035b, 036a, 030, takt-023, takt-030, takt-033b, takt-035 (e2e gegen Produktions-Build hinter `vite preview`), 031a; Lesebefund zu Spec 036 (Opus, 30.09.2026: N5, N6, m4, m5, m6, m8); Bedrohungsmodell T-G1-S-02, T-G1-I-09, T-G1-D-03; Register B11, E33
**Depends on:** 035b (gemergt: `/v1/stream` im Dienst), 036a (gemergt: `liveStore` mit `clear()` und `onStreamMessage`)
**Perspektive:** Security (Sitzungsende), Betrieb, UX/Barrierefreiheit · **Glossar: neue Begriffe:** nein

## Warum hoch

- **Sitzungsentzug im Client.** Der Client reagiert auf `end {session | forbidden | roles_changed}` und auf 401. Er muss
  den Puffer leeren und darf ohne bestätigte Sitzung nicht neu verbinden (T-G1-S-02, T-G1-I-09 c).
- **Netzgrenze.** Lange Verbindungen vom Browser zum Dienst, mit Rückzug, Obergrenzen und Rückfall (T-G1-D-03, E33).

## Befund (Ist-Stand, gelesen auf `59ef4fd`)

- `createHttpApi.subscribe` (`apps/web/src/api/http.ts`) kennt nur den 30-s-Takt.
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
   - **401 (m4)** → `onUnauthorized` wie jede Anfrage; **kein** Neuaufbau, bis `onActorChange(actor)` die Sitzung erneut
     bestätigt.
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
- `apps/web/e2e/031-http-betriebsart.spec.ts` (nur neue Tests H11 und H12 am Dateiende und der Kopfkommentar zur
  `page.route`-Ausnahme für H12, m5; keine neue Datei im Projekt `http`, damit die gepinnte Reihenfolge aus 031b bleibt)
- `docs/evidence/031-h11-zweiter-browser.png`, `docs/evidence/031-h12-verbindungsanzeige.png`
- `docs/folgeliste.md` (nur nicht blockierende Befunde; Sicherheitsbefunde nie)
- `docs/produktplan-beta.md` (nur Stand-Zeile Etappe B nach dem Merge)

Weitere Dateien sind Scope-Befunde (Liste im nächsten Abschnitt).

## Ausdrücklich nicht erlaubt

`apps/web/src/api/liveStore.ts`, `apps/web/playwright.config.ts`, `apps/web/vite.config.ts`, `apps/web/src/features/**`.
Dieser Abschnitt steht bewusst außerhalb von „Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. 035b und 036a gemergt.
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
   - 401 → `onUnauthorized`, kein Neuaufbau ohne neue Bestätigung (m4);
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
| SC-06 | ja: MF-SC-1, MF-SC-2 |
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
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; PR-CI-Lauf <id> (H11, H12); Zustellzeit; Netztrace-Tabelle;
docs/evidence/031-h11-zweiter-browser.png, docs/evidence/031-h12-verbindungsanzeige.png
Open: Lasttest 071; Produktionsweg (035b Frage 3)
Touched: <Dateiliste>
```

## Review findings

Lesebefund zu Spec 036 (Opus, frischer Kontext, `9f2560c`): nicht baureif. In dieser Fassung eingearbeitet: N5
(Entscheidung 2, Test 2), N6 (Test 4, Vor dem Bau prüfen 3), m4 (Entscheidung 3, Test 2), m5 (Test 5, Files allowed), m6
(Vor dem Bau prüfen 2), m8 (Entscheidung 3, Test 2).
