# Scheibe 035b — SSE-Strom, Teil 2: Dienst (Verteiler, Route, Grenzen, Sitzungsentzug)

**Status:** spec (überarbeitet nach dem Lesebefund vom 30.09.2026 zu `9f2560c`; Teil 2 der geteilten Scheibe 035)
**Risikoklasse:** hoch · 1,75 AStd · 28.10.2026 (W5) · Lanes: service; docs-sicherheit; docs-adr nur Architekt
**Rolle:** service-implementer; Architekt für die ADR-0014-Ergänzung; Review in frischem Kontext mit Perspektive Security und Betrieb, Lesebefund der Spec vor dem Bau, nie gebündelt; Sicherheits-Checkliste des Reviewers (Abschnitt unten) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** R-PERM-04 (aus 035a, hier durchgesetzt), R-PERM-01, R-PERM-02; AGENTS.md R2, R4, R6, R7, R8, R11, R12
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/035; ADR 0014, ADR 0011, ADR 0006, ADR 0013; Scheiben 029b, takt-023, 033a, 034a, 034b, takt-033; Lesebefund zu Spec 035/036 (Opus, 30.09.2026: B1, M4–M8, m2, m4, m5, m6, m7, m8, m9, m11, m12); Bedrohungsmodell T-G1-I-09, T-G1-S-02, T-G1-D-03, T-G3-I-01, SG1, SG2, SG4, SG5; Register B11, E10, E33
**Depends on:** 035a (gemergt: Vertrag 0.3.11, `stream.ts`), 023, 010, 024, 034b, takt-033 (im Code auf `59ef4fd`)
**Perspektive:** Security (Sitzungsentzug, Leserechte), Betrieb (lange Verbindungen, Grenzen) · **Glossar: neue Begriffe:** nein

## Warum hoch

- **Sitzungsentzug.** Ein offener Strom muss bei Abmelden, Ablauf, Subject-Sperre und `RoleRevoked` enden
  (T-G1-I-09 c, T-G1-S-02, SP-7).
- **Netzgrenze und Ressourcen.** Lange Verbindungen umgehen die Annahme aus 034a, dass jede Anfrage nach höchstens 10 s
  endet. Neue Obergrenzen je Sitzung, je Subject und global (T-G1-D-03).
- **Integrität.** Der Strom darf nie Ereignisse aus einer ungeprüften oder geänderten Kette liefern (SG4).
- **Rechte.** R-PERM-04 wird hier je Zustellung durchgesetzt.

## Befund (Ist-Stand, gelesen auf `59ef4fd`)

- `apps/api/src/app.ts:1170-1171`: keine Route, veralteter Kommentar („optional per the slice spec“).
- Request-Timeout (`apps/api/src/limits/middleware.ts:69-91`) misst bis zur Rückgabe der Antwort. `postgresBoundary`
  (`app.ts:543-650`) prüft Migrationsstand und Laufzeitrechte, öffnet dann eine Transaktion für die ganze Anfrage.
  `idle_in_transaction_session_timeout` 15 s. `server.ts:58`: `headersTimeout: 10_000, requestTimeout: 30_000`.
- `loadChain` (`app.ts:272-291`) liefert ein versiegeltes Log und `historyChanged`. `historyChanged` bezieht sich auf
  den **gemeinsamen** Kettencache der App. Hat eine Fachanfrage die geänderte Kette zuerst gesehen und den Cache ersetzt,
  meldet das nächste Laden des Verteilers **kein** `historyChanged` mehr (Lesebefund B1).
- `readSession(token, now, false)` (`apps/api/src/auth/store.ts:104-122`) deckt Widerruf, Ablauf, Leerlauf und Sperre ab,
  ohne das Leerlauffenster zu verlängern.
- CORS: `allowHeaders` (`app.ts:453`) enthält `Last-Event-ID` nicht.
- `createRequestLog` schreibt eine Zeile, wenn die Kette zurückkehrt, bei Streaming also beim Öffnen.
- `apps/api/src/__tests__/helpers.ts:297-308`: `req()` wartet auf `app.request` und prüft die Antwort gegen den Vertrag.
  Für einen offenen Strom endet das nicht.

## Ziel und Entscheidungen vor Bau

Ein angemeldeter Leser öffnet `GET /v1/stream` und erhält in Echtzeit genau die Nachrichten, die R-PERM-04 (035a)
erlaubt, lückenlos wiederaufnehmbar. Sobald er die Rechte verliert, endet der Strom. Kein offener Strom bindet eine
Datenbankverbindung.

1. **Öffnen (m7).** Reihenfolge: bestehende Middleware (Zugriffslog, Sicherheitsheader, CORS, Request-Timeout, Quelle,
   Body-Limit, Akteur, Subject-Limits) → `validateOperation('streamEvents')` → dieselben Vorprüfungen wie
   `postgresBoundary` ohne Transaktion (Migrationsstand offen → 503 `StreamUnavailable`, `assertRuntimePrivileges`) →
   Platz reservieren (Entscheidung 7) → erste Auflösung aus der Projektion des Verteilers → 200.
   - **Frische beim Öffnen:** Liegt das letzte Nachladen des Verteilers mehr als 1 s zurück (oder hat er noch nie
     geladen), lädt er vor der ersten Auflösung frisch nach. Sonst bekäme eine gerade zugeordnete Rolle ein falsches 403.
   - Die Route nutzt weder `postgresBoundary` noch den `domain`-Proxy.
   - Das Sitzungstoken liegt nur in der Closure der Route. Es wird nie geloggt, nie in einem Fehler weitergegeben und nie
     an den Verteiler übergeben (SP-5).
   - CORS: `Last-Event-ID` kommt in `allowHeaders` (m9).
2. **Verteiler je App (`apps/api/src/stream/hub.ts`).** Genau einer je `createApp`. Er startet mit dem ersten offenen
   Strom und endet mit dem letzten.
   - **Auslöser:** (a) nach jedem COMMIT mit neuen Ereignissen in `postgresBoundary` ein Anstoß ohne Nutzdaten; (b) ein
     Takt von 1 s, solange Ströme offen sind (andere Instanzen); (c) beim In-Memory- und JSONL-Pfad `store.subscribe`.
     Jeder Auslöser **plant nur** ein Nachladen ein (m8), er erledigt keine Arbeit im Hörer. Höchstens ein Nachladen
     zugleich, Stapel frühestens alle 250 ms.
   - **Nachladen:** eigene kurze Transaktion `REPEATABLE READ READ ONLY` auf eigener Verbindung über `loadChain`
     (Struktur wie `readSnapshotEvents`, Verbindung verwerfen nach 034a).
   - **Zustand:** eine Projektion je Jahrgang (`State` über `reduce`), schrittweise fortgeschrieben. Vor dem Anwenden
     eines Stapels bestimmt er die Lesbarkeit „vorher“ der betroffenen Gegenstände, danach „nachher“ (035a).
3. **Eigene Kontinuitätsprüfung (B1).** Der Verteiler hält `(lastSeq, lastHash)` des zuletzt angewandten Ereignisses.
   Bei **jedem** Nachladen prüft er selbst: Das geprüfte Log hat mindestens `lastSeq` Einträge, und
   `log[lastSeq-1].hash === lastHash`.
   - Bricht das, weil das Log kürzer ist oder der Hash abweicht, erhalten **alle** offenen Ströme `reset {lastSeq: Kopf}`
     und werden geschlossen. Der Verteiler verwirft seine Projektionen, baut sie aus dem neuen Log neu auf und setzt
     `(lastSeq, lastHash)` neu.
   - Das gilt unabhängig davon, ob `historyChanged` gesetzt ist. `historyChanged` dient nur der bestehenden festen
     stderr-Zeile aus takt-033 (unverändert).
   - `PostgresIntegrityError` → alle Ströme `end {unavailable}`, schließen, Zustand verwerfen. Ein neues Öffnen antwortet
     wie jede Fachanfrage 500 ohne Inhalt.
   - Ein Ereignis ohne Hash im Stapel → `end {unavailable}` für alle (m6).
   - Eine `id` ist nie kleiner oder gleich einer auf dieser Verbindung schon gesendeten.
   - Zugestellt werden nur Ereignisse aus einem geprüften Log, nie aus `pendingEvents`.
4. **Rechte zum Zustellzeitpunkt (M4, M6).**
   - **Referenz beim Öffnen:** die Akteurkarte `resolveReaderActors` (035a) aus der Projektion des Verteilers,
     `meetingId → Actor`. Leere Karte → 403 R-PERM-01 beim Öffnen. Mit `meetingId`-Filter ohne Eintrag für diesen
     Jahrgang → 403.
   - **Vor jedem Stapel mit sichtbarer Nachricht und bei jedem Heartbeat:** Die Karte wird **aus der Projektion des
     Verteilers** neu bestimmt, einschließlich des Stapels und nach `clock()` für den Ablauf. Es wird nie je Strom
     `readSnapshotEvents` gelesen (M6). Leere Karte → `end {forbidden}`. Jede andere Abweichung von der Referenz (ein
     Jahrgang mehr oder weniger, andere Rolle, anderer Fachbereich, andere Person) → `end {roles_changed}`. Aus diesem
     Stapel wird dann **nichts** zugestellt, auch nichts mit kleinerem `seq`.
   - **Sitzung:** `authStore.readSession(token, clock(), false)`. Das Ergebnis wird je Sitzung höchstens 1 s gemerkt und
     von allen Strömen dieser Sitzung geteilt, also höchstens eine Prüfung je Sitzung und Stapel. Die Prüfungen laufen
     über höchstens **2** gleichzeitige Pool-Verbindungen (eigene Warteschlange). Die Heartbeats der Ströme sind
     versetzt (Startversatz je Strom innerhalb der 15 s). `null` → `end {session}`. Scheitert die Prüfung selbst
     (Datenbank, Timeout) → `end {unavailable}`: fail closed.
   - Im Demo-Header-Modus (`X-Actor`, nur Tests) entfällt die Sitzungsprüfung; die Akteurkarte gilt.
5. **Wiederaufnahme** (Semantik aus 035a, hier umgesetzt).
   - Cursor = `Last-Event-ID`, sonst `after`; ohne beide beginnt der Strom am Kopf mit `cursor`.
   - Cursor > Kopf oder Abstand > 1000 → `reset`, schließen.
   - Sonst Nachlauf: Leser mit `event.read` alle Ereignisse einzeln; die übrigen `replayMessage` (035a), die `change`
     mit `replay: true` oder `reset` liefert.
   - **Gegendruck (M8):** Der Nachlauf wird mit Gegendruck geschrieben: warten, bis der Socket wieder aufnimmt, nicht
     vorab puffern. Die Rückstaugrenze gilt nur für **eingereihte, noch nicht gesendete Live-Nachrichten** (256 oder
     1 MiB). Noch nicht gesendete `change`-Nachrichten werden zu einer zusammengeführt (Vereinigung von Themen und
     Kennungen, höchstens 100, sonst ohne `subjects`; `id` = höchste). Erst über der Grenze wird die Verbindung
     geschlossen.
   - **Garantie:** Für Leser mit `event.read` kommt jedes `seq > Cursor` genau einmal, aufsteigend, ohne Lücke, global
     über alle Jahrgänge (M5 (a)). Für die übrigen geht keine sichtbare Änderung nach dem Cursor verloren; `id` steigt
     streng.
   - `cursor` mit dem Heartbeat, wenn der Kopf nur durch unsichtbare Ereignisse vorgerückt ist.
6. **Jahrgangsfilter.** Mit `meetingId` nur Ereignisse dieses Jahrgangs, der Cursor bleibt global. Unbekannt → 404.
   `/v1/events` bleibt ohne Filter (043).
7. **Grenzen und Zeitverhalten** (feste Werte in `apps/api/src/limits/config.ts`, für Tests per Option senkbar, nicht
   per Umgebung; eine Anhebung ist eine Spec-Änderung):

   | Wert | Standard | Verhalten |
   |---|---|---|
   | Heartbeat | 15 s, versetzt | Kommentarzeile, bei Bedarf `cursor`; Anlass für die Prüfung aus Entscheidung 4 |
   | Ströme je Sitzung (Demo-Header: je Akteur) | 3 | darüber 429, `Retry-After: 30`; ältere Ströme werden nicht verdrängt |
   | Ströme je Subject (m4) | 6 | darüber 429, `Retry-After: 30` (mehrere Geräte einer Person) |
   | Ströme je Prozess | 200 | darüber 503 `StreamUnavailable`, `Retry-After: 30` |
   | Lebensdauer eines Stroms (M7) | 25 min | `end {rotate}`; der Client verbindet mit `Last-Event-ID` neu, Anmeldung, Rate-Limit, Grenzen und Vorprüfungen laufen erneut |
   | Nachlauf | 1000 Ereignisse | darüber `reset` |
   | Rückstau je Verbindung | 256 Nachrichten oder 1 MiB, nur Live | zusammenführen, darüber schließen (M8) |

   - **Reservierung (m4):** Der Platz wird **synchron** vor dem ersten `await` nach den Zählprüfungen reserviert und bei
     jedem Abbruch (Fehler vor 200, Client-Abbruch über `c.req.raw.signal`, Schreibfehler, `end`) genau einmal
     freigegeben.
   - **Rotation und Leerlauf (M7):** Das Öffnen verlängert das Leerlauffenster der Sitzung wie jede Anfrage (bestehende
     Middleware). Ein offener, sichtbarer Strom zählt damit alle 25 min als Aktivität, so wie heute der 30-s-Takt und das
     Auffrischen von `/auth/me`. Das ist keine Verhaltensänderung gegenüber heute. Die Zustellung selbst verlängert nie
     (`slideIdle = false`). Siehe Eigentümerfrage 1.
   - Das Request-Timeout aus 034a gilt für das Öffnen (Vorprüfungen, erste Auflösung, Nachlaufbeginn innerhalb 10 s),
     danach nicht mehr. Es gibt keine Ausnahme in `TIMEOUT_EXEMPT`. Das Rate-Limit zählt das Öffnen als einen Lesevorgang.
   - Antwortkopf: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-store, no-transform`,
     `X-Accel-Buffering: no`, keine Kompression. Die Sicherheitsheader aus 034a bleiben.
   - **Proxy- und Netlify-Pufferung nur festhalten, nichts ändern** (Eigentümerfrage 3). Keine Netlify-, Proxy- oder
     Deploy-Konfiguration wird geändert.
8. **Zugriffslog (033a): eine Zeile je Strom.** Die bestehende Zeile beim Öffnen: `operationId` `streamEvents`, Status,
   `latencyMs` bis zur Antwort, `seq` `null`. Keine neuen Schlüssel, keine Zeile je Nachricht, kein Stromende. Ein Ende
   wegen `unavailable` meldet stderr einmal je Vorkommen gebündelt über `createNotices`, mit fester Zeile ohne Inhalt.
9. **Dienst ohne Postgres** (In-Memory, JSONL): gleiche Route, Verteiler über `store.subscribe`. Kontinuitätsprüfung
   (Entscheidung 3) gilt ebenso.

## Nicht-Ziele

- Keine Änderung an Domäne oder Vertrag (035a), an `ROLE_PERMISSIONS` oder an der Wahrheitstabelle.
- Kein Web-Code (036a/036b).
- Kein WebSocket, kein Broker, kein `LISTEN/NOTIFY`, keine Migration.
- Keine Konfiguration der Stromgrenzen per Umgebung (034b-Schema, `.env.example` bleiben).
- Keine Änderung an Netlify, Proxy, Deploy oder `server.ts`.
- Keine Alarme (085), keine Bühnen-Wiederaufnahme im Web (058), kein Lasttest (071).

## Files allowed

- `docs/slices/035b-sse-dienst.md`
- `packages/contract/allowlist.json` (nur Eintrag `streamEvents` entfernen, im Commit mit dem ersten Test der Route)
- `apps/api/src/stream/hub.ts` (neu: Verteiler, Kontinuität)
- `apps/api/src/stream/sse.ts` (neu: SSE-Rahmung, reine Funktionen)
- `apps/api/src/stream/route.ts` (neu: Öffnen, Vorprüfungen, Grenzen, Reservierung, Zustellung, Gegendruck)
- `apps/api/src/stream/sessionCheck.ts` (neu: gemerkte Sitzungsprüfung mit Warteschlange)
- `apps/api/src/app.ts` (nur: Route registrieren, Anstoß nach COMMIT, Verteiler verdrahten, `Last-Event-ID` in CORS
  `allowHeaders`, veralteten Kommentar ersetzen, Option für die Stromgrenzen, optionaler Test-Haken in `testHooks`)
- `apps/api/src/limits/config.ts` (nur Stromgrenzen als Konstanten)
- `apps/api/src/__tests__/stream035.test.ts` (neu, ohne Postgres)
- `apps/api/src/__tests__/stream-reader035.ts` (neu: Test-Leser für offene Ströme; `helpers.ts` bleibt unverändert, m5)
- `apps/api/src/__tests__/postgres-stream035.test.ts` (neu, mit Postgres)
- `docs/sicherheit/bedrohungsmodell.md` (nur Zeilen T-G1-I-09, T-G1-S-02, T-G1-D-03, T-G3-I-01: Stand und Tests; m12)
- `docs/adr/0014-realtime-sse.md` (nur „Nachweis“ und Ergänzung: Domänenfunktion R-PERM-04 statt „ohne Domänenänderung“,
  Teilung, Rotation; **Architekt**)
- `docs/folgeliste.md` (nur nicht blockierende Befunde; Sicherheitsbefunde nie)
- `docs/produktplan-beta.md` (nur Stand-Zeile Etappe B nach dem Merge)

Weitere Dateien sind Scope-Befunde (Liste im nächsten Abschnitt).

## Ausdrücklich nicht erlaubt

`apps/api/src/__tests__/helpers.ts`, `apps/api/src/limits/middleware.ts`, `apps/api/src/observability/*`,
`apps/api/src/persistence/*`, `apps/api/src/server.ts` und `packages/**` außer der Allowlist. Dieser Abschnitt steht
bewusst außerhalb von „Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. 035a gemergt; Vertrag 0.3.11 in `types.ts`; `stream.ts` exportiert `visibleMessages`, `replayMessage`,
   `resolveReaderActors`, `EVENT_SUBJECTS`.
2. **Streaming in Hono:** Mit `hono/streaming` und der eingesetzten Version von `@hono/node-server` prüfen:
   - Kommt der Client-Abbruch über `c.req.raw.signal` an?
   - Kehrt die Middleware-Kette bei Rückgabe der Antwort zurück, nicht erst am Stromende?
   - Setzt `createRequestLog` `X-Server-Time` auf der Streaming-Antwort, ohne den Rumpf zu puffern?
   - Liefert ein Schreibaufruf Gegendruck (Promise), der für den Nachlauf nutzbar ist?
3. **Node-Server:** Beendet `requestTimeout: 30_000` bzw. `headersTimeout` eine laufende Antwort? Nachweis mit einem
   echten Server (`serve` mit denselben `serverOptions`) über mehr als 30 s. Sind die Optionen nicht wiederverwendbar,
   ist das ein Befund, keine Änderung an `server.ts`.
4. Das Abdeckungstor erkennt `streamEvents` als ausgeübt, auch wenn die Tests `app.request` über den eigenen Leser rufen.
   Sonst Befund.
5. Weichen Zeilenangaben ab, melden und anhalten.

## Tests zuerst (rot, dann grün)

Die Tests ohne Postgres laufen auf In-Memory-Persistenz mit Test-`authStore` und Demo-Header; Zeitgeber per Option oder
Fake-Timer, Uhr injiziert. Offene Ströme liest `stream-reader035.ts`. Die Nummern 12–29 sind die Diensttests dieser
Spec; ein Verweis auf einen Domänentest heißt immer ausdrücklich „035a Test n“. `req()` nur für Antworten, die enden (Fehlerfälle,
m5).

**Ohne Postgres** (`stream035.test.ts`):

12. Öffnen: 200, Kopf aus Entscheidung 7, erste Zeile `retry: 3000`, Heartbeat nach 15 s. Fehlerfälle: ohne Sitzung 401;
   ohne aktive Rolle 403 R-PERM-01; `Last-Event-ID: abc` 422; `Last-Event-ID` über dem Maximum 422; unbekanntes
   `meetingId` 404; Migrationen offen → 503 `StreamUnavailable` mit `Retry-After` (m7); Preflight mit `Last-Event-ID`
   aus erlaubter Herkunft → erlaubt (m9).
13. **Trennen und wieder verbinden, keine Lücke:** admin empfängt `1…k`, trennt, Schreibvorgänge folgen, neu mit
    `Last-Event-ID: k` → genau `k+1…m`, ohne Doppel. Dasselbe mit `after`. Mit beiden gewinnt `Last-Event-ID`. Admin
    erhält auch Ereignisse eines Jahrgangs ohne eigene Zuordnung (M5).
14. Nicht-admin nach Trennung: `change` mit `replay: true` bzw. `reset` nach 035a Test 9. **podium** trennt, eine Frage
    wird vorgelesen oder auf die Bühne gestellt, neu verbinden → `reset` (jeder Leser mit `stage.read` gilt für `stage`
    als gegenstandsgebunden, 035a). **moderation** trennt, eine Frage wird auf die Bühne gestellt, neu verbinden →
    `reset`; nur eine Einordnung im Bereich → `change` mit `replay: true`. **expert** trennt, eine Frage wird aus seinem
    Fachbereich wegverteilt, neu verbinden → `reset` (M3).
15. Cursor > Kopf → `reset` ohne `id`; Abstand > 1000 → `reset`; danach geschlossen.
16. **Rollenentzug während des offenen Stroms:** `RoleRevoked` → `end {forbidden}`, keine Nachricht aus dem Stapel.
    Einengung → `end {roles_changed}`. **`RoleAssigned` in einem zweiten Jahrgang → `end {roles_changed}`** (M4). Ablauf
    nach injizierter Uhr → `end {forbidden}` beim nächsten Heartbeat.
17. **Sitzung:** Abmelden, Subject-Sperre, Leerlaufablauf → `end {session}` vor der nächsten Zustellung. `readSession`
    nur mit `slideIdle = false` (Spy). Drei Ströme derselben Sitzung, ein Stapel → genau **eine** Sitzungsprüfung (M6).
    Prüfung wirft → `end {unavailable}`.
18. **Obergrenzen:** vierter Strom derselben Sitzung → 429 mit `Retry-After`; siebter Strom desselben Subjects über drei
    Sitzungen → 429. Globale Grenze (gesenkt auf 2) → 503 `StreamUnavailable`. **Paralleles Öffnen (m4):** 10 gleichzeitige
    Öffnungen derselben Sitzung → genau 3 × 200, 7 × 429. Nach Abbruch ist der Platz sofort frei; nach einem Fehler vor
    200 ist kein Platz belegt.
19. Lebensdauer (gesenkt) → `end {rotate}`.
20. **Gegendruck (M8):** Nachlauf von 1000 Ereignissen an einen langsamen Leser (liest in Stücken mit Pausen) wird
    vollständig und lückenlos zugestellt, ohne Abbruch. Live-Rückstau über der Grenze: `change`-Nachrichten werden
    zusammengeführt; erst bei Überschreiten mit `event`-Nachrichten schließt die Verbindung.
21. **Zugriffslog:** ein Strom mit 50 Nachrichten → genau eine Zeile, `operationId` `streamEvents`, ohne Inhalt, Thema,
    Kennung oder Token.
22. Jahrgangsfilter: nur Ereignisse des Jahrgangs, `id` global.
23. Ereignis ohne Hash im Stapel (Test-Persistenz) → `end {unavailable}` (m6). Auslöser `store.subscribe` erledigt keine
    Arbeit synchron (Spy: kein Aufruf von `visibleMessages` im Hörer; m8).
23a. **Frische beim Öffnen:** `RoleAssigned` festgeschrieben, das letzte Nachladen des Verteilers liegt länger als 1 s
    zurück, sofortiges Öffnen → 200, kein 403.
23b. **Kontinuität ohne Postgres (B1):** In-Memory-Test-Persistenz, deren geprüftes Log beim nächsten Nachladen gekürzt
    bzw. durch eine gültige andere Kette ersetzt ist → `reset` an alle Ströme, Neuaufbau ab dem neuen Kopf.
23c. **„stream lifetime < SESSION_IDLE_MS“ (M7):** Die feste Lebensdauer (25 min) liegt unter `SESSION_IDLE_MS` aus
    `apps/api/src/auth/sessions.ts` (Test gegen die beiden Konstanten). So verlängert die Rotation eine offene Sitzung,
    bevor ihr Leerlauffenster abläuft.

**Mit Postgres** (`postgres-stream035.test.ts`, eigene DB je Lauf):

24. Schreiben über eine **zweite** App-Instanz → Zustellung auf dem Strom der ersten innerhalb von 2 s; über dieselbe
    Instanz innerhalb von 500 ms.
25. **Manipulation bei offenem Strom** (alte Zeile per Owner-Verbindung geändert) → `end {unavailable}` auf allen
    Strömen; ein neues Öffnen → 500 ohne Inhalt.
25b. **Kette ersetzt, zuerst von einer Fachanfrage gesehen (B1):** Owner-Verbindung ersetzt das Log durch eine gültige
    andere Kette. Eine Fachanfrage derselben App lädt zuerst (Cache ersetzt, `historyChanged` dort verbraucht), danach
    lädt der Verteiler → alle Ströme `reset`. Kein Ereignis der neuen Kette wird als Fortsetzung zugestellt.
25c. **Log gekürzt, zuerst von einer Fachanfrage gesehen (B1):** wie 25b mit gekürztem Log → `reset`; nach Neuaufbau
    stellt der Verteiler neue Ereignisse ab dem neuen Kopf zu.
26. `RoleRevoked` über die zweite Instanz → `end {forbidden}` auf der ersten.
27. Subject-Sperre über die zweite Instanz → `end {session}` spätestens beim nächsten Heartbeat oder vor der nächsten
    Zustellung.
28. **Keine gehaltene Verbindung:** Mit 10 ruhenden Strömen ist **außerhalb** der Nachlade- und Prüffenster (per
    Test-Haken markiert) keine Pool-Verbindung ausgecheckt und keine Transaktion der Laufzeitrolle offen
    (`pg_stat_activity`). Gemessen wird nur zwischen den Fenstern (M6).
29. **Last (M6):** 200 offene Ströme (20 Sitzungen, Heartbeat gesenkt) und parallel 20 Schreibvorgänge → alle
    Schreibvorgänge 2xx innerhalb des Budgets aus 034a, **kein** 503 `PersistenceBusy`, höchstens 2 gleichzeitige
    Verbindungen für Sitzungsprüfungen (Test-Haken), alle Ströme erhalten die Ereignisse.

**Echter Server:** Ein Strom über mehr als 30 s mit den `serverOptions` aus `server.ts` bleibt offen und erhält Heartbeats.

## Akzeptanzkriterium

1. Tests 12–29 (mit 23a–23c) und der Test mit echtem Server grün, zuerst rot belegt; `streamEvents` nicht mehr in der Allowlist;
   Abdeckungstor grün.
2. Bedrohungsmodell T-G1-I-09, T-G1-S-02 (Stromteil), T-G1-D-03, T-G3-I-01 mit Stand und Testnamen; ADR-0014-Ergänzung vom
   Architekten vor dem Merge.
3. `pnpm gates` **mit Postgres-Variablen** grün auf sauberem Baucommit; `slice-scope` akzeptiert nur die Dateien oben.
4. Lesebefund vor dem Bau; Security- und Betriebsreview in frischem Kontext; Blocker/Major vor dem Merge;
   Sicherheitsbefunde nie auf die Folgeliste. Jeder Commit nennt „Scheibe 035b“ und endet mit `[skip netlify]`.

## Nachweise

Schluss von `pnpm gates` mit Postgres-Variablen; Testnamen 12–29; gemessene Zustellzeiten (Test 24); Messwerte aus
Test 29 (Schreiblatenzen, Verbindungen); Rohstromausschnitte aus Test 13 (Lückenlosigkeit) und 25b (`reset`). Kein
Screenshot: keine Oberfläche.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch
Ausgelöst: [x] Rolle, Recht, Identität (Sitzungsentzug im Strom) [x] Persistenz, Nebenläufigkeit (Verteiler, Kette) [x] Betrieb (lange Verbindungen, Grenzen) [x] vertrauliche Daten (SG1, SG2)
Perspektive(n): Security (6.5), Betrieb (6.7) · Nachweise: Tests 12–29 · Offene Entscheidung: Eigentümerfragen 1–3; E33

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Invarianten.**
  1. Keine Nachricht ohne vorherige Akteurprüfung und ohne gültige, höchstens 1 s alte Sitzungsprüfung für diesen
     Stapel.
  2. Nur Ereignisse aus einer geprüften Kette, deren Fortsetzung der Verteiler selbst über `(lastSeq, lastHash)` belegt
     hat; streng steigende `id`.
  3. Kein offener Strom hält außerhalb kurzer Nachlade- und Prüffenster eine Datenbankverbindung.
  4. Das Sitzungstoken verlässt die Closure der Route nicht.
- **MF-SSE-2 (T-G1-I-09 b), Abspielen über eine Rechtegrenze.** Ein Client setzt `Last-Event-ID: 0`. Abwehr: Nachlauf
  höchstens 1000; Rechte zum Zustellzeitpunkt; Nichtadmins erhalten nur eine zusammengefasste Nachricht oder `reset`;
  Rate-Limit. Erkennung: Zugriffslog (Öffnungen je Subject-Hash), 429.
- **MF-SSE-3 (T-G1-I-09 c, T-G1-S-02, SP-7), Gerät verloren oder gesperrt.** Abwehr: Sitzungsprüfung je Stapel und
  Heartbeat, Rotation nach 25 min. Erkennung: `end {session}`; der nächste Aufbau scheitert mit 401, im Zugriffslog
  sichtbar.
- **MF-SSE-4 (T-G1-D-03), viele Ströme.** Abwehr: 3 je Sitzung, 6 je Subject, 200 je Prozess, Rückstaugrenze,
  Rate-Limit, höchstens 2 Verbindungen für Sitzungsprüfungen. Erkennung: 429/503 im Zugriffslog.
- **MF-SSE-5 (SG4), geänderte Kette.** Abwehr: eigene Kontinuitätsprüfung (B1) zusätzlich zum Kettencache. Erkennung:
  `reset` an alle, stderr-Zeile aus takt-033.
- **Restrisiko (Eigentümerfrage 2).** Aktivitätsvolumen über `id`-Sprünge und Zeitpunkte.
- **Fehler- und Wiederherstellungsfall.**
  - Datenbank weg: Das Nachladen scheitert und wird im Takt wiederholt. Ströme erhalten Heartbeats, aber keine
    Zustellung. Scheitert die Sitzungsprüfung → `end {unavailable}`.
  - Integritätsfehler → alle `unavailable`, neue 500.
  - Neustart → Clients setzen mit `Last-Event-ID` fort.
- **Betrieb.**
  - Speicher: Projektion je Jahrgang plus je Verbindung höchstens 1 MiB.
  - Datenbank: ein Nachladen je Sekunde bei offenen Strömen (Digest 22–25 ms laut takt-033), dazu höchstens eine
    Sitzungsprüfung je Sitzung und Stapel auf höchstens 2 Verbindungen.
  - Messung unter Last in 071.
- **Datenschutz (ADR 0013).** Kein neuer Log-Schlüssel, keine Zeile je Nachricht, keine Kennzahl je Person.

## Sicherheits-Checkliste (Antworten für den Reviewer)

| Punkt | Antwort |
|---|---|
| SC-01 | ja: Route hinter Actor-Port, `validateOperation` und R-PERM-04 (`can()` im Kern); Kontext aus der Projektion, nie vom Client; kein Rollenname |
| SC-02 | ja: keine neue Aktion; Sichtbarkeitstabelle aus 035a unverändert angewandt |
| SC-03 | ja: nur Nachrichten nach 035a; `reset` und `end` ohne `id` und ohne Inhalt; Tests 13–16, 21 |
| SC-04 | ja: Nachlauf 1000, Grenzen je Sitzung, Subject und Prozess, Rate-Limit auf das Öffnen |
| SC-05 | ja: Sitzungsentzug, Sperre, Rollenentzug beenden den Strom (Tests 16, 17, 26, 27); kein Geheimnis im Diff |
| SC-06 | ja: MF-SSE-2 bis MF-SSE-5 mit Erkennung |
| SC-07 | ja: nur lesend; Zeit aus der injizierten Uhr (Ablauf, Rotation) |
| SC-08 | ja: nur SELECT in kurzen Lesetransaktionen, keine Verbindung über die Stromdauer (Test 28) |
| SC-09 | nicht anwendbar (kein Nachbarsystem); T-G3-I-01 über denselben Filter |
| SC-10 | ja: keine neue Abhängigkeit (`hono/streaming` gehört zu Hono) |
| SC-11 | ja: eine Zugriffslogzeile ohne Inhalt, stderr mit fester Zeile |
| SC-12 | ja: nur Allowlist-Eintrag entfernt, kein Tor verändert |
| SP-2 | ja: Grenzen aus Entscheidung 7, Gegendruck, Speicher je Verbindung begrenzt, Merker der Sitzungsprüfung mit Ablauf 1 s |
| SP-3 | ja: Cookie, CSRF (nur lesend, keine Schreibroute), Leerlauf (`slideIdle = false` beim Zustellen), 401 unverändert |
| SP-4 | nicht anwendbar (kein HTML); `Cache-Control: no-store, no-transform` |
| SP-5 | ja: kein Geheimnis im Diff; das Sitzungstoken lebt nur in der Closure der Route, wird nie geloggt, nie in Fehlern oder Nachrichten weitergegeben, nie an den Verteiler übergeben (Test 21 prüft das Log) |
| SP-6 | ja: T-G1-I-09 (b, c), T-G1-S-02, T-G1-D-03, T-G3-I-01 mit Tests |
| SP-7 | ja: Sperrliste wirkt auf offene Ströme vor der nächsten Zustellung (Tests 17, 27) und bei Wiederaufnahme (Öffnen prüft die Sitzung) |

## Offene Eigentümerfragen

1. **Rotation als Aktivität (Sitzung).** Ein offener, sichtbarer Strom verlängert das Leerlauffenster alle 25 min beim
   Neuaufbau. Das entspricht dem heutigen 30-s-Takt und dem Auffrischen von `/auth/me`. Standard, gebaut: so hinnehmen.
   Alternative: Öffnen ohne Verlängerung, dann endet eine Sitzung bei offenem Tab nach 30 min ohne Eingabe.
2. **Restrisiko Aktivitätsvolumen (Security/Datenschutz).** Leser ohne `event.read` sehen an `id`-Sprüngen und
   Nachrichtenzeitpunkten, wie viel sonst geschieht, ohne Inhalt und ohne Kennung. Standard, gebaut: hinnehmen wie die
   Zähler (T-G1-I-04). Alternative: undurchsichtige Marke statt `seq` (Vertragsänderung, spätere Scheibe).
3. **Produktionsweg für lange Verbindungen (Betrieb, E10/E33, ADR 0007).** Reicht der Weg über Netlify bzw. den
   Konzern-Proxy `text/event-stream` ungepuffert und ohne Leerlaufgrenze unter 20 s durch, und ist HTTP/2 bis zum
   Browser gesichert? Diese Scheibe ändert nichts daran. Standard bis zur Klärung: Polling-Rückfall aus 036b; Prüfung beim
   ersten Staging-Deploy.

## Bericht (nach Bau ausfüllen)

```
Slice: 035b-sse-dienst
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates` mit Postgres-Variablen; Testnamen 12–29; Zustellzeiten; Lastwerte
Open: Eigentümerfragen 1–3; Lasttest 071
Touched: <Dateiliste>
```

## Review findings

Lesebefund zu Spec 035 (Opus, frischer Kontext, `9f2560c`): nicht baureif. In dieser Fassung eingearbeitet: B1
(Entscheidung 3, Tests 25b/25c), M4 (Entscheidung 4, Test 16), M5 (a) (Entscheidung 5, Test 13), M6 (Entscheidung 4,
Tests 17, 28, 29), M7 (Entscheidung 7, Eigentümerfrage 1), M8 (Entscheidung 5, Test 20), m2, m4, m5, m6, m7, m8, m9,
m11 (Tests 12, 18, 23), m12. Domänenteil in 035a.
