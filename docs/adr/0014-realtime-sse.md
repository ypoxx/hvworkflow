# ADR 0014 — Realtime über Server-Sent Events

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Umsetzer (Plan 3 „Realtime-Kanal"); Umsetzer und Projektleitung (In-App-Alarme, Plan 3 „Benachrichtigungen und Alarme") · **Annahme:** Prüfpunkt 3 (Plan 4)

## Kontext

Heute holt die Oberfläche nach jeder Änderung den Stand neu (Vollabruf über `useApiVersion`). Mit
50 Backoffice- und 15 Erfassungsnutzern (B11) und einer Bühne, die nach einer Partition wieder
aufsetzen muss (B7), braucht es einen Ereigniskanal mit Wiederaufnahme. `store.subscribe` existiert
bereits; Clients brauchen ohnehin `after=seq`. ADR 0001 hat einen Message-Broker zwischen den Teilen
verworfen.

## Entscheidung

Standardannahme aus Plan 3 („Realtime-Kanal", „Benachrichtigungen und Alarme") und Plan 4
(Zeile 0014, Baustein 3):

- **Server-Sent Events** `GET /v1/stream?after=seq` mit `Last-Event-ID` und Heartbeat;
  Jahrgangsfilter; Rechteprüfung wie bei den Leserechten — kein Ereignis, das die lesende Person
  nicht lesen darf.
- **Polling über `/events` bleibt Fallback.** Kein WebSocket, kein Broker.
- **Der Client wendet Ereignisse auf gepufferte Listen an** (inkrementeller Zustand statt
  Vollabruf): gezielter Nachlauf bei Lücken, mehrfach-Tab-sicher, Vollabruf nur beim ersten Laden,
  Historie paginiert. Die Signatur von `useApiVersion` bleibt, die Aufrufer ändern sich nicht.
- **In-App-Alarme laufen über denselben Strom:** Ereignis `NotificationRaised {severity,
  targetPermission, subjectId, ruleId}` mit Quittung, zugestellt an angemeldete Sitzungen mit dem
  Zielrecht. Empfänger sind Rechte, keine Rollennamen. Kein Push, keine E-Mail in der Beta; die
  Betriebsauswertung (037) alarmiert außerhalb des Tools.
- Die Bühne setzt nach einer Partition über `Last-Event-ID` wieder auf (ADR 0006).

## Konsequenzen

**Positiv.** SSE ist ein Endpunkt ohne Domänenänderung. Ein zweiter Browser sieht eine Änderung in
unter 2 s (B11); der Netztrace zeigt keinen Vollabruf je Ereignis mehr. Alarme brauchen keinen
zweiten Kanal.

**Negativ.** Der Client bekommt einen ereignisgetriebenen Store mit Reducer-Tests und Lade-,
Offline- und Wiederverbindungszuständen. Der Strom muss dieselben Leserechte anwenden wie die
Lesemethoden; ein Fehler dort wäre ein Leck (Test: `observer` erhält keine Entwurfsereignisse).

**Risiko.** Lange Verbindungen hängen am Saalnetz (E33: Hallen-WLAN plus Hotspot-Rückfall); ob
Proxys der Konzern-IT sie begrenzen, nennt der Plan nicht (Vorschlag, nicht im Plan). Der
Polling-Fallback bleibt Pflicht (Plan 3).

## Kosten bei Änderung

- WebSocket-Adapter zusätzlich: < 1,5 AStd, Client-Port identisch (Plan 3).
- Zusätzlicher Alarmkanal (E-Mail, Push): ein Adapter, 1,5 AStd (Plan 3).

## Verworfene Alternativen

- **WebSocket.** Verworfen als Standard: SSE reicht für einen Strom vom Dienst zum Client, ist ein
  Endpunkt ohne Domänenänderung und nutzt `after=seq`, das die Clients ohnehin brauchen (Plan 3).
- **Message-Broker.** In ADR 0001 verworfen: das Volumen trägt ihn nicht, die Betriebsfläche wäre am
  HV-Tag ein Risiko.
- **Vollabruf je Ereignis** (heutiger Stand). Verworfen: B11, Netztrace ohne Vollabruf (036).
- **Push oder E-Mail in der Beta.** Verworfen: kein Push, keine E-Mail (Plan 3).
- **Alarmempfänger als Rollennamen.** Verworfen: `targetPermission`, Rechte sind Daten (Regel 4).

## Nachweis

Scheiben **035** und **036** (Plan 4): Test Verbindung trennen, wieder verbinden, keine Lücke in
`seq`; Test `observer` erhält keine Entwurfsereignisse; Unit-Tests des Store-Reducers; Playwright
zweiter Browser sieht Änderung < 2 s; Netztrace im Bericht. In-App-Alarme mit Quittung in 085
(B10); Wiederaufnahme der Bühne in 058. Aus B11: SSE-Latenz < 2 s im Lasttest (071).

## Offene Registerzeilen

- **E22** RPO/RTO/SLO — Register-Standard (Plan 10): RPO 0, RTO 15 min, p90 < 300 ms im Probefenster.
  Das SSE-Ziel < 2 s stammt aus B11, nicht aus E22.
- **E33** Endgeräte und Saalnetz (Hallen-WLAN, Hotspot-Rückfall) — bestimmt, wie oft der Strom
  wieder aufsetzt.

## Ergänzung (vorgeschlagen, 30.09.2026; Scheiben 035a und 035b; Annahme Prüfpunkt 3)

**Status der Ergänzung:** vorgeschlagen · **Entscheider:** Architekt (Zuschnitt, Dienstentwurf, Bauklärungen);
Eigentümer für die offenen Fragen unten · Der bisherige Text dieses ADR bleibt unverändert. Wo er „ohne
Domänenänderung“ sagt, gilt ab hier diese Ergänzung: Die Sichtbarkeit ist eine Domänenfunktion.

**Teilung.** Planscheibe 035 ist am 30.09.2026 geteilt (die Planzeile bleibt):

- **035a** (`docs/slices/035a-sse-domaene-vertrag.md`): Vertrag 0.3.11 für `GET /v1/stream` (Nachrichtenarten
  `event`, `change`, `cursor`, `reset`, `end`; `after` ohne `default`; 404, 429, 503 `StreamUnavailable`) und die neue
  Leseregel **R-PERM-04** als reine Funktionen in `packages/domain/src/stream.ts` (`visibleMessages`, `replayMessage`,
  `resolveReaderActors`, Datentabellen `EVENT_TOPICS`, `EVENT_SUBJECTS`, `SCOPE_EXIT_EVENTS`). Dienst und Demo
  (`HvApi.subscribe`) nutzen dieselbe Funktion.
- **035b** (`docs/slices/035b-sse-dienst.md`): der Dienst unter `apps/api/src/stream/` (Verteiler `hub.ts`, Route
  `route.ts`, SSE-Rahmung `sse.ts`, Sitzungsprüfung `sessionCheck.ts`), Grenzen in `apps/api/src/limits/config.ts`.

**Sichtbarkeit (R-PERM-04).** Jede Sichtbarkeitsentscheidung fällt über `can()`, je Ereignis, je Leser, mit den
Rechten zum Zustellzeitpunkt. Es gibt kein Rollenliteral und keine Erkennung der Art des Leseumfangs.

- Wer `event.read` in irgendeinem aktiven Jahrgang hält, erhält jedes Ereignis als `event`, maskiert wie `listEvents`
  (dieselbe Funktion `maskEvent`, keine zweite Kopie).
- Alle übrigen Leser erhalten nur `change`-Nachrichten: Themen (`StreamTopic`) und die Kennungen der Gegenstände, die
  sie vorher oder nachher lesen dürfen, höchstens 100, ohne Inhalt. Dazu Zählersignale ohne Kennung. Ein Stapel ergibt
  höchstens eine `change`-Nachricht. Ereignisse ohne Jahrgang gehen nie als `change`.
- Damit ist die Forderung „kein Ereignis, das die lesende Person nicht lesen darf“ oben geschärft: Rollen ohne
  `event.read` erhalten ein Änderungssignal, nie ein Ereignis. Die Freigabe der Sichtbarkeitstabelle ist
  Eigentümerfrage 1 von 035a.

**Dienstentwurf (035b).**

- **Ein Verteiler je Prozess** (je `createApp`), gestartet mit dem ersten offenen Strom, beendet mit dem letzten. Er
  lädt in eigener kurzer Lesetransaktion nach (Anstoß nach COMMIT, Takt 1 s für andere Instanzen, `store.subscribe`
  ohne Postgres), hält eine Projektion je Jahrgang und bindet zwischen den Nachladungen keine Datenbankverbindung.
- **Eigene Kontinuitätsprüfung.** Der Verteiler hält `(lastSeq, lastHash)` des zuletzt angewandten Ereignisses und
  prüft bei jedem Nachladen selbst, dass das geprüfte Log dieses Ereignis unverändert enthält, unabhängig vom
  gemeinsamen Kettencache. Ein kürzeres Log oder ein anderer Hash → `reset` an alle Ströme und Neuaufbau. Ein
  Integritätsfehler oder ein Ereignis ohne Hash → `end {unavailable}` an alle. Zugestellt wird nur aus einem geprüften
  Log; eine `id` steigt je Verbindung streng.
- **Lückenlose Übergabe vom Nachlauf zu live.** Der Verteiler wendet einen Stapel an und verteilt ihn in einem einzigen
  synchronen Schritt. Die Verbindung wird als wartend mit eigenem Puffer registriert. Im selben Schritt liest die Route
  den Kopf `H`. Dann schreibt sie den Nachlauf `(Cursor, H]` mit Gegendruck und danach aus dem Puffer alles mit
  `seq > H`. Mit dem Leeren des letzten Pufferinhalts wechselt die Verbindung auf live.
- **Frische Sitzungsprüfung je Stapel und je Heartbeat.** `readSession(token, clock(), false)` läuft für jeden Stapel
  frisch, geteilt nur von den Strömen derselben Sitzung für genau diesen Stapel, nie für einen späteren
  wiederverwendet. Höchstens 2 gleichzeitige Pool-Verbindungen dafür. Scheitert die Prüfung selbst: `end
  {unavailable}` (fail closed). Die Zustellung verlängert das Leerlauffenster nie.
- **Grenzen** (feste Konstanten, nicht per Umgebung; eine Anhebung ist eine Spec-Änderung):

  | Wert | Standard | Verhalten |
  |---|---|---|
  | Ströme je Sitzung | 3 | darüber 429 |
  | Ströme je Subject | 6 | darüber 429 |
  | Ströme je Prozess | 200 | darüber 503 `StreamUnavailable` |
  | Lebensdauer | 25 min | `end {rotate}`, Neuaufbau mit `Last-Event-ID` durch alle Prüfungen des Öffnens |
  | Nachlauf | 1000 Ereignisse | darüber `reset` |
  | Rückstau je Verbindung | 256 Nachrichten oder 1 MiB | `change` zusammenführen, darüber schließen |
  | Heartbeat | 15 s, versetzt | Anlass für Rechte- und Sitzungsprüfung, bei Bedarf `cursor` |

- **`reset` und `end`.** Beide tragen keine `id`, der Dienst schließt danach. Nach `reset {lastSeq}` verwirft der Client
  seinen Stand und verbindet **ohne** Cursor neu; er erhält sofort `cursor` mit dem Kopf. Ein Client auf Basis von
  `EventSource` braucht dafür eine neue Instanz ohne `Last-Event-ID`. `end {reason}` mit `session`, `forbidden`,
  `roles_changed`, `rotate` oder `unavailable` beendet den Strom. Der Client verbindet nach `rotate` sofort und nach
  `unavailable` nach `Retry-After` von selbst neu, nach den übrigen erst mit erneut bestätigter Sitzung (036b).

**Rechte zum Zustellzeitpunkt, auch während des Nachlaufs.** Beim Öffnen wird die Akteurkarte
(`resolveReaderActors`, `meetingId → Actor`) aus der Projektion des Verteilers als Referenz bestimmt. Vor jedem Stapel
mit sichtbarer Nachricht und bei jedem Heartbeat wird sie neu bestimmt. Eine leere Karte führt zu `end {forbidden}`,
jede andere Abweichung zu `end {roles_changed}`, und aus diesem Stapel wird nichts zugestellt. Das gilt ab der
Registrierung, nicht erst ab live: Heartbeat- und Rotationszeitgeber starten mit der Registrierung. Sitzung und Rechte
werden je Heartbeat auch während eines Nachlaufs geprüft, der wegen Gegendrucks lange dauert. Ein Nachlauf verlängert
die Zeit ohne Prüfung also nicht. Umgesetzt in 035b (`1bcfd4f`): Zeitgeber ab `hub.register`, Prüfung je Heartbeat
während des Nachlaufs (`checkDuringHandover`), Rechte unmittelbar vor jedem geschriebenen Stapel (`rightsNow`); Tests R1–R2.

**Bauklärungen von 035b** (im Rahmen von Spec und Vertrag, keine Vertragsänderung):

1. **`meetingId`-Filter.** Mit Filter kommt jedes Ereignis dieses Jahrgangs nach dem Cursor genau einmal und
   aufsteigend. `id` bleibt die globale `seq`; Lücken sind Ereignisse anderer Jahrgänge. Lückenlos in `seq` gilt nur
   ohne Filter, unter Filter nur innerhalb des Jahrgangs. Ereignisse ohne Jahrgang kommen unter einem Filter nicht,
   auch nicht bei `event.read`. Der Kopf rückt über `cursor` mit dem Heartbeat nach; die Nachlaufgrenze zählt den
   globalen Abstand. Der Vertragswortlaut „gap-free in `seq`“ (`streamEvents`) wird vor 036b entsprechend berichtigt
   (Architekt, Vertragsänderung ohne neue Semantik).
2. **`Retry-After: 30`** bei jedem 503 `StreamUnavailable` (Prozessgrenze, Migrationen offen, Persistenz beschäftigt
   beim Öffnen) und bei den stromeigenen 429. Nicht 2 wie bei `PersistenceBusy`: Das Öffnen kennt keine
   Schreibwarteschlange, und viele Clients kämen sonst im Zwei-Sekunden-Takt wieder.

**Client-Seite (036).**

- **036a** (`docs/slices/036a-live-store.md`): gepufferte Lesezugriffe hinter `HvApi`, gezielt je Thema und Kennung
  aus `change` ungültig gemacht und einmal je Stapel neu gelesen, keine Deltas vom Dienst. Ob das „Ereignisse auf
  gepufferte Listen anwenden“ oben erfüllt, ist Eigentümerfrage 1 von 036a, offen.
- **036b** (`docs/slices/036b-strom-client.md`): Strom-Client im HTTP-Adapter mit Neuaufbau, `Retry-After`,
  Verbindungsanzeige. Polling über den bestehenden 30-s-Takt bleibt Rückfall, solange kein Strom offen ist.

**Offene Eigentümerfragen aus 035b.**

1. **Rotation als Aktivität.** Das Öffnen verlängert das Leerlauffenster wie jede Anfrage; ein offener, sichtbarer
   Strom zählt so alle 25 min als Aktivität (25 min liegt unter dem Leerlauffenster). Gebaut: hinnehmen, wie heute
   der 30-s-Takt. Alternative: Öffnen ohne Verlängerung.
2. **Restrisiko Aktivitätsvolumen.** Leser ohne `event.read` sehen an `id`-Sprüngen und Zeitpunkten, wie viel sonst
   geschieht, ohne Inhalt und Kennung. Gebaut: hinnehmen wie die Zähler. Alternative: undurchsichtige Marke statt
   `seq` (Vertragsänderung, spätere Scheibe).
3. **Produktionsweg.** Ob Netlify oder der Konzern-Proxy `text/event-stream` ungepuffert und ohne kurze
   Leerlaufgrenze durchreichen und ob HTTP/2 bis zum Browser gesichert ist (sonst begrenzt HTTP/1.1 die Verbindungen je
   Ursprung), ist offen (E10, E33, ADR 0007). 035b ändert keine Proxy-, Netlify- oder Deploy-Konfiguration. Bis zur
   Klärung: Polling-Rückfall aus 036b; Prüfung beim ersten Staging-Deploy.

**Nachweis der Ergänzung.** 035a: Tests 1–12 in `packages/domain` (Sichtbarkeitstabelle aus `ROLE_PERMISSIONS`,
`observer` ohne Entwurfsereignisse). 035b: Tests 12–29 in `apps/api/src/__tests__/stream035.test.ts` und
`postgres-stream035.test.ts` (Trennen und Wiederverbinden ohne Lücke, Commit während der Übergabe, Sitzungs- und
Rollenentzug, Grenzen, Kontinuität bei ersetzter oder gekürzter Kette, keine gehaltene Verbindung, Last mit 200
Strömen) sowie der Test mit echtem Server über 30 s.
