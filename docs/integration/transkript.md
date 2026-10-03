# Integrationsleitfaden Transkript-Ingest

**Stand:** Gliederung (03.10.2026, mit Spec 064a). Die Scheibe 064a füllt jeden Abschnitt, führt jedes Beispiel gegen
den lokalen Dienst aus und ersetzt diesen Vermerk durch Vertragsversion und Datum. Bis dahin ist nichts hier ein
zugesagtes Verhalten; maßgeblich ist `packages/contract/openapi.yaml`.

**Verbindlich vor allem anderen:** Keine echten Transkripte und keine Mitschnitte echter Versammlungen in irgendeiner
Umgebung (Demo, lokal, Staging, Übungsmandant), bevor der Datenschutzbeauftragte zur DSFA geantwortet hat (Register
E14). Für jeden Test gibt es die synthetische Beispieldatei.

**Für wen:** Entwicklerinnen und Entwickler eines Transkriptionswerkzeugs oder eines Adapters, die Transkriptabschnitte
an das HV-Tool liefern. Vorwissen: HTTP und JSON. Kein Zugang zu echten Daten nötig und keiner erlaubt.

**Quellen:** Vertrag `packages/contract/openapi.yaml` (Operationen `ingestSpeechSegments`,
`listMeetingSpeechSegments`), ADR 0008 (Integrationen), ADR 0015 (Versionierung), Spec
`docs/slices/064a-transkript-ingest-vertrag-kern.md`, Spec `docs/slices/064b-transkript-import-erfassung.md`.

## 1. Was die Schnittstelle tut

- Ein Abschnitt ist ein Stück gesprochener Wortlaut mit Anfang und Ende, wie es das Werkzeug liefert.
- Jeder Abschnitt wird genau einmal und unveränderlich gespeichert. Er steht als „unbestätigt“ (`unconfirmed`) in der
  Erfassung.
- Erst ein Mensch mit dem Recht zur Erfassung übernimmt Abschnitte in einen Redebeitrag. Kein Abschnitt wird ohne diesen
  Schritt zu einer Einzelfrage.
- Begriffe: Transkriptabschnitt (transcript segment, `SpeechSegment`), Redebeitrag (contribution), übernehmen (adopt).
  Siehe `docs/glossar.md`.

## 2. Schnellstart in fünf Schritten (lokal, ohne Zugangsdaten)

<!-- 064a: jeden Befehl ausführen, Ausgabe gekürzt einfügen, Port und Pfade prüfen -->

Voraussetzungen: Node und pnpm wie im Repositorium, `curl`, `jq`. Alle Befehle laufen im Wurzelverzeichnis des
Repositoriums (die Pfade der Beispieldateien sind relativ dazu).

1. Dienst im Demo-Modus starten: `pnpm install`, dann `pnpm --filter @hv/api dev` (Port 8787, synthetischer Seed).
2. Laufende HV ermitteln:
   `HV=$(curl -s 'http://localhost:8787/v1/meetings?status=running' -H 'X-Actor: u-cap-1:capture' | jq -r '.[0].id')`
3. Beispieldatei einspielen:
   `curl -s -X POST "http://localhost:8787/v1/meetings/$HV/speech-segments" -H 'X-Actor: u-cap-1:capture' -H 'Content-Type: application/json' --data-binary @docs/integration/beispiele/transkript-beispiel.json`
   (`--data-binary`, damit curl Zeilenumbrüche im Wortlaut nicht verändert; die Datei hat feste Zeitanker in der
   Vergangenheit)
4. Denselben Befehl wiederholen: alle Abschnitte kommen als `duplicate` zurück, nichts wird doppelt gespeichert.
5. Abschnitte lesen:
   `curl -s "http://localhost:8787/v1/meetings/$HV/speech-segments?status=unconfirmed" -H 'X-Actor: u-cap-1:capture'`

Dasselbe als Skript: `node docs/integration/beispiele/transkript-einspielen.mjs` (Node ohne Abhängigkeiten, `fetch`;
setzt die Zeitanker der Beispieldatei auf „jetzt minus Versatz“ und sendet). <!-- 064a: Skript anlegen, ausführen, Ausgabe einfügen -->

In der Netlify-Demo läuft der Kern im Browser (ADR 0002). Dort zeigt die Erfassung denselben Ablauf über den Knopf
„Transkript importieren“ (Abschnitt 10).

## 3. Endpunkte

| Operation | Methode und Pfad | Recht |
|---|---|---|
| Abschnitte einspielen | `POST /v1/meetings/{meetingId}/speech-segments` | `ingest.write` |
| Abschnitte lesen | `GET /v1/meetings/{meetingId}/speech-segments?status=&limit=&offset=` (neueste zuerst; `limit` 1–500, Standard 100; ältere über `offset`, Gesamtzahl in `total`) | `contribution.read` |
| Übernehmen (Erfassung, nicht für Partner) | `POST /v1/meetings/{meetingId}/contributions` mit `segmentIds` | `contribution.capture` |

<!-- 064a: Vertragsversion eintragen; Hinweis auf Pfadabweichung zu E3a (früher genannt: /v1/ingest/speech-segments) -->

## 4. Anmeldung

**Klartext:** Eine Maschinenanmeldung für Partner gibt es heute nicht. Im Betrieb schreibt heute nur der Datei-Import im
Browser, mit der Sitzung der erfassenden Person. Ein Partner entwickelt und testet im Demo-Modus (unten) und später im
Sandbox-Mandanten (Scheibe 065).

- **Heute, Demo und lokale Tests:** Kopfzeile `X-Actor: <id>:<role>`, nur mit `HV_DEMO=1`. Nicht für den Betrieb.
- **Heute, Betrieb:** Sitzung der erfassenden Person (Cookie `hv_session`, Anmeldung über OIDC) plus `X-CSRF-Token` aus
  `GET /auth/me`. Das ist kein Weg für ein Fremdsystem.
- **Später, Push-Adapter:** Systemakteur mit eigenem Recht `ingest.write`, Anmeldung über Client-Credentials oder mTLS
  als Konfiguration (ADR 0008). Noch nicht gebaut; Form folgt mit 043c und der Scheibe nach E3b.

## 5. Nutzlast

<!-- 064a: Tabelle aus dem Vertrag übernehmen, Beispiel aus der Beispieldatei -->

- Stapel `{ "segments": [ … ] }`, 1 bis 100 Abschnitte, keine weiteren Felder.
- Je Abschnitt: `segmentId`, `text`, `startedAt`, `endedAt`, `speakerId` (optional), `source`; Formen und Grenzen wie im
  Vertrag.
- `speakerId` ist nur ein Bezug auf eine Wortmeldung dieser HV, nie ein Name. Kennt das Werkzeug die Wortmeldung nicht,
  bleibt das Feld weg; die Erfassung ordnet bei der Übernahme zu.
- `source` benennt Werkzeug oder Adapter. Es ist eine Angabe, keine Anmeldung.
- Verboten im Wortlaut (422 R-ING-03): Steuerzeichen außer Tab, Zeilenumbruch und Wagenrücklauf; DEL; C1-Steuerzeichen;
  Bidi-Einbettung, -Überschreibung und -Isolation (U+202A–U+202E, U+2066–U+2069). Länge in Unicode-Codepunkten.
- Unicode-Normalisierung: Der Dienst normalisiert nicht. Bitte NFC senden; NFC und NFD desselben Wortlauts sind für die
  Idempotenz verschiedene Inhalte (eine Wiederholung in anderer Form ergibt 409).

## 6. Antworten und Fehler

<!-- 064a: Tabelle Status → Bedeutung → Regel-id → was der Partner tun soll; Beispiele für 409 und 422 -->

| Status | Bedeutung | Regel-id | Partner tut |
|---|---|---|---|
| `200` | Ergebnis je Abschnitt `created` oder `duplicate` | — | nichts weiter |
| `401` / `403` | nicht angemeldet / Recht fehlt | R-PERM-01 (Schreiben), R-PERM-02 (Lesen) | Konfiguration prüfen |
| `404` | HV unbekannt | — | laufende HV neu ermitteln |
| `409` | Kennung mit anderem Inhalt; HV läuft nicht; Obergrenze erreicht | R-ING-01, R-ING-02, R-ING-05 | R-ING-01 als Alarm behandeln, nie eine neue Kennung erfinden |
| `413` | Body zu groß | — | kleinere Stapel |
| `422` | Form, Länge, Zeitanker, Bezug | R-ING-03 | Daten berichtigen |
| `429` / `503` | Quote / Persistenz belegt | — | nach `Retry-After` wiederholen |
| `500` „Persistence outcome is unknown.“ | Ausgang unbekannt | — | denselben Stapel wiederholen |

Fehler sind RFC 9457 Problem Details; `detail` nennt Index und Kennung, nie gespeicherten Wortlaut.

## 7. Idempotenz und Wiederholung

- Schlüssel ist die `segmentId` je HV, unabhängig davon, wer sendet.
- Gleicher Inhalt: `duplicate`, kein zweites Ereignis. Anderer Inhalt: `409` R-ING-01; ein Abschnitt wird nie
  überschrieben. Eine Berichtigung ist ein neuer Abschnitt mit neuer Kennung.
- Ein Stapel wird ganz oder gar nicht gespeichert.
- Kennungen nicht vorhersagbar wählen (UUID oder ULID mit Präfix des Werkzeugs), damit niemand sie vorab besetzen kann.
- Kein `Idempotency-Key`, kein `If-Match` nötig.

## 8. Zeitanker

- `startedAt` und `endedAt` sind Angaben des Senders (ADR 0011); der Dienst stempelt den Eingang mit seiner Uhr.
- Kein Zeitanker darf nach der Serverzeit liegen, auch nicht um Sekunden; den Versatz liefert die Kopfzeile
  `X-Server-Time` jeder Antwort.
- Form RFC 3339 mit Zeitzone (`2026-10-01T08:30:00Z`); ein Datum ohne Uhrzeit wird abgelehnt.
- Eine Untergrenze gibt es nicht; ein Abschnitt aus der Vergangenheit wird angenommen und bleibt unbestätigt.
- Zeitzonen sind erlaubt; gespeichert wird der Zeitpunkt in UTC.

## 9. Grenzen

<!-- 064a: Werte aus Vertrag und Dienst prüfen -->

- Body höchstens 262 144 Byte; 100 Abschnitte je Stapel; 4 000 Codepunkte je Abschnitt; 10 000 Abschnitte und 8 MiB
  Wortlaut je HV (in der Demo im Browser 500 Abschnitte und 512 KiB).
- Quoten je Subjekt (`429` mit `Retry-After`).
- Empfehlung: Stapel von höchstens 200 000 Byte, gemessen am serialisierten JSON, nacheinander senden; bei `429` und
  `503` die Sekunden aus `Retry-After` warten.

## 10. In der Oberfläche

<!-- 064b: Screenshots docs/evidence/064b-*.png verlinken, Ablauf aus dem Demoszenario A in fünf Sätzen -->

## 11. Kompatibilität (/v1)

- Additive Änderungen (neue optionale Felder, neue Enum-Werte in Antworten, neue Operationen) kommen jederzeit in einer
  Patch-Stufe. Ein Client ignoriert unbekannte Felder und überspringt unbekannte Enum-Werte.
- Eine nicht additive Änderung an diesen Operationen wird mindestens einen Zyklus vorher im CHANGELOG als veraltet
  angekündigt und wird frühestens zwei Vertragszyklen (Minor-Stufen) nach der Ankündigung wirksam (ADR 0008, ADR 0015).
- Brechende Änderungen nur mit ADR-Verweis; der Pfad bleibt `/v1`, solange die Zusage gilt.
- Änderungen stehen in `packages/contract/CHANGELOG.md`.

## 12. Sicherheit und Datenschutz für Partner

- Nur synthetische Daten in Tests und im Sandbox-Mandanten (065); keine echten Mitschnitte.
- Keine Namen im Feld `speakerId`; Wortlaut nur so, wie gesprochen.
- Der Wortlaut wird nur als Text angezeigt; trotzdem keine Steuerzeichen senden (werden abgelehnt).
- Antworten geben nie gespeicherten Wortlaut zurück. Wer eine Kennung **mit** vermutetem Wortlaut sendet, erfährt aus
  `duplicate` oder 409 aber, ob die Vermutung stimmt (Inhaltsbestätigung). Heute darf nur die Erfassung schreiben, die
  die Abschnitte ohnehin liest; für Systemakteure kommt ein Kennungs-Namensraum je Akteur.
- Kennungen nicht vorhersagbar wählen; ein 409 R-ING-01 ist ein Alarmzeichen, keine Aufforderung, umzubenennen.

## 13. Häufige Fragen

<!-- 064a/064b: aus den Leitfaden-Läufen und dem Review füllen -->

## Änderungen dieses Leitfadens

| Datum | Scheibe | Änderung |
|---|---|---|
| 03.10.2026 | Spec 064a | Gliederung |
