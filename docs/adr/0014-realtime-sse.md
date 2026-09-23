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
