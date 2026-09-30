# Scheibe 035 — SSE-Strom /v1/stream mit Last-Event-ID und Rechteprüfung je Zustellung

**Status:** spec (Lesebefund vor dem Bau ausstehend, Pflicht bei Klasse hoch)
**Risikoklasse:** hoch · 2,5 AStd (Plan: 1 AStd) · 28.10.2026 (W5) · Lanes: service, domain; contract und docs-adr nur Architekt; docs-sicherheit
**Rolle:** service-implementer; Architekt für Vertrag (vor dem Bau) und ADR-0014-Ergänzung; Review in frischem Kontext mit Perspektive Security und Betrieb, Lesebefund der Spec vor dem Bau, nie gebündelt (Leitplanken §4; Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** neu **R-PERM-04** (Stromsichtbarkeit: je Ereignis, je Leser, mit den Rechten zum Zustellzeitpunkt); angewandt R-PERM-01 (keine aktive Rolle), R-PERM-02 (Leserecht fehlt), R-PERM-03 (Leseumfang über `can()`); AGENTS.md R2, R4, R6, R7, R8, R11, R12
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/035; ADR 0014 (Realtime über SSE), ADR 0011 (globaler, lückenloser `seq`), ADR 0002 (Demo in-process), ADR 0006 (Bühne setzt über `Last-Event-ID` wieder auf); Scheibe 010 (Festlegung 5: `subscribe`, `event.read`), takt-023 (Rollenverlust), 029b (Sitzung, Subject-Sperre), 033a (Zugriffslog), 034a/034b (Grenzen, Timeouts), takt-033 (Kettencache, `historyChanged`); Bedrohungsmodell T-G1-I-09, T-G1-S-02, T-G1-D-03, SG1, SG2, SG4; Register B11, E33
**Depends on:** 023, 010, 024, 034b, takt-033 (im Code vorhanden auf `59ef4fd`)
**Perspektive:** Security (Leserechte, Sitzungsentzug), Betrieb (lange Verbindungen, Grenzen) · **Glossar: neue Begriffe:** nein (Arbeitsbegriffe „Änderungssignal“, „Verteiler“ nur in dieser Spec und im Code, nicht in der Oberfläche)

## Warum hoch, nicht mittel wie im Plan

Der Plan führt 035 als mittel. Nach Leitplanken §4 gilt die höchste ausgelöste Klasse, und drei Hoch-Auslöser sind
berührt:

1. **Rechte.** Der Strom ist eine neue Leseschnittstelle. Ein Fehler in der Filterung ist ein Leck von SG1/SG2
   (Entwürfe, Rechtseinschätzungen) an Rollen ohne Leserecht (T-G1-I-09 a). Dazu kommt eine neue Regel (R-PERM-04),
   die Rollen ohne `event.read` ein Änderungssignal gibt (Entscheidung 2). Das ist eine neue Leseregel, keine reine
   Übernahme von 010.
2. **Sitzungsentzug.** Ein offener Strom muss bei Abmelden, Ablauf, Subject-Sperre und `RoleRevoked` enden
   (T-G1-I-09 c, T-G1-S-02). Das ist Verhalten beim Sitzungsentzug.
3. **Netzgrenze und Ressourcen.** Lange Verbindungen umgehen die Annahme aus 034a, dass jede Anfrage nach höchstens
   10 s endet. Neue Obergrenzen je Sitzung und global werden eingeführt (T-G1-D-03).

Damit ist 035 **hoch**. Das ist eine Hochstufung, keine Herabstufung; `downgrade-check` bleibt grün. Die Schätzung von
1 AStd trägt den Umfang nicht (Vertrag, Domänenfunktion, Verteiler, Route, Postgres-Tests). Geschätzt sind 2,5 AStd.
Das liegt über einem Agententag; der Teilungsschnitt steht unter „Teilung“. Der Orchestrator entscheidet vor dem Bau.

## Befund (Ist-Stand, gelesen auf `59ef4fd`)

- **Vertrag:** `GET /stream` (`streamEvents`) ist seit 0.3.0 vorab erklärt (`packages/contract/openapi.yaml:837-866`):
  `after`, `meetingId` (Jahrgangsfilter), `Last-Event-ID` (Muster `^[0-9]+$`, sonst 422); „`Last-Event-ID` gewinnt“;
  Heartbeat 15 s als Kommentarzeile; „dieselbe Leseberechtigung wie `listEvents` je zugestelltem Ereignis (`event.read`
  plus die Leseumfänge aus 010)“. Er steht in `packages/contract/allowlist.json` mit Ablauf 25.11.2026. Nicht
  modelliert sind Nachrichtenarten außer `EventRead`, das Verhalten bei `seq` vor oder hinter dem Log, Obergrenzen und
  Stromende.
- **Dienst:** keine Route. `apps/api/src/app.ts:1170-1171` trägt einen veralteten Kommentar („optional per the slice
  spec“). `listEvents` prüft nur `event.read` und maskiert jedes Ereignis mit `maskEvent` (`packages/domain/src/api.ts:343-360,
  1207-1210`). Eine Prüfung des Leseumfangs je Ereignis gibt es nicht; sie ist bisher nicht nötig, weil nur `admin`
  `event.read` hält (`packages/domain/src/permissions.ts:22-77`).
- **Folge für den Plan:** Wörtlich genommen („wie die Leserechte aus 010“) dürfte nur `admin` den Strom lesen. ADR 0014
  und 036 brauchen ihn aber für alle Rollen (zweiter Browser sieht Änderung < 2 s). Deshalb Entscheidung 2.
- **Abonnement im Prozess:** `subscribe` gibt Lesern ohne `event.read` `[]` als bloßes Änderungssignal und prüft das
  Recht bei jeder Zustellung gegen den aktuellen Akteur (`api.ts:1227-1245`, Festlegung 5 aus 010).
- **Akteur:** `sessionActorFromEvents` (`apps/api/src/actor.ts:86-118`) wählt die älteste aktive Zuordnung.
  `createInProcessApi` löst den Akteur je Projektion erneut auf und wirft 403 R-PERM-01 ohne aktive Zuordnung
  (`api.ts:320-331`).
- **Grenzen aus 034a:** Das Request-Timeout von 10 s (`createRequestTimeout`, `apps/api/src/limits/middleware.ts:69-91`)
  misst bis zur Rückgabe der Antwort, nicht bis zum Ende des Rumpfs. Jede Fachanfrage läuft in einer Transaktion der
  `postgresBoundary` (`app.ts:543-650`). Die Pool-Parameter setzen `idle_in_transaction_session_timeout` auf 15 s.
  `server.ts:58` setzt `headersTimeout: 10_000, requestTimeout: 30_000`. Das Rate-Limit zählt je Anfrage.
- **Kette:** `loadChain` (`app.ts:272-291`) liefert ein versiegeltes, geprüftes Log, `historyChanged` und wirft
  `PostgresIntegrityError`. Der Cache lebt je App.
- **Zugriffslog:** `createRequestLog` (`apps/api/src/observability/requestLog.ts`) schreibt eine Zeile mit acht festen
  Schlüsseln, wenn die Middleware-Kette zurückkehrt, bei einer Streaming-Antwort also beim Öffnen.

## Ziel und Entscheidungen vor Bau

Ein angemeldeter Leser mit aktiver Rolle öffnet `GET /v1/stream` und erhält in Echtzeit genau das, was er lesen darf,
mit lückenloser Wiederaufnahme. Sobald er die Rechte verliert, endet der Strom.

1. **Nachrichtenarten (Vertrag, Architekt vor dem Bau).** Jede Nachricht ist ein SSE-Block mit `event:`, `id:` (außer
   `end`) und genau einer `data:`-Zeile JSON:
   - `event: event`: ein `EventRead` wie in `listEvents` (dieselbe Maskierung `maskEvent`), `id` = sein `seq`.
   - `event: change`: `StreamChange {seq, topics: StreamTopic[], subjects?: string[], meetingId?: string, replay?: true}`,
     `id` = `seq` des letzten abgedeckten Ereignisses. `StreamTopic` ist die feste Liste `meeting | speakers |
     contributions | questions | stage | roles`.
   - `event: cursor`: `{seq}`, `id` = aktueller Kopf. Wird mit dem Heartbeat gesendet, wenn der Kopf seit der letzten
     Nachricht nur durch Ereignisse vorgerückt ist, die der Leser nicht sieht. So bleibt die Wiederaufnahme kurz.
   - `event: reset`: `{lastSeq}`. Der Client verwirft seinen gepufferten Stand und lädt neu. Danach schließt der Dienst.
   - `event: end`: `{reason}` mit `reason ∈ session | forbidden | roles_changed | rotate | unavailable`. Danach schließt
     der Dienst. Kein Freitext, keine ID, kein `seq`.
   - Heartbeat: Kommentarzeile `: hb` alle 15 s. Erste Zeile des Stroms: `retry: 3000`.
   Neue Schemas `StreamChange`, `StreamCursor`, `StreamReset`, `StreamEnd`, `StreamTopic` unter `components/schemas`
   (dokumentarisch; OpenAPI modelliert SSE-Nachrichten nicht einzeln, die Beschreibung von `/stream` verweist darauf).
   Neue Antwort `StreamUnavailable` (503, `Retry-After` Pflicht) für die globale Obergrenze. `404` für unbekanntes
   `meetingId`. Vertrag 0.3.11 (Patch; die Operation war vorab erklärt, ADR 0015), Eintrag in `CHANGELOG.md`,
   `streamEvents` verlässt die Allowlist. `pnpm contract:types` regeneriert `packages/contract/src/types.ts`.
2. **Rechte je Ereignis, je Leser, zum Zustellzeitpunkt (R-PERM-04).** Eine reine Domänenfunktion in
   `packages/domain/src/stream.ts` entscheidet für jedes Ereignis und jeden Leser, und zwar immer über `can()`, nie über
   einen Rollennamen (R4):
   - **Leser mit `event.read`** (heute nur `admin`) erhalten `event`-Nachrichten, genau wie `listEvents`.
   - **Alle anderen Leser mit aktiver Rolle** erhalten nur `change`-Nachrichten. Ein Thema erscheint nur, wenn der Leser
     ein Leserecht dafür hält (`READ_PERMISSIONS` der zugehörigen Lesemethoden, geprüft über `can()`). `meeting` gilt für
     jeden angemeldeten Leser (Stammdaten, Festlegung 1 aus 010).
   - **Gegenstandsbezogen:** Für Ereignisse zu einer Einzelfrage gilt zusätzlich `can(actor, 'question.read', q)` bzw.
     für `stage` `can(actor, 'stage.read')` bei einer Frage, die auf der Bühne steht. Maßgeblich ist der Zustand **vor
     oder nach** dem zugestellten Stapel: Wer die Frage vorher lesen konnte, erfährt auch, dass sie seinen Umfang
     verlässt. Andernfalls gibt es kein Thema und keine ID. `subjects` enthält nur Kennungen, die der Leser vorher oder
     nachher lesen darf, höchstens 100 je Nachricht; darüber entfällt `subjects`, und der Client behandelt das ganze Thema
     als geändert. Dasselbe gilt für Wortmeldungen (`speaker.read`) und Redebeiträge (`contribution.read`).
   - **`meeting` aus Frageereignissen** nur, wenn sich `meeting.counts` durch den Stapel ändert. Die Zähler darf jeder
     Leser sehen (T-G1-I-04, hingenommen).
   - **`roles`** nur mit `admin.roles.manage` oder für eine Zuordnung des Lesers selbst.
   - Die Zuordnung Ereignistyp → Themen ist Daten: `EVENT_TOPICS: Record<EventType, readonly StreamTopic[]>`
     (vollständig durch den Typ, konservative Obermenge). Der Client von 036 nutzt sie für `event`-Nachrichten.
   - Für die Auflösung des Akteurs je Jahrgang wird die bestehende Closure `actor()` aus `createInProcessApi` in eine
     exportierte reine Funktion ausgelagert (Vorschlag `resolveMeetingActor(state, current, now)`). Beide Stellen nutzen
     sie; das Verhalten ändert sich nicht, die bestehenden Tests bleiben grün.
   - **Sichtbarkeitstabelle vor dem Bau** (Leitplanken §4, hoch: Rechte-Diff vor dem Bau). Keine Änderung an
     `ROLE_PERMISSIONS`, an `READ_SCOPES` oder an der Wahrheitstabelle; die Tabelle leitet sich aus ihnen ab:

     | Rolle | `event` | `meeting` | `speakers` | `contributions` | `questions` | `stage` | `roles` |
     |---|---|---|---|---|---|---|---|
     | admin | ja (alle Ereignisse, maskiert) | – (aus `event`) | – | – | – | – | – |
     | moderation | nein | ja | ja | ja | ja | ja | nur eigene |
     | capture | nein | ja | ja | ja | ja | nein | nur eigene |
     | coordination | nein | ja | ja | ja | ja | nein | nur eigene |
     | expert | nein | ja | nein | nein | nur Fragen des eigenen Fachbereichs | nein | nur eigene |
     | legal | nein | ja | nein | nein | ja | nein | nur eigene |
     | approver | nein | ja | nein | nein | ja | ja | nur eigene |
     | podium | nein | ja | nein | nein | nein | nur Fragen auf der Bühne | nur eigene |
     | observer | nein | ja (Zähler) | nein | nein | nur `delivered`/`closed` | nein | nur eigene |

     Weicht die gebaute Tabelle (Test in `stream035.test.ts`, erzeugt aus `ROLE_PERMISSIONS`) ab, ist das ein Befund.
3. **Rechte zum Zustellzeitpunkt, nie zum Verbindungsaufbau.** Vor jeder Zustellung eines Stapels, der mindestens eine
   für den Leser sichtbare Nachricht enthält, und bei jedem Heartbeat gilt:
   - (a) **Sitzung** neu lesen mit `authStore.readSession(token, clock(), false)`. Das deckt Abmelden, Ablauf,
     Leerlauf und Subject-Sperre ab und verlängert das Leerlauffenster nicht. Ergebnis `null` → `end {session}`.
   - (b) **Akteur** aus dem geprüften Log **einschließlich** des Stapels neu auflösen (`sessionActorFromEvents` bzw.
     `resolveMeetingActor`). Keine aktive Rolle mehr (`RoleRevoked`, Ablauf nach `clock()`, Jahrgang geschlossen) →
     `end {forbidden}`. Rolle, Fachbereich oder Person anders als beim Öffnen (auch eingeengt) → `end {roles_changed}`.
     Aus diesem Stapel wird dann **nichts** zugestellt, auch keine Nachricht mit `seq` vor dem `RoleRevoked`. Der Strom
     wechselt nie mitten in der Verbindung auf andere Rechte; der Client baut neu auf (036).
   - Im Demo-Header-Modus (`X-Actor`, nur Tests) entfällt (a); (b) gilt.
4. **Wiederaufnahme.** Cursor = `Last-Event-ID`, sonst `after`.
   - **Ohne beide** beginnt der Strom am Kopf mit einer `cursor`-Nachricht, ohne Nachlauf. Ein Leser ohne `event.read`
     kennt den Kopf nicht, weil `listEvents` ihm 403 gibt; der Standard `after = 0` würde bei mehr als 1000 Ereignissen
     jedes erste Öffnen in ein `reset` schicken. Vertrag: `/stream` nutzt dafür einen eigenen Parameter `after` ohne
     `default` statt `#/components/parameters/After` (dort `default: 0`, bleibt für `/events`). Ein ausdrückliches
     `after=0` spielt ab dem Anfang ab (Grenze unten).
   - Cursor = Kopf → nur Live-Nachrichten.
   - Cursor < Kopf und Abstand ≤ 1000 → **Nachlauf** vor den Live-Nachrichten. Leser mit `event.read` erhalten jedes
     Ereignis `cursor+1 … Kopf` genau einmal in aufsteigender Reihenfolge. Die übrigen erhalten **eine**
     zusammengefasste `change`-Nachricht mit `replay: true`, `id` = Kopf und ohne `subjects`. Ihre Themen sind die
     Vereinigung von `EVENT_TOPICS` über den Bereich, geschnitten mit den Themen des Lesers. Bei gegenstandsbezogenem
     Umfang (Fachbereichsbindung oder Leseumfang aus `READ_SCOPES`, erkannt über `hasUnitBoundRead` bzw.
     `extendingScopesFor`, nie über einen Rollennamen) zählt ein Frageereignis nur, wenn die Frage **jetzt** lesbar ist.
     Es werden keine historischen Projektionen gebildet. Die Rechte gelten zum Zustellzeitpunkt, nie zum Zeitpunkt des
     Ereignisses (T-G1-I-09 b).
   - Cursor < Kopf und Abstand > 1000 → `reset {lastSeq: Kopf}`, schließen. Der Client lädt voll und verbindet mit
     `after = Kopf` neu. Der Nachlauf ist damit nach oben begrenzt.
   - **Cursor > Kopf** (Rücksicherung, gekürztes Log, anderer Dienst) → `reset {lastSeq: Kopf}`, schließen. Der Dienst
     wartet nie still, bis der Kopf den Cursor erreicht: Das würde Ereignisse einer anderen Kette überspringen.
   - **Garantie:** Für Leser mit `event.read` gilt, zwischen Öffnen und Ende einer Verbindung, jedes `seq > Cursor` genau
     einmal, aufsteigend, ohne Lücke. Mit `Last-Event-ID` = letzte empfangene `id` setzt die nächste Verbindung ohne
     Lücke und ohne Doppel fort. Für die übrigen gilt: Keine sichtbare Änderung nach dem Cursor geht verloren; `id` steigt
     streng.
5. **Kettenintegrität.** Der Strom stellt nur Ereignisse aus einem geprüften, versiegelten Log zu (`loadChain` bzw. beim
   In-Memory- und JSONL-Pfad aus dem beim Start geprüften Speicher). Nie aus `pendingEvents` einer laufenden Anfrage.
   - `PostgresIntegrityError` beim Nachladen → alle offenen Ströme erhalten `end {unavailable}` und schließen. Ein neues
     Öffnen antwortet wie jede Fachanfrage 500 ohne Inhalt. Es gibt kein „weiter mit dem letzten Stand“.
   - `historyChanged` (gültige, aber geänderte oder gekürzte Kette, takt-033) → alle offenen Ströme erhalten
     `reset {lastSeq}` und schließen. Der Verteiler baut seinen Zustand aus der neuen Kette neu auf. Kein Ereignis wird
     über eine geänderte Historie hinweg zugestellt. Die feste stderr-Zeile aus takt-033 bleibt unverändert.
   - Eine `id` ist nie kleiner oder gleich einer bereits auf dieser Verbindung gesendeten.
6. **Verteiler je App (`apps/api/src/stream/hub.ts`).** Genau ein Verteiler je `createApp`. Er startet mit dem ersten
   offenen Strom und endet mit dem letzten.
   - **Auslöser:** (a) nach jedem COMMIT mit neuen Ereignissen in `postgresBoundary` ein Anstoß ohne Nutzdaten (der
     Verteiler liest selbst nach); (b) ein Takt von 1 s, solange Ströme offen sind, für Schreibvorgänge anderer
     Instanzen; (c) beim In-Memory- und JSONL-Pfad `store.subscribe`. Höchstens ein Nachladen zugleich, Stapel frühestens
     alle 250 ms.
   - **Nachladen:** eigene kurze Transaktion `REPEATABLE READ READ ONLY` auf eigener Verbindung über `loadChain`
     (Struktur wie `readSnapshotEvents`, Verbindung verwerfen nach 034a). **Kein offener Strom hält eine
     Datenbankverbindung oder Transaktion**, auch nicht beim Öffnen über die erste Auslieferung hinaus.
   - **Zustand:** eine Projektion je Jahrgang (`State` über `reduce`), schrittweise mit dem Suffix fortgeschrieben. Vor
     dem Anwenden eines Stapels wird für jeden betroffenen Gegenstand und jede Verbindung die Lesbarkeit „vorher“
     bestimmt, danach „nachher“ (Entscheidung 2).
   - Die Route nutzt weder `postgresBoundary` noch den `domain`-Proxy (der wirft ohne Grenze absichtlich).
7. **Jahrgangsfilter.** Mit `meetingId` nur Ereignisse dieses Jahrgangs; der Cursor bleibt global. Unbekanntes
   `meetingId` → 404 vor dem Öffnen; keine aktive Zuordnung in diesem Jahrgang → 403 R-PERM-01. Ohne Filter: je Ereignis
   die Rechte im Jahrgang des Ereignisses; ohne aktive Zuordnung dort wird nichts aus diesem Jahrgang zugestellt.
   `/v1/events` bleibt ohne Filter (Vertrag: kommt mit 043).
8. **Grenzen und Zeitverhalten (feste Werte in `apps/api/src/limits/config.ts`, als Option für Tests senkbar, nicht
   per Umgebung konfigurierbar; eine Anhebung ist eine Spec-Änderung wie beim Body-Limit):**

   | Wert | Standard | Verhalten |
   |---|---|---|
   | Heartbeat | 15 s | Kommentarzeile, bei Bedarf `cursor`; Anlass für Prüfung 3 (a)/(b) |
   | Ströme je Sitzung (Demo-Header: je Akteur) | 3 | der vierte → 429 mit `Retry-After: 30`; kein Verdrängen älterer Ströme (sonst Wechselspiel zwischen Tabs) |
   | Ströme je Prozess | 200 | darüber → 503 `StreamUnavailable` mit `Retry-After: 30` (B11: 50 + 15 Nutzer, bis 3 Tabs) |
   | Lebensdauer eines Stroms | 30 min | `end {rotate}`; der Client verbindet mit `Last-Event-ID` neu, dabei laufen Anmeldung, Rate-Limit und Obergrenzen erneut |
   | Nachlauf | 1000 Ereignisse | darüber `reset` |
   | Rückstau je Verbindung | 256 Nachrichten oder 1 MiB | darüber schließen ohne weitere Nachricht; der Client setzt mit `Last-Event-ID` fort |

   - Das Request-Timeout aus 034a gilt für das Öffnen: Anmeldung, Prüfungen und erstes Nachladen liegen im 10-s-Budget.
     Danach misst es nicht mehr. Die Route braucht **keine** Ausnahme in `TIMEOUT_EXEMPT`.
   - Das Rate-Limit zählt das Öffnen als einen Lesevorgang. Wiederverbindungen zählen einzeln.
   - Ein Abbruch durch den Client (`c.req.raw.signal`) oder ein Schreibfehler gibt den Platz sofort frei.
   - Antwortkopf: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-store, no-transform`,
     `X-Accel-Buffering: no`, keine Kompression. Die Sicherheitsheader aus 034a bleiben.
   - **Proxy- und Netlify-Pufferung nur festhalten, nichts ändern:** Ob der Produktionsweg (Netlify-Rewrite auf den
     Dienst, Reverse-Proxy der Konzern-IT, ADR 0007, E33) `text/event-stream` ungepuffert und ohne Leerlaufgrenze unter
     30 s durchreicht, ist unbekannt. Die Scheibe ändert keine Netlify-, Proxy- oder Deploy-Konfiguration. Heartbeat
     15 s, Rotation und der Polling-Rückfall in 036 sind so gewählt, dass eine Grenze ab 20 s Leerlauf nur Wiederaufbau
     kostet. Die Prüfung gehört in den ersten Staging-Deploy (Register E10/E33), siehe offene Frage 2.
9. **Zugriffslog (033a): eine Zeile je Strom, keine je Nachricht.** Die bestehende Zeile beim Öffnen, `operationId`
   `streamEvents`, Status 200 bzw. der Fehlerstatus, `latencyMs` bis zur Antwort, `seq` `null` (Bedeutung aus 033a
   unverändert: bestätigtes `seq` eines Schreibvorgangs). Keine neuen Schlüssel. Stromende, Dauer und Zahl der Nachrichten
   stehen nicht im Log. Über ein Strom-Ende wegen `unavailable` meldet stderr einmal je Vorkommen eine feste Zeile ohne
   Inhalt, gebündelt wie in `createNotices`. Kein Ereignisinhalt, kein Thema, keine Kennung im Log.
10. **Demo- und In-Process-Betrieb (ADR 0002).** Im Browser gibt es keinen HTTP-Strom. Das Gegenstück ist
    `HvApi.subscribe`. Die Signatur wird rückwärtsverträglich erweitert:
    `subscribe(listener: (events: ReadEvent[], change?: StreamChange) => void)`. Die In-Process-Implementierung
    berechnet `change` mit **derselben** Funktion aus `stream.ts` gegen den aktuellen Akteur je Zustellung (der
    Rollenumschalter wirkt sofort, wie heute). Leser mit `event.read` erhalten wie bisher die Ereignisse, die übrigen
    `[]` plus `change`. So verhält sich 036 in beiden Betriebsarten gleich. Der Dienst-Pfad `createApp` ohne Postgres
    (In-Memory, JSONL) bedient `/v1/stream` wie mit Postgres, nur ohne Nachladen.

## Nicht-Ziele

- Keine Änderung an `ROLE_PERMISSIONS`, `READ_SCOPES`, `PERMISSIONS`, Übergangstabelle oder Wahrheitstabelle. Kein
  `event.read` für weitere Rollen.
- Kein Web-Code (036). `apps/web` bleibt unberührt, auch `http.ts`.
- Kein WebSocket, kein Broker, kein `LISTEN/NOTIFY` (bräuchte eine dauerhaft gehaltene Verbindung je Instanz und für
  Auslöser eine Migration), keine Migration, keine neue Tabelle.
- Keine `NotificationRaised`-Alarme (085), keine Bühnen-Wiederaufnahme im Web (058).
- Kein Filter für `/v1/events` (043). Keine Paginierung.
- Keine Konfiguration per Umgebung für die Stromgrenzen (034b-Schema und `.env.example` bleiben).
- Keine Änderung an Netlify, Proxy oder Deploy.
- Kein Cache der Projektion für Fachanfragen (takt-033, Nicht-Ziel dort). Der Verteiler hält eine eigene Projektion nur
  für die Sichtbarkeit.

## Teilung (vorbereitet, Entscheidung des Orchestrators vor dem Bau)

Passt der Bau nicht in einen Agententag, wird hier geschnitten:

- **035a** (hoch, domain + Vertrag): Entscheidungen 1, 2 und 10, `stream.ts`, R-PERM-04, `resolveMeetingActor`,
  erweitertes `subscribe`, Sichtbarkeitstabelle als Test. Kein Dienstcode.
- **035b** (hoch, service): Entscheidungen 3–9, Verteiler, Route, Grenzen, Postgres-Tests, Allowlist-Eintrag entfernen.

Die Abnahmekriterien unten verteilen sich entsprechend (1–2 in 035a, 3–9 in 035b).

## Files allowed

Vertrag zuerst, vom Architekten und vor jedem Code, der davon abhängt (AGENTS.md R6):

- `docs/slices/035-sse-strom.md`
- `packages/contract/openapi.yaml` (nur `/stream`, neue Schemas `StreamChange`, `StreamCursor`, `StreamReset`,
  `StreamEnd`, `StreamTopic`, Antwort `StreamUnavailable`, `info.version` 0.3.11, ein Absatz in `info.description`;
  **Architekt**)
- `packages/contract/CHANGELOG.md` (Abschnitt 0.3.11; Architekt)
- `packages/contract/allowlist.json` (nur Eintrag `streamEvents` entfernen; mit dem Dienstteil, damit die Abdeckung passt)
- `packages/contract/src/types.ts` (nur regeneriert mit `pnpm contract:types`)

Domäne:

- `packages/domain/src/stream.ts` (neu: `EVENT_TOPICS`, Sichtbarkeitsfunktion, Themen des Lesers)
- `packages/domain/src/api.ts` (nur: `actor()` nach `resolveMeetingActor` auslagern, `subscribe` mit `change`, Typ von
  `HvApi.subscribe`)
- `packages/domain/src/index.ts` (nur Exporte)
- `packages/domain/src/rules.ts` (nur Eintrag R-PERM-04, Art „Recht“, Quelle „Leitplanken“ bzw. „Rechtekonzept“ mit
  ehrlicher Fundstelle)
- `packages/domain/src/types.ts` (nur Typen `StreamTopic`, `StreamChange`, falls nicht in `stream.ts`)
- `packages/domain/src/__tests__/stream035.test.ts` (neu)

Dienst:

- `apps/api/src/stream/hub.ts` (neu: Verteiler)
- `apps/api/src/stream/sse.ts` (neu: SSE-Rahmung, reine Funktionen)
- `apps/api/src/stream/route.ts` (neu: Öffnen, Prüfungen, Obergrenzen, Zustellung)
- `apps/api/src/app.ts` (nur: Route registrieren, Anstoß nach COMMIT in `postgresBoundary`, Verteiler verdrahten,
  veralteten Kommentar ersetzen, optionaler Test-Haken in `testHooks`, Option für die Stromgrenzen)
- `apps/api/src/limits/config.ts` (nur Stromgrenzen als feste Konstanten)
- `apps/api/src/__tests__/stream035.test.ts` (neu, ohne Postgres)
- `apps/api/src/__tests__/postgres-stream035.test.ts` (neu, mit Postgres)

Dokumente:

- `docs/sicherheit/bedrohungsmodell.md` (nur Zeilen T-G1-I-09, T-G1-S-02, T-G1-D-03: Stand und Tests)
- `docs/adr/0014-realtime-sse.md` (nur Abschnitt „Nachweis“ und eine Ergänzung: „ohne Domänenänderung“ trifft nicht
  zu, Änderungssignal nach R-PERM-04; **Architekt**)
- `docs/folgeliste.md` (nur nicht blockierende Reviewbefunde; Sicherheitsbefunde gehen nie dorthin)
- `docs/produktplan-beta.md` (nur Stand-Zeile Etappe B nach dem Merge)

Weitere Dateien sind Scope-Befunde. Das gilt ausdrücklich für `apps/api/src/limits/middleware.ts`,
`apps/api/src/observability/*`, `apps/api/src/persistence/*`, `apps/api/src/server.ts` und `packages/domain/src/permissions.ts`:
Braucht der Bau eine Änderung dort, anhalten und die Spec klären.

## Vor dem Bau prüfen

1. **Streaming in Hono:** `hono/streaming` (`streamSSE`) mit der eingesetzten Version von `@hono/node-server`. Kommt der
   Abbruch des Clients über `c.req.raw.signal` an? Kehrt die Middleware-Kette (Zugriffslog, Request-Timeout,
   Sicherheitsheader) bei Rückgabe der Antwort zurück und nicht erst am Stromende? Setzt `createRequestLog` den Kopf
   `X-Server-Time` auf der Streaming-Antwort, ohne den Rumpf zu puffern (Zweig `new Response(c.res.body, c.res)`)?
2. **Node-Server:** Beendet `requestTimeout: 30_000` bzw. `headersTimeout` in `server.ts:58` eine laufende Antwort
   nach 30 s? Nach Node-Doku betrifft beides nur den Empfang der Anfrage. Nachweis mit einem echten Server
   (`@hono/node-server` `serve` mit denselben `serverOptions`) und einem Strom über mehr als 30 s. Sind die Optionen in
   `server.ts` nicht wiederverwendbar, ist das ein Befund, keine Änderung an `server.ts`.
3. **Rate-Limit:** `createSubjectLimits` zählt beim Eintritt der Anfrage; ein Strom zählt einmal.
4. **Abdeckungstor:** `operation-coverage.setup.ts` erkennt `streamEvents` als ausgeübt, sobald die Tests die Route
   aufrufen. Der Allowlist-Eintrag wird im selben Commit wie der erste Test entfernt.
5. **`maskEvent`** ist heute eine Closure in `createInProcessApi`. `stream.ts` braucht dieselbe Maskierung. Auslagern
   ist erlaubt (`api.ts`), eine zweite Kopie nicht.
6. **Akteur:** Liefert die ausgelagerte `resolveMeetingActor` für jede bestehende Stelle dasselbe Ergebnis? Alle
   Domänen- und Dienst-Tests grün vor der ersten neuen Zeile.
7. Weichen Zeilenangaben ab oder fehlt eine Datei, melden und anhalten.

## Tests zuerst (rot, dann grün)

**Domäne** (`stream035.test.ts`, ohne Netz):

1. `EVENT_TOPICS` ist für jeden `EventType` gesetzt (Typ plus Laufzeitprüfung über die Liste der Typen).
2. **Themen sind nicht zu eng:** Über den Seed-Korpus wird jedes Ereignis angewandt. Jede Lesesicht, die sich dabei
   ändert (Liste der Wortmeldungen, Redebeiträge, Fragen, Bühne, Jahrgang mit Zählern, Zuordnungen), gehört zu einem
   Thema aus `EVENT_TOPICS` dieses Ereignisses.
3. **Sichtbarkeitstabelle:** aus `ROLE_PERMISSIONS` erzeugt und gleich der Tabelle in Entscheidung 2.
4. **observer erhält keine Entwurfsereignisse:** Folge Erfassen → Einordnen → Zuweisen → Entwurf → Einreichen →
   Freigabe → Bühne → Vorlesen. Der Beobachter erhält für jedes Ereignis vor `QuestionDelivered` weder `event` noch
   `change` noch die Kennung der Frage. Ab `delivered` erhält er `questions` mit dieser Kennung. Die serialisierte Ausgabe
   enthält den Entwurfstext nie.
5. **expert** erhält kein Thema und keine Kennung zu Fragen eines anderen Fachbereichs. Wird eine Frage aus seinem
   Fachbereich wegverteilt, erhält er einmal `questions` mit ihrer Kennung (Zustand vorher).
6. **podium** erhält nur `stage`, und nur für Fragen, die vorher oder nachher auf der Bühne stehen.
7. **admin** erhält `event` mit genau der Maskierung von `listEvents` (gleiches JSON wie `listEvents` für dasselbe `seq`).
8. **In-Process-`subscribe`:** Für jede Rolle entspricht `change` der Funktion aus `stream.ts`. Ein Rollenwechsel im
   Umschalter wirkt ab der nächsten Zustellung. Bestehende `subscribe`-Tests bleiben grün.

**Dienst ohne Postgres** (`stream035.test.ts`, In-Memory-Persistenz, Sitzungsadapter mit Test-`authStore` und Demo-Header;
Zeitgeber per Option bzw. Fake-Timer, Uhr injiziert):

9. Öffnen: 200, Kopfzeilen aus Entscheidung 8, erste Zeile `retry: 3000`. Heartbeat nach 15 s. Ohne Sitzung 401, ohne
   aktive Rolle 403 R-PERM-01, `Last-Event-ID: abc` 422, unbekanntes `meetingId` 404.
10. **Trennen und wieder verbinden, keine Lücke:** admin empfängt `1…k`, trennt; es folgen Schreibvorgänge; neu mit
    `Last-Event-ID: k` → genau `k+1…m`, aufsteigend, ohne Doppel. Dasselbe mit `after`. Mit beiden gewinnt
    `Last-Event-ID`.
11. Nicht-admin nach Trennung: eine `change`-Nachricht mit `replay: true` und den richtigen Themen. Bei observer fehlt
    `questions`, wenn im Bereich nur Entwurfsereignisse liegen.
12. Cursor > Kopf → `reset`; Abstand > 1000 → `reset`; danach ist die Verbindung geschlossen.
13. **Rollenentzug während des offenen Stroms:** `RoleRevoked` des Lesers → `end {forbidden}`. Keine Nachricht mit einem
    `seq` aus dem Stapel des Entzugs, auch nicht mit einem kleineren. Einengung (eine von zwei Zuordnungen entzogen,
    anderer Fachbereich) → `end {roles_changed}`. Ablauf der Zuordnung nach der injizierten Uhr → `end {forbidden}` beim
    nächsten Heartbeat.
14. **Sitzung:** Abmelden, Subject-Sperre (`auth_subject_blocks` im Test-`authStore`) und Leerlaufablauf → `end {session}`
    vor der nächsten Zustellung. Danach kommt keine Nachricht mehr. `readSession` wird mit `slideIdle = false` gerufen
    (Spy).
15. **Obergrenzen:** der vierte Strom derselben Sitzung → 429 mit `Retry-After`. Die globale Grenze (per Option auf 2
    gesenkt) → 503 `StreamUnavailable` mit `Retry-After`. Nach Abbruch eines Stroms ist der Platz sofort frei.
16. Lebensdauer (per Option gesenkt) → `end {rotate}`. Rückstau über der Grenze → Verbindung geschlossen.
17. **Zugriffslog:** ein Strom mit 50 zugestellten Nachrichten erzeugt genau eine Zeile, `operationId` `streamEvents`,
    ohne Inhalt, Thema oder Kennung.
18. Jahrgangsfilter: nur Ereignisse des Jahrgangs, `id` bleibt der globale `seq`.

**Dienst mit Postgres** (`postgres-stream035.test.ts`, eigene DB je Lauf):

19. Schreiben über eine **zweite** App-Instanz → Zustellung auf dem Strom der ersten innerhalb von 2 s (Takt).
    Schreiben über dieselbe Instanz → innerhalb von 500 ms (Anstoß nach COMMIT).
20. **Keine gehaltene Verbindung:** Mit 10 offenen, ruhenden Strömen ist nach dem Öffnen keine Pool-Verbindung
    ausgecheckt, und keine Transaktion bleibt offen (`pg_stat_activity` der Test-DB ohne `idle in transaction` der
    Laufzeitrolle).
21. **Manipulation bei offenem Strom** (alte Zeile per Owner-Verbindung geändert) → `end {unavailable}` auf allen
    Strömen. Danach keine Nachricht; ein neues Öffnen antwortet 500 ohne Inhalt.
22. **Gekürzte oder ersetzte, gültige Kette** → `reset` auf allen Strömen. Ein Ereignis der ersetzten Kette jenseits
    des alten Kopfes wird nie zugestellt.
23. `RoleRevoked`, festgeschrieben über die zweite Instanz → der Strom der ersten endet mit `end {forbidden}` ohne weitere
    Nachricht.
24. Subject-Sperre über die zweite Instanz → `end {session}` spätestens beim nächsten Heartbeat oder vor der nächsten
    Zustellung.

**Echter Server** (in `stream035.test.ts` oder eigener Block): ein Strom über mehr als 30 s mit den `serverOptions` aus
`server.ts` bleibt offen und erhält Heartbeats (Vor dem Bau prüfen 2).

## Akzeptanzkriterium

1. Vertrag 0.3.11 vom Architekten vor dem Code; `pnpm contract:types` ohne Diff danach; `streamEvents` nicht mehr in der
   Allowlist; Abdeckungstor grün.
2. Domänentests 1–8 grün; bestehende Domänentests unverändert grün; Wahrheitstabelle ohne Diff; `role-literals` grün.
3. Diensttests 9–18 grün, Postgres-Tests 19–24 grün, Test mit echtem Server grün.
4. Sichtbarkeitstabelle im Test gleich der Tabelle in Entscheidung 2.
5. Bedrohungsmodell T-G1-I-09, T-G1-S-02 (Stromteil), T-G1-D-03 (Grenzen) mit Stand und Testnamen; ADR-0014-Ergänzung
   vom Architekten vor dem Merge.
6. `pnpm gates` **mit Postgres-Variablen** grün auf sauberem Baucommit; `slice-scope` akzeptiert nur die Dateien oben.
7. Lesebefund der Spec vor dem Bau; Security- und Betriebsreview in frischem Kontext; Blocker/Major vor dem Merge;
   Sicherheitsbefunde nie auf die Folgeliste. Jeder Commit nennt „Scheibe 035“ und endet mit `[skip netlify]`.

## Nachweise

Schluss von `pnpm gates` mit Postgres-Variablen; Testnamen 1–24 mit Ergebnis; gemessene Zustellzeit (dieselbe
Instanz, zweite Instanz) aus Test 19; Ausschnitt des Rohstroms aus Test 4 bzw. 11 (observer, ohne Entwurfstext) und aus
Test 10 (admin, Lückenlosigkeit). Kein Screenshot: keine Oberfläche.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch
Ausgelöst: [x] Vertrag, Ereignis [x] Rolle, Recht, Identität (R-PERM-04, Sitzungsentzug im Strom) [x] Persistenz, Nebenläufigkeit (Verteiler, Kette) [x] Betrieb (lange Verbindungen, Grenzen) [x] vertrauliche Daten (SG1, SG2 über den Strom)
Perspektive(n): Security (6.5), Betrieb (6.7), Vertrag (6.4) · Nachweise: Tests 1–24, Sichtbarkeitstabelle, Bedrohungsmodell · Offene Entscheidung: Fragen 1 und 2 unten; E33

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Invarianten.** (1) Keine Nachricht an einen Leser, der ihren Inhalt oder Gegenstand zum Zustellzeitpunkt nicht lesen
  darf. (2) Keine Zustellung ohne vorherige, erfolgreiche Sitzungs- und Akteurprüfung für diesen Stapel. (3) Nur
  Ereignisse aus einer geprüften Kette, streng steigende `id`. (4) Kein offener Strom hält eine Datenbankverbindung.
- **Missbrauchsfall 1 (T-G1-I-09 a).** `observer` oder ein Fachbereich öffnet den Strom, um Entwürfe oder fremde Fragen
  mitzulesen. Abwehr: `event` nur mit `event.read`; `change` ohne Inhalt, Kennungen nur für lesbare Gegenstände. Test 4,
  5, 11.
- **Missbrauchsfall 2 (T-G1-I-09 b).** Ein Client setzt `Last-Event-ID: 0`, um das ganze Log abzuspielen. Abwehr:
  Nachlauf höchstens 1000, Rechte zum Zustellzeitpunkt, Nichtadmins nur eine zusammengefasste Nachricht. Rate-Limit
  begrenzt die Wiederholung.
- **Missbrauchsfall 3 (T-G1-I-09 c, T-G1-S-02).** Gestohlenes oder gesperrtes Gerät behält einen offenen Strom. Abwehr:
  Sitzung vor jeder Zustellung und je Heartbeat neu gelesen, Rotation nach 30 min. Erkennung: `end {session}`, der
  nächste Aufbau scheitert mit 401 und steht im Zugriffslog.
- **Missbrauchsfall 4 (T-G1-D-03).** Viele Ströme binden Speicher und Sockets. Abwehr: 3 je Sitzung, 200 je Prozess,
  Rückstaugrenze, Rate-Limit auf das Öffnen. Erkennung: 429/503 im Zugriffslog.
- **Restrisiko (offene Frage 1).** Leser ohne `event.read` sehen an den Sprüngen der `id` (globaler, lückenloser `seq`,
  ADR 0011) und am Zeitpunkt der Nachrichten, **wie viel** sonst geschieht, nicht was. Das entspricht den für alle
  sichtbaren Zählern (T-G1-I-04). Eine undurchsichtige Marke statt `seq` wäre eine Vertragsänderung gegen ADR 0014.
- **Fehler- und Wiederherstellungsfall.** Integritätsfehler → alle Ströme `unavailable`, neue 500. Datenbank weg →
  Nachladen scheitert, der Verteiler versucht es im Takt erneut. Offene Ströme bleiben mit Heartbeat bestehen, stellen
  aber nichts zu. Ist die Sitzungsprüfung nicht möglich, endet der Strom mit `end {unavailable}`: fail closed. Neustart
  des Dienstes → alle Ströme brechen ab, Clients setzen mit `Last-Event-ID` fort.
- **Betrieb.** Speicher: eine Projektion je Jahrgang (Größenordnung wie der Kettencache) plus Puffer je Verbindung (≤
  1 MiB). Datenbank: ein kurzes Nachladen je Sekunde, solange Ströme offen sind (Digest-Abfrage 22–25 ms laut takt-033).
  CPU: Sichtbarkeit je Stapel und Verbindung, linear in Verbindungen mal betroffene Gegenstände. Messung unter Last in
  071 (B11).
- **Datenschutz (ADR 0013).** Das Zugriffslog erhält keinen neuen Schlüssel und keine Zeile je Nachricht. Ströme
  erzeugen keine Kennzahl je Person. Der Auswertungskatalog bleibt unverändert.
- **Wahrheitstabelle.** Keine Änderung an Rechten oder Übergängen. Die Sichtbarkeitstabelle steht oben vor dem Bau.

## Offene Eigentümerfragen

1. **Restrisiko Aktivitätsvolumen (Security/Datenschutz).** Leser ohne `event.read` sehen aus `id`-Sprüngen und
   Nachrichtenzeitpunkten, wie viele Ereignisse sonst geschehen, ohne Inhalt und ohne Kennung. Standard, gebaut: hinnehmen
   wie die Zähler (T-G1-I-04). Alternative: undurchsichtige Marke statt `seq` (Vertragsänderung, spätere Scheibe).
2. **Produktionsweg für lange Verbindungen (Betrieb, E10/E33, ADR 0007).** Reicht der Weg über Netlify bzw. den
   Konzern-Proxy `text/event-stream` ungepuffert und ohne Leerlaufgrenze unter 20 s durch? Ist HTTP/2 bis zum Browser
   gesichert (unter HTTP/1.1 teilen sich alle Tabs sechs Verbindungen je Herkunft)? Die Scheibe ändert nichts daran.
   Standard bis zur Klärung: Polling-Rückfall aus 036; Prüfung beim ersten Staging-Deploy.

## Bericht (nach Bau ausfüllen)

```
Slice: 035-sse-strom
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates` mit Postgres-Variablen; Testnamen 1–24; Zustellzeiten
Open: Eigentümerfragen 1 und 2; Lasttest 071
Touched: <Dateiliste>
```

## Review findings

folgt
