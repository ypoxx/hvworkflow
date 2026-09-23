# ADR 0008 — Integrationen: ein kanonischer Vertrag je Nachbarsystem

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Projektleitung und Tool-Team (Transkript, E3a, E3b); Projektleitung, Recht, DSB (KI, E18) · **Annahme:** Prüfpunkt 5 (Plan 4)

## Kontext

ADR 0001, Grenze 3: Eigenes gegen Fremdes — ein Adapter je Nachbarsystem, kein Fremdformat
erreicht den Kern. Nachbarn sind das Transkriptionstool, eine KI-Wissensbasis, das Aktienregister
und Abnehmer des Ereignisstroms. Das Tool und der Exportpfad der Transkription sind unbekannt
(Frage 4); Recherche Z.160 verlangt Vollbetrieb ohne KI. Die Ist-Analyse (Abschnitt 6.1, zitiert in
Plan 3) verlangt Vertragskompatibilität über zwei Zyklen für Partner.

## Entscheidung

Standardannahme aus Plan 3 („Exportpfad des Transkriptionstools", „KI-Funktionen und Anbieter")
und Plan 4 (Zeile 0008, Abschnitt „Nachbarsysteme"):

- **Ein kanonischer Vertrag je Nachbarsystem, ein Adapter je Fremdsystem.** Nachbarsysteme
  erreichen den Kern nur über Adapter hinter den Verträgen Ingest, Vorschläge,
  Aktienregister-Lookup und Ereignisstrom/Webhooks; kein direkter Datenbankzugriff, auch nicht als
  Abkürzung vor der HV (Vorlage zu ADR 0001).
- **Systemakteure mit eigenen Rechten** (z. B. `ingest.write`), Anmeldung über Client-Credentials
  oder mTLS als Konfiguration; der Ereignisfilter folgt dem Leserecht des Systemakteurs (nie
  Notizen, nie `protected`).
- **Transkript-Ingest, zwei getrennte Fragen.** E3a Vertragsform: `POST /v1/ingest/speech-segments`
  (`segmentId, text, startedAt, endedAt, speakerId` optional, `source`); Segmente unveränderlich,
  Status `unconfirmed`, Idempotenz je `segmentId`; eingefroren in 043. E3b Adapter: der erste Adapter
  ist ein Datei-/Zwischenablage-Import im Browser, der die Datei zerlegt und den Endpunkt mit der
  Sitzung der erfassenden Person aufruft; `ingest.write` erhält `capture` als Zeile in
  `ROLE_PERMISSIONS`, Systemakteure erhalten es für spätere Push-Adapter. Der Erfassungsfluss bleibt
  identisch (Redebeitrag mit `source: transcript`).
- **KI: nur ein Port.** `POST /v1/questions/{id}/answer-suggestions` mit Pflichtfeldern `sources,
  model, version, confidence`; **kein Statuswechsel durch KI**; Adapter `none` antwortet 503 „nicht
  konfiguriert"; kein Anbieter in der Beta (E18).
- **Ereignisstrom für Nachbarn:** Abonnements je Systemakteur (Ereignistypen, Ziel-URL, HMAC-Secret
  aus der Konfiguration), signierte Zustellung mit Wiederholung und Idempotenzschlüssel;
  **Sandbox-Mandant** `HV_MODE=training` mit synthetischem Korpus für Partnertests (ADR 0010).
- **Aktienregister-Lookup** hinter einem kanonischen Vertrag; die Legitimation der Wortmeldung
  bleibt in der Beta manuell, kein Registerabgleich (E28).
- **/v1-Kompatibilität für Partner über zwei Vertragszyklen** (ADR 0015), festgehalten im
  Integrationsleitfaden.

## Konsequenzen

**Positiv.** Ein Partner braucht nur Vertrag und Leitfaden; ein Tool-Wechsel ist ein Adaptertausch.
Der KI-Port sichert die Vertragsform, ohne dass ein Anbieter oder ein Modell gewählt ist. Die
Sandbox erlaubt Partnertests ohne echte Daten.

**Negativ.** Systemakteure sind zu verwalten (Rechte, Secrets aus der Plattform, Sperre); Webhooks
brauchen Wiederholung und Signaturprüfung. Bis das Tool bekannt ist, bleibt der Datei-Import der
einzige Weg.

**Risiko.** Ein Push-Adapter, der vor der Vertragsform E3a gebaut wird, müsste zweimal gebaut
werden; deshalb friert 043 die Form zuerst ein.

## Kosten bei Änderung

- Vertragsform der Segmente später ändern: ein Vertragszyklus, 1 AStd plus Allowlist-Eintrag; der
  Vertrag bleibt zwei Zyklen kompatibel (Plan 3, E3a).
- Push-Adapter: 1,5–3 AStd plus Partnerleitfaden (Plan 3, E3b).
- KI: ein Adapter je Anbieter, Modell-Pinning als Konfiguration (Plan 3, E18).

## Verworfene Alternativen

- **Direkter Datenbankzugriff eines Fremdsystems.** Verworfen: ausgeschlossen, auch als Abkürzung
  vor der HV (Vorlage zu ADR 0001, Grenze 3).
- **Fremdformat im Kern** (Segmente in Tool-Notation speichern). Verworfen: ADR 0001, Grenze 3.
- **KI löst Statuswechsel aus oder ein Anbieter in der Beta.** Verworfen: Recherche Z.160
  (Vollbetrieb ohne KI ist Pflicht), E18.
- **Push-Adapter als erster Adapter.** Verworfen für den Start: Tool und Schnittstelle sind
  unbekannt (E3b); der Datei-Import deckt den Erfassungsfluss ohne Partnerabhängigkeit.
- **Unsignierte Webhooks.** Verworfen: HMAC-Signatur, Wiederholung, Idempotenzschlüssel (Plan 4).
- **Message-Broker zwischen den Teilen.** In ADR 0001 verworfen (Volumen, Betriebsfläche am HV-Tag).

## Nachweis

Scheiben **064** und **065** (Plan 4): Test „gleiches Segment zweimal → ein Ereignis"; Negativtest
Rolle ohne `ingest.write` → 403; Playwright Import → Redebeitrag → Einzelfragen; Leitfaden; Test
Signatur falsch → verworfen; Wiederholung nach 5xx; `protected`-Ereignis wird nicht zugestellt.
Vertragsform in 043 (E3a); KI-Port in 066, Aktienregister in 067 (Vorlage zu ADR 0001, Grenze 3).

## Offene Registerzeilen

- **E3a** Vertragsform der Transkript-Segmente (Ansprechperson Tool-Team bis 16.10.2026).
- **E3b** Adapter des Transkriptionstools.
- **E18** KI-Funktionen und Anbieter.
- **E28** Legitimation, Aktien- und Teilnehmermodell.
