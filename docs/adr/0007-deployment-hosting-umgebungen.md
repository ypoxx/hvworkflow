# ADR 0007 — Deployment, Hosting und Umgebungen

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Eigentümer, Konzern-IT, DSB (Plan 3 „Hosting-Plattform"; E10, E10b, E39); Eigentümer (RPO/RTO/SLO, E22) · **Annahme:** Prüfpunkt 3 (Plan 4)

## Kontext

Die Demo läuft statisch auf Netlify mit dem Kern im Browser (ADR 0002). Die Beta braucht den
HTTP-Dienst mit Postgres, echte Anmeldung und eine menschlich betriebene Generalprobe. Regel 11:
keine Zugangsdaten in Reichweite der Agenten, Deployment nur aus der Pipeline nach dem Go des
Eigentümers. Das Konzernkonto für Hosting ist eine Anfrage (25.09.2026) mit Rückfalltrigger
30.10.2026 (E10); die Software darf davon nicht abhängen.

## Entscheidung

Standardannahme aus Plan 3 („Hosting-Plattform", „Taktfläche für Kleinänderungen") und Plan 4
(Zeile 0007, Abschnitt „Drei Umgebungen"):

- **Zwei Artefakte:** statisches Web und ein OCI-Container für `apps/api`; dazu eine managed
  Postgres (ADR 0003).
- **Typisiertes Konfigurationsschema**, beim Start geprüft; Secrets kommen nur aus der Plattform;
  `/healthz` und `/readyz` (Datenbank, Migrationsstand, NTP).
- **Drei Umgebungen:** Demo (Netlify, In-Process, Taktfläche bis beta-1), Staging-synthetisch
  (Agenten, e2e, Last, Chaos; nur synthetische Daten und Testidentitäten) und Übungsmandant
  (menschlich betrieben, Banner „Generalprobe", eigene Datenbank, nach der Probe durch den
  Plattformbetreiber gelöscht). Jede Umgebung hat eine Betriebsauswertung mit Alarmversand.
- **Deploy nur aus der Pipeline nach dem Go des Eigentümers** (Approval-Schritt), Health-Smoke nach
  dem Deploy, **Freeze-Regel in der Pipeline** (kein Deploy im Freeze-Fenster), Image mit Digest.
- **Plattform:** Orientierung am Telekom-Großkundenstandard (souveräne Cloud). Bis zum Konzernkonto
  läuft Staging-synthetisch auf einem vom Umsetzer gemieteten Container-Host mit Härtungs-Checkliste;
  dort bis zur AVV nur synthetische Testidentitäten ohne Personenbezug (E39). Der Übungsmandant
  läuft standardmäßig auf derselben Plattform wie Staging; der Rückfall (gemieteter Host plus
  Keycloak-Realm mit gepoolten Stationsidentitäten, AVV vom Umsetzer, DSB informiert) wird mit E13
  am 29.01.2027 entschieden (E10b).

## Konsequenzen

**Positiv.** Container, Konfigurationsschema und Health-Endpunkte sind plattformneutral; die
Plattform bestimmt nur Secrets-Bezug und Netzgrenze. Ein Plattformwechsel ist Pipeline-Ziel plus
Secrets-Bindung, die Daten ziehen per Dump/Restore des Ereignislogs um.

**Negativ.** Bis zum Konzernkonto zwei Plattformen (Netlify für die Demo, gemieteter Host für
Staging); die Härtung des gemieteten Hosts und die AVV-Kette liegen beim Umsetzer (E39). Der
Approval-Schritt macht jedes Staging-Deploy zu einer Handlung des Eigentümers.

**Risiko.** Bleibt das Konzernkonto aus, wird der Rückfall-Host zur Plattform der Generalprobe;
dann gelten die Einschränkungen aus E13 (B18).

## Kosten bei Änderung

- Pipeline-Ziel und Secrets-Bindung: < 3 AStd; Datenmigration ist Dump/Restore des Ereignislogs
  (Plan 3).
- Taktfläche von der Demo auf Staging umstellen: eine Pipeline-Regel (Plan 3, E35).
- Zweite Zone: außerhalb dieses Plans (E27, Leitplanken 9.3).

## Verworfene Alternativen

- **Plattformspezifisches Backend** (Netlify Functions mit Blob-Speicher). In ADR 0002 verworfen,
  weil es einen zweiten, plattformgebundenen Persistenzpfad bringt; gilt für die Beta fort — der
  Dienst ist ein portabler Container.
- **Deploy von Hand oder aus einer Agentensitzung.** Verworfen: Regel 11, B10 (Deploy nur aus der
  Pipeline nach Go, kein Deploy im Freeze-Fenster).
- **Eine gemeinsame Umgebung für Agententests und menschliche Probe.** Verworfen: der Übungsmandant
  hat eine eigene Datenbank und wird nach der Probe gelöscht (B15).
- **Personenidentitäten auf dem gemieteten Host vor der AVV.** Verworfen: bis zur AVV nur
  synthetische Testidentitäten ohne Personenbezug (E39).
- **Zweite Zone in der Beta.** Verworfen für die Beta (E27).

## Nachweis

Scheibe **037** (Plan 4): Image-Digest und Staging-URL im Bericht; Testalarm kommt bei der
benannten Beobachterin an; Pipeline-Protokoll mit Approval-Schritt; Deploy im Freeze-Fenster →
abgelehnt (Test). Aus B10: `curl /readyz` bei gestoppter Datenbank → 503 (027), Screenshot der
Auswertung mit ausgelöstem Testalarm. RPO/RTO-Drill in 038 (E22).

## Offene Registerzeilen

- **E10** Hosting-Plattform und Ansprechpartner der Konzern-IT (Hosting, Postgres, AVV).
- **E10b** Plattform des Übungsmandanten (mit E13 am 29.01.2027).
- **E39** Rückfall-Host: Verantwortlichkeit, AVV, Standort, Löschung.
- **E22** RPO/RTO/SLO — Register-Standard (Plan 10): RPO 0, RTO 15 min, p90 < 300 ms im
  Probefenster; Drill in 038.
- **E27** Datenbanktopologie und Hochverfügbarkeit.
- **E35** Taktfläche nach Umstellung auf HTTP.
