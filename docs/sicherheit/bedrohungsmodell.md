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
| Demo-Hosting | statischer Build ohne Funktionen und ohne Secrets; drei Sicherheits-Header, keine CSP | `netlify.toml:1-4, 17-22` |
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
| SG4 | Integrität des Ereignislogs als Grundlage der Niederschrift-Anlage (B12): Reihenfolge, Akteur, Zeit, Inhalt | Integrität, Nachweisbarkeit | `packages/domain/src/store.ts:27-37`, `apps/api/src/eventLog.ts:23-31`; seit takt-033 zusätzlich der Kettencache je App (`apps/api/src/persistence/chainCache.ts`) und das versiegelte, eingefrorene Log (`sealVerifiedLog`, `packages/domain/src/envelope.ts`) |
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

## Stand Scheibe 029b (interne Beta-Anmeldung)

Die untenstehenden STRIDE-Zeilen beschreiben zum Teil noch den ursprünglichen Demo-Stand. Für
T-G1-S-01 gilt seit 029a der Startabbruch bei Demo plus Issuer und 401 ohne Demo-Anmeldung; 029b
ergänzt den OIDC-Sitzungsadapter. T-G1-S-02, T-G1-I-08 und T-G1-T-05 erhalten mit 029b
browsergebundenen Login-State, ein zufälliges HttpOnly-Sitzungscookie, 14 Stunden absolute und
30 Minuten Leerlaufgrenze, Abmelden, Subject-Sperre und CSRF-Pflicht vor jedem `/v1`-Schreiben.
Offene SSE-Ströme und der UI-Client folgen in 035 beziehungsweise 030; der Geräteverlustfall ist
damit noch nicht vollständig geschlossen. T-G3-S-02 wird mit `openid-client` gegen JWKS,
Issuer, Audience, Ablauf, Nonce, State und PKCE geprüft; die Negativfälle stehen in
`apps/api/src/__tests__/auth-029b.test.ts`. T-G3-E-03 erhält die aktuelle Rollenzuordnung aus
`RoleAssigned`/`RoleRevoked`, ohne automatische IdP-Gruppenrechte; der Entzug wird beim nächsten
Aufruf geprüft. T-G3-D-01 bleibt für Register und Transkription offen; ein ausgefallener IdP
verhindert neue Anmeldungen. Notfallkonten bleiben bis nach der Fortführungsentscheidung zurückgestellt.

Der Datenbanknachweis in `apps/api/src/__tests__/postgres-auth-029b.test.ts` prüft zwei Prozesse,
Logout, Sperre und Laufzeitrechte. Der echte Keycloak- und Browser-Nachweis steht im
CI-Schritt `scripts/keycloak-ci-029b.mjs`; sein grünes CI-Ergebnis ist vor Merge erforderlich.
Die Test-Fixierung verwendet ausschließlich synthetische Subjects. Die Tabellenzeilen unten
sind die Bedrohungsbeschreibung; dieser Nachtrag ist der aktuelle 029b-Status der genannten IDs.

## Stand Scheibe 034b (Konfigurationsschema, CORS-Allowlist, Proxy-Quelle)

Gilt für die genannten IDs vor den Tabellenzeilen unten, die die ursprüngliche Bedrohung beschreiben. Nachweis-Commit:
`4976877` (`pnpm gates` grün).

| ID | Stand nach 034b | Nachweis |
|---|---|---|
| T-Q-T-04 | teilweise (Rest: Seed nur in `training`, 042): typisiertes zod-Schema, Start verweigert mit festem Satz je Regel und ohne Wert bei fehlender Pflichtkonfiguration (Zugriffslog, Schlüssel), unvollständiger Anmeldung, `HV_DEMO` ungleich `1`, `HV_DEMO=1` mit Issuer, ungültigen Zahlen und falscher Reihenfolge der Zeitgrenzen | `apps/api/src/__tests__/config034b.test.ts` |
| T-G2-E-02 | geschlossen für den Dienst (Rest: Container ohne Root, 037): `HV_EVENT_LOG` nur mit `HV_DEMO=1`, absolut, Elternverzeichnis beschreibbar, nicht im Log-Verzeichnis; Rechte des Log-Verzeichnisses (lstat, kein Symlink, `(mode & 0o027) === 0`). **Restrisiko (Ziel 037):** die Rechte werden nur beim Start geprüft; `O_NOFOLLOW` der Senke schützt nur die letzte Pfadkomponente, ein austauschbares Elternverzeichnis bleibt eine TOCTOU-Lücke; Gegenmaßnahme im Betrieb: Elternverzeichnis gehört root oder dem Dienst, Wurzeldateisystem nur lesbar; ACLs erfasst `mode & 0o027` nicht | `config034b.test.ts` › „paths and directory rights" |
| T-G1-T-05 | CORS-Teil geschlossen (CSRF bleibt 029b): Allowlist aus `HV_CORS_ORIGINS`, exakter Vergleich, außerhalb der Demo nur `https:`, höchstens 10, ohne Platzhalter und `null`; fremde Herkunft ohne jeden `Access-Control-*`-Header, auch im Preflight; ohne Variable außerhalb der Demo kein CORS | `apps/api/src/__tests__/cors034b.test.ts` |
| T-G2-S-01 | berührt (Secrets aus der Plattform: 037): kein Geheimnis und kein Pfad in Startzeile, Fehlersätzen und der Meldung unbekannter Variablen | `config034b.test.ts` › „start line and secrets" |
| T-G1-D-01 (Proxy-Teil) | Quelle hinter Proxy geschlossen: `X-Forwarded-For` nur von Gegenstellen in `HV_TRUSTED_PROXY_CIDRS` (höchstens 16 Blöcke ohne Host-Bits, IPv4 ab /8, IPv6 ab /32, also nie `/0`; IPv4-abgebildete IPv6-Blöcke gelten als IPv4-Block, ein IPv6-Block, der `::ffff:0:0/96` enthält, wird abgelehnt), rechtester nicht vertrauenswürdiger Eintrag; direkte Verbindung mit gefälschtem Header zählt unter der Verbindungsadresse; Grenzen und Timeouts konfigurierbar, Standardwerte unverändert. Restrisiko: falsch eingetragener, aber gültiger Block (etwa ein zu weites Firmennetz); Proxy-Grenze 037 | `config034b.test.ts` › „trusted proxy list", „configured limits take effect" |

Neue Laufzeitabhängigkeit (SC-10): `zod` 4.6.5, exakt gepinnt, Lizenz MIT, keine transitiven Laufzeitabhängigkeiten,
im Lockfile; Nutzen: Planvorgabe „typisiertes Konfigurationsschema (zod)".

## Stand Scheibe 031a (HTTP-Projekt der e2e-Suite)

Gilt für die genannten IDs vor den Tabellenzeilen unten. Der Nachweis des Bauzustands steht in `docs/slices/031a-e2e-http-harness-anmeldung.md`
unter „Nachweis“; der Keycloak-Teil (H4 bis H8) läuft nur im CI-Job `e2e-http` und ist erst mit dessen grünem Lauf belegt.

- **029b-Nachtrag (Keycloak-Nachweis in CI):** der Schritt `scripts/keycloak-ci-029b.mjs` bleibt im Job `gates`; er nutzt seit 031a das Modul
  `scripts/lib/keycloak-ci.mjs` und das Keycloak-Image mit Digest. Zusätzlich fährt der Job `e2e-http` Anmeldung, Abmelden, Subject-Sperre und
  Schreibkonflikt im Browser gegen den echten Dienst (Realm `hv-e2e-031`, neun synthetische Personen, Geheimnisse je Lauf).
- **H7 weicht von der Spec ab:** eine Person ohne aktive Rolle bekommt keine Sitzung, `/auth/callback` antwortet 403 (`R-PERM-01`) vor jedem Cookie;
  die Seite „Keine aktive Rolle“ entsteht nur, wenn eine Rolle mitten in der Sitzung entfällt. H7 belegt deshalb „kein Cookie, `/auth/me` 401“.
- Zuordnung Bedrohung → Test: T-G1-S-02 → H4, H5, H6; T-G1-S-03 → H1, H4, `030-anmeldung.spec.ts`; T-G1-T-05 → H3, H5, H8;
  T-Q-I-01 → `scripts/e2e-http-031.test.mjs`; T-G2-I-02 → Stufe 6 des Harness (Zugriffslog gegen `e2e-texts.ts`).

## Stand Scheibe 037a (lokales Betriebspaket, Container und Compose)

Gilt für die genannten IDs vor den Tabellenzeilen unten, nur für den lokalen Stack (`deploy/`, `scripts/stack.mjs`,
`docs/betrieb/installation.md`). Pipeline, Push mit Digest, TLS, CSP und Proxy-Vertrauen folgen in 037b. Nachweis des
Bauzustands: `docs/slices/037a-lokales-betriebspaket.md`, Abschnitt „Bericht“, und `docs/evidence/037a-stack-protokoll.txt`.

| ID | Stand nach 037a | Nachweis |
|---|---|---|
| T-G2-E-02 | Rest „Container ohne Root“ für den lokalen Stack geschlossen: Dienst und Befüllung als 65532, Web als 101, `read_only`, `cap_drop: ALL`, `no-new-privileges`; `/var/lib/hv` root 0755, Zugriffslog-Volume 65532 0700 | `scripts/stack.test.mjs` S4; `node scripts/stack.mjs probe images` (S14) |
| T-Q-S-02 | teilweise: Images lokal gebaut, alle Basis-Images per Tag und Index-Digest gepinnt (Postgres und Keycloak gleich CI), pnpm mit sha512 über corepack, Befüllung in eigenem Image `seed`; Push mit Digest 037b | `scripts/stack.test.mjs` S1, S4, S9 |
| T-Q-I-01 | teilweise: Secrets des lokalen Stacks je Installation einmal zufällig, außerhalb des Repositoriums (0700/0600), je Dienst nur die eigene Datei, Ausgabe nur über `stack:credentials`, `::add-mask::` vor jeder Ausgabe in CI, nie `docker compose config` in CI; Secrets aus der Plattform 037b | `scripts/stack.test.mjs` S3, S5, S6, S10 |
| T-Q-I-02 | im Web-Image geschlossen: `.map` → 404 am Proxy, Quelltextkarten zusätzlich aus dem Image entfernt; für das Netlify-Demo offen bis 037b | Rauchtest S12.2 (`pnpm stack:smoke`) |
| T-G1-D-01 (Proxy-Teil) | Grenzen am Proxy im lokalen Stack: Header- und Body-Timeout 10 s, `send_timeout` 30 s, Keepalive 15 s und 1000, Header-Puffer 4 × 8k, Body bis 257k (413 darüber), Sicherheitsheader `always` auch auf 4xx und 5xx des Proxys, Proben und `/metrics` nicht auf dem Webport; kein Proxy-Vertrauen lokal (`trusted-proxies=none`) | Rauchtest S12.1, S12.2 |
| T-G1-S-02 | Restrisiko nur im lokalen Stack: `hv_session` gilt je Host, nicht je Port; jede andere Anwendung auf `localhost` im selben Browserprofil bekommt das Cookie mitgeschickt. Gegenmaßnahme: eigenes Browserprofil oder Abmelden nach der Demo (Installationsseite §8) | — |
| T-G1-D-05 (`auth_purge_login_states`) | im lokalen Stack verringert, nicht geschlossen: `hv_owner` ist dort Datenbankeigentümer ohne Superuser (NOSUPERUSER NOCREATEROLE NOCREATEDB), die SECURITY-DEFINER-Funktion läuft mit Eigentümerrechten auf `hv`; in CI unverändert (`POSTGRES_USER: hv_owner` ist Superuser) | Rauchtest S12.7 |
| T-G2-T-04 / T-Q-T-04 | Befüllung des lokalen Stacks am Rechtepfad vorbei nur in ein leeres Log, nur mit Loopback-Issuer und Compose-Host `postgres`, nur im Image `seed` (das Image `api` enthält kein `/app/scripts`) | `scripts/stack.test.mjs` S8; `probe images` (S14), `probe refusals` (S15) |

## 5. STRIDE je Grenze

### 5.1 G1 — Oberfläche ↔ Dienst

| ID | Bedrohung (Beispiel) | Kontrolle | Beta | Test | Status |
|---|---|---|---|---|---|
| T-G1-S-01 | Identität per Behauptung: der Dienst übernimmt `X-Actor` ohne Anmeldung und unabhängig von `HV_DEMO`; wer den Port erreicht, sendet `X-Actor: irgendwer:admin` und hat alle Rechte (Probe P1). `HV_DEMO` schaltet nur CORS und Seed (`apps/api/src/app.ts:131-140, 300-303`), die Auswertung läuft immer (`apps/api/src/app.ts:143-146`). | vorhanden: nur Form- und Rollennamenprüfung, 401 bei fehlendem, fehlerhaftem oder unbekanntem Wert (`apps/api/src/actor.ts:12-27`); geplant: Actor-Port mit drei Adaptern, `demoHeader` nur bei `HV_DEMO=1` ohne Issuer, sonst Startabbruch (029) | B1 | `apps/api/src/__tests__/negative.test.ts › 401: missing X-Actor header`; `apps/api/src/__tests__/negative.test.ts › 401: unknown role in X-Actor header`; geplant in Scheibe 029 („X-Actor ohne Demo → 401") | offen |
| T-G1-S-02 | Sitzungsübernahme im Beta-Ziel: gestohlenes Sitzungscookie (unbeaufsichtigter Erfassungsplatz, XSS, geteiltes Browserprofil), Session Fixation, Login-CSRF auf den Rückruf der Anmeldung; ein offener SSE-Strom überdauert Abmelden oder Sperre (T-G1-I-09). Heute gibt es keine Sitzung (`apps/api/src/actor.ts:1-5`). | geplant: HttpOnly/SameSite-Cookie, 14 h mit stillem Refresh und Leerlauf-Timeout, Abmelden, Sperrliste ohne Neustart (029); neue Sitzungs-ID nach der Anmeldung (029, Zielvorschlag); CSP (034, 037) | B1 | geplant in Scheibe 029 („abgelaufene Sitzung → 401", „gesperrtes Subject → 401"); im Browser 031a: `apps/web/e2e/031-http-betriebsart.spec.ts` H4 (Cookie-Attribute), H5 (Abmelden, altes Cookie 401), H6 (Subject-Sperre ohne Neustart), Nachweis in der PR-CI, Job `e2e-http`; Stand 035b (Stromteil): ein offener Strom endet mit `end {session}` vor der nächsten Zustellung nach Abmelden, Sperre und Leerlaufablauf, `readSession` nur mit `slideIdle = false`, frisch je Stapel, Tests `apps/api/src/__tests__/stream035.test.ts` 17, `postgres-stream035.test.ts` 27; Rotation nach 25 min, Tests 19, 23c | offen |
| T-G1-S-03 | Rollenwahl in der Demo: jede Person nimmt im Browser über den Rollenumschalter jede Rolle an (`apps/web/src/api/actor.ts:43-51`), gewollt nach ADR 0002. Gefahr ist die Verwechslung: echte Daten in der Demo oder ein Build mit Rollenumschalter gegen einen echten Dienst. | vorhanden: Demo hält nur den synthetischen Korpus im Browser des Geräts (`apps/web/src/api/index.ts:17-48`, `packages/domain/src/seed.ts:1-7`); Demo-Kennzeichen fest verdrahtet (`apps/web/src/api/index.ts:86`); geplant: Betriebsart per Build-Konfiguration, Rollenumschalter nur in der Demo (030) | B17 | `apps/web/e2e/001-shell.spec.ts › shell: counters, role switch, language switch @screenshot` (belegt nur den Demo-Pfad); geplant in Scheibe 030; 031a: `031-http-betriebsart.spec.ts` H1 und H4 sowie `030-anmeldung.spec.ts` im Projekt `http` (echter Dienst ohne Rollenumschalter) | teilweise |
| T-G1-T-01 | Anfrage außerhalb des Vertrags (falscher Typ, Wert außerhalb des Enums, Query außerhalb des Bereichs) erreicht Domäne und Log. | vorhanden: `validateOperation` prüft Header, Query und Body gegen die Vertragsschemas vor jedem Handler (`apps/api/src/validate.ts:29-54`); fachliche Eingangsprüfung in der Domäne (`packages/domain/src/api.ts:411-417`) | — | `apps/api/src/__tests__/negative.test.ts › 422: a wrongly-typed body is rejected against the contract before it reaches the domain`; `apps/api/src/__tests__/negative.test.ts › 422: an out-of-enum kind or status is rejected, not silently written`; `apps/api/src/__tests__/negative.test.ts › 422: an out-of-range or out-of-enum query parameter is rejected, not clamped` | geschlossen |
| T-G1-T-02 | Unbekannte Felder im nur anhängenden Log: `PATCH /v1/speakers/{id}` mit `{"round":1,"injected":"…"}` wird angenommen und als Payload von `SpeakerUpdated` gespeichert (Probe P4). Die Anfrageschemas verbieten keine Zusatzfelder (`packages/contract/openapi.yaml:701-711`), der Validator läuft mit `strict: false` (`apps/api/src/contractSchema.ts:25`), die Domäne übernimmt den Body ganz (`packages/domain/src/api.ts:338, 421`). | geplant: `additionalProperties: false` auf Anfrageschemas (023, Zielvorschlag); Payload aus benannten Feldern im Umschlag v2 (024, Zielvorschlag) | B3 | geplant in Scheibe 023 | offen |
| T-G1-T-03 | Verlorene Änderung: zwei Personen bearbeiten dieselbe Einzelfrage, ohne `If-Match` überschreibt der Zweite still (`packages/domain/src/api.ts:209-217`). | vorhanden: Prüfung, wenn `If-Match` gesendet wird (`packages/domain/src/api.ts:210`); geplant: `If-Match` Pflicht mit 428, Übernahme-Sperre (028) | B9 | `apps/api/src/__tests__/negative.test.ts › 412: a stale If-Match is a precondition failure and changes nothing`; geplant in Scheibe 028 („paralleles captureQuestions → 412 für den Zweiten") | teilweise |
| T-G1-T-04 | Freigabe unterschieben: eine andere als die zuletzt eingereichte Fassung wird freigegeben, oder der Text ändert sich nach der Freigabe. | vorhanden: R-GUARD-04 „nur die letzte Fassung" (`packages/domain/src/transitions.ts:43-55`); eine neue Fassung hebt die Freigabe auf (`packages/domain/src/state.ts:215`) | B6 | `packages/domain/src/__tests__/transitions.test.ts › R-GUARD-04: approval must name the latest answer version`; `packages/domain/src/__tests__/api.test.ts › a new answer version after approval voids the approval (bound to the text)` | geschlossen |
| T-G1-T-05 | Cross-Site Request Forgery im Beta-Ziel: eine fremde Seite löst im Browser einer angemeldeten Freigabe `POST /v1/questions/{id}/approvals` aus. Heute nicht ausnutzbar: Identität steht in einem eigenen Header, CORS ist nur im Demo-Modus für eine lokale Entwicklungsadresse offen (`apps/api/src/app.ts:131-140`). | geplant: SameSite-Cookie und CSRF-Token für Schreibvorgänge (029), Client sendet den Token (030), CORS-Allowlist aus der Konfiguration (034) | B1 | geplant in Scheibe 029; im Browser 031a: `031-http-betriebsart.spec.ts` H5 (`X-CSRF-Token` beim Abmelden), H3 (keine CORS-Antwort), H8 (Schreiben nur mit Token) | offen |
| T-G1-T-06 | Skripteinschleusung (XSS) über Fragetext, Antworttext oder Rednernamen auf Bühne, Historie und Export; ab 055 formatierte Antworten mit „Einfügen aus Word". | vorhanden: Texte werden als Textknoten gesetzt (z. B. `apps/web/src/features/stage/Podium.tsx:90, 179`), keine Verwendung von `dangerouslySetInnerHTML` oder `innerHTML` in `apps/web/src` (Suche ohne Treffer); Semgrep-Regel gegen `dangerouslySetInnerHTML` blockiert in CI (`scripts/semgrep/rules.yml:60-66`, Schritt `.github/workflows/gates.yml:64-80`); vorhanden seit 034a: CSP am Dienst (`default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`, Test `contract.test.ts › 034a security headers`); geplant: CSP für das Web-Dokument und die Demo (037), Whitelist-Renderer für das Blockdokument (055) | — | geplant in Scheibe 037 („CSP-Report ohne Verstoß in e2e", Produktions-Build) | teilweise |
| T-G1-T-07 | Zeit behaupten: Client oder Gerät setzt eine Zeit, um eine Antwort, ein Vorlesen oder eine Papier-Nacherfassung rückzudatieren. | vorhanden: die Ereigniszeit kommt aus der injizierten Uhr des Dienstes, nie aus der Anfrage (`packages/domain/src/api.ts:177, 231-235`, Uhr `apps/api/src/app.ts:99`); in der Demo ist es die Uhr des Browsers (`apps/web/src/api/index.ts:46`); geplant: `occurredAt` nur als Angabe mit Quelle, Zukunft abgelehnt (024); `lateEntry` mit Pflichtgrund (025); now()-Tor auch für `apps/web` (032); vorhanden seit 033a: `X-Server-Time` auf jeder Antwort (200 bis 500, `notFound`, `onError`) aus der injizierten Uhr, ein `Date`-Header des Clients wird nie gelesen (`apps/api/src/__tests__/platform033a.test.ts`); vorhanden seit 012: now()-Tor über Domäne und Dienst in `pnpm gates` (`scripts/now-check.mjs:24`, `package.json:15`) | B4 | geplant in Scheibe 024 („occurredAt aus Quelle device wird nie zu recordedAt, Zukunft abgelehnt") | teilweise |
| T-G1-R-01 | Abstreiten einer Handlung („ich habe nicht freigegeben"): jedes Ereignis trägt `actor` (`packages/domain/src/events.ts:21`), aber der Akteur ist selbst behauptet (T-G1-S-01); der Dienst protokolliert keine Zugriffe (keine Log-Middleware in `apps/api/src/app.ts:126-148`). | vorhanden: Akteur und Serverzeit an jedem Ereignis (`packages/domain/src/api.ts:231-235`); vorhanden seit 033a: Zugriffslog mit Korrelations-ID, Subject-Hash und `seq` in eigener Senke, eine Zeile je Anfrage; Einzelidentität über OIDC (029). Restrisiko: `seq` führt ohne Schlüssel über die Vorgangshistorie auf die Actor-ID (MF-09) | B1, B5 | `apps/api/src/__tests__/access-log033a.test.ts` (Schlüsselmenge, Zeile ohne Fragetext trotz Body, `seq` je Schreibaufruf), `postgres-access-log033a.test.ts` (`seq` nach COMMIT, null nach Rollback) | teilweise |
| T-G1-R-02 | „Vorgelesen" ohne Beweiswert: `QuestionDelivered` trägt nur die Fassungsnummer der Freigabe, keinen Bühnenplatz, kein Gerät, keinen Hash der vorgelesenen Fassung, keine Zeitquelle (`packages/domain/src/api.ts:478-484`); ein Soll-Ist ist nicht belegbar. | vorhanden: Fassungsnummer der Freigabe im Ereignis (`packages/domain/src/api.ts:482`); geplant: Delivery-Entität mit `versionHash`, Platz, Gerät, `occurredAt`/`recordedAt` (049); Offline-Absicht mit Gerätezeit als Angabe (058) | B7, B12 | geplant in Scheibe 049 („Delivery referenziert exakt die freigegebene Version") | teilweise |
| T-G1-I-01 | Jede Rolle liest alles: keine Lesemethode prüft ein Recht (`packages/domain/src/api.ts:277-296, 343-352, 397-409, 509-525`). `observer` erhält mit `GET /v1/questions?status=answer_drafted` unveröffentlichte Antworttexte (Probe P2). Der Vertrag 0.2.0 kennt die Leserechte schon (`packages/contract/openapi.yaml:582-610`), die Domäne noch nicht (`packages/domain/src/types.ts:26-45`). | geplant: Leserechte nur in `ROLE_PERMISSIONS`, `can()` auf allen Lesemethoden, 403 mit R-PERM-02 (010); Attributebene Einheit, Platz, Vertraulichkeit (047) | B2 | geplant in Scheibe 010 („observer 403 auf ?status=answer_drafted") | offen |
| T-G1-I-02 | Massenlesen in einem Aufruf: `GET /v1/events?limit=5000` liefert jedem Akteur das ganze Log mit Entwürfen, Rückgabegründen und Akteuren (Probe P3); `GET /v1/questions` bis 2000 Einträge je Seite (`packages/contract/openapi.yaml:208, 457`, `packages/domain/src/api.ts:523-525`). | vorhanden: Obergrenze je Seite, Überschreitung wird abgewiesen (`apps/api/src/validate.ts:32-39`); geplant: `event.read` nur für die Administration (010); Rate-Limit (034); Export nur mit `export.dossier` und Ereignis je Export (051) | B2, B12 | `apps/api/src/__tests__/negative.test.ts › 422: an out-of-range or out-of-enum query parameter is rejected, not clamped`; geplant in Scheibe 010 („podium 403 auf /events") | teilweise |
| T-G1-I-03 | Klarnamen der Redner für alle: jede Einzelfrage trägt den Anzeigenamen des Redners (`packages/domain/src/state.ts:177`), die Freitextsuche trifft ihn (`packages/domain/src/api.ts:268`), `SpeakerRegistered` speichert Name und Organisation (`packages/domain/src/events.ts:36-47`). | geplant: Personentabelle, Pseudonym ohne `question.identity.reveal` (026); Aufdecken als Ereignis mit Grund (067) | — | geplant in Scheibe 026 („Pseudonym ohne question.identity.reveal") | offen |
| T-G1-I-04 | Ableitung über Nummern, Zähler und Suche: fortlaufende F-Nummern (`packages/domain/src/api.ts:384`), Zähler je Status für jeden Leser (`packages/domain/src/api.ts:277-280`) und die Suche über Antworttexte (`packages/domain/src/api.ts:266-272`) verraten Existenz, Stand und Stichworte auch dann, wenn der Inhalt später geschützt ist (Suchorakel). | vorhanden: Ressourcen-IDs sind zufällig, aus `crypto.randomUUID` oder `crypto.getRandomValues` (`packages/domain/src/api.ts:119-136`); geplant: Zähler lückenlos ohne Inhalt, `protected` nur für Berechtigte (047, E17); Suche nur über lesbare Fragen (010, 047, Zielvorschlag) | B2 | geplant in Scheibe 047 („observer auf protected 403") | teilweise |
| T-G1-I-05 | Echo ungeprüfter Eingaben: Problem-Details geben den Header-Wert zurück (`apps/api/src/actor.ts:22, 26`, Probe P9); als JSON harmlos, aber ein Weg für Log- und Anzeige-Injektion. | vorhanden: unerwartete Fehler ohne Stack und ohne Details an den Aufrufer (`apps/api/src/problem.ts:9-16`), Typ `application/problem+json` (`apps/api/src/problem.ts:22-25`); vorhanden seit 033a: das Zugriffslog enthält weder Pfad noch Query noch Header noch Body noch Fehlermeldung, die `operationId` stammt aus dem Vertrag (`servers` je Pfad), die Korrelations-ID aus dem Dienst; geplant: `actor.ts` wird durch den Actor-Port ersetzt (029) | — | `apps/api/src/__tests__/negative.test.ts › 401: malformed X-Actor header (no role)`; `access-log033a.test.ts › survives hostile client strings`, `› maps a request to an operation only under the base URL its servers entry declares`; geplant in Scheibe 029 | teilweise |
| T-G1-I-06 | Fehlende Sicherheits-Header: Antworten des Dienstes tragen nur `content-type` (Probe P7; keine Header-Middleware in `apps/api/src/app.ts:126-148`), also kein `Cache-Control: no-store` für Entwürfe, keine CSP, kein Frame-Schutz; die Demo setzt drei Header, aber keine CSP (`netlify.toml:17-22`, `apps/web/index.html:1-13`). | vorhanden: Frame-Schutz, `nosniff` und `Referrer-Policy` für die Demo (`netlify.toml:20-22`); vorhanden seit 034a (Anteil Dienst): acht Header mit festen Werten (CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Resource-Policy`, `Cross-Origin-Opener-Policy`, `Strict-Transport-Security` ohne `includeSubDomains`/`preload`, `Cache-Control: no-store`) auf jeder Antwort der Anwendung, auch 408, 413, 429, 500, 503 und `notFound` (`apps/api/src/limits/middleware.ts`). **Benannte Ausnahme:** die leere 408-Antwort, die Node selbst bei `headersTimeout`/`requestTimeout` schreibt, erreicht Hono nicht und trägt keine Header (kein darstellbarer Inhalt); geplant: CSP für das Web-Dokument und CSP-Report im e2e-Lauf (037) | — | `apps/api/src/__tests__/contract.test.ts › 034a security headers` (Werte auf 200, 201, 302, 400, 401, 404, 408, 413, 422, 429, 500, 503; `no-store` genau einmal an den Anmeldepfaden; CORS und `Retry-After` in `exposeHeaders` auf 429) | teilweise (Dienst geschlossen, Web-Dokument 037) |
| T-G1-I-07 | Idempotenz-Replay als Leck: ein anderer Akteur sendet denselben `Idempotency-Key` und erhält das gespeicherte Ergebnis samt `_actions` des Erstakteurs. | vorhanden: Schlüssel gilt je Akteur und Operation, R-IDEM-01 (`packages/domain/src/api.ts:223-230`) | B9 | `packages/domain/src/__tests__/api.test.ts › R-IDEM-01: an idempotency key is scoped to actor and operation`; `apps/api/src/__tests__/negative.test.ts › idempotent replay is scoped to the actor (rework review blocker 3, domain rule R-IDEM-01)` | geschlossen |
| T-G1-I-08 | Unbeaufsichtigtes oder einsehbares Gerät (Erfassung, Beantwortung, Podium): Bildschirm und Browserspeicher zeigen unveröffentlichte Antworten; in der Demo bleibt das Log im `localStorage` des Geräts (`apps/web/src/api/index.ts:29-39`). | geplant: Leerlauf-Timeout, Abmelden, Sperren einer Sitzung (029); Offline-Puffer nur mit freigegebenen Antworten des eigenen Platzes (058); Szenario „Podiumsgerät verloren" (070, 078) | B15 | geplant in Scheibe 029 („gesperrtes Subject → 401") | offen |
| T-G1-I-09 | SSE-Strom als eigene Leseschnittstelle (`/v1/stream`, ADR 0014): (a) der Strom stellt Ereignisse ohne dieselbe Prüfung wie die Lesemethoden zu, etwa Entwurfsereignisse an `observer`; (b) ein Client setzt `Last-Event-ID` oder `after=seq` zurück und spielt Ereignisse über eine Rechtegrenze hinweg ab — aus einem fremden Jahrgang, aus der Zeit vor einem Rollenentzug oder zu Fragen, die inzwischen `protected` sind; (c) ein offener Strom liefert nach Abmelden, Sitzungsablauf, Sperre (Kill-Switch) oder Rollenentzug weiter Inhalte. Heute gibt es keinen Strom über HTTP (`apps/api/src/app.ts:312-313`); das Abonnement im Prozess filtert nicht (`packages/domain/src/api.ts:536-538`), und `/v1/events` liefert jedem Akteur alles (`packages/domain/src/api.ts:523-525`). | geplant: Rechteprüfung im Strom wie bei den Leserechten aus 010, Jahrgangsfilter, Wiederaufnahme über `after=seq` (035); Prüfung bei jeder Zustellung gegen die aktuellen Rechte statt gegen die beim Verbindungsaufbau, Wiederaufnahme nur über lesbare Ereignisse (035, Zielvorschlag); Strom schließen bei Abmelden, Sitzungsablauf, Sperre und Rollenentzug (035 mit 029, Zielvorschlag) | B1, B2, B10 | geplant in Scheibe 035 („observer erhält keine Entwurfsereignisse"); Stand 035a: Domäne gebaut, Dienst in 035b — R-PERM-04 in `packages/domain/src/stream.ts` (`visibleMessages`, `replayMessage`, `resolveReaderActors`), Tests `packages/domain/src/__tests__/stream035.test.ts` 3 (Sichtbarkeitstabelle), 4 (observer erhält keine Entwurfsereignisse), 5, 6, 7, 9 (Nachlauf, zu b), 10 (Akteurkarte, zu c); Stand 035b: Dienst gebaut (`apps/api/src/stream/`), Review offen — zu (a) R-PERM-04 je Zustellung aus der Projektion des Verteilers, Tests `apps/api/src/__tests__/stream035.test.ts` 13, 13a, 14, 22; zu (b) Nachlauf höchstens 1000, Nichtadmins nur `change` oder `reset`, Tests 13c, 14, 15, 20; zu (c) Akteurkarte und frische Sitzungsprüfung je Stapel und Heartbeat, Tests 16, 17, `postgres-stream035.test.ts` 26, 27; Kette nur mit eigener Kontinuitätsprüfung, Tests 23, 23b, 25, 25b, 25c | offen |
| T-G1-I-10 | Kennzahlen ohne Berechtigung: `/metrics` ist eine Route außerhalb `/v1` ohne Sitzung; ein Aufruf ohne oder mit falschem Token, ein Token gleicher Länge oder ein Dienst ohne konfigurierten Token liefert Betriebskennzahlen an Unbefugte; ein Aufruf löst vor der Prüfung einen Speicherzugriff aus. | vorhanden seit 033b: Bearer-Prüfung gegen `HV_METRICS_TOKEN` (mindestens 32 Zeichen, `timingSafeEqual` über SHA-256-Digests) vor jedem Speicherzugriff; ohne konfigurierten Token antwortet jeder Aufruf 401; der Token steht in keiner Logzeile, die Zugriffslog-Zeile trägt `subjectHash: null` | B1, B5 | `apps/api/src/__tests__/metrics033b.test.ts › answers 401 without Authorization, with a wrong token, with a token of the same length`, `› answers 401 for every call without a configured token …`, `› does not ask the store before the token is checked …`, `› writes the token into no access log line and no process log line` | geschlossen |
| T-G1-D-01 | Erschöpfung durch Anfragen: kein Rate-Limit, kein Body-Limit, kein Timeout; ein 2-MB-Redebeitrag wird angenommen und dauerhaft ins Log geschrieben (Probe P8). Der Body wird ganz gelesen (`apps/api/src/http.ts:11-19`); die einzige Längengrenze im Vertrag gilt dem Idempotenzschlüssel (`packages/contract/openapi.yaml:505`). | vorhanden seit 034a: Rate-Limit je Subject (60 Schreibvorgänge und 1 200 Lesevorgänge je Fenster von 60 s, Schlüssel `subjectHash`, 429 mit `Retry-After`, `/auth/logout` ausgenommen), Quellschicht vor Anmeldung und Datenbank (nicht angemeldet 600, Proben 600, Preflights 1 200 je Quelle; mit gefälschtem Cookie zählt jede Antwort ohne Subject nachträglich, auch 2xx/3xx, 403, 422, 400; bei erschöpfter Quelle ersetzt 429 jede Antwort ab Status 400, 2xx/3xx nie, damit der 302 des Callbacks keine verwaiste Sitzung hinterlässt), Body-Limit 262 144 Byte (413), Request-Timeout 10 s (408, im Postgres-Pfad „nichts festgeschrieben“), `maxLength`/`maxItems` im Vertrag 0.3.10, Node `headersTimeout`/`requestTimeout`. Restrisiko: gefälschtes, wohlgeformtes Cookie kostet je Anfrage eine Sitzungslesung (und wird bis 600 je Fenster und Quelle bedient); Node prüft `headersTimeout` nur im Intervall `connectionsCheckingInterval` (auf 5 s gesenkt, wirksam 10 bis 15 s); CSRF-403 bekannter Subjects ungezählt (Kosten zwei Sitzungslesungen und eine Log-Zeile mit `subjectHash`); mehrere Prozesse vervielfachen die Grenzen; Ziel Proxy-Grenze (037). Der Demo-Pfad im Browser validiert nicht gegen den Vertrag (Kernprüfung 043) | B10, B11 | `apps/api/src/__tests__/limits034a.test.ts` (Subject-Grenzen, Body-Limit, Längengrenzen je Zeile der Tabelle, 408, 700 × 413 mit und ohne Cookie), `apps/api/src/__tests__/postgres-limits034a.test.ts` (408 ohne festgeschriebenes Ereignis, verzögertes COMMIT → 201, Abbruch nach Sperrerhalt) | teilweise (Dienst geschlossen; Proxy 037) |
| T-G1-D-02 | Unbegrenzter Idempotenzspeicher: jeder neue Schlüssel bleibt bis zum Neustart im Speicher des Dienstes (`packages/domain/src/api.ts:171, 223-230`); viele Schlüssel füllen ihn. | vorhanden: Schlüssellänge höchstens 128 (`packages/contract/openapi.yaml:505`); geplant: Idempotenz aus dem Log rekonstruiert (028); Ablauf und Obergrenze (028, Zielvorschlag) | B9 | `apps/api/src/__tests__/negative.test.ts › 422: an Idempotency-Key over 128 characters is rejected`; geplant in Scheibe 028 | teilweise |
| T-G1-D-03 | Vollabruf und lange Verbindungen im HV-Fenster: heute löst jede Änderung einen Vollabruf aus (`apps/web/src/api/useApiVersion.ts:10-16`); im Beta-Ziel hält jeder Client einen SSE-Strom, viele offene Ströme eines Subjects binden Verbindungen. | geplant: SSE mit Heartbeat (035), inkrementeller Client (036), Rate-Limit (034a, durch die Tests zu T-G1-D-01 abgedeckt), Begrenzung der Ströme je Subject (035, Zielvorschlag), Lasttest 50 + 15 (071) | B11 | geplant in Scheibe 071 („SSE-Latenz < 2 s"); Stand 035b: Heartbeat 15 s versetzt, 3 Ströme je Sitzung, 6 je Subject, 200 je Prozess, Rückstau 256 Nachrichten oder 1 MiB, Nachlauf mit Gegendruck, höchstens 2 Verbindungen für Sitzungsprüfungen, keine gehaltene Verbindung zwischen den Fenstern; Tests `apps/api/src/__tests__/stream035.test.ts` 12, 18, 19, 20, echter Server, `postgres-stream035.test.ts` 28, 29 (200 Ströme, 20 Schreibvorgänge) | offen |
| T-G1-D-04 | Öffentliche Probe als Verstärker: `/readyz` ist ohne Anmeldung erreichbar; jeder Aufruf könnte eine ausgehende NTP-Abfrage auslösen und den Dienst als Lastquelle gegen den Zeitserver nutzbar machen. | vorhanden seit 033a: höchstens eine NTP-Runde je 30 s (auch Fehlercodes werden zwischengespeichert), genau eine laufende Runde, höchstens drei Server, Gesamtbudget 1800 ms | B3 | `apps/api/src/__tests__/ntp033a.test.ts › sends one query for 100 calls within 30 s, and another after the interval` | geschlossen |
| T-G1-D-05 | Flutung des Anmeldestarts ohne Anmeldung: `GET /auth/login` schreibt je Aufruf eine Zeile in `auth_login_states` (Befund 029b major), ohne Obergrenze und ohne Aufräumen; die Tabelle füllt sich und je Aufruf entsteht eine IdP-Weiterleitung. | vorhanden seit 034a: jeder `GET /auth/login` zählt je Quelle (120) und gesamt (600 je Fenster), unabhängig von Cookie und `X-Actor`; bei erschöpftem Kontingent 429 vor `authorizationUrl` und `createLoginState` (kein Datenbank-, kein IdP-Zugriff); das Gesamtkontingent zählt nur je Quelle zugelassene Aufrufe, eine abgewiesene Quelle sperrt die anderen nicht; Aufräumen verbrauchter und abgelaufener Zeilen (höchstens 500 je Aufruf) durch die Funktion `auth_purge_login_states(p_now)` (Migration 0003, `SECURITY DEFINER`, fester `search_path`, `REVOKE … FROM PUBLIC` in der Migration, Katalogprüfung in `assertSchemaConsistent`), aufgerufen vor dem INSERT mit der Zeit der injizierten Uhr; ein Aufräumfehler blockiert die Anmeldung nicht (stderr: `HV-Tool API: login state purge failed.`, höchstens je Minute). **SC-08, benannte Ausnahme:** die Laufzeitrolle hat weiterhin kein DELETE-Recht auf irgendeiner Tabelle, aber EXECUTE auf genau dieser Funktion (geprüft in `assertRuntimePrivileges`); Restrisiko: eine kompromittierte Laufzeitrolle kann mit vorgestelltem `p_now` laufende Anmeldungen entfernen (Folge: erneutes Anmelden); ist die Owner-Rolle ein Superuser, läuft die Funktion mit deren Rechten (Trennung 037/038). Restrisiko MF-10: ein Innentäter hinter derselben Firmen-NAT-Adresse erschöpft das Anmeldekontingent des Hauses je Fenster (Erkennung stderr „sign-in start limit reached.“, Reaktion Wert anheben über 034b, Messung 071/078) | B10 | `apps/api/src/__tests__/limits034a.test.ts` (121. Aufruf → 429, auch mit Cookie und `X-Actor`; 601. gesamt), `apps/api/src/__tests__/postgres-limits034a.test.ts` (Aufräumfunktion, Katalog, Laufzeitrolle ohne DELETE mit EXECUTE, `assertRuntimePrivileges`-Negativfälle, `/readyz` vor Migration 3, Aufräumfehler) | offen bis Review |
| T-G1-E-01 | Umgehung der Oberfläche bei Schreibvorgängen: ein Akteur ruft eine schreibende Operation direkt auf, die die Oberfläche ihm nicht anbietet (z. B. `POST /v1/questions/{id}/classification` als `observer`). Lesende Operationen stehen in T-G1-I-01 (offen). | vorhanden: jeder Schreibvorgang prüft Recht und Übergangstabelle im Dienst (`packages/domain/src/api.ts:205-208, 241-257`); `_actions` ist nur Anzeige (`packages/domain/src/api.ts:158-161`); deny by default (`packages/domain/src/permissions.ts:54-60`); seit 012 hält das Rollenliteral-Tor Rollennamen aus Dienst und Domäne heraus (`scripts/role-literal-check.mjs:31-36`, `package.json:15`) | B2 | `apps/api/src/__tests__/negative.test.ts › 403: observer may read but not classify (deny reason carries a rule id)`; `packages/domain/src/__tests__/transitions.test.ts › deny by default: an unknown role has no permissions`; `packages/domain/src/__tests__/transitions.test.ts › matches the committed table — any change must be reviewed` | geschlossen |
| T-G1-E-02 | Selbstfreigabe: `legal` hält `answer.draft` und `question.approve` (`packages/domain/src/permissions.ts:33`), R-TRANS-05 hat keinen Guard „Ersteller ≠ Freigeber" (`packages/domain/src/transitions.ts:97-104`); dieselbe Kennung entwirft und gibt frei (Probe P5, `packages/domain/policy-truth-table.md:83`). | geplant: R-GUARD-06 Ersteller ≠ Freigeber, `legal` erhält `question.legal.clear` statt der Freigabe (021); personengenau erst mit Einzelidentitäten (029, B18) | B6 | geplant in Scheibe 021 („legal entwirft und versucht Freigabe → 409 R-GUARD-06") | offen |
| T-G1-E-03 | Rechtstor umgehen: `approver` gibt frei und stellt auf die Bühne, ohne dass Recht geprüft hat; R-TRANS-07 hat keinen Guard (`packages/domain/src/transitions.ts:112-118`, Rechte `packages/domain/src/permissions.ts:34-40`). | geplant: R-GUARD-07 mit `LEGAL_GATE_BY_TRACK`, zur Laufzeit nicht abschaltbar (021) | B6 | geplant in Scheibe 021 („stage ohne Rechtsfreigabe → 409 R-GUARD-07") | offen |
| T-G1-E-04 | Administration als Inhaltskonto: `admin` hielt alle Rechte (vor 040a `packages/domain/src/permissions.ts:74`) und konnte allein erfassen, entwerfen, freigeben und auf die Bühne stellen — im Widerspruch zum Rechtekonzept Abschnitt 4. | vorhanden seit 040a: ausdrückliche Liste ohne Ableitung (Lesen, Weiterleiten mit `question.assign`/`question.return`, `agenda.manage`, `admin.roles.manage`, `demo.seed`); keine Inhaltsrechte, kein `question.withdraw`; Wahrheitstabellen-Diff (63 ✓ → `·`) und neuer Abschnitt „Role × Wortmeldung, Erfassung und Demo“; keine Selbstzuordnung (R-ADM-07); Weiterleiten in der Historie mit Abzeichen „Administration“ hervorgehoben; Vier-Augen gilt auch für die Administration (021); geplant: `admin.override` nur mit Grund als Ereignis (040d) | B2, B6 | `packages/domain/src/__tests__/admin040a.test.ts` (Tests 1–9); `apps/api/src/__tests__/negative.test.ts › 403/409: admin over HTTP — content writes are R-PERM-01, reading works, self-assignment is R-ADM-07 (Scheibe 040a)`; `packages/domain/policy-truth-table.md`; geplant in Scheibe 040d („override erzeugt Ereignis mit Grund") | teilweise (Rest: Override mit Grund, 040d; zwei zusammenwirkende Verwaltungskonten, MF-01) |
| T-G1-E-05 | Kontext vom Client: ein Podiumsgerät markiert eine beliebige Frage der Warteschlange als vorgelesen, auch die eines anderen Bühnenplatzes und nicht die aktuelle (Probe P6); `deliverQuestion` kennt keinen Platz (`packages/domain/src/api.ts:478-484`, `packages/domain/src/transitions.ts:127-133`). | geplant: Kontext (Einheit, Platz, Vertraulichkeit) im Dienst aufgelöst, nie vom Client (047); Delivery mit Platz und Hash (049); Warteschlange je Platz (056) | B2, B7 | geplant in Scheibe 047 („Client behauptet einen fremden Platz → wird ignoriert") | offen |

### 5.2 G2 — Dienst ↔ Persistenz

| ID | Bedrohung (Beispiel) | Kontrolle | Beta | Test | Status |
|---|---|---|---|---|---|
| T-G2-S-01 | Fremder Prozess spricht als Dienstrolle mit der Datenbank (Zugangsdaten aus Konfiguration, Log oder Agentenkontext), oder der Dienst verbindet sich mit einer untergeschobenen Datenbank. Heute gibt es keine Datenbank; der Speicherort ist ein Pfad aus der Umgebung (`apps/api/src/app.ts:86-87`). | geplant: Secrets nur aus der Plattform, Eigentümer-Checkliste Secrets (037); Konfigurationsschema beim Start (034); verschlüsselte Verbindung zur Datenbank (027, Zielvorschlag) | B10 | geplant in Scheibe 037 | offen |
| T-G2-S-02 | Ereignis mit fremdem Akteur einschieben: wer die JSONL-Datei oder den `localStorage` beschreiben kann, hängt Ereignisse mit beliebigem `actor` und `at` an; beim Start werden sie ungeprüft übernommen (`apps/api/src/eventLog.ts:13-22`, `packages/domain/src/store.ts:23`, `apps/web/src/api/index.ts:20-27`). | geplant: Hash-Kette mit Prüfung beim Laden (024); Dienstrolle nur INSERT/SELECT (027) | B3 | geplant in Scheibe 024 („manipuliertes Ereignis → Ladefehler mit seq") | offen |
| T-G2-T-01 | Gespeichertes Ereignis ändern: der Text einer freigegebenen Antwort wird im Speicher nachträglich geglättet; das Ereignis hat weder Hash noch Kettenglied (`packages/domain/src/events.ts:16-24`). | vorhanden: der Code hängt nur an und überschreibt nie (`apps/api/src/eventLog.ts:23-31`, `packages/domain/src/store.ts:27-37`); geplant: Hash-Kette SHA-256 über kanonisches JSON (024); kein UPDATE/DELETE für die Dienstrolle, Kettenprüfung nach Neustart (027); Restore verifiziert die Kette (038); takt-033: Kettencache je App nur aus geprüften Datenbankzeilen, je Anfrage Digest der Datenbank (sha256) über alle Zeilen bis zum Prüfpunkt, sonst vollständige Prüfung; Erkennungszeitpunkt unverändert die nächste Anfrage | B3, B12 | `packages/domain/src/__tests__/api.test.ts › events are append-only and gap-free`; geplant in Scheibe 024, 027 | teilweise |
| T-G2-T-02 | Abgelehnter Schreibvorgang wird wirksam: scheitert das Schreiben der Datei (`apps/api/src/eventLog.ts:29`), steht das Ereignis schon im Log des Speichers (`packages/domain/src/store.ts:30-31`), die Projektion erhält es nicht (`packages/domain/src/store.ts:34-35`), der Aufrufer sieht einen Fehler; der nächste Schreibvorgang schreibt es mit (`apps/api/src/eventLog.ts:24-30`), nach einem Neustart gilt die abgelehnte Änderung (Probe S1–S3). | geplant: Postgres-Adapter bestätigt erst nach synchronem Commit (027); JSONL bleibt Entwicklungsadapter (027) | B3 | geplant in Scheibe 027 | offen |
| T-G2-T-03 | Lücke oder Duplikat in `seq` durch parallele Schreiber oder einen Absturz im Append; beim Laden wird `seq` nicht geprüft (`packages/domain/src/state.ts:93`). | vorhanden: `seq` = Loglänge + 1 in einem Prozess (`packages/domain/src/store.ts:30`); geplant: Vergabe unter Advisory-Lock (027); Kill mitten im Append (072) | B3 | `packages/domain/src/__tests__/api.test.ts › events are append-only and gap-free`; geplant in Scheibe 072 („seq-Lücken-/Duplikatprüfung nach Kill") | teilweise |
| T-G2-T-04 | Log über die Anwendung ersetzen (Seed über einen bestehenden Bestand). | vorhanden: Seed nur in ein leeres Log (`packages/domain/src/api.ts:529-531`), nur mit Recht `demo.seed` (`packages/domain/src/api.ts:527`), Endpunkt nur bei `HV_DEMO=1` (`apps/api/src/app.ts:300-303`) | B3 | `packages/domain/src/__tests__/api.test.ts › seeding twice is refused: the log is never replaced`; `apps/api/src/__tests__/negative.test.ts › 403: POST /v1/demo/seed is refused unless HV_DEMO=1` | geschlossen |
| T-G2-R-01 | Änderung am Speicher ohne Spur: Plattformbetreiber oder Datenbankadministration ändert oder entfernt Zeilen direkt; es entsteht kein Ereignis, und niemand bemerkt es, weil ungeprüft geladen wird (`packages/domain/src/store.ts:23`). | geplant: Kettenprüfung beim Laden und nach Neustart (024, 027); Jahrgangs-Export mit Hash-Liste (038); Log-Hash in der Niederschrift-Anlage (051). takt-033: mit Cache erkennt der Digest der Datenbank über das ganze gespeicherte Präfix eine Änderung an einer alten Zeile bei der nächsten Anfrage (nicht erst nach Neustart); eine gültige, aber geänderte oder gekürzte Kette (Rücksicherung oder Umschreibung) wird angenommen und mit einer festen stderr-Zeile ohne Inhalt gemeldet (offene Owner-Frage 1 der Spec, Standard b). Das Fenster zwischen Lesen und Einfügen für Änderungen mit Owner-Rechten außerhalb der Advisory-Sperre des Schreibers ist dasselbe wie auf dem vollen Pfad (Prüfwerte und neuere Zeilen kommen aus einer Abfrage, also einem Snapshot), und die vollständige Kettenprüfung beim nächsten Laden erkennt eine solche Änderung und scheitert laut | B3, B12 | geplant in Scheibe 027 („Hash-Kette nach Neustart verifiziert") | offen |
| T-G2-I-01 | Klartext im Speicher und in Kopien: Entwürfe, Rückgabegründe und Klarnamen stehen im Klartext im Log (`packages/domain/src/events.ts:36-47, 63-72`); die JSONL-Datei entsteht mit den Standardrechten des Prozesses (`apps/api/src/eventLog.ts:29`), die Demo schreibt in den `localStorage` (`apps/web/src/api/index.ts:34`); Backups enthalten dasselbe. | geplant: Personentabelle getrennt, `personId` statt Klarname (026); Payload-Teil `pii` mit `keyId` hinter dem Codec-Port (024); verschlüsselte Backups (037); bis E13/E14 nur synthetische Daten | — | geplant in Scheibe 026 („kein displayName in Ereignis-Payloads") | offen |
| T-G2-I-02 | Nutzdaten und Verbindungsdaten im Fehlerlog: unerwartete Fehler werden vollständig ins Prozesslog geschrieben (`apps/api/src/problem.ts:10`); mit einem Datenbanktreiber können darin SQL mit Fragetext oder Verbindungsparameter stehen. | vorhanden: der Aufrufer erhält keine Details (`apps/api/src/problem.ts:11-16`); vorhanden seit 033a: unerwartete Fehler erscheinen im Fehlerlog nur als eine JSON-Zeile mit `log`, `ts`, `requestId`, `errorClass` (keine Meldung, kein Stack, keine Treiberdetails), das Zugriffslog trägt keine Nutzdaten; vorhanden seit 034a: `statement_timeout`, `lock_timeout`, Abfrage-Timer und „Ergebnis unbekannt“ antworten mit festen Texten ohne Treibertext (`postgres-limits034a.test.ts`); geplant: Secrets nur aus der Plattform (037) | B5 | `apps/api/src/__tests__/access-log033a.test.ts › reduces the error log to four keys …`, `postgres-access-log033a.test.ts` (Treiberfehler mit Geheimnis) | teilweise |
| T-G2-D-01 | Speicher nicht erreichbar oder voll während der HV, und der Dienst merkt es erst beim nächsten Schreibvorgang: es gibt keinen Bereitschaftsendpunkt (Routen `apps/api/src/app.ts:154-310`). | vorhanden: `/readyz` mit Datenbank und Migrationsstand (027) und seit 033a mit NTP-Status (SNTP, höchstens 1800 ms je Runde, 30 s Zwischenspeicher, Codes `timeout`, `clock_unsynced`, `clock_drift`; Test `apps/api/src/__tests__/ntp033a.test.ts`); vorhanden seit 034a (Schreibwarteschlange): `lock_timeout` 3 s auf die globale Schreibsperre, `statement_timeout` 5 s, eigener Abfrage-Timer 6 s; Ablauf → 503 „Persistence is busy.“ mit `Retry-After: 2`, „Migrations are pending.“ mit `Retry-After: 30`, Timer während COMMIT → 500 „Persistence outcome is unknown.“ (Test `postgres-limits034a.test.ts`); Vorprüfungen und Readiness laufen unter dem Zeitgeber und verwerfen ihren Anschluss bei Ablauf; Pool mit `keepAlive` und `client_connection_check_interval=1000` (**Betriebsvoraussetzung: PostgreSQL 14 oder neuer**, sonst scheitert jede Verbindung mit einem unbekannten Parameter; Prüfung der Version beim Betrieb 037/038, CI nutzt 16); eine schon abgelaufene Anfrage nimmt weder Anschluss noch Schreibsperre. **Restrisiko:** ein durch den Zeitgeber zerstörter Anschluss kann die globale Schreibsperre bis zum Ende seiner Anweisung halten (höchstens `statement_timeout` 5 s; bei totem Netz bis zum Leerlauf-Timeout 15 s, bis das Verbindungsprüfintervall greift); weitere Schreibvorgänge antworten dann mit 503 → Messung im Lasttest 071, Betrieb 037; geplant: Alarm (037); RPO 0 und RTO 15 min (038, E22) | B3, B10 | geplant in Scheibe 027 („curl /readyz bei gestoppter DB → 503") | teilweise |
| T-G2-D-02 | Neustart dauert zu lang: die Projektion entsteht beim Start aus dem vollständigen Log (`packages/domain/src/api.ts:169-170`); im HV-Fenster zählt jede Minute. | geplant: Rebuild von 10 000 Ereignissen unter 5 min als Test, Snapshot optional (027); Failover-Drill (072) | B3, B15 | geplant in Scheibe 027 („Rebuild-Zeit im Bericht") | offen |
| T-G2-D-03 | Vollscan je Historienaufruf: `getQuestionHistory` filtert das ganze Log (`packages/domain/src/api.ts:406-409`); hinter `all()` (`packages/domain/src/store.ts:41-43`) läse ein Datenbankadapter bei jedem Aufruf die ganze Tabelle. | vorhanden seit 033b für `/metrics`: Ergebnis-Zwischenspeicher 10 s mit einer laufenden Berechnung, eigener Snapshot ohne Advisory-Lock; geplant: Leseweg je `subjectId` mit Index (027, Zielvorschlag); Lasttest und Messung der Scan-Kosten (071) | B11 | `apps/api/src/__tests__/metrics033b.test.ts › answers 20 queries within 10 s from one scan of the store`; `postgres-metrics033b.test.ts › reads one REPEATABLE READ READ ONLY snapshot without an advisory lock …`; geplant in Scheibe 071 | teilweise |
| T-G2-D-04 | Zugriffslog voll oder Senke nicht beschreibbar: die Anfrage darf nicht scheitern, aber der Ausfall des technischen Logs fiele unbemerkt an; ohne Senke fehlte im Vorfall der Nachweis. | vorhanden seit 033a: Schreibfehler der Senke werden abgefangen (die HV-Verfügbarkeit geht vor dem technischen Log), je Minute höchstens eine feste stderr-Zeile ohne Inhalt; Start ohne beschreibbares `HV_ACCESS_LOG_DIR` oder ohne `HV_ACCESS_LOG_HASH_KEY` außerhalb der Demo verweigert; geplant: Alarm auf Schreibfehler und Füllstand des Log-Datenträgers (037), Begrenzung nicht angemeldeter Anfragen je Quelle (seit 034a: 429 ab 601 je Fenster, auch für Anfragen mit gefälschtem, wohlgeformtem Cookie, deren Antwort 401, 403, 422 oder 400 wäre; eine 2xx/3xx-Antwort auf `/auth/callback` wird gezählt, aber nicht ersetzt; `/auth/transparency-notice` und `/metrics` lesen nie eine Sitzung und zählen unabhängig vom Cookie vorab als nicht angemeldet (429 ohne weitere Einzelzeile), weitere Abweisungen desselben Schlüssels im Fenster nicht einzeln protokolliert, stattdessen je Minute eine feste stderr-Summenzeile ohne Quelle; verteilte Quellen knapp unter der Schwelle erzeugen weiter Zeilen, Alarm auf den Füllstand 037). Keine Größengrenze je Tag, weil eine Flut sonst die späteren, relevanten Zeilen verwürfe | B3, B5 | `apps/api/src/__tests__/access-log033a.test.ts › answers the request, and writes at most one fixed stderr line per minute …`, `› start refusal without an access log`, `apps/api/src/__tests__/limits034a.test.ts › sources without a session …` (601.–700. ohne Zeile, Summenzeile 99, keine Quelle in Log oder stderr) | teilweise |
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
| T-G3-I-01 | Ereignisstrom gibt Geschütztes an Nachbarn: `/v1/events` ist als Strom für Nachbarsysteme beschrieben (`packages/contract/openapi.yaml:39`) und liefert jedem Akteur alles (`packages/domain/src/api.ts:523-525`); ein Abonnent erhielte Entwürfe und Rückgabegründe. | geplant: `event.read` nur für die Administration (010); Filter nach Leserecht des Systemakteurs, nie Notizen, nie `protected` (065); SSE mit denselben Leserechten (035) | B2 | geplant in Scheibe 065 („protected-Ereignis nicht zugestellt"); Stand 035a: Domäne gebaut, Dienst in 035b — SSE-Filter nach Leserecht (R-PERM-04, `packages/domain/src/stream.ts`), Tests `packages/domain/src/__tests__/stream035.test.ts` 3, 4, 7, 10; Stand 035b: der SSE-Dienst wendet denselben Filter je Zustellung an, Tests `apps/api/src/__tests__/stream035.test.ts` 13, 14, 22 | offen |
| T-G3-I-02 | Abfluss an einen KI-Anbieter (Fragetexte, Klarnamen, Entwürfe). | geplant: kein Anbieter in der Beta (E18); Adapter `none` antwortet 503 (066) | — | geplant in Scheibe 066 | offen |
| T-G3-I-03 | Alarmversand trägt Inhalte nach außen (Fragetext in einer Alarmnachricht, Personenbezug in der Betriebsauswertung). | vorhanden seit 033b: `/metrics` gibt genau die Familien aus `apps/api/src/metrics/catalog.json` aus (fünf fachliche Kennzahlen, eine technische Zählung ohne Labels); Kennzahlen-Allowlist-Tor `pnpm metrics-allowlist` in `pnpm gates` (rot bei Label außerhalb `meeting_id`/`unit_id`, bei Personenbezug im Namen oder Label auch mit Spec-Eintrag, bei `rate_limit`); geplant: Alarmweg (037); datenfreier Fehler-Beacon (058); kein Push und keine E-Mail in der Beta (085) | B5, B10 | `scripts/metrics-allowlist-check.test.mjs` (Fixtures: Label `subject_hash`, Name `hv_answers_per_actor`, `unit_id` plus `user` im Namen, `rate_limit`); `apps/api/src/__tests__/metrics033b.test.ts › contains no actor id, personId, subject id, display name or question text` | teilweise |
| T-G3-I-04 | Mehr IdP-Claims als nötig (Name, E-Mail, Gruppen) landen in Ereignissen und Logs. | vorhanden seit 033a: Subject-Hash (HMAC mit Schlüssel aus der Plattform) statt Klartext im Zugriffslog (`access-log033a.test.ts › hashes the actor id …`); vorhanden seit 033b: die Ausgabe von `/metrics` trägt nur Label-Namen aus dem Katalog, und der Katalog nur `meeting_id`, `unit_id`; geplant: pseudonyme Subject-ID; Personentabelle (026); IdP-Gruppen nur als Vorschlag in `/auth/me` (029) | B5 | `apps/api/src/__tests__/metrics033b.test.ts › serves text/plain 0.0.4 with the catalog families in order and labels within the catalog`; geplant in Scheibe 026 („kein displayName in Ereignis-Payloads") | teilweise |
| T-G3-I-05 | Aktienregister liefert mehr Personendaten als nötig (Bestand, Anschrift), die im Log landen. | geplant: Lookup-Port mit Adapter `local` über die Personentabelle, Klarname nur per protokolliertem Aufdecken (067); Push-Adapter und Legitimation in der B-Liste | — | geplant in Scheibe 067 („expert sieht Pseudonym") | offen |
| T-G3-D-01 | Nachbar fällt aus oder hängt und blockiert den Kernprozess (IdP nicht erreichbar, Register antwortet nicht, Transkription liefert nichts). | geplant: Notfallkonten bei IdP-Ausfall (029); Klärungs-Queue bei Registerausfall (067); Datei-Import statt Push (064); Request-Timeout (034a; Anmeldepfade mit OIDC-Frist 5 s je Abruf, Ablauf → 503 ohne Sitzung, Test `limits034a.test.ts › sign-in paths keep their own upper bounds`); Papierpfad (068, 070) | B1, B10 | geplant in Scheibe 072 („IdP nicht erreichbar → Anmeldung über Notfallkonto mit Alarm") | offen |
| T-G3-D-02 | Flut vom Nachbarn: tausende Segmente je Minute oder ein langsamer Webhook-Empfänger stauen den Dienst. | geplant: Rate-Limit auch für Systemakteure (034a: Subject-Grenzen gelten für jeden Akteur unabhängig von der Rolle, `limits034a.test.ts`, kein Rollenname im Code); Idempotenz je `segmentId` (064); Wiederholung mit Grenze (065) | B11 | geplant in Scheibe 064 | offen |
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
| T-Q-R-01 | Auslieferung ohne nachvollziehbares Go: der Produktions-Build der Demo läuft bei jedem Push ohne Überspring-Marke im Commit-Betreff (Deploy-Previews und Branch-Deploys überspringt seit takt-022 der `ignore`-Befehl, `netlify.toml:5-7`) und prüft nur Typen und Build, nicht die Tore (`netlify.toml:3`); das Go ist heute eine organisatorische Übergangsregel (ADR 0016). | geplant: Deploy nur über ein Approval-Environment mit Protokoll, Freeze-Regel (037); Taktfläche nach E35 | B10 | geplant in Scheibe 037 („Deploy im Freeze-Fenster → abgelehnt") | offen |
| T-Q-R-02 | Handeln einer Agentensitzung ohne Spur (lokale Befehle, Netzaufrufe). | vorhanden: jeder Commit nennt die Scheibe (AGENTS.md Regel 12); ein Hook sperrt wenige gefährliche Befehle (`.claude/settings.json:3-13`), protokolliert aber nichts; geplant: Berichtsformat-Hook, Stop-Hook mit Testlauf, Sperre für `.env` und ausgehende Netzaufrufe (016) | B13 | geplant in Scheibe 016 („Protokoll eines blockierten Stop-Versuchs") | teilweise |
| T-Q-I-01 | Secrets in Repositorium, Artefakt, Log, Screenshot oder Agentenkontext. Heute stehen keine Secrets in versionierten Dateien (Suche ohne Treffer); CI lädt Screenshots und den Playwright-Bericht als Artefakt hoch (`.github/workflows/gates.yml:94-101`). | vorhanden: `.env` ist ausgeschlossen (`.gitignore:4-6`); nur synthetischer Korpus (`packages/domain/src/seed.ts:1-7`); seit 012 gitleaks über den Diff und nachts über das ganze Repositorium (`.github/workflows/gates.yml:81-85`, `.github/workflows/nightly.yml:25-29`) und eine Semgrep-Regel gegen Zugangsdaten als Literal (`scripts/semgrep/rules.yml:77-102`); die gitleaks-Konfiguration lief noch nie gegen das echte Programm (`scripts/gitleaks.toml:11-14`); geplant: Secrets nur aus der Plattform und Eigentümer-Checkliste (037); Hook gegen `.env`-Zugriff (016) | B13 | geplant in Scheibe 037; für den Job `e2e-http` 031a: `scripts/e2e-http-031.test.mjs` (Zufallswerte je Lauf, `--check` gibt keinen Marker-Wert aus, `trace` und `video` aus, kein `html`-Reporter, Job ohne Bericht-, Trace- und Video-Upload) | teilweise |
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
| 033a Serverzeit, Health, NTP, Zugriffslog | T-G2-I-02, T-G1-D-04, T-G2-D-04 | T-G1-R-01, T-G3-I-04, T-G2-D-01, T-G1-T-07, T-G1-I-05 |
| 033b Kennzahlen, Allowlist-Tor, Auswertungskatalog | T-G3-I-03, T-G1-I-10 | T-G3-I-04, T-G2-D-03, T-G1-I-01 (SC-03: nur Zählungen) |
| 034a Grenzen, Timeouts, Sicherheitsheader, Aufräumen der Login-Zustände | T-G1-D-01, T-G1-D-05, T-G1-I-06 | T-G1-T-06 (CSP am Dienst), T-G2-D-04, T-G2-D-01, T-G2-I-02, T-G3-D-01, T-G3-D-02, T-G1-D-03 |
| 034b Konfiguration, CORS-Allowlist, Proxy-Quelle | T-Q-T-04, T-G2-E-02 | T-G1-T-05 (CORS), T-G1-D-05 (Quelle hinter Proxy) |
| 035 SSE | T-G1-I-09 | T-G1-D-03 (Heartbeat, Ströme je Subject), T-G3-I-01 (Filter nach Leserecht) |
| 037 Container, Pipeline (geteilt: 037a lokales Betriebspaket, 037b Pipeline und Staging) | T-G2-S-01, T-Q-R-01, T-Q-D-01, T-Q-E-03 | T-Q-S-02, T-Q-I-01, T-Q-I-02, T-Q-I-04, T-Q-D-02, T-G1-T-06; 037a: T-G2-E-02, T-G1-D-01 (Proxy-Teil), T-G1-S-02, T-G1-D-05, T-G2-T-04, T-Q-T-04 |
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
| 040 Administration im Kern (040a: Inhaltsrechte, R-ADM-07, R-ADM-08; Rest 040b–d) | T-G1-E-04 (Inhaltsteil mit 040a; Override 040d) | MF-01 |
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
  (026); seit 040a keine Selbstzuordnung (R-ADM-07, 409, kein Ereignis) — der Weg „sich `approver` zuordnen,
  eigene admin-Zuordnung entziehen, freigeben“ ist für eine einzelne Person geschlossen; die letzte tragfähige
  Verwaltungsrolle ist nicht entziehbar (R-ADM-08; tragfähig heißt: nicht entzogen, ohne Ablauf oder Ablauf ≥ 24 h,
  und die Zuordnung, die die Sitzung des Subjects tatsächlich wählt — die älteste aktive über alle nicht
  geschlossenen Jahrgänge; eine Verwaltungsrolle hinter einer älteren Zuordnung desselben Subjects zählt nicht); Änderungen nach dem Konfigurationsfreeze nur mit
  `admin.override` und Grund (040d). **Offen:** zwei Verwaltungskonten, die einander Rollen geben, und eine Person
  mit zwei Subjects.
- *Erkennung:* Alarm (085) mit Zielrecht `admin.roles.manage` bei Zuordnung eines Freigabe- oder Rechtsrechts
  nach dem Freeze und bei Zuordnung und Entzug innerhalb eines Tages (Zielvorschlag für 040); die Selbstzuordnung
  verhindert R-ADM-07 seit 040a, ein verweigerter Versuch steht als 409 mit R-ADM-07 im Zugriffslog (033a); der
  Freeze-Hash im Kopf (041) ändert sich sichtbar.
- *Nachweis:* 040a: `packages/domain/src/__tests__/admin040a.test.ts` (Test 7 R-ADM-07, Test 8 R-ADM-08),
  `apps/api/src/__tests__/negative.test.ts` (Selbstzuordnung über HTTP → 409 R-ADM-07); geplant in Scheibe 040b
  bis 040d („Stammdatenänderung nach Freeze → 409 R-ADM-03"), 026 („abgelaufene Rolle → 403").

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
  (legal und dieselbe id unter anderer Rolle → 409 R-GUARD-06, kein Ereignis; `_actions` ohne Freigabe),
  `apps/api/src/__tests__/negative.test.ts` (409 über HTTP). Seit 040a hält admin weder `answer.draft` noch
  `question.approve`: der Fall „admin entwirft und gibt frei“ in `api.test.ts` antwortet 403 R-PERM-01; der Weg über
  eine Selbstzuordnung ist durch R-ADM-07 geschlossen (`admin040a.test.ts` Tests 3, 7 und 9).

**MF-08 Demo-Schalter in Staging** (029, 034, 042)
- *Ablauf:* bei einem Deploy bleibt `HV_DEMO=1` gesetzt; Seed-Endpunkt und Header-Identität sind offen.
- *Verhindert durch:* T-Q-T-04, T-G1-S-01; Startabbruch bei `HV_DEMO=1` mit Issuer (gebaut in 029a, Test
  `apps/api/src/__tests__/demo-lock.test.ts`; ohne `HV_DEMO=1` wird `X-Actor` nicht gelesen), Konfigurationsschema
  (034), Seed nur in `training` (042).
- *Erkennung:* seit 034b nennt die Startzeile die Betriebsart (`mode demo` oder `mode service`); der Health-Smoke nach
  dem Deploy vergleicht sie mit der erwarteten (Zielvorschlag für 037); Banner je Modus (042).
- *Nachweis:* geplant in Scheibe 029 („HV_DEMO=1 mit Issuer → Start verweigert"), 042 („seed im Modus live →
  403"); seit 034b `config034b.test.ts` (Startzeile, Demo mit Issuer, `HV_EVENT_LOG` nur in der Demo, Anmeldung alles oder nichts).
- *Ausnahme (Erkennung):* der automatische Vergleich der Startzeile fehlt bis 037; Eigentümer technischer Betrieb, Ablauf mit
  Merge von 037, spätestens 30.10.2026.

**MF-12 Test-Hintertür im Produktpfad** (031a)
- *Ablauf:* um die `http`-Suite grün zu bekommen, fügt jemand einen Testschalter in Dienst oder Oberfläche ein (Anmeldung überspringen,
  eine Variable `HV_E2E_*`, Cross-Origin für `http:` außerhalb der Demo, angehobene Grenzen im Standard) oder übernimmt die Test-Umgebung in Staging.
- *Verhindert durch:* „Files allowed“ von 031a ohne Produktcode (außer einem Unit-Test); nur öffentliche Konfiguration innerhalb der
  Schema-Bereiche; die Werte stehen nur im Harness, nicht in `.env.example`; die Dienstumgebung ist ausdrücklich und wird gegen eine
  Positiv- und eine Verbotsliste geprüft.
- *Erkennung:* Startzeile und stderr im Harness wörtlich geprüft (eine unbekannte Variable erzeugt `ignoring unknown variables`, der Lauf ist rot);
  der Reviewer prüft SC-12 über `.github/**` und `scripts/**`; Staging gegen die Eigentümer-Checkliste (037). *Signal und Empfänger:* roter Job
  `e2e-http`, Orchestrator und Reviewer. *Ausnahme:* keine.
- *Nachweis:* `scripts/e2e-http-031.test.mjs` (Verbotsliste, Positivliste, kein `HV_E2E_`), Harness-Stufe 4.

**MF-11 Fremde Herkunft in der CORS-Allowlist** (034b)
- *Ablauf:* jemand trägt beim Deploy eine fremde oder zu weite Herkunft in `HV_CORS_ORIGINS` ein, damit eine fremde
  Seite im Browser einer angemeldeten Person Antworten lesen kann.
- *Verhindert durch:* keine Platzhalter, kein `null`, außerhalb der Demo nur `https:`, höchstens 10 exakte Herkünfte,
  `SameSite=Lax`-Cookie und CSRF-Token (029b).
- *Erkennung:* die Startzeile listet die erlaubten Herkünfte; der Betrieb prüft sie beim Deploy gegen die
  Eigentümer-Checkliste (037). Signal und Empfänger: Startzeile im Plattformprotokoll, technischer Betrieb; bis 037 manuell beim
  Tagesstart. Ausnahme: fehlender automatischer Vergleich, Eigentümer technischer Betrieb, Ablauf mit Merge von 037,
  spätestens 30.10.2026.
- *Nachweis:* `apps/api/src/__tests__/cors034b.test.ts`, Startzeilen-Test in `config034b.test.ts`.

**MF-09 Leistungsauswertung über das Zugriffslog** (033a; verwandt MF-02, dort ist das Zugriffslog nur Erkennungsweg)
- *Ablauf:* eine Person im technischen Betrieb, die zugleich im Tool `event.read` hat, will die
  Arbeitsgeschwindigkeit einer Kollegin ablesen. Sie gleicht `seq` der Log-Zeilen mit der Vorgangshistorie ab und
  erhält so ohne Schlüssel die Actor-ID je `subjectHash`, danach Latenzen und Uhrzeiten aller Anfragen dieses Hashs.
- *Verhindert durch:* keinen technischen Riegel in 033a, ehrlich benannt. Organisatorisch durch das Verfahren
  „Auswertung nur zu zweit“ (ADR 0013) einschließlich des `seq`-Abgleichs, Lesezugriff auf die Dateien nur im
  technischen Betrieb (Modus 0600), keine Auswertungswerkzeuge, 30 Tage Aufbewahrung. Technisch mit 047
  (`AuditAccessGranted` für personenbezogene Felder der Historie).
- *Erkennung:* bis 047 keine technische, nur das Protokoll in der Betriebsakte des Eigentümers.
- *Nachweis:* 033a: `apps/api/src/__tests__/access-log033a.test.ts` (exakte Schlüsselmenge, Zeile ohne Fragetext
  trotz Body); Sperrtest folgt mit 047.

**MF-10 Flutung ohne Anmeldung** (034a; verwandt MF-09)
- *Ablauf:* eine Person im internen Netz oder mit Zugang zur Staging-Adresse ruft `GET /auth/login` und beliebige Pfade in einer
  Schleife auf, auch mit gefälschten Sitzungscookies. Ohne 034a entstünde je Anmeldestart eine Datenbankzeile und eine
  IdP-Weiterleitung, je Anfrage eine Zugriffslog-Zeile; Tabelle und Log-Datenträger liefen voll, die Anmeldung der
  Arbeitsplätze am HV-Tag würde langsam.
- *Verhindert durch:* T-G1-D-05 (Grenzen je Quelle und gesamt für jeden je Quelle zugelassenen Anmeldestart, Aufräumen), die Quellschicht vor
  Authentifizierung und Datenbank (429 statt jeder Fehlerantwort ab Status 400 bei erschöpftem Kontingent, auch bei gefälschtem Cookie; der 302 des Callbacks wird gezählt, nie ersetzt; Pfade ohne Sitzungslesung zählen vorab, cookieunabhängig), die Protokollausnahme (Summenzeile statt
  Einzelzeilen), Body-Limit 413 und Request-Timeout 408.
- *Verfügbarkeitsfolge, benannt:* dieselbe Person hinter der Firmen-NAT-Adresse erschöpft das Anmeldekontingent des
  ganzen Hauses für jeweils ein Fenster; neu hinzukommende Quellen teilen unter einer Adressflut den Überlaufschlüssel;
  bestehende Sitzungen arbeiten weiter.
- *Erkennung:* feste stderr-Zeilen „anonymous rate limit reached; N repeated rejections not logged individually.“ und
  „sign-in start limit reached.“ (je Minute höchstens eine, ohne Quelle und ohne Person) und die erste 429-Zeile je Quelle
  und Fenster im Zugriffslog (`status` 429, `subjectHash` null); keine Kennzahl je Person (ADR 0013).
- *Reaktion:* Wert über 034b anheben und neu starten, vertrauenswürdige Proxys setzen (034b), Quelle am Proxy sperren (037).
  *Signal und Empfänger:* bis 037 liest der technische Betrieb stderr beim Tagesstart und im HV-Fenster; mit 037 alarmiert die
  Betriebsauswertung. *Ausnahme mit Eigentümer und Ablauf:* fehlende Alarmierung, Eigentümer technischer Betrieb, Ablauf
  mit Merge von 037, spätestens 30.10.2026. *Messung:* Anmeldespitze in 071 und 078.
- *Nachweis:* `apps/api/src/__tests__/limits034a.test.ts` (Tests zu T-G1-D-05 und T-G2-D-04).

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
| BF-05 | G1 | Kein Rate-Limit, kein Body-Limit, kein Timeout (`apps/api/src/http.ts:11-19`, `apps/api/src/app.ts:126-148`); 2-MB-Text angenommen (Probe P8). | mittel | 034a | Anteil Dienst behoben (034a); Rest: Proxy-Grenze 037 |
| BF-06 | G1 | Keine Sicherheits-Header am Dienst (`apps/api/src/app.ts:126-148`, Probe P7); keine CSP für die Demo (`netlify.toml:17-22`, `apps/web/index.html:1-13`). | mittel | 034a, 037 | Anteil Dienst behoben (034a); Web-Dokument 037 |
| BF-07 | G1 | Unbekannte Felder gelangen ins Log (`packages/domain/src/api.ts:338, 421`, `apps/api/src/contractSchema.ts:25`, `packages/contract/openapi.yaml:701-711`; Probe P4). | mittel | 023, 024 | offen |
| BF-08 | G1 | „Vorgelesen" ohne Bindung an Platz und aktuelle Frage (`packages/domain/src/api.ts:478-484`, `packages/domain/src/transitions.ts:127-133`; Probe P6). | mittel | 047, 049 | offen |
| BF-09 | G1 | `admin` hielt alle Rechte einschließlich Entwurf und Freigabe (vor 040a `packages/domain/src/permissions.ts:74`); Widerspruch zum Rechtekonzept Abschnitt 4 (kein ADR). **Geschlossen (040a):** ausdrückliche Liste ohne Inhaltsrechte (`admin040a.test.ts` Tests 1–3, Wahrheitstabellen-Diff). Das Aussperren durch Entzug der letzten Verwaltungsrolle verhindert R-ADM-08; als Rückhalt zählt nur eine Verwaltungszuordnung, die die Sitzung ihres Subjects auch wählt (älteste aktive über alle nicht geschlossenen Jahrgänge, wie `apps/api/src/actor.ts`; Test 8, `apps/api/src/__tests__/admin040a.test.ts`). Ablauf und Jahrgangsschluss beenden Zuordnungen weiter ohne Entzug (Grenze der Spec, Ziel 3). | mittel | 040a, 021 | geschlossen |
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
| BF-20 | Q | Der Produktions-Build der Demo läuft ohne Tore bei jedem Push ohne Überspring-Marke (`netlify.toml:3`; Previews seit takt-022 übersprungen, `netlify.toml:5-7`); das Go ist nur organisatorisch (ADR 0016, E35). | mittel | 037, E35 | offen |
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
