# Bedrohungsmodell v1 — HV-Tool (Beta)

**Status:** v1, Prüfhilfe mit Perspektive Security · **Stand:** 23.09.2026, Code-Stand Commit `a8cbbe1`
(Scheibe 039; zuerst gegen `8c8368b`, nach dem Merge von Scheibe 012 fortgeschrieben) · **Nachfolger:** v2 mit
Befundstatus in Scheibe 074 · **Adressaten:** die Scheiben, die Bedrohungen schließen (Abschnitt 6), der Reviewer mit Perspektive Security
([`reviewer-checkliste-sicherheit.md`](reviewer-checkliste-sicherheit.md)), der Sicherheitsreview des
Architekten an den Prüfpunkten 3, 4 und 7, der Pentest ([`pentest-scope.md`](pentest-scope.md), E32).

> **Rang.** Dieses Dokument führt keine Regel und kein Tor ein und erteilt keine Sicherheitsfreigabe
> (Leitplanken 1). Eine Kontrolle wird für eine Scheibe erst verbindlich, wenn ihre Spec die Bedrohungs-ID als
> Akzeptanzkriterium übernimmt. Wo eine Kontrolle mit „Zielvorschlag" markiert ist, steht sie so nicht im
> Plantext; die Spec der genannten Scheibe entscheidet, ob sie sie übernimmt. Die ADRs 0003, 0004, 0007, 0008,
> 0011, 0013 und 0014 sind „vorgeschlagen"; das Beta-Ziel beschreibt ihre Standardannahme.

**Belegregel.** Jede Aussage über den heutigen Stand nennt Datei und Zeile im Code (Commit `a8cbbe1`). Wo
eine Aussage eine Abwesenheit ist („kein Rate-Limit"), nennt sie die Stelle, an der die Kontrolle stehen
müsste. Die schwersten Befunde sind zusätzlich durch Proben gegen den laufenden Code bestätigt (Anhang A).

---

## 1. Gegenstand und Stand

### 1.1 Heute (am Code belegt)

| Baustein | Stand heute | Beleg |
|---|---|---|
| Demo-Betriebsart (ADR 0002) | Domäne läuft im Browser; Ereignislog im `localStorage` des Geräts; Rollenumschalter setzt den Akteur | `apps/web/src/api/index.ts:17-48`, `apps/web/src/api/actor.ts:12-21, 43-51` |
| Demo-Hosting | statischer Build ohne Funktionen und ohne Secrets; drei Sicherheits-Header, keine CSP | `netlify.toml:1-4, 14-19` |
| HTTP-Dienst | Hono-App über der Domäne; jeder Handler ruft genau eine `HvApi`-Methode | `apps/api/src/app.ts:84-316` |
| Identität im Dienst | Header `X-Actor: <id>:<rolle>`, geprüft werden nur Form und bekannter Rollenname; die Auswertung läuft immer, auch ohne `HV_DEMO`; der Seed beim Start läuft als Akteur aus Option, `HV_SEED_ACTOR` oder Systemakteur | `apps/api/src/actor.ts:11-29`, `apps/api/src/app.ts:109-113, 143-146` |
| Schalter `HV_DEMO` | wirkt nur auf CORS, Seed beim Start und den Seed-Endpunkt | `apps/api/src/app.ts:85, 104, 131-140, 300-303` |
| Vertrag | Version 0.2.0, 29 Operationen, globales Schema `demoActor`; OIDC nur als geplantes Schema | `packages/contract/openapi.yaml:4, 41-42, 489-499` |
| Rechte | acht Rollen als Bündel; `can()` als einziger Entscheidungspunkt; Schreibwege prüfen, Lesewege nicht | `packages/domain/src/permissions.ts:12-44`, `packages/domain/src/api.ts:142-155, 205-208, 241-257, 277-296, 343-352, 397-409, 509-525` |
| Übergänge | Tabelle R-TRANS-01..12 mit Guards R-GUARD-01..05; kein Vier-Augen-Guard, kein Rechtstor | `packages/domain/src/transitions.ts:28-60, 64-156` |
| Ereignis | `seq, id, type, at, actor, subjectId, payload`; kein Hash, kein Jahrgang, eine Zeit | `packages/domain/src/events.ts:16-24` |
| Persistenz | Speicher im Prozess; optional JSONL-Datei (`HV_EVENT_LOG`), nur angehängt, beim Start ungeprüft geladen | `packages/domain/src/store.ts:22-52`, `apps/api/src/eventLog.ts:9-33`, `apps/api/src/app.ts:86-87` |
| Zeit | Ereigniszeit aus der injizierten Uhr des Dienstes; in der Demo die Uhr des Browsers | `packages/domain/src/api.ts:167, 177, 231-235`, `apps/web/src/api/index.ts:46` |
| Nebenläufigkeit | `If-Match` nur geprüft, wenn gesendet; Idempotenz je Akteur und Operation, nur im Speicher | `packages/domain/src/api.ts:171, 209-230` |
| Eingangsprüfung | Header, Query und Body gegen die Vertragsschemas vor jedem Handler; Zusatzfelder erlaubt | `apps/api/src/validate.ts:29-54`, `apps/api/src/contractSchema.ts:25` |
| Fehler | Problem-Details; unerwartete Fehler ohne Stack an den Aufrufer, vollständig ins Prozesslog | `apps/api/src/problem.ts:8-26` |
| Realtime | kein SSE über HTTP; im Prozess ein Abonnement ohne Filter | `apps/api/src/app.ts:312-313`, `packages/domain/src/api.ts:536-538` |
| Nachbarsysteme | kein Adapter; `/v1/events` ist als Strom für Nachbarn beschrieben und für jeden Akteur offen | `packages/contract/openapi.yaml:39, 450-469`, `packages/domain/src/api.ts:523-525` |
| Start | `tsx` aus dem Quelltext, Port aus der Umgebung, kein `hostname` (lauscht auf allen Schnittstellen) | `apps/api/package.json:8-9`, `apps/api/src/server.ts:11-17` |
| CI | Workflow `gates` bei Push und PR: Vertragstypen, `pnpm gates` (mit Architektur-, Rollenliteral-, now()- und Plan-Ehrlichkeits-Tor), Wahrheitstabelle, Semgrep auf geänderten Dateien, gitleaks, `pnpm audit`, e2e; Workflow `nightly` mit gitleaks, Semgrep-Vollauf und `pnpm audit`; Token nur lesend; Drittanbieter-Bausteine per Commit-Hash, vier Bausteine per Tag; keine SBOM | `.github/workflows/gates.yml:7-9, 14-20, 58-94`, `.github/workflows/nightly.yml:10-40`, `package.json:15` |
| Agenten | vier Rollen, die bauenden mit `Write` und `Bash`; ein Hook sperrt Force-Push, `rm -rf /`, `reset --hard`, `curl … \| sh` | `.claude/agents/implementierer-backend.md:5`, `.claude/settings.json:3-13` |

### 1.2 Beta-Ziel (Standardannahmen der vorgeschlagenen ADRs)

| Baustein | ADR | Scheiben |
|---|---|---|
| OIDC über einen BFF im Dienst, HttpOnly-Sitzung, Sperrliste, zwei Notfallkonten, Demo-Verriegelung | 0004 | 029, 030, 088 |
| Postgres nur anhängend (Dienstrolle INSERT/SELECT), `seq` unter Advisory-Lock, PITR, Restore-Drill | 0003 | 027, 038 |
| Umschlag v2: Hash-Kette, `meetingId`, `recordedAt`/`occurredAt` mit Quelle, `retentionClass`, `pii` mit `keyId` | 0011 | 023, 024 |
| SSE `/v1/stream` mit Leserechten, inkrementeller Client, In-App-Alarme | 0014 | 035, 036, 085 |
| Ein Adapter je Nachbarsystem: Ingest, KI-Port ohne Anbieter, Aktienregister-Lookup, Webhooks mit HMAC | 0008 | 064, 065, 066, 067 |
| Container, drei Umgebungen, Deploy nur aus der Pipeline nach Go, Freeze-Regel, Betriebsauswertung | 0007 | 037, 042 |
| Zwei Protokollebenen, Auswertung nur zu zweit, keine Kennzahl je Person | 0013 | 033, 047 |

### 1.3 Grenzen und Datenflüsse

```
 Browser (Oberfläche)              Dienst (apps/api + packages/domain)         Persistenz
 ┌──────────────────────┐   G1    ┌────────────────────────────────────┐  G2   ┌──────────────────┐
 │ Web, Podiumsgerät    │ ──────▶ │ Actor-Port → can() → Übergänge     │ ────▶ │ Ereignislog      │
 │ (Demo: Domäne im     │ ◀────── │ → append → Projektion              │ ◀──── │ (heute Speicher/ │
 │  Browser, kein G1)   │  SSE    └────────────────────────────────────┘       │  JSONL; Beta PG) │
 └──────────────────────┘                  │ G3                                └──────────────────┘
                                           ▼
             IdP · Transkription/Ingest · KI-Port · Aktienregister · Webhook-Abonnenten · Alarmversand
 Q (Querschnitt): Repositorium, CI, Abhängigkeiten, bauende Agenten, Secrets, Konfiguration, Plattform
```

G1 ist die Grenze Oberfläche gegen Anwendung (ADR 0001, Grenze 1). G2 ist die Grenze zwischen Dienst und
Speicher hinter dem Persistence-Port (Grenze 2). G3 umfasst alle Nachbarsysteme hinter je einem Adapter
(Grenze 3). In der Demo gibt es keine Netzgrenze G1: wer das Gerät bedient, kontrolliert die Domäne; das ist
nach ADR 0002 hingenommen, weil die Demo nur den synthetischen Korpus hält (T-G1-S-03).

---

## 2. Schutzgüter

| ID | Schutzgut | Schutzziel | Wo es heute liegt |
|---|---|---|---|
| SG1 | Unveröffentlichte Antwortentwürfe und -fassungen | Vertraulichkeit, Integrität | `packages/domain/src/types.ts:141-147`, Ereignis `AnswerDrafted` (`packages/domain/src/events.ts:63-66`) |
| SG2 | Rechtseinschätzungen, Rückgabe- und künftig Verweigerungsgründe | Vertraulichkeit, Integrität | `packages/domain/src/types.ts:171`, Ereignis `QuestionReturned` (`packages/domain/src/events.ts:69-72`); Verweigerung ab 044 |
| SG3 | Identität der Redner (Klarname, Organisation) | Vertraulichkeit | `packages/domain/src/events.ts:36-47`, `packages/domain/src/state.ts:177` |
| SG4 | Integrität des Ereignislogs als Grundlage der Niederschrift-Anlage (B12): Reihenfolge, Akteur, Zeit, Inhalt | Integrität, Nachweisbarkeit | `packages/domain/src/store.ts:27-37`, `apps/api/src/eventLog.ts:23-31` |
| SG5 | Verfügbarkeit im HV-Fenster: Erfassung, Beantwortung, Bühne | Verfügbarkeit | Dienst `apps/api/src/server.ts:11-17`; Bühne `packages/domain/src/api.ts:509-522` |
| SG6 | Rechtezuordnung: Rollenbündel, ab 026 Zuordnung je Person, ab 040 Freeze | Integrität | `packages/domain/src/permissions.ts:12-44` |
| SG7 | Zugangsmittel: Sitzungen, Client-Secrets, HMAC-Secrets, Notfallkonto-Geheimnisse, Datenbank-Zugang | Vertraulichkeit | heute keine (Identität ist ein Header, `apps/api/src/actor.ts:11-29`) |
| SG8 | Personenbezogene Metadaten der Beschäftigten (wer hat wann was bearbeitet) | Vertraulichkeit, Zweckbindung (ADR 0013) | `actor` an jedem Ereignis (`packages/domain/src/events.ts:21`), `createdBy`/`approvedBy` (`packages/domain/src/types.ts:145, 152`) |
| SG9 | Integrität von Code, Vertrag, Wahrheitstabelle und ausgelieferten Artefakten | Integrität | `packages/domain/policy-truth-table.md`, `.github/workflows/gates.yml:22-93` |

## 3. Akteure

| ID | Akteur | Fähigkeit | Ziel | Grenzen |
|---|---|---|---|---|
| AK1 | Angreifer ohne Konto im Netz (Internet, Saal-WLAN) | erreicht öffentliche Endpunkte, sendet beliebige Anfragen | Entwürfe lesen, Bühne stören, Dienst lahmlegen | G1, G3 |
| AK2 | Innentäter mit gültigem Konto und zu wenig Recht (z. B. Fachbereich, Beobachtung) | angemeldet, kennt Oberfläche und Abläufe | mehr lesen oder tun als erlaubt, fremde Einheit, eigene Antwort freigeben | G1 |
| AK3 | Neugieriger Beobachter (Schulterblick im Saal, unbeaufsichtigter Platz, Mitlesen berechtigter Personen) | sieht Bildschirme, nutzt liegengelassene Sitzungen | unveröffentlichte Antworten, Rednernamen | G1 |
| AK4 | Administration | hält `admin`-Rechte, künftig Rollenzuordnung und Konfiguration | Rechte an sich ziehen, Inhalte ändern, Spuren verwischen | G1, G2 |
| AK5 | Kompromittiertes Podiumsgerät (Kiosk-Tablet, E33) | handelt mit der Sitzung des Podiums, liest den Offline-Puffer | falsches „Vorgelesen", fremde Warteschlange lesen | G1 |
| AK6 | Kompromittiertes Nachbarsystem (Transkription, KI-Adapter, Aktienregister, Webhook-Abonnent, IdP) | sendet im Namen eines Systemakteurs, empfängt den Ereignisstrom | Fragen einschleusen, Inhalte abziehen, Identität fälschen | G3 |
| AK7 | Kompromittierte Abhängigkeit oder Build-Kette, einschließlich der bauenden Agenten | führt Code in CI, im Build und in Agentensitzungen aus | Hintertür, Secrets, Tore aushebeln | Q |
| AK8 | Plattformbetreiber (Hosting, managed Postgres, Demo-Hosting; Konzern-IT oder gemieteter Host) | Zugriff auf Laufzeit, Datenbank, Backups, Secrets | Daten lesen, Log ändern, Verfügbarkeit | G2, Q |

---

## 4. Lesehilfe für die STRIDE-Tabellen

- **ID** `T-<Grenze>-<Buchstabe>-<nn>`, stabil; eine gestrichene Bedrohung behält ihre ID mit Vermerk.
- **Bedrohung** mit konkretem Beispiel und, wo es den heutigen Stand betrifft, Datei:Zeile.
- **Kontrolle** „vorhanden" mit Datei:Zeile oder „geplant" mit Scheibennummer aus Plan Abschnitt 5.
- **Beta** ist das Beta-Kriterium aus Plan Abschnitt 1, das die Kontrolle trägt, sonst „—".
- **Test** ist ein vorhandener Test in der Form Pfad › Testname (in Backticks) oder „geplant in Scheibe NNN"
  (in Klammern der Nachweis aus dem Plan, wo er genannt ist).
- **Status** bewertet den heutigen Code gegen das Beta-Ziel: `geschlossen` (Kontrolle vorhanden und durch
  einen zitierten Test belegt), `teilweise` (ein Teil vorhanden und belegt, der Rest geplant), `offen` (keine
  wirksame Kontrolle im Code). Eine Kontrolle, die nur aus CI-Konfiguration besteht, zählt höchstens als
  `teilweise`: ein CI-Schritt ist kein zitierbarer Test, und bis zum Branch-Schutz (016) kann jede Änderung am
  Workflow sie wieder entfernen.
- **STRIDE:** S Identität vortäuschen · T Manipulation · R Abstreiten · I Offenlegung · D Verfügbarkeit ·
  E Rechteerhöhung. In v1 hat jeder Buchstabe jeder Grenze mindestens eine Bedrohung; die Form „nicht
  anwendbar, weil …" wird deshalb nicht gebraucht.

## 5. STRIDE je Grenze

### 5.1 G1 — Oberfläche ↔ Dienst

| ID | Bedrohung (Beispiel) | Kontrolle | Beta | Test | Status |
|---|---|---|---|---|---|
| T-G1-S-01 | Identität per Behauptung: der Dienst übernimmt `X-Actor` ohne Anmeldung und unabhängig von `HV_DEMO`; wer den Port erreicht, sendet `X-Actor: irgendwer:admin` und hat alle Rechte (Probe P1). `HV_DEMO` schaltet nur CORS und Seed (`apps/api/src/app.ts:131-140, 300-303`), die Auswertung läuft immer (`apps/api/src/app.ts:143-146`). | vorhanden: nur Form- und Rollennamenprüfung, 401 bei fehlendem, fehlerhaftem oder unbekanntem Wert (`apps/api/src/actor.ts:12-27`); geplant: Actor-Port mit drei Adaptern, `demoHeader` nur bei `HV_DEMO=1` ohne Issuer, sonst Startabbruch (029) | B1 | `apps/api/src/__tests__/negative.test.ts › 401: missing X-Actor header`; `apps/api/src/__tests__/negative.test.ts › 401: unknown role in X-Actor header`; geplant in Scheibe 029 („X-Actor ohne Demo → 401") | offen |
| T-G1-S-02 | Sitzungsübernahme im Beta-Ziel: gestohlenes Sitzungscookie (unbeaufsichtigter Erfassungsplatz, XSS, geteiltes Browserprofil), Session Fixation, Login-CSRF auf den Rückruf der Anmeldung; ein offener SSE-Strom überdauert Abmelden oder Sperre (T-G1-I-09). Heute gibt es keine Sitzung (`apps/api/src/actor.ts:1-5`). | geplant: HttpOnly/SameSite-Cookie, 14 h mit stillem Refresh und Leerlauf-Timeout, Abmelden, Sperrliste ohne Neustart (029); neue Sitzungs-ID nach der Anmeldung (029, Zielvorschlag); CSP (034, 037) | B1 | geplant in Scheibe 029 („abgelaufene Sitzung → 401", „gesperrtes Subject → 401") | offen |
| T-G1-S-03 | Rollenwahl in der Demo: jede Person nimmt im Browser über den Rollenumschalter jede Rolle an (`apps/web/src/api/actor.ts:43-51`), gewollt nach ADR 0002. Gefahr ist die Verwechslung: echte Daten in der Demo oder ein Build mit Rollenumschalter gegen einen echten Dienst. | vorhanden: Demo hält nur den synthetischen Korpus im Browser des Geräts (`apps/web/src/api/index.ts:17-48`, `packages/domain/src/seed.ts:1-7`); Demo-Kennzeichen fest verdrahtet (`apps/web/src/api/index.ts:86`); geplant: Betriebsart per Build-Konfiguration, Rollenumschalter nur in der Demo (030) | B17 | `apps/web/e2e/001-shell.spec.ts › shell: counters, role switch, language switch @screenshot` (belegt nur den Demo-Pfad); geplant in Scheibe 030 | teilweise |
| T-G1-T-01 | Anfrage außerhalb des Vertrags (falscher Typ, Wert außerhalb des Enums, Query außerhalb des Bereichs) erreicht Domäne und Log. | vorhanden: `validateOperation` prüft Header, Query und Body gegen die Vertragsschemas vor jedem Handler (`apps/api/src/validate.ts:29-54`); fachliche Eingangsprüfung in der Domäne (`packages/domain/src/api.ts:411-417`) | — | `apps/api/src/__tests__/negative.test.ts › 422: a wrongly-typed body is rejected against the contract before it reaches the domain`; `apps/api/src/__tests__/negative.test.ts › 422: an out-of-enum kind or status is rejected, not silently written`; `apps/api/src/__tests__/negative.test.ts › 422: an out-of-range or out-of-enum query parameter is rejected, not clamped` | geschlossen |
| T-G1-T-02 | Unbekannte Felder im nur anhängenden Log: `PATCH /v1/speakers/{id}` mit `{"round":1,"injected":"…"}` wird angenommen und als Payload von `SpeakerUpdated` gespeichert (Probe P4). Die Anfrageschemas verbieten keine Zusatzfelder (`packages/contract/openapi.yaml:701-711`), der Validator läuft mit `strict: false` (`apps/api/src/contractSchema.ts:25`), die Domäne übernimmt den Body ganz (`packages/domain/src/api.ts:338, 421`). | geplant: `additionalProperties: false` auf Anfrageschemas (023, Zielvorschlag); Payload aus benannten Feldern im Umschlag v2 (024, Zielvorschlag) | B3 | geplant in Scheibe 023 | offen |
| T-G1-T-03 | Verlorene Änderung: zwei Personen bearbeiten dieselbe Einzelfrage, ohne `If-Match` überschreibt der Zweite still (`packages/domain/src/api.ts:209-217`). | vorhanden: Prüfung, wenn `If-Match` gesendet wird (`packages/domain/src/api.ts:210`); geplant: `If-Match` Pflicht mit 428, Übernahme-Sperre (028) | B9 | `apps/api/src/__tests__/negative.test.ts › 412: a stale If-Match is a precondition failure and changes nothing`; geplant in Scheibe 028 („paralleles captureQuestions → 412 für den Zweiten") | teilweise |
| T-G1-T-04 | Freigabe unterschieben: eine andere als die zuletzt eingereichte Fassung wird freigegeben, oder der Text ändert sich nach der Freigabe. | vorhanden: R-GUARD-04 „nur die letzte Fassung" (`packages/domain/src/transitions.ts:43-55`); eine neue Fassung hebt die Freigabe auf (`packages/domain/src/state.ts:215`) | B6 | `packages/domain/src/__tests__/transitions.test.ts › R-GUARD-04: approval must name the latest answer version`; `packages/domain/src/__tests__/api.test.ts › a new answer version after approval voids the approval (bound to the text)` | geschlossen |
| T-G1-T-05 | Cross-Site Request Forgery im Beta-Ziel: eine fremde Seite löst im Browser einer angemeldeten Freigabe `POST /v1/questions/{id}/approvals` aus. Heute nicht ausnutzbar: Identität steht in einem eigenen Header, CORS ist nur im Demo-Modus für eine lokale Entwicklungsadresse offen (`apps/api/src/app.ts:131-140`). | geplant: SameSite-Cookie und CSRF-Token für Schreibvorgänge (029), Client sendet den Token (030), CORS-Allowlist aus der Konfiguration (034) | B1 | geplant in Scheibe 029 | offen |
| T-G1-T-06 | Skripteinschleusung (XSS) über Fragetext, Antworttext oder Rednernamen auf Bühne, Historie und Export; ab 055 formatierte Antworten mit „Einfügen aus Word". | vorhanden: Texte werden als Textknoten gesetzt (z. B. `apps/web/src/features/stage/Podium.tsx:90, 179`), keine Verwendung von `dangerouslySetInnerHTML` oder `innerHTML` in `apps/web/src` (Suche ohne Treffer); Semgrep-Regel gegen `dangerouslySetInnerHTML` blockiert in CI (`scripts/semgrep/rules.yml:60-66`, Schritt `.github/workflows/gates.yml:64-80`); geplant: CSP am Dienst (034) und für die Demo (037), Whitelist-Renderer für das Blockdokument (055) | — | geplant in Scheibe 034 („CSP-Report ohne Verstoß in e2e") | teilweise |
| T-G1-T-07 | Zeit behaupten: Client oder Gerät setzt eine Zeit, um eine Antwort, ein Vorlesen oder eine Papier-Nacherfassung rückzudatieren. | vorhanden: die Ereigniszeit kommt aus der injizierten Uhr des Dienstes, nie aus der Anfrage (`packages/domain/src/api.ts:177, 231-235`, Uhr `apps/api/src/app.ts:99`); in der Demo ist es die Uhr des Browsers (`apps/web/src/api/index.ts:46`); geplant: `occurredAt` nur als Angabe mit Quelle, Zukunft abgelehnt (024); `lateEntry` mit Pflichtgrund (025); now()-Tor auch für `apps/web` (032); vorhanden seit 012: now()-Tor über Domäne und Dienst in `pnpm gates` (`scripts/now-check.mjs:24`, `package.json:15`) | B4 | geplant in Scheibe 024 („occurredAt aus Quelle device wird nie zu recordedAt, Zukunft abgelehnt") | teilweise |
| T-G1-R-01 | Abstreiten einer Handlung („ich habe nicht freigegeben"): jedes Ereignis trägt `actor` (`packages/domain/src/events.ts:21`), aber der Akteur ist selbst behauptet (T-G1-S-01); der Dienst protokolliert keine Zugriffe (keine Log-Middleware in `apps/api/src/app.ts:126-148`). | vorhanden: Akteur und Serverzeit an jedem Ereignis (`packages/domain/src/api.ts:231-235`); geplant: Einzelidentität über OIDC (029); Zugriffslog mit Korrelations-ID und Subject-Hash in eigener Senke (033) | B1, B5 | geplant in Scheibe 033 („Log-Zeile ohne Fragetext trotz Body") | teilweise |
| T-G1-R-02 | „Vorgelesen" ohne Beweiswert: `QuestionDelivered` trägt nur die Fassungsnummer der Freigabe, keinen Bühnenplatz, kein Gerät, keinen Hash der vorgelesenen Fassung, keine Zeitquelle (`packages/domain/src/api.ts:478-484`); ein Soll-Ist ist nicht belegbar. | vorhanden: Fassungsnummer der Freigabe im Ereignis (`packages/domain/src/api.ts:482`); geplant: Delivery-Entität mit `versionHash`, Platz, Gerät, `occurredAt`/`recordedAt` (049); Offline-Absicht mit Gerätezeit als Angabe (058) | B7, B12 | geplant in Scheibe 049 („Delivery referenziert exakt die freigegebene Version") | teilweise |
| T-G1-I-01 | Jede Rolle liest alles: keine Lesemethode prüft ein Recht (`packages/domain/src/api.ts:277-296, 343-352, 397-409, 509-525`). `observer` erhält mit `GET /v1/questions?status=answer_drafted` unveröffentlichte Antworttexte (Probe P2). Der Vertrag 0.2.0 kennt die Leserechte schon (`packages/contract/openapi.yaml:582-610`), die Domäne noch nicht (`packages/domain/src/types.ts:26-45`). | geplant: Leserechte nur in `ROLE_PERMISSIONS`, `can()` auf allen Lesemethoden, 403 mit R-PERM-02 (010); Attributebene Einheit, Platz, Vertraulichkeit (047) | B2 | geplant in Scheibe 010 („observer 403 auf ?status=answer_drafted") | offen |
| T-G1-I-02 | Massenlesen in einem Aufruf: `GET /v1/events?limit=5000` liefert jedem Akteur das ganze Log mit Entwürfen, Rückgabegründen und Akteuren (Probe P3); `GET /v1/questions` bis 2000 Einträge je Seite (`packages/contract/openapi.yaml:208, 457`, `packages/domain/src/api.ts:523-525`). | vorhanden: Obergrenze je Seite, Überschreitung wird abgewiesen (`apps/api/src/validate.ts:32-39`); geplant: `event.read` nur für die Administration (010); Rate-Limit (034); Export nur mit `export.dossier` und Ereignis je Export (051) | B2, B12 | `apps/api/src/__tests__/negative.test.ts › 422: an out-of-range or out-of-enum query parameter is rejected, not clamped`; geplant in Scheibe 010 („podium 403 auf /events") | teilweise |
| T-G1-I-03 | Klarnamen der Redner für alle: jede Einzelfrage trägt den Anzeigenamen des Redners (`packages/domain/src/state.ts:177`), die Freitextsuche trifft ihn (`packages/domain/src/api.ts:268`), `SpeakerRegistered` speichert Name und Organisation (`packages/domain/src/events.ts:36-47`). | geplant: Personentabelle, Pseudonym ohne `question.identity.reveal` (026); Aufdecken als Ereignis mit Grund (067) | — | geplant in Scheibe 026 („Pseudonym ohne question.identity.reveal") | offen |
| T-G1-I-04 | Ableitung über Nummern, Zähler und Suche: fortlaufende F-Nummern (`packages/domain/src/api.ts:384`), Zähler je Status für jeden Leser (`packages/domain/src/api.ts:277-280`) und die Suche über Antworttexte (`packages/domain/src/api.ts:266-272`) verraten Existenz, Stand und Stichworte auch dann, wenn der Inhalt später geschützt ist (Suchorakel). | vorhanden: Ressourcen-IDs sind zufällig, aus `crypto.randomUUID` oder `crypto.getRandomValues` (`packages/domain/src/api.ts:119-136`); geplant: Zähler lückenlos ohne Inhalt, `protected` nur für Berechtigte (047, E17); Suche nur über lesbare Fragen (010, 047, Zielvorschlag) | B2 | geplant in Scheibe 047 („observer auf protected 403") | teilweise |
| T-G1-I-05 | Echo ungeprüfter Eingaben: Problem-Details geben den Header-Wert zurück (`apps/api/src/actor.ts:22, 26`, Probe P9); als JSON harmlos, aber ein Weg für Log- und Anzeige-Injektion. | vorhanden: unerwartete Fehler ohne Stack und ohne Details an den Aufrufer (`apps/api/src/problem.ts:9-16`), Typ `application/problem+json` (`apps/api/src/problem.ts:22-25`); geplant: `actor.ts` wird durch den Actor-Port ersetzt (029) | — | `apps/api/src/__tests__/negative.test.ts › 401: malformed X-Actor header (no role)`; geplant in Scheibe 029 | teilweise |
| T-G1-I-06 | Fehlende Sicherheits-Header: Antworten des Dienstes tragen nur `content-type` (Probe P7; keine Header-Middleware in `apps/api/src/app.ts:126-148`), also kein `Cache-Control: no-store` für Entwürfe, keine CSP, kein Frame-Schutz; die Demo setzt drei Header, aber keine CSP (`netlify.toml:14-19`, `apps/web/index.html:1-13`). | vorhanden: Frame-Schutz, `nosniff` und `Referrer-Policy` für die Demo (`netlify.toml:17-19`); geplant: Sicherheits-Header und CSP am Dienst (034), CSP für die Demo (037) | — | geplant in Scheibe 034 („Header-Probe in contract.test.ts") | teilweise |
| T-G1-I-07 | Idempotenz-Replay als Leck: ein anderer Akteur sendet denselben `Idempotency-Key` und erhält das gespeicherte Ergebnis samt `_actions` des Erstakteurs. | vorhanden: Schlüssel gilt je Akteur und Operation, R-IDEM-01 (`packages/domain/src/api.ts:223-230`) | B9 | `packages/domain/src/__tests__/api.test.ts › R-IDEM-01: an idempotency key is scoped to actor and operation`; `apps/api/src/__tests__/negative.test.ts › idempotent replay is scoped to the actor (rework review blocker 3, domain rule R-IDEM-01)` | geschlossen |
| T-G1-I-08 | Unbeaufsichtigtes oder einsehbares Gerät (Erfassung, Beantwortung, Podium): Bildschirm und Browserspeicher zeigen unveröffentlichte Antworten; in der Demo bleibt das Log im `localStorage` des Geräts (`apps/web/src/api/index.ts:29-39`). | geplant: Leerlauf-Timeout, Abmelden, Sperren einer Sitzung (029); Offline-Puffer nur mit freigegebenen Antworten des eigenen Platzes (058); Szenario „Podiumsgerät verloren" (070, 078) | B15 | geplant in Scheibe 029 („gesperrtes Subject → 401") | offen |
| T-G1-I-09 | SSE-Strom als eigene Leseschnittstelle (`/v1/stream`, ADR 0014): (a) der Strom stellt Ereignisse ohne dieselbe Prüfung wie die Lesemethoden zu, etwa Entwurfsereignisse an `observer`; (b) ein Client setzt `Last-Event-ID` oder `after=seq` zurück und spielt Ereignisse über eine Rechtegrenze hinweg ab — aus einem fremden Jahrgang, aus der Zeit vor einem Rollenentzug oder zu Fragen, die inzwischen `protected` sind; (c) ein offener Strom liefert nach Abmelden, Sitzungsablauf, Sperre (Kill-Switch) oder Rollenentzug weiter Inhalte. Heute gibt es keinen Strom über HTTP (`apps/api/src/app.ts:312-313`); das Abonnement im Prozess filtert nicht (`packages/domain/src/api.ts:536-538`), und `/v1/events` liefert jedem Akteur alles (`packages/domain/src/api.ts:523-525`). | geplant: Rechteprüfung im Strom wie bei den Leserechten aus 010, Jahrgangsfilter, Wiederaufnahme über `after=seq` (035); Prüfung bei jeder Zustellung gegen die aktuellen Rechte statt gegen die beim Verbindungsaufbau, Wiederaufnahme nur über lesbare Ereignisse (035, Zielvorschlag); Strom schließen bei Abmelden, Sitzungsablauf, Sperre und Rollenentzug (035 mit 029, Zielvorschlag) | B1, B2, B10 | geplant in Scheibe 035 („observer erhält keine Entwurfsereignisse") | offen |
| T-G1-D-01 | Erschöpfung durch Anfragen: kein Rate-Limit, kein Body-Limit, kein Timeout; ein 2-MB-Redebeitrag wird angenommen und dauerhaft ins Log geschrieben (Probe P8). Der Body wird ganz gelesen (`apps/api/src/http.ts:11-19`); die einzige Längengrenze im Vertrag gilt dem Idempotenzschlüssel (`packages/contract/openapi.yaml:505`). | geplant: Rate-Limit je Subject (Standard 60 Schreibvorgänge/min), Body-Limit 256 kB, Request-Timeout (034); `maxLength` für Textfelder (023, Zielvorschlag) | B10, B11 | geplant in Scheibe 034 („Negativtests 429, 413, 408") | offen |
| T-G1-D-02 | Unbegrenzter Idempotenzspeicher: jeder neue Schlüssel bleibt bis zum Neustart im Speicher des Dienstes (`packages/domain/src/api.ts:171, 223-230`); viele Schlüssel füllen ihn. | vorhanden: Schlüssellänge höchstens 128 (`packages/contract/openapi.yaml:505`); geplant: Idempotenz aus dem Log rekonstruiert (028); Ablauf und Obergrenze (028, Zielvorschlag) | B9 | `apps/api/src/__tests__/negative.test.ts › 422: an Idempotency-Key over 128 characters is rejected`; geplant in Scheibe 028 | teilweise |
| T-G1-D-03 | Vollabruf und lange Verbindungen im HV-Fenster: heute löst jede Änderung einen Vollabruf aus (`apps/web/src/api/useApiVersion.ts:10-16`); im Beta-Ziel hält jeder Client einen SSE-Strom, viele offene Ströme eines Subjects binden Verbindungen. | geplant: SSE mit Heartbeat (035), inkrementeller Client (036), Rate-Limit (034), Begrenzung der Ströme je Subject (035, Zielvorschlag), Lasttest 50 + 15 (071) | B11 | geplant in Scheibe 071 („SSE-Latenz < 2 s") | offen |
| T-G1-E-01 | Umgehung der Oberfläche bei Schreibvorgängen: ein Akteur ruft eine schreibende Operation direkt auf, die die Oberfläche ihm nicht anbietet (z. B. `POST /v1/questions/{id}/classification` als `observer`). Lesende Operationen stehen in T-G1-I-01 (offen). | vorhanden: jeder Schreibvorgang prüft Recht und Übergangstabelle im Dienst (`packages/domain/src/api.ts:205-208, 241-257`); `_actions` ist nur Anzeige (`packages/domain/src/api.ts:158-161`); deny by default (`packages/domain/src/permissions.ts:54-60`); seit 012 hält das Rollenliteral-Tor Rollennamen aus Dienst und Domäne heraus (`scripts/role-literal-check.mjs:31-36`, `package.json:15`) | B2 | `apps/api/src/__tests__/negative.test.ts › 403: observer may read but not classify (deny reason carries a rule id)`; `packages/domain/src/__tests__/transitions.test.ts › deny by default: an unknown role has no permissions`; `packages/domain/src/__tests__/transitions.test.ts › matches the committed table — any change must be reviewed` | geschlossen |
| T-G1-E-02 | Selbstfreigabe: `legal` hält `answer.draft` und `question.approve` (`packages/domain/src/permissions.ts:33`), R-TRANS-05 hat keinen Guard „Ersteller ≠ Freigeber" (`packages/domain/src/transitions.ts:97-104`); dieselbe Kennung entwirft und gibt frei (Probe P5, `packages/domain/policy-truth-table.md:83`). | geplant: R-GUARD-06 Ersteller ≠ Freigeber, `legal` erhält `question.legal.clear` statt der Freigabe (021); personengenau erst mit Einzelidentitäten (029, B18) | B6 | geplant in Scheibe 021 („legal entwirft und versucht Freigabe → 409 R-GUARD-06") | offen |
| T-G1-E-03 | Rechtstor umgehen: `approver` gibt frei und stellt auf die Bühne, ohne dass Recht geprüft hat; R-TRANS-07 hat keinen Guard (`packages/domain/src/transitions.ts:112-118`, Rechte `packages/domain/src/permissions.ts:34-40`). | geplant: R-GUARD-07 mit `LEGAL_GATE_BY_TRACK`, zur Laufzeit nicht abschaltbar (021) | B6 | geplant in Scheibe 021 („stage ohne Rechtsfreigabe → 409 R-GUARD-07") | offen |
| T-G1-E-04 | Administration als Inhaltskonto: `admin` hält alle Rechte (`packages/domain/src/permissions.ts:42`) und kann allein erfassen, entwerfen, freigeben und auf die Bühne stellen (`packages/domain/policy-truth-table.md:149`) — im Widerspruch zum Rechtekonzept Abschnitt 4. | geplant: Administrationsrechte mit Wahrheitstabellen-Diff, `admin.override` nur mit Grund als Ereignis (040); Vier-Augen gilt auch für die Administration (021) | B2, B6 | geplant in Scheibe 040 („override erzeugt Ereignis mit Grund") | offen |
| T-G1-E-05 | Kontext vom Client: ein Podiumsgerät markiert eine beliebige Frage der Warteschlange als vorgelesen, auch die eines anderen Bühnenplatzes und nicht die aktuelle (Probe P6); `deliverQuestion` kennt keinen Platz (`packages/domain/src/api.ts:478-484`, `packages/domain/src/transitions.ts:127-133`). | geplant: Kontext (Einheit, Platz, Vertraulichkeit) im Dienst aufgelöst, nie vom Client (047); Delivery mit Platz und Hash (049); Warteschlange je Platz (056) | B2, B7 | geplant in Scheibe 047 („Client behauptet einen fremden Platz → wird ignoriert") | offen |

### 5.2 G2 — Dienst ↔ Persistenz

| ID | Bedrohung (Beispiel) | Kontrolle | Beta | Test | Status |
|---|---|---|---|---|---|
| T-G2-S-01 | Fremder Prozess spricht als Dienstrolle mit der Datenbank (Zugangsdaten aus Konfiguration, Log oder Agentenkontext), oder der Dienst verbindet sich mit einer untergeschobenen Datenbank. Heute gibt es keine Datenbank; der Speicherort ist ein Pfad aus der Umgebung (`apps/api/src/app.ts:86-87`). | geplant: Secrets nur aus der Plattform, Eigentümer-Checkliste Secrets (037); Konfigurationsschema beim Start (034); verschlüsselte Verbindung zur Datenbank (027, Zielvorschlag) | B10 | geplant in Scheibe 037 | offen |
| T-G2-S-02 | Ereignis mit fremdem Akteur einschieben: wer die JSONL-Datei oder den `localStorage` beschreiben kann, hängt Ereignisse mit beliebigem `actor` und `at` an; beim Start werden sie ungeprüft übernommen (`apps/api/src/eventLog.ts:13-22`, `packages/domain/src/store.ts:23`, `apps/web/src/api/index.ts:20-27`). | geplant: Hash-Kette mit Prüfung beim Laden (024); Dienstrolle nur INSERT/SELECT (027) | B3 | geplant in Scheibe 024 („manipuliertes Ereignis → Ladefehler mit seq") | offen |
| T-G2-T-01 | Gespeichertes Ereignis ändern: der Text einer freigegebenen Antwort wird im Speicher nachträglich geglättet; das Ereignis hat weder Hash noch Kettenglied (`packages/domain/src/events.ts:16-24`). | vorhanden: der Code hängt nur an und überschreibt nie (`apps/api/src/eventLog.ts:23-31`, `packages/domain/src/store.ts:27-37`); geplant: Hash-Kette SHA-256 über kanonisches JSON (024); kein UPDATE/DELETE für die Dienstrolle, Kettenprüfung nach Neustart (027); Restore verifiziert die Kette (038) | B3, B12 | `packages/domain/src/__tests__/api.test.ts › events are append-only and gap-free`; geplant in Scheibe 024, 027 | teilweise |
| T-G2-T-02 | Abgelehnter Schreibvorgang wird wirksam: scheitert das Schreiben der Datei (`apps/api/src/eventLog.ts:29`), steht das Ereignis schon im Log des Speichers (`packages/domain/src/store.ts:30-31`), die Projektion erhält es nicht (`packages/domain/src/store.ts:34-35`), der Aufrufer sieht einen Fehler; der nächste Schreibvorgang schreibt es mit (`apps/api/src/eventLog.ts:24-30`), nach einem Neustart gilt die abgelehnte Änderung (Probe S1–S3). | geplant: Postgres-Adapter bestätigt erst nach synchronem Commit (027); JSONL bleibt Entwicklungsadapter (027) | B3 | geplant in Scheibe 027 | offen |
| T-G2-T-03 | Lücke oder Duplikat in `seq` durch parallele Schreiber oder einen Absturz im Append; beim Laden wird `seq` nicht geprüft (`packages/domain/src/state.ts:93`). | vorhanden: `seq` = Loglänge + 1 in einem Prozess (`packages/domain/src/store.ts:30`); geplant: Vergabe unter Advisory-Lock (027); Kill mitten im Append (072) | B3 | `packages/domain/src/__tests__/api.test.ts › events are append-only and gap-free`; geplant in Scheibe 072 („seq-Lücken-/Duplikatprüfung nach Kill") | teilweise |
| T-G2-T-04 | Log über die Anwendung ersetzen (Seed über einen bestehenden Bestand). | vorhanden: Seed nur in ein leeres Log (`packages/domain/src/api.ts:529-531`), nur mit Recht `demo.seed` (`packages/domain/src/api.ts:527`), Endpunkt nur bei `HV_DEMO=1` (`apps/api/src/app.ts:300-303`) | B3 | `packages/domain/src/__tests__/api.test.ts › seeding twice is refused: the log is never replaced`; `apps/api/src/__tests__/negative.test.ts › 403: POST /v1/demo/seed is refused unless HV_DEMO=1` | geschlossen |
| T-G2-R-01 | Änderung am Speicher ohne Spur: Plattformbetreiber oder Datenbankadministration ändert oder entfernt Zeilen direkt; es entsteht kein Ereignis, und niemand bemerkt es, weil ungeprüft geladen wird (`packages/domain/src/store.ts:23`). | geplant: Kettenprüfung beim Laden und nach Neustart (024, 027); Jahrgangs-Export mit Hash-Liste (038); Log-Hash in der Niederschrift-Anlage (051) | B3, B12 | geplant in Scheibe 027 („Hash-Kette nach Neustart verifiziert") | offen |
| T-G2-I-01 | Klartext im Speicher und in Kopien: Entwürfe, Rückgabegründe und Klarnamen stehen im Klartext im Log (`packages/domain/src/events.ts:36-47, 63-72`); die JSONL-Datei entsteht mit den Standardrechten des Prozesses (`apps/api/src/eventLog.ts:29`), die Demo schreibt in den `localStorage` (`apps/web/src/api/index.ts:34`); Backups enthalten dasselbe. | geplant: Personentabelle getrennt, `personId` statt Klarname (026); Payload-Teil `pii` mit `keyId` hinter dem Codec-Port (024); verschlüsselte Backups (037); bis E13/E14 nur synthetische Daten | — | geplant in Scheibe 026 („kein displayName in Ereignis-Payloads") | offen |
| T-G2-I-02 | Nutzdaten und Verbindungsdaten im Fehlerlog: unerwartete Fehler werden vollständig ins Prozesslog geschrieben (`apps/api/src/problem.ts:10`); mit einem Datenbanktreiber können darin SQL mit Fragetext oder Verbindungsparameter stehen. | vorhanden: der Aufrufer erhält keine Details (`apps/api/src/problem.ts:11-16`); geplant: strukturiertes Zugriffslog ohne Nutzdaten (033); Secrets nur aus der Plattform (037) | B5 | geplant in Scheibe 033 („Log-Zeile ohne Fragetext trotz Body") | teilweise |
| T-G2-D-01 | Speicher nicht erreichbar oder voll während der HV, und der Dienst merkt es erst beim nächsten Schreibvorgang: es gibt keinen Bereitschaftsendpunkt (Routen `apps/api/src/app.ts:154-310`). | geplant: `/readyz` mit Datenbank und Migrationsstand (027, erste Fassung 033); Alarm (037); RPO 0 und RTO 15 min (038, E22) | B3, B10 | geplant in Scheibe 027 („curl /readyz bei gestoppter DB → 503") | offen |
| T-G2-D-02 | Neustart dauert zu lang: die Projektion entsteht beim Start aus dem vollständigen Log (`packages/domain/src/api.ts:169-170`); im HV-Fenster zählt jede Minute. | geplant: Rebuild von 10 000 Ereignissen unter 5 min als Test, Snapshot optional (027); Failover-Drill (072) | B3, B15 | geplant in Scheibe 027 („Rebuild-Zeit im Bericht") | offen |
| T-G2-D-03 | Vollscan je Historienaufruf: `getQuestionHistory` filtert das ganze Log (`packages/domain/src/api.ts:406-409`); hinter `all()` (`packages/domain/src/store.ts:41-43`) läse ein Datenbankadapter bei jedem Aufruf die ganze Tabelle. | geplant: Leseweg je `subjectId` mit Index (027, Zielvorschlag); Lasttest (071) | B11 | geplant in Scheibe 071 | offen |
| T-G2-E-01 | Dienstrolle mit zu viel Recht (Schema-Eigentümer, UPDATE, DELETE); eine Einschleusung in eine Abfrage oder ein Adapterfehler ändert oder löscht Ereignisse. | geplant: Dienstrolle nur INSERT und SELECT (027); Migrationen unter getrennter Rolle und parametrisierte Abfragen (027, Zielvorschlag); eine Semgrep-Regel gegen zusammengesetzte Abfragen (027, Zielvorschlag) — der Regelsatz aus 012 hat keine (`scripts/semgrep/rules.yml:1-102`) | B3 | geplant in Scheibe 027 („UPDATE/DELETE als Dienstrolle → Berechtigungsfehler") | offen |
| T-G2-E-02 | Schreiben an beliebige Orte: der Pfad der Ereignisdatei kommt ungeprüft aus der Umgebung (`apps/api/src/app.ts:86`) und wird mit den Rechten des Dienstes beschrieben (`apps/api/src/eventLog.ts:29`). | geplant: Konfigurationsschema prüft beim Start (034); Container ohne Root-Rechte (037); JSONL nur als Entwicklungsadapter (027) | B10 | geplant in Scheibe 034 („fehlende Pflichtkonfiguration → Start verweigert") | offen |

### 5.3 G3 — Dienst ↔ Nachbarsysteme (Transkription/Ingest, KI-Port, Aktienregister, IdP, Alarmversand)

Heute ist keiner dieser Adapter gebaut. Die Zeilen beschreiben die Bedrohungen des Beta-Ziels nach ADR 0004
und 0008; wo der heutige Code schon eine Angriffsfläche bietet, ist sie belegt.

| ID | Bedrohung (Beispiel) | Kontrolle | Beta | Test | Status |
|---|---|---|---|---|---|
| T-G3-S-01 | Gefälschter Ingest: ein Angreifer liefert Segmente als Transkriptionstool, um Fragen zu erfinden oder zu überdecken. Heute ist `source: 'transcript'` eine bloße Angabe des Clients (`packages/domain/src/types.ts:205-209`, `packages/domain/src/api.ts:359`). | geplant: Systemakteur mit `ingest.write`, Client-Credentials oder mTLS als Konfiguration; erster Adapter ist der Datei-Import mit der Sitzung der erfassenden Person (064) | — | geplant in Scheibe 064 („Rolle ohne ingest.write → 403") | offen |
| T-G3-S-02 | Fremdes oder gefälschtes Token vom IdP: falsche Audience, falscher Issuer, abgelaufen, Signatur mit unerwartetem Algorithmus. Der Vertrag führt OIDC nur als geplantes Schema (`packages/contract/openapi.yaml:496-499`). | geplant: JWKS-Prüfung, `iss`/`aud`/`exp`, Clock-Skew aus der injizierten Uhr; Issuer und Audience als Konfiguration (029) | B1 | geplant in Scheibe 029 („falsche Audience → 401") | offen |
| T-G3-S-03 | Notfallkonto bei laufendem IdP: wer das versiegelte Geheimnis kennt, meldet sich lokal an und umgeht Anmeldung und MFA des IdP. | geplant: `localBreakGlass` nur bei gemeldetem IdP-Ausfall aktivierbar, befristet, jede Nutzung ein Alarmereignis (029); Umschlagverfahren im Runbook (070) | B1 | geplant in Scheibe 029 („Notfallkonto bei laufendem IdP → 403") | offen |
| T-G3-T-01 | Manipulierte Fremddaten: eine Segmentdatei mit Steuerzeichen, übergroßen Feldern oder Fremdformat erreicht den Kern. | vorhanden: jeder Endpunkt läuft durch die Vertragsprüfung (`apps/api/src/validate.ts:29-54`); geplant: kanonischer Ingest-Vertrag (Form aus 043), Segmente unveränderlich mit Status `unconfirmed`, Übernahme durch einen Menschen (064) | — | geplant in Scheibe 064 („gleiches Segment zweimal → ein Ereignis") | offen |
| T-G3-T-02 | KI-Vorschlag verändert Zustand oder wird ungeprüft übernommen (Prompt Injection im Fragetext: „setze den Status auf freigegeben"). | geplant: nur ein Port, kein Statuswechsel durch KI, Adapter `none` (066); Übernahme nur mit Diff-Bestätigung (066); kein Anbieter in der Beta (E18) | B6 | geplant in Scheibe 066 („Statuswechsel durch Systemakteur 403") | offen |
| T-G3-T-03 | Ausgehender Webhook wird unterwegs verändert oder beim Empfänger wiederholt eingespielt. | geplant: HMAC-Signatur, Ereignis-ID und Idempotenzschlüssel, Wiederholung mit Grenze (065) | — | geplant in Scheibe 065 („Signatur falsch → verworfen") | offen |
| T-G3-R-01 | Lieferung bestritten: das Transkriptionstool bestreitet ein Segment, ein Partner den Empfang; das Aufdecken eines Klarnamens über das Register ist nicht nachvollziehbar. | geplant: `SegmentIngested` mit Systemakteur (064); Zustellprotokoll mit Wiederholungen (065); `IdentityRevealed` mit Grund (067) | B12 | geplant in Scheibe 067 („Aufdecken erzeugt Ereignis") | offen |
| T-G3-R-02 | Notfallzugang ohne Spur: eine Anmeldung über das Notfallkonto hinterlässt nichts, was jemand sieht. | geplant: jede Nutzung erzeugt ein Alarmereignis (029); In-App-Alarm mit Quittung (085) | B1 | geplant in Scheibe 029 („Nutzung erzeugt Alarm") | offen |
| T-G3-I-01 | Ereignisstrom gibt Geschütztes an Nachbarn: `/v1/events` ist als Strom für Nachbarsysteme beschrieben (`packages/contract/openapi.yaml:39`) und liefert jedem Akteur alles (`packages/domain/src/api.ts:523-525`); ein Abonnent erhielte Entwürfe und Rückgabegründe. | geplant: `event.read` nur für die Administration (010); Filter nach Leserecht des Systemakteurs, nie Notizen, nie `protected` (065); SSE mit denselben Leserechten (035) | B2 | geplant in Scheibe 065 („protected-Ereignis nicht zugestellt") | offen |
| T-G3-I-02 | Abfluss an einen KI-Anbieter (Fragetexte, Klarnamen, Entwürfe). | geplant: kein Anbieter in der Beta (E18); Adapter `none` antwortet 503 (066) | — | geplant in Scheibe 066 | offen |
| T-G3-I-03 | Alarmversand trägt Inhalte nach außen (Fragetext in einer Alarmnachricht, Personenbezug in der Betriebsauswertung). | geplant: Betriebsauswertung kennt nur fachliche Kennzahlen, Allowlist-Tor (033, 037); datenfreier Fehler-Beacon (058); kein Push und keine E-Mail in der Beta (085) | B5, B10 | geplant in Scheibe 033 („Allowlist-Tor rot bei absichtlicher Kennzahl je Person") | offen |
| T-G3-I-04 | Mehr IdP-Claims als nötig (Name, E-Mail, Gruppen) landen in Ereignissen und Logs. | geplant: pseudonyme Subject-ID und Subject-Hash im Zugriffslog (033); Personentabelle (026); IdP-Gruppen nur als Vorschlag in `/auth/me` (029) | B5 | geplant in Scheibe 026 („kein displayName in Ereignis-Payloads") | offen |
| T-G3-I-05 | Aktienregister liefert mehr Personendaten als nötig (Bestand, Anschrift), die im Log landen. | geplant: Lookup-Port mit Adapter `local` über die Personentabelle, Klarname nur per protokolliertem Aufdecken (067); Push-Adapter und Legitimation in der B-Liste | — | geplant in Scheibe 067 („expert sieht Pseudonym") | offen |
| T-G3-D-01 | Nachbar fällt aus oder hängt und blockiert den Kernprozess (IdP nicht erreichbar, Register antwortet nicht, Transkription liefert nichts). | geplant: Notfallkonten bei IdP-Ausfall (029); Klärungs-Queue bei Registerausfall (067); Datei-Import statt Push (064); Request-Timeout (034); Papierpfad (068, 070) | B1, B10 | geplant in Scheibe 072 („IdP nicht erreichbar → Anmeldung über Notfallkonto mit Alarm") | offen |
| T-G3-D-02 | Flut vom Nachbarn: tausende Segmente je Minute oder ein langsamer Webhook-Empfänger stauen den Dienst. | geplant: Rate-Limit auch für Systemakteure (034); Idempotenz je `segmentId` (064); Wiederholung mit Grenze (065) | B11 | geplant in Scheibe 064 | offen |
| T-G3-E-01 | Systemakteur mit zu viel Recht, den ein kompromittierter Nachbar nutzt (Ingest mit Freigaberecht, KI mit Statusrecht). | vorhanden: Rechte nur als Bündel in `ROLE_PERMISSIONS`, deny by default (`packages/domain/src/permissions.ts:12-60`); geplant: eigenes Bündel je Systemakteur mit Wahrheitstabellen-Diff (064, 065, 086); kein Statusrecht für KI (066) | B2 | `packages/domain/src/__tests__/transitions.test.ts › deny by default: an unknown role has no permissions`; geplant in Scheibe 066 | teilweise |
| T-G3-E-02 | SSRF über die Ziel-URL eines Abonnements: der Dienst ruft interne Adressen der Plattform auf. | geplant: Abonnements aus der Konfiguration (065); Ziel-Allowlist und Sperre interner Adressbereiche (065, Zielvorschlag) | — | geplant in Scheibe 065 | offen |
| T-G3-E-03 | IdP-Gruppe wird zur Rolle: wer im IdP eine Gruppe ändern kann, vergibt Rechte im Tool. | geplant: Zuordnungstabelle ist die eine Wahrheit, IdP-Gruppen nur als Vorschlag (026, 029; E8) | B1 | geplant in Scheibe 029 („Subject ohne Rolle → 403") | offen |

### 5.4 Q — Querschnitt: Lieferkette, Build, Betrieb

| ID | Bedrohung (Beispiel) | Kontrolle | Beta | Test | Status |
|---|---|---|---|---|---|
| T-Q-S-01 | Tore umgehen: der Workflow läuft bei jedem Push und Pull Request (`.github/workflows/gates.yml:4-6`), ob er einen Merge blockiert, entscheidet der Branch-Schutz außerhalb des Repositoriums; ein Commit kann unter fremdem Namen stehen. | vorhanden: Tore im Workflow (`.github/workflows/gates.yml:22-93`), seit 012 mit Architektur-, Rollenliteral-, now()- und Plan-Ehrlichkeits-Tor (`package.json:15`); geplant: Branch-Schutz-Checkliste mit Pflicht-Statuschecks, Scheibenumfang-Tor (016); Review durch ein anderes Modell (AGENTS.md Regel 3) | B13 | geplant in Scheibe 016 („Scheibenumfang-Tor rot bei absichtlich fremder Datei") | teilweise |
| T-Q-S-02 | Untergeschobenes Artefakt: ein anderes als das geprüfte Image wird ausgerollt. Heute startet der Dienst aus dem Quelltext (`apps/api/package.json:9`), es gibt kein Image. | geplant: Image mit Digest (037); signierte Images und SBOM (074) | B10 | geplant in Scheibe 074 („SBOM-Artefakt in CI") | offen |
| T-Q-T-01 | Kompromittierte Abhängigkeit: ein Paket mit Installationsskript läuft in CI, im Demo-Build und in Agentensitzungen; Versionsbereiche mit `^` (`apps/api/package.json:16-22`). | vorhanden: eingefrorenes Lockfile in CI und im Demo-Build (`.github/workflows/gates.yml:22`, `netlify.toml:3`); seit 012 blockiert `pnpm audit` ab `moderate`, Ausnahmen nur mit Grund, Eigentümer und Ablauf (`scripts/audit-check.mjs:18-29`, `scripts/audit-exceptions.json:1-10`, Schritt `.github/workflows/gates.yml:86-87`, nachts `.github/workflows/nightly.yml:39-40`); geplant: SBOM (074) | B13 | geplant in Scheibe 074 („SBOM-Artefakt in CI") | teilweise |
| T-Q-T-02 | Verschobener Versions-Tag bringt fremden Code in die CI: vier Workflow-Bausteine (Checkout, pnpm-Einrichtung, Node-Einrichtung, Artefakt-Upload) sind weiter per Tag statt Commit-Hash eingebunden (`.github/workflows/gates.yml:14, 19, 20, 94`, `.github/workflows/nightly.yml:17, 21, 22`). | vorhanden seit 012: die Drittanbieter-Bausteine sind auf Commit-Hash gepinnt (`.github/workflows/gates.yml:34, 48, 82`, `.github/workflows/nightly.yml:26`); geplant: pnpm-Einrichtung pinnen (016, Folgebefund aus der Nachprüfung von 012), die übrigen drei ebenso (016, Zielvorschlag) | B13 | geplant in Scheibe 016 | teilweise |
| T-Q-T-03 | Agent macht die eigene Arbeit grün, indem er Tore, Snapshots oder Hooks ändert (z. B. die Wahrheitstabelle neu schreibt). | vorhanden: Wahrheitstabelle als eingecheckter Snapshot (`packages/domain/src/__tests__/transitions.test.ts:89-117`), CI prüft den Diff (`.github/workflows/gates.yml:62-63`); geplant: Scheibenumfang-Tor, Branch-Schutz, Hooks (016) | B13, B16 | `packages/domain/src/__tests__/transitions.test.ts › matches the committed table — any change must be reviewed`; geplant in Scheibe 016 | teilweise |
| T-Q-T-04 | Falsche Konfiguration: `HV_DEMO=1` in Staging öffnet Seed-Endpunkt und CORS (`apps/api/src/app.ts:85, 131-140, 300-303`); fehlende Werte fallen still auf Standards zurück (`apps/api/src/server.ts:11`). | vorhanden seit 012: ein fehlerhafter `HV_SEED_ACTOR` bricht den Start ab, ein Seed-Akteur ohne `demo.seed` seedet nicht (`apps/api/src/app.ts:75-82, 109-113`); geplant: typisiertes Konfigurationsschema, Start verweigert bei fehlender Pflichtkonfiguration (034); Start verweigert bei `HV_DEMO=1` mit Issuer (029); Seed nur im Modus `training` (042) | B1, B10 | `apps/api/src/__tests__/seedActor.test.ts › a malformed HV_SEED_ACTOR (no ":<role>") makes createApp throw, naming HV_SEED_ACTOR, not X-Actor`; `apps/api/src/__tests__/seedActor.test.ts › a seed actor without demo.seed fails closed (rights are data, AGENTS.md rule 4) — no meeting appears`; geplant in Scheibe 029 („HV_DEMO=1 mit Issuer → Start verweigert") | teilweise |
| T-Q-R-01 | Auslieferung ohne nachvollziehbares Go: der Demo-Build läuft bei jedem Push ohne Überspring-Marke im Commit-Betreff und prüft nur Typen und Build, nicht die Tore (`netlify.toml:3`); das Go ist heute eine organisatorische Übergangsregel (ADR 0016). | geplant: Deploy nur über ein Approval-Environment mit Protokoll, Freeze-Regel (037); Taktfläche nach E35 | B10 | geplant in Scheibe 037 („Deploy im Freeze-Fenster → abgelehnt") | offen |
| T-Q-R-02 | Handeln einer Agentensitzung ohne Spur (lokale Befehle, Netzaufrufe). | vorhanden: jeder Commit nennt die Scheibe (AGENTS.md Regel 12); ein Hook sperrt wenige gefährliche Befehle (`.claude/settings.json:3-13`), protokolliert aber nichts; geplant: Berichtsformat-Hook, Stop-Hook mit Testlauf, Sperre für `.env` und ausgehende Netzaufrufe (016) | B13 | geplant in Scheibe 016 („Protokoll eines blockierten Stop-Versuchs") | teilweise |
| T-Q-I-01 | Secrets in Repositorium, Artefakt, Log, Screenshot oder Agentenkontext. Heute stehen keine Secrets in versionierten Dateien (Suche ohne Treffer); CI lädt Screenshots und den Playwright-Bericht als Artefakt hoch (`.github/workflows/gates.yml:94-101`). | vorhanden: `.env` ist ausgeschlossen (`.gitignore:4-6`); nur synthetischer Korpus (`packages/domain/src/seed.ts:1-7`); seit 012 gitleaks über den Diff und nachts über das ganze Repositorium (`.github/workflows/gates.yml:81-85`, `.github/workflows/nightly.yml:25-29`) und eine Semgrep-Regel gegen Zugangsdaten als Literal (`scripts/semgrep/rules.yml:77-102`); die gitleaks-Konfiguration lief noch nie gegen das echte Programm (`scripts/gitleaks.toml:11-14`); geplant: Secrets nur aus der Plattform und Eigentümer-Checkliste (037); Hook gegen `.env`-Zugriff (016) | B13 | geplant in Scheibe 037 | teilweise |
| T-Q-I-02 | Quelltextkarten öffentlich: der Build erzeugt Sourcemaps (`apps/web/vite.config.ts:10`), die Demo liefert Quelltext samt Kommentaren aus; gering, solange im Web-Code kein Geheimnis steht. | geplant: Entscheidung über Sourcemaps im Deploy (037, Zielvorschlag) | — | geplant in Scheibe 037 | offen |
| T-Q-I-03 | Agent mit Schreib- und Netzzugriff trägt Inhalte nach außen oder bekommt echte Daten in den Kontext: die bauenden Rollen haben `Write` und `Bash` (`.claude/agents/implementierer-backend.md:5`), der Hook sperrt keine Netzaufrufe (`.claude/settings.json:9`). | vorhanden: nur synthetischer Korpus (`packages/domain/src/seed.ts:1-7`); geplant: Sperre ausgehender Netzaufrufe (016); keine Zugangsdaten in Agentenreichweite (037) | B13 | geplant in Scheibe 016 | teilweise |
| T-Q-I-04 | Plattformbetreiber liest Daten, Backups und Secrets (managed Postgres, gemieteter Host, Demo-Hosting). | geplant: AVV (E10, E39); bis zur AVV nur synthetische Testidentitäten (E39); Härtungs-Checkliste und verschlüsselte Backups (037); PII-Codec vor Produktion (Leitplanken 9.3) | — | geplant in Scheibe 037 | offen |
| T-Q-D-01 | Auslieferung im HV-Fenster bricht den Dienst (Konfigurationsfehler, fehlerhaftes Image, Plattformwartung). | geplant: Freeze-Regel in der Pipeline (037, 077); Health-Smoke mit Rückrollen (037); Degradationsstufen und Papierpfad (070) | B10, B15 | geplant in Scheibe 037 („Deploy im Freeze-Fenster → abgelehnt") | offen |
| T-Q-D-02 | CI oder Paket-Registry nicht verfügbar, wenn ein Hotfix nötig ist. | geplant: Image mit Digest als ausrollbares Artefakt und Rückrollen auf das letzte Image (037); Freeze-Kalender (070) | B10 | geplant in Scheibe 037 | offen |
| T-Q-E-01 | Agent erweitert seine Rechte: ändert `.claude/settings.json`, Hooks oder Agentenrollen; die bauenden Rollen dürfen schreiben (`.claude/agents/implementierer-backend.md:5`). | vorhanden: Review durch ein anderes Modell im frischen Kontext (AGENTS.md Regel 3, Rolle `.claude/agents/reviewer.md:1-6`); geplant: Scheibenumfang-Tor (Lane infra nur mit Spec), Branch-Schutz (016) | B13 | geplant in Scheibe 016 | teilweise |
| T-Q-E-02 | CI-Token mit Schreibrecht: ein kompromittierter Schritt schreibt mit dem Token des Workflows in Branches. Bis 012 ohne `permissions:`; heute nur lesend, doch eine spätere Workflow-Änderung kann die Rechte wieder erweitern. | vorhanden seit 012: `permissions` nur `contents: read` und `pull-requests: read` (`.github/workflows/gates.yml:7-9`, `.github/workflows/nightly.yml:10-12`), `persist-credentials: false` beim Checkout (`.github/workflows/gates.yml:17`, `.github/workflows/nightly.yml:20`); geplant: Branch-Schutz mit Pflicht-Statuschecks, damit eine Rechteerweiterung nicht ungeprüft gemergt wird (016) | B13 | geplant in Scheibe 016 | teilweise |
| T-Q-E-03 | Übernahme des Host- oder Plattformkontos (SSH, Root auf dem gemieteten Host) gibt Zugriff auf Dienst, Datenbank und Secrets; heute lauscht der Dienst auf allen Schnittstellen (`apps/api/src/server.ts:14`). | geplant: Härtungs-Checkliste (SSH-Schlüssel, Updates, Firewall, verschlüsselte Backups), Container distroless und ohne Root (037) | B10 | geplant in Scheibe 037 | offen |

---

## 6. Für Scheiben zitierbar

Eine Scheibe übernimmt die IDs der Spalte „muss schließen" als Akzeptanzkriterien und nennt im Bericht je ID
den Test, der sie belegt. „Berührt" heißt: die Scheibe liefert einen Teil der Kontrolle; der Rest liegt bei
der genannten anderen Scheibe.

| Scheibe | muss schließen | berührt |
|---|---|---|
| 024 Umschlag v2 | T-G2-S-02, T-G2-T-01, T-G1-T-07 | T-G1-T-02 (Payload aus benannten Feldern), T-G2-I-01 (`pii` mit `keyId`), T-G2-R-01 (Kette als Erkennung) |
| 027 Postgres nur anhängend | T-G2-T-02, T-G2-T-03, T-G2-R-01, T-G2-D-01, T-G2-D-02, T-G2-E-01 | T-G2-T-01 (Grants, Kettenprüfung nach Neustart), T-G2-D-03, T-G2-S-01, T-G2-E-02 |
| 029 OIDC-BFF | T-G1-S-01, T-G1-S-02, T-G1-T-05, T-G3-S-02, T-G3-S-03, T-G3-R-02, T-G3-E-03, T-Q-T-04 | T-G1-I-05, T-G1-I-08, T-G1-R-01, T-G3-D-01 |
| 010 Lesepfade | T-G1-I-01 | T-G1-I-02, T-G1-I-04, T-G3-I-01 |
| 033 Zwei Protokollebenen | T-G2-I-02, T-G3-I-03 | T-G1-R-01, T-G3-I-04, T-G2-D-01 |
| 034 Limits, Header, Konfiguration | T-G1-D-01, T-G1-I-06 | T-G1-T-05 (CORS), T-G1-T-06 (CSP), T-Q-T-04, T-G2-E-02, T-G3-D-02 |
| 035 SSE | T-G1-I-09 | T-G1-D-03 (Heartbeat, Ströme je Subject), T-G3-I-01 (Filter nach Leserecht) |
| 037 Container, Pipeline | T-G2-S-01, T-Q-R-01, T-Q-D-01, T-Q-E-03 | T-Q-S-02, T-Q-I-01, T-Q-I-02, T-Q-I-04, T-Q-D-02, T-G1-T-06 |
| 058 Podium offline | — | T-G1-I-08 (Puffer nur eigener Platz), T-G1-R-02 (Absicht mit Gerätezeit), T-G3-I-03 (datenfreier Beacon) |
| 064 Ingest | T-G3-S-01, T-G3-T-01 | T-G3-D-02, T-G3-R-01 |
| 067 Aktienregister-Lookup | T-G3-I-05 | T-G1-I-03, T-G3-R-01 |

Weitere Scheiben mit Sicherheitsbezug:

| Scheibe | muss schließen | berührt |
|---|---|---|
| 012 Tore (gemergt in `a8cbbe1`) | — (Beitrag: T-Q-T-02, T-Q-E-02 und T-Q-T-04 jetzt teilweise; BF-21 bis BF-24 geschlossen) | T-Q-T-01, T-Q-I-01, T-Q-S-01, T-G1-T-06, T-G1-T-07, T-G1-E-01 |
| 016 Hooks, Scheibenumfang | T-Q-S-01, T-Q-E-01, T-Q-T-02 (restliche Pins), T-Q-E-02 (Branch-Schutz) | T-Q-R-02, T-Q-I-03, T-Q-T-03 |
| 021 Vier-Augen, Rechtstor | T-G1-E-02, T-G1-E-03 | T-G1-E-04 |
| 023 Vertrag 0.3.0 | — | T-G1-T-02, T-G1-D-01 (Zielvorschläge `additionalProperties`, `maxLength`) |
| 026 Personentabelle | T-G1-I-03, T-G2-I-01 | T-G3-I-04, T-G3-E-03 |
| 028 Idempotenz, If-Match | T-G1-T-03, T-G1-D-02 | — |
| 040 Administration im Kern | T-G1-E-04 | MF-01 |
| 047 Attributrechte | T-G1-I-04, T-G1-E-05 | T-G1-I-01 |
| 049 Vorgelesen als Entität | T-G1-R-02 | T-G1-E-05 |
| 065 Webhooks | T-G3-T-03, T-G3-I-01, T-G3-E-02 | T-G3-D-02 |
| 066 KI-Port | T-G3-T-02, T-G3-I-02 | T-G3-E-01 |
| 074 Bedrohungsmodell v2 | Status aller IDs neu bewerten | T-Q-S-02 |

---

## 7. Missbrauchsfälle mit Erkennung

Für die Hochrisikoänderungen der Beta (Leitplanken 6.5 Punkt 5). Erkennung heißt: ein Signal, das ohne
Kennzahl je Person auskommt (ADR 0013). Wo ein Signal auf eine Person führen muss, geschieht das nur im
Vier-Augen-Verfahren mit `AuditAccessGranted` (047).

**MF-01 Rechteerhöhung über die Rollenzuordnung** (026, 040)
- *Ablauf:* ein Administrationskonto weist sich selbst oder einer zweiten Person die Rolle `approver` zu, gibt
  frei und entzieht die Rolle wieder. Heute genügt dafür ein anderer Header-Wert (T-G1-S-01).
- *Verhindert durch:* T-G1-E-04, T-G3-E-03; Zuordnung als Ereignis `RoleAssigned`/`RoleRevoked` mit Ablauf
  (026); Änderungen nach dem Konfigurationsfreeze nur mit `admin.override` und Grund (040).
- *Erkennung:* Alarm (085) mit Zielrecht `admin.roles.manage` bei Selbstzuordnung, bei Zuordnung eines
  Freigabe- oder Rechtsrechts nach dem Freeze und bei Zuordnung und Entzug innerhalb eines Tages
  (Zielvorschlag für 040); der Freeze-Hash im Kopf (041) ändert sich sichtbar.
- *Nachweis:* geplant in Scheibe 040 („Stammdatenänderung nach Freeze → 409 R-ADM-03"), 026 („abgelaufene
  Rolle → 403").

**MF-02 Massenlesen und Export** (010, 047, 051)
- *Ablauf:* eine Person mit Leserecht zieht den gesamten Bestand über `/v1/events` oder seitenweise über
  `/v1/questions`, oder sie exportiert die Niederschrift-Anlage wiederholt. Heute für jede Rolle in einem
  Aufruf möglich (Probe P3).
- *Verhindert durch:* T-G1-I-01, T-G1-I-02, T-G1-I-04, T-G3-I-01.
- *Erkennung:* jeder Export ist ein Ereignis `ExportCreated` (051), sichtbar in der Historie; das Rate-Limit
  (034) antwortet 429 und wird als technisches Ereignis ohne Personenbezug gezählt; die Zuordnung zu einer
  Person erfolgt nur im Vier-Augen-Verfahren über das Zugriffslog (033, 047). Spannung: Leitplanken 6.5
  Punkt 3 verlangt Begrenzung und Nachvollziehbarkeit, ADR 0013 verbietet eine Kennzahl je Person; die
  Auflösung steht im Restrisiko RR-02.
- *Nachweis:* geplant in Scheibe 010 („observer 403 auf ?status=answer_drafted"), 051 („Export ohne Recht
  403, Export erzeugt Ereignis").

**MF-03 Notfallkonto bei laufendem IdP** (029)
- *Ablauf:* eine Person mit Zugang zum versiegelten Umschlag meldet sich über `localBreakGlass` an, obwohl der
  IdP erreichbar ist, und umgeht MFA und Einzelidentität.
- *Verhindert durch:* T-G3-S-03; Aktivierung nur nach gemeldetem IdP-Ausfall, zeitlich befristet (029).
- *Erkennung:* jede Nutzung erzeugt ein Alarmereignis (029, T-G3-R-02), In-App-Alarm mit Quittung an die
  Inhaber des Zielrechts (085); Umschlag- und Siegelprotokoll im Runbook (070).
- *Nachweis:* geplant in Scheibe 029 („Notfallkonto bei laufendem IdP → 403", „Nutzung erzeugt Alarm"), 072
  (Szenario „IdP nicht erreichbar").

**MF-04 Manipulation eines Ereignisses in der Datenbank** (024, 027, 038)
- *Ablauf:* eine Person mit Datenbankzugang außerhalb der Dienstrolle (Plattformbetreiber,
  Datenbankadministration) ändert nach der HV den Text einer vorgelesenen Antwort in der Tabelle `events`.
- *Verhindert durch:* T-G2-E-01 (Dienstrolle ohne UPDATE/DELETE) hält die Anwendung ab, nicht aber einen
  Datenbank-Superuser.
- *Erkennung:* T-G2-T-01, T-G2-R-01: Kettenprüfung beim Laden und nach jedem Neustart führt zu einem
  Ladefehler mit `seq` (024, 027); der nightly Restore-Test verifiziert die Kette (038); die Hash-Liste und der
  Log-Hash der Niederschrift-Anlage liegen außerhalb der Datenbank (051, 081). Wer die ganze Kette neu
  berechnet, fällt nur gegen einen externen Anker auf (Restrisiko RR-01).
- *Nachweis:* geplant in Scheibe 024 („manipuliertes Ereignis → Ladefehler mit seq"), 038 („Export → Import →
  identische Hash-Kette").

**MF-05 Gefälschter Ingest-Webhook** (064, 065)
- *Ablauf:* ein Angreifer im Saalnetz oder mit gestohlenen Client-Credentials schickt Segmente als
  Transkriptionstool, um erfundene Fragen einzuschleusen oder echte zu überdecken.
- *Verhindert durch:* T-G3-S-01, T-G3-T-01, T-G3-D-02; Segmente sind unveränderlich und `unconfirmed`, erst
  ein Mensch übernimmt sie in einen Redebeitrag (064). Nimmt ein späterer Push-Adapter signierte Aufrufe an,
  gilt für ihn dieselbe HMAC-Regel wie für ausgehende Webhooks (065, Zielvorschlag).
- *Erkennung:* Segmente ohne passende Wortmeldung oder mit Zeitanker außerhalb der Redezeit als Kennzeichen in
  der Erfassung (Zielvorschlag für 064); Anmeldefehler und 429 des Systemakteurs im Zugriffslog (033) mit
  Alarmregel „Anmeldefehler" (070).
- *Nachweis:* geplant in Scheibe 064 („Rolle ohne ingest.write → 403", „gleiches Segment zweimal → ein
  Ereignis").

**MF-06 „Vorgelesen" auf fremdem Bühnenplatz** (047, 049, 056, 058)
- *Ablauf:* das Gerät eines Platzes (oder ein kompromittiertes Podiumsgerät) markiert eine Frage eines
  anderen Platzes als vorgelesen; sie verschwindet aus dessen Warteschlange und gilt als beantwortet. Heute
  möglich (Probe P6).
- *Verhindert durch:* T-G1-E-05, T-G1-R-02; Platz im Dienst aus Rollenzuordnung und Gerät aufgelöst (047),
  Warteschlange je Platz (056), Delivery mit Platz, Gerät und `versionHash` (049).
- *Erkennung:* Delivery, deren Platz nicht zur Bühnenzuordnung der Frage passt, erzeugt einen Vermerk und
  einen Alarm an die Inhaber von `question.legal.clear` (Zielvorschlag für 049, analog zur Abweichung);
  die Kanarienfrage auf eigenem Platz prüft den Weg alle 30 Minuten (086).
- *Nachweis:* geplant in Scheibe 047 („Client behauptet einen fremden Platz → wird ignoriert"), 056
  („podium auf Platz ceo sieht keine cfo-Fragen").

**MF-07 Selbstfreigabe über Rollenwechsel oder Vertretung** (021, 026)
- *Ablauf:* eine Person entwirft eine Antwort und gibt sie selbst frei, direkt (Probe P5) oder über eine
  zweite Rollenzuordnung als Vertretung.
- *Verhindert durch:* T-G1-E-02, T-G1-E-04; R-GUARD-06 vergleicht Personen, nicht Rollen (021); Rechtekonzept
  Abschnitt 4: auch ein Rollenwechsel in derselben Sitzung hebt Vier-Augen nicht auf.
- *Erkennung:* **offen.** Ein verweigerter Übergang hängt kein Ereignis an; der Versuch erscheint daher nicht in der
  Historie, nur als 409 mit R-GUARD-06 beim Aufrufer. Protokollierung verweigerter Schreibversuche kommt mit 033
  (Protokollebenen). Im Rückfall gepoolter Stationsidentitäten wirkt der Guard nur auf Stationsebene (B18); im
  Demobetrieb ist die Akteur-id eine Angabe des Clients (`X-Actor`), personengenau erst mit Anmeldung (029).
- *Nachweis:* umgesetzt in 021a (26.09.2026): `packages/domain/src/__tests__/transitions.test.ts` und `api.test.ts`
  (legal, admin und dieselbe id unter anderer Rolle → 409 R-GUARD-06, kein Ereignis; `_actions` ohne Freigabe),
  `apps/api/src/__tests__/negative.test.ts` (409 über HTTP).

**MF-08 Demo-Schalter in Staging** (029, 034, 042)
- *Ablauf:* bei einem Deploy bleibt `HV_DEMO=1` gesetzt; Seed-Endpunkt und Header-Identität sind offen.
- *Verhindert durch:* T-Q-T-04, T-G1-S-01; Startabbruch bei `HV_DEMO=1` mit Issuer (gebaut in 029a, Test
  `apps/api/src/__tests__/demo-lock.test.ts`; ohne `HV_DEMO=1` wird `X-Actor` nicht gelesen), Konfigurationsschema
  (034), Seed nur in `training` (042).
- *Erkennung:* Health-Smoke nach dem Deploy prüft die Betriebsart (Zielvorschlag für 037); Banner je Modus
  (042).
- *Nachweis:* geplant in Scheibe 029 („HV_DEMO=1 mit Issuer → Start verweigert"), 042 („seed im Modus live →
  403").

---

## 8. Befundliste

Lücken des heutigen Baus, am Code belegt. „Schwere" ist die Einschätzung des Reviewers für einen Betrieb
außerhalb des eigenen Rechners, kein CVSS-Wert. Ein Widerspruch zu einem ADR steht mit „→ ADR-Nacharbeit";
der ADR bleibt in dieser Scheibe unverändert. Mit Scheibe 012 geschlossene Befunde nennen den früheren Stand
(`8c8368b`) und die schließenden Stellen; ein verbleibender Rest steht unter einer neuen, angehängten ID.

| ID | Grenze | Befund | Schwere | Ziel | Status |
|---|---|---|---|---|---|
| BF-01 | G1 | `X-Actor` wurde unabhängig von `HV_DEMO` ausgewertet; jeder, der den Port erreichte, war jede Rolle (Probe P1). **Geschlossen (029a):** ohne `HV_DEMO=1` wählt `selectAuthAdapter` (`apps/api/src/actor.ts`) den Adapter „keine Anmeldung“: jeder Aufruf unter `/v1` → 401, der Header wird nicht gelesen (`apps/api/src/app.ts`, Middleware); `HV_DEMO=1` plus `HV_OIDC_ISSUER` verweigert den Start (Verriegelung ADR 0004); `server.ts` meldet den Betrieb ohne Demo im Log; Probe P1 wiederholt (401 ohne, 200 mit Demo). **Rest bei 029:** OIDC-Anmeldung, Sperrliste, Notfallkonten; ADR-Nacharbeit. | kritisch | 029a / 029 | behoben (029a) |
| BF-02 | G1 | Lesemethoden ohne Rechteprüfung (`packages/domain/src/api.ts:277-296, 343-352, 397-409, 509-525`); `observer` liest Entwürfe (Probe P2), jede Rolle das ganze Log in einem Aufruf (Probe P3). | hoch | 010 | offen |
| BF-03 | G1 | Kein Vier-Augen: `legal` entwirft und gibt frei (`packages/domain/src/permissions.ts:33`, `packages/domain/src/transitions.ts:97-104`, Probe P5). | hoch | 021 | offen |
| BF-04 | G1 | Kein Rechtstor vor der Bühne (`packages/domain/src/transitions.ts:112-118`). | hoch | 021 | offen |
| BF-05 | G1 | Kein Rate-Limit, kein Body-Limit, kein Timeout (`apps/api/src/http.ts:11-19`, `apps/api/src/app.ts:126-148`); 2-MB-Text angenommen (Probe P8). | mittel | 034 | offen |
| BF-06 | G1 | Keine Sicherheits-Header am Dienst (`apps/api/src/app.ts:126-148`, Probe P7); keine CSP für die Demo (`netlify.toml:14-19`, `apps/web/index.html:1-13`). | mittel | 034, 037 | offen |
| BF-07 | G1 | Unbekannte Felder gelangen ins Log (`packages/domain/src/api.ts:338, 421`, `apps/api/src/contractSchema.ts:25`, `packages/contract/openapi.yaml:701-711`; Probe P4). | mittel | 023, 024 | offen |
| BF-08 | G1 | „Vorgelesen" ohne Bindung an Platz und aktuelle Frage (`packages/domain/src/api.ts:478-484`, `packages/domain/src/transitions.ts:127-133`; Probe P6). | mittel | 047, 049 | offen |
| BF-09 | G1 | `admin` hält alle Rechte einschließlich Entwurf und Freigabe (`packages/domain/src/permissions.ts:42`, `packages/domain/policy-truth-table.md:149`); Widerspruch zum Rechtekonzept Abschnitt 4 (kein ADR). | mittel | 040, 021 | offen |
| BF-10 | G1 | Klarnamen in jeder Einzelfrage und in der Suche (`packages/domain/src/state.ts:177`, `packages/domain/src/api.ts:268`, `packages/domain/src/events.ts:36-47`). | mittel | 026, 067 | offen |
| BF-11 | G1 | `If-Match` optional (`packages/domain/src/api.ts:209-217`). | mittel | 028 | offen |
| BF-12 | G1 | Idempotenzspeicher unbegrenzt und flüchtig (`packages/domain/src/api.ts:171, 223-230`). | niedrig | 028 | offen |
| BF-13 | G1 | Problem-Details spiegeln den Header-Wert (`apps/api/src/actor.ts:22, 26`; Probe P9). | niedrig | 029 | offen |
| BF-14 | G2 | Ereignislog ohne Integritätsschutz, Laden ohne Prüfung von Inhalt und `seq` (`packages/domain/src/events.ts:16-24`, `apps/api/src/eventLog.ts:13-22`, `packages/domain/src/store.ts:23`, `packages/domain/src/state.ts:93`). | hoch | 024, 027 | offen |
| BF-15 | G2 | Ein abgelehnter Schreibvorgang wird mit dem nächsten Schreibvorgang gespeichert und nach einem Neustart wirksam: `append` legt das Ereignis vor dem Speichern ins Log und benachrichtigt die Projektion erst danach (`packages/domain/src/store.ts:27-37`, `apps/api/src/eventLog.ts:23-31`; Probe S1–S3). Die Reihenfolge liegt in `createInMemoryEventStore` und gilt für jeden Adapter, der nur `Persistence` (`load`/`save`) umsetzt; damit trifft sie die Integrität des Ereignislogs (SG4) unabhängig vom Speicher: eine Änderung, die der Aufrufer als abgelehnt kennt, steht nach einem Neustart im Nachweis. | hoch | 027 | offen |
| BF-16 | G2 | Die Domäne nutzt `all()`, `lastSeq()` und `subscribe()` des Stores (`packages/domain/src/api.ts:170, 173-175, 408, 529`); die Historie liest das ganze Log je Aufruf (`packages/domain/src/api.ts:406-409`). ADR 0003 (Kontext) sagt, die Domäne sehe nur `append` und `readAfter` → ADR-Nacharbeit. | mittel | 027 | offen |
| BF-17 | G2 | Kein Bereitschaftsendpunkt; Ausfall des Speichers fällt erst beim Schreiben auf (Routen `apps/api/src/app.ts:154-310`). | mittel | 033, 027 | offen |
| BF-18 | G2 | JSONL-Datei mit Standardrechten, Pfad ungeprüft aus der Umgebung (`apps/api/src/eventLog.ts:29`, `apps/api/src/app.ts:86`). Nur Entwicklungsadapter. | niedrig | 027, 037 | offen |
| BF-19 | G3 | `/v1/events` ist als Strom für Nachbarsysteme beschrieben, hat aber weder Systemakteur noch Filter (`packages/contract/openapi.yaml:39`, `packages/domain/src/api.ts:523-525`). | mittel | 010, 065 | offen |
| BF-20 | Q | Der Demo-Build läuft ohne Tore bei jedem Push ohne Überspring-Marke (`netlify.toml:3`); das Go ist nur organisatorisch (ADR 0016, E35). | mittel | 037, E35 | offen |
| BF-21 | Q | Workflow ohne `permissions:` (Stand `8c8368b`). Geschlossen mit 012: Token nur lesend (`.github/workflows/gates.yml:7-9`, `.github/workflows/nightly.yml:10-12`), `persist-credentials: false` (`.github/workflows/gates.yml:17`, `.github/workflows/nightly.yml:20`), Drittanbieter-Bausteine per Commit-Hash (`.github/workflows/gates.yml:34, 48, 82`). Rest: BF-34. | — | 012 | geschlossen |
| BF-22 | Q | Keine Sicherheitstore (Stand `8c8368b`). Geschlossen mit 012: Semgrep auf geänderten Dateien und nachts vollständig (`.github/workflows/gates.yml:64-80`, `.github/workflows/nightly.yml:30-38`), gitleaks (`.github/workflows/gates.yml:81-85`, `.github/workflows/nightly.yml:25-29`), `pnpm audit` ab `moderate` (`.github/workflows/gates.yml:86-87`, `scripts/audit-check.mjs:18`). Die gitleaks-Konfiguration ist bisher nur in CI gelaufen (`scripts/gitleaks.toml:11-14`). Rest: BF-35. | — | 012 | geschlossen |
| BF-23 | Q | Rollenliteral im Dienst: Seed-Akteur mit Rollennamen als Literal (Stand `8c8368b`), Regel 4. Geschlossen mit 012: Akteur aus Option, `HV_SEED_ACTOR` oder `SYSTEM_ACTOR` (`apps/api/src/app.ts:109-113`, `packages/domain/src/seed.ts:70`), Rollenliteral-Tor (`scripts/role-literal-check.mjs:31-36`, `package.json:15`); bekannte Lücken des Tors hat die Nachprüfung von 012 an 016 gegeben. Rest (zweite Identitätsquelle): BF-36. | — | 012 | geschlossen |
| BF-24 | Q | Rückfall der ID-Erzeugung über `Date.now()` und `Math.random()` (Stand `8c8368b`), Regel 8. Geschlossen mit 012: IDs aus `crypto.randomUUID`, sonst `crypto.getRandomValues` (`packages/domain/src/api.ts:119-136`); `Math.random` nur noch ohne jede Web-Crypto-API (`packages/domain/src/api.ts:135`) und als Semgrep-Hinweis gemeldet (`scripts/semgrep/rules.yml:68-75`); now()-Tor (`scripts/now-check.mjs:24`). | — | 012 | geschlossen |
| BF-25 | Q | Sourcemaps im öffentlichen Demo-Build (`apps/web/vite.config.ts:10`). | niedrig | 037 | offen |
| BF-26 | Q | Der Hook sperrt weder `.env`-Zugriff noch ausgehende Netzaufrufe (`.claude/settings.json:9`); ADR 0016 beschreibt beides als Ziel von 016 (kein Widerspruch, noch nicht gebaut). | niedrig | 016 | offen |
| BF-27 | Q | Vertragstext zum Seed „Replace all data" (`packages/contract/openapi.yaml:474`) widerspricht Code (`packages/domain/src/api.ts:529-531`) und Regel 7. | niedrig | 023 | offen |
| BF-28 | Q | Dienst startet aus dem Quelltext mit `tsx` und lauscht auf allen Schnittstellen (`apps/api/package.json:9`, `apps/api/src/server.ts:14`). | niedrig | 037 | offen |
| BF-29 | G1 | CORS geprüft: nur im Demo-Modus, nur für die lokale Entwicklungsadresse, keine Credentials (`apps/api/src/app.ts:131-140`). | — | — | geschlossen |
| BF-30 | G1 | Fehlerantworten geprüft: unerwartete Fehler ohne Stack und ohne Details (`apps/api/src/problem.ts:9-16`). | — | — | geschlossen |
| BF-31 | G1 | Eingangsprüfung geprüft: jede Operation mit Parametern oder Body läuft durch die Vertragsprüfung (`apps/api/src/app.ts:160-310`, `apps/api/src/validate.ts:29-54`); belegt durch T-G1-T-01. | — | — | geschlossen |
| BF-32 | G1 | Idempotenz-Replay über Akteursgrenzen geprüft (`packages/domain/src/api.ts:223-230`); belegt durch T-G1-I-07. | — | — | geschlossen |
| BF-33 | G2 | Seed ersetzt kein bestehendes Log (`packages/domain/src/api.ts:529-531`); belegt durch T-G2-T-04. | — | — | geschlossen |
| BF-34 | Q | Vier Workflow-Bausteine weiter per Versions-Tag statt Commit-Hash (`.github/workflows/gates.yml:14, 19, 20, 94`, `.github/workflows/nightly.yml:17, 21, 22`); 012 hat nur die Drittanbieter-Bausteine gepinnt, die pnpm-Einrichtung steht als Folgebefund für 016 in der Nachprüfung von 012, die übrigen drei nicht. | niedrig | 016 | offen |
| BF-35 | Q | Keine SBOM und keine Signatur der Artefakte: kein Schritt dafür in `.github/workflows/gates.yml:1-101` oder `.github/workflows/nightly.yml:1-40`. | niedrig | 074 | offen |
| BF-36 | Q | Zweite Stelle, die Identität herstellt: der Seed-Akteur entsteht außerhalb von `actor.ts` aus Option, `HV_SEED_ACTOR` (über `parseActorHeader`) oder `SYSTEM_ACTOR` (`apps/api/src/app.ts:75-82, 109-113`). ADR 0004 (Kontext) nennt `actor.ts` den einzigen Ort, der Identität herstellt → ADR-Nacharbeit. | niedrig | 029 | offen |

---

## 9. Restrisiko und Außerhalb

| ID | Restrisiko oder Ausschluss | Warum hingenommen | Ort |
|---|---|---|---|
| RR-01 | Ein Datenbank-Superuser kann die ganze Hash-Kette neu berechnen; das fällt nur gegen einen Anker außerhalb der Datenbank auf. | Beta: Hash-Liste und Log-Hash im Export (051, 081) und Jahrgangs-Export (038) sind der Anker; qualifizierter Zeitstempel ist Nach-Beta | B-Liste „PDF/A mit Bates-Nummern, qualifizierter Zeitstempel" |
| RR-02 | Massenlesen durch eine berechtigte Person ist nur schwach erkennbar, weil es keine Kennzahl je Person geben darf. | Mitbestimmung geht vor; Auswertung nur zu zweit (ADR 0013) | E13 (Betriebsvereinbarung, Mindest-Aggregationsschwelle offen) |
| RR-03 | Im Rückfall gepoolter Stationsidentitäten gelten Anmeldung, Vier-Augen und Nachvollziehbarkeit nur je Station. | Rückfallpfad der Mitbestimmung | B18, E13 |
| RR-04 | Personenbezogene Felder sind in der Beta nur über den Identitäts-Codec geführt; Löschung und Krypto-Shredding werden nicht ausgeführt. | Beta ist Schattenbetrieb mit synthetischen Fragen | B-Liste „Löschung und Krypto-Shredding", Leitplanken 9.3, E16 |
| RR-05 | Keine zweite Zone, kein zweiter Netzweg, kein externes Monitoring. | Papierpfad und Degradationsstufen tragen den Ausfall (070) | B-Liste „SAML, zweite Zone …", E27 |
| RR-06 | Der Pentest-Retest liegt nach beta-1 und außerhalb des Plans. | Termin vor der Vollprobe | B-Liste „Externer Pentest-Retest", E45 |
| RR-07 | Härtung der Podiumsgeräte (Browser, Erweiterungen, MDM) liegt bei der Konzern-IT. | Geräteklasse offen | E33 |
| RR-08 | Die öffentliche Demo mit Rollenumschalter bleibt; jede Person ist dort jede Rolle. | nur synthetischer Korpus, kein Dienst (ADR 0002) | B17 |
| RR-09 | Angriffe auf Plattform, Saal-WLAN und Konzern-IdP selbst sowie Überlast geteilter Infrastruktur. | außerhalb des Gegenstands; Rückfall Hotspot und Papier | E33, E10, Pentest-Scope Abschnitt 5 |
| RR-10 | SAML, Gastkonten, verdeckter Bestand (Ethical Wall). | Nach-Beta | B-Liste |
| RR-11 | KI-Anbieter, Wissensbasis. | kein Anbieter in der Beta | B-Liste, E18 |
| RR-12 | Social Engineering und physischer Zugriff auf die versiegelten Notfallkonten. | organisatorisch über das Umschlagverfahren (070) | Leitplanken 9.3 (Break-Glass abgenommen) |

**Außerhalb dieses Modells:** die Interna des Konzern-IdP und der Hosting-Plattform, das Saalnetz, die
Endgeräteverwaltung, jede Rechtsbewertung (E15) und die Datenschutz-Folgenabschätzung (DSFA-Vorentwurf aus
014, Endfassung 083).

## 10. Pflege

- Eine Scheibe, die eine ID schließt, nennt in ihrem Bericht ID und Test; den Status in dieser Datei schreibt
  sie nicht fort (Lane docs-sicherheit). Scheibe 074 bewertet alle IDs neu (v2) und übernimmt neue
  Bedrohungen, die Reviews als Befund melden.
- Neue IDs werden angehängt, nie umnummeriert. Ein Zielvorschlag, den eine Spec ablehnt, bleibt mit Vermerk
  stehen.

## Anhang A — Proben gegen den laufenden Code

Aufrufe gegen `createApp()` aus `apps/api/src/app.ts` (Hono-Testclient, Seed mit 300 Fragen) und gegen
`createInMemoryEventStore`/`createInProcessApi` aus `packages/domain`, gegen `8c8368b` und erneut gegen `a8cbbe1`
(nach dem Merge von 012) mit identischen Ergebnissen. Das Probenskript lag nur im Arbeitsbereich
des Bauenden und ist nicht eingecheckt; jede Probe ist mit den Testhelfern aus
`apps/api/src/__tests__/helpers.ts` in wenigen Zeilen nachstellbar.

| Probe | Aufruf | Ergebnis |
|---|---|---|
| P1 | App mit `demoEnabled: false`, `GET /v1/questions?limit=1` mit `X-Actor: someone:admin` | 200 |
| P2 | `GET /v1/questions?status=answer_drafted&limit=1` als `observer` | 200, Antworttext enthalten |
| P3 | `GET /v1/events?limit=5000` als `observer` | 200, 2376 von 2376 Ereignissen |
| P4 | `PATCH /v1/speakers/{id}` mit `{"round":1,"injected":"beliebiger Text"}` als `moderation` | 200, gespeicherte Payload `{"round":1,"injected":"beliebiger Text"}` |
| P5 | `legal` entwirft Fassung, `expert` reicht ein, dieselbe `legal`-Kennung gibt frei | 200, `createdBy` = `approvedBy` |
| P6 | `podium` markiert die letzte Frage der Warteschlange (Platz `supervisory_board_chair`) ohne `If-Match` als vorgelesen | 200 |
| P7 | Kopfzeilen der Antwort aus P1 | nur `content-type` |
| P8 | `POST /v1/contributions` mit 2 MB Text als `capture` | 201 |
| P9 | `X-Actor: x:superhero` | 401, `detail` enthält den gesendeten Rollennamen |
| S1–S3 | `save` der Persistenz wirft beim Klassifizieren; danach ein erfolgreicher Schreibvorgang; Neustart aus dem Gespeicherten | S1 Fehler an den Aufrufer; S2 Projektion unverändert, Speicher-Log +1; S3 nach Neustart ist die abgelehnte Klassifizierung wirksam |

## Quellen

ADR 0001, 0002, 0003, 0004, 0006, 0007, 0008, 0009, 0011, 0013, 0014, 0016; Leitplanken 1.3, 2, 6.5, 9.3;
`docs/rollen-und-rechtekonzept.md` Abschnitte 2–4; Register E8, E10, E13, E16, E17, E18, E22, E27, E32, E33,
E35, E39, E45; Plan Abschnitt 1 (B1–B18) und Abschnitt 5 (Scheiben).
