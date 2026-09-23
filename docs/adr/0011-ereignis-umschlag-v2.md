# ADR 0011 — Ereignis-Umschlag v2

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Umsetzer (Jahrgang, Hash-Kette, zwei Zeiten; Plan 3); Recht und DSB für `retentionClass`, `legalHold` und den PII-Teil (Plan 3 „Aufbewahrung") · **Annahme:** Prüfpunkt 3 (Plan 4)

## Kontext

Das heutige Ereignis trägt Typ, Akteur, Zeit und Payload. B3 verlangt eine Hash-Kette und
`meetingId` auf jedem Ereignis, B4 eine Referenzuhr (`recordedAt` aus der Server-Uhr,
`occurredAt` als Angabe mit Quelle), B9 Idempotenzschlüssel, die einen Neustart überleben, und
ADR 0009 Aufbewahrungsklasse und PII-Codec. Alles davon ist billig, bevor das erste echte Ereignis
in Postgres liegt, und teuer danach (Log-Neuaufbau). Die Demo-Protokolle im `localStorage` sind
Wegwerfcode (ADR 0002) und bekommen keinen Upcaster.

## Entscheidung

Standardannahme aus Plan 3 („Jahrgang und Tagesordnung", „Persistenzform", „Aufbewahrung") und
Plan 4 (Zeile 0011, Baustein 1):

- **Felder des Umschlags:** `schemaVersion`, `idempotencyKey`, `causationId`, `prevHash`/`hash`
  (SHA-256 über kanonisches JSON), `recordedAt`, `occurredAt` mit Quellenkennzeichen
  (`server | device | paper | transcript`), `retentionClass`, `legalHold`, `meetingId`, `personId`
  statt Klarname, Payload-Teil `pii` mit `keyId` je Jahrgang hinter dem Codec-Port.
- **`recordedAt` ist die maßgebliche Zeit** und kommt immer aus der Server-Uhr (injizierter
  Clock-Port, Regel 8). `occurredAt` ist eine Angabe des Absenders; nur die Quelle `server` ist
  vertrauenswürdig, alle anderen werden im Export als Angabe ausgewiesen; eine Angabe in der Zukunft
  wird abgelehnt. Der Browser rechnet mit Server-Offset und warnt ab 30 s Drift; der statische
  `now()`-Check läuft über domain, api und web (B4).
- **`meetingId` auf jedem Ereignis** (und auf Wortmeldung, Redebeitrag, Einzelfrage, Bündel) vor dem
  ersten Postgres-Schreibvorgang. Modelliert wird nur der Jahrgang; ein zweiter Rechtsträger wird
  nicht gebaut, sondern steht als Registerzeile (B-Liste).
- **Kettenprüfung beim Laden:** ein manipuliertes Ereignis führt zu einem Ladefehler mit `seq`.
- **Kein Upcaster für Demo-Protokolle:** bei altem `localStorage`-Protokoll erscheint ein
  Reset-Banner (Ergänzung zu ADR 0002). Ein Upcaster v1→v2 existiert nur für JSONL-Dev-Bestände.
- Idempotenzschlüssel überleben einen Neustart (B9).

## Konsequenzen

**Positiv.** Ein Ereignis ist ohne den Speicher prüfbar (Kette, Zeitquelle, Klasse). Die
Niederschrift-Anlage (B12) kann Soll-Ist-Vermerke und Quellenkennzeichen direkt aus dem Umschlag
ableiten. Offline-Absichten des Podiums (ADR 0006) tragen Gerätezeit als Angabe und bekommen die
maßgebliche Zeit im Dienst.

**Negativ.** Jeder Schreibpfad muss die Felder füllen; Tests prüfen, dass Gerätezeit nie zu
`recordedAt` wird. Das kanonische JSON für den Hash ist eine Festlegung, die nicht mehr beiläufig
geändert werden darf.

**Risiko.** Wird `meetingId` oder die Kette nach der ersten echten Persistenz nachgerüstet, ist
das ein Log-Neuaufbau (Plan 3). Deshalb liegt 024 vor 027.

## Kosten bei Änderung

- `meetingId` nach der ersten echten Persistenz nachrüsten: Log-Neuaufbau (Plan 3).
- Zweiter Rechtsträger: Feld `legalEntityId` additiv plus Filter, rund 1,5 AStd; Jahrgangs-Klonen:
  Admin-Aktion (Plan 3).
- PII-Codec: ohne Umschlag Neuaufbau des Logs, mit Umschlag Schlüssel einschalten und Bestand
  einmal exportieren, < 3 AStd (Plan 3; ADR 0009).

## Verworfene Alternativen

- **Gerätezeit als maßgebliche Zeit.** Verworfen: B4, eine Referenzuhr; Gerätezeit ist eine Angabe
  mit Quelle.
- **Eine Zeit statt zwei.** Verworfen: Offline-Absichten und Papierpfad brauchen die Angabe des
  Absenders neben der maßgeblichen Serverzeit (B4, B7).
- **Upcaster für Demo-Protokolle.** Verworfen: der `localStorage`-Adapter ist Wegwerfcode
  (ADR 0002); Reset-Banner.
- **Hash-Kette und Codec später nachrüsten.** Verworfen: ohne Umschlag kostet das spätere
  Einschalten einen Neuaufbau des Logs (Plan 3); B3 verlangt die Kette über alle Ereignisse.
- **Zweiter Rechtsträger oder Mandantenfeld jetzt.** Verworfen: Registerzeile (B-Liste), additiv
  nachrüstbar.
- **Klarname im Ereignis.** Verworfen: `personId`, Personentabelle (ADR 0009).

## Nachweis

Scheibe **024** (Plan 4): Test manipuliertes Ereignis → Ladefehler mit `seq`; Test Replay JSONL
v1 → v2; Test `occurredAt` aus Quelle `device` wird nie zu `recordedAt`, Zukunft abgelehnt; Test
altes `localStorage`-Protokoll → Reset-Banner; `pnpm gates`. Aus B4: Tor-Ausgabe des `now()`-Checks,
Test mit gefälschter Client-Uhr. Vertragsfelder aus 023.

## Offene Registerzeilen

- **E16** Aufbewahrung — Bedeutung und Fristen je `retentionClass`, `legalHold`.
- Zweiter Rechtsträger: keine E-Nummer; steht als B-Liste (Plan 3, „Jahrgang und Tagesordnung").
