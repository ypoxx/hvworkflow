# Scheibe 034b — Konfigurationsschema, .env.example und CORS-Allowlist

**Status:** spec (nach Lesebefund 29.09.2026 nachgebessert)
**Risikoklasse:** hoch · 1 AStd · 28.10.2026 (W5) · Lanes: service, manifests, infra, docs-sicherheit
**Rolle:** Implementierer-Backend; unabhängiges Review in frischem Kontext mit Perspektive Security/Betrieb, zusätzlich Sicherheits-Checkliste des Reviewers (SC-01, SC-05, SC-06, SC-10, SC-11, SP-3, SP-5, SP-6) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue fachliche Regel, keine Änderung an `ROLE_PERMISSIONS` oder der Übergangstabelle; AGENTS.md R4 (Rechte), R8 (Zeit aus der injizierten Uhr), R11 (keine Zugangsdaten, keine echten Daten)
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/034b (Teil 2 der am 29.09.2026 geteilten Scheibe 034); Befund 033a R1 nit (`docs/folgeliste.md`: Rechte des Log-Verzeichnisses); Bedrohungsmodell Abschnitt 6 Zeile 034 (T-Q-T-04, T-G2-E-02, T-G1-T-05), MF-08; ADR 0004 (Demo-Verriegelung), ADR 0013; Leitplanken §4, 6.8, 6.12
**Depends on:** 034a (muss vor Baubeginn gemergt sein)
**Perspektive:** Security/Betrieb · **Glossar: neue Begriffe:** nein

## Warum geteilt

Siehe `docs/slices/034a-grenzen-timeouts-sicherheitsheader.md`, Abschnitt „Warum geteilt“. 034b prüft den
Prozessstart: jede Variable des Dienstes läuft durch ein Schema, bevor ein Socket geöffnet wird. Dazu gehört, welchen
Proxys der Dienst die Quelladresse glaubt (Punkt 8). Die Grenzen und
Timeouts aus 034a werden hier konfigurierbar, ihre Standardwerte ändern sich nicht.

## Ziel und Entscheidungen vor Bau

Offene Punkte sind auf Standard gebaut und als solche markiert.

1. **Ein Schema, eine Stelle.** Neues Modul `apps/api/src/config/schema.ts` mit zod (neue Abhängigkeit `zod`, exakt
   gepinnte Version, MIT-Lizenz, im Lockfile; SC-10: Nutzen = Planvorgabe „typisiertes Konfigurationsschema (zod)“,
   Pflege aktiv, keine transitiven Laufzeitabhängigkeiten). Exportiert `readServiceConfig(env)` → typisiertes,
   eingefrorenes Objekt, oder wirft `ConfigError` mit einer Liste fester Sätze. `server.ts` ruft es als Erstes auf; bei
   Fehler schreibt es jeden Satz auf stderr und beendet mit Exit 1. Jeder Satz hat die Form
   `HV-Tool API: refusing to start: <VARIABLE> <Regel>.` und nennt **nie** einen Wert (auch nicht gekürzt). Die drei
   Sätze aus 033a (`REFUSE_DIR`, `REFUSE_KEY`, `REFUSE_RETENTION`) bleiben wörtlich gleich.
2. **Erfasste Variablen** (alle, die `apps/api/src` außerhalb der Migrations-CLI liest, plus die neuen):
   `PORT` (1–65535, Standard 8787); `HV_DEMO` (`1` oder fehlend; jeder andere Wert, auch `0`, verweigert den Start —
heute wirkt `HV_DEMO=0` wie „aus“, künftig ist es ein Fehler, im Bericht nennen); `HV_DATABASE_URL`; `HV_EVENT_LOG`; `HV_DB_TLS`
   (`0`/`1`); `HV_OIDC_ISSUER`, `HV_OIDC_CLIENT_ID`, `HV_OIDC_CLIENT_SECRET`, `HV_OIDC_REDIRECT_URI`,
   `HV_AUTH_ENCRYPTION_KEY` (base64url, genau 32 Byte); `HV_TRANSPARENCY_NOTICE_VERSION`/`_DE`/`_EN`,
   `HV_DSFA_SUMMARY_URL`; `HV_SEED_ACTOR`; `HV_ACCESS_LOG_DIR`, `HV_ACCESS_LOG_HASH_KEY`,
   `HV_ACCESS_LOG_RETENTION_DAYS` (033a); `HV_NTP_SERVERS`, `HV_CLOCK_MAX_DRIFT_MS` (033a); `HV_METRICS_TOKEN` (033b);
   neu: `HV_CORS_ORIGINS`, `HV_TRUSTED_PROXY_CIDRS` (Standard leer), `HV_REQUEST_TIMEOUT_MS` (7 000–60 000, Standard
   10 000; Minimum über dem `/readyz`-Budget von 3 × 2 000 ms), `HV_RATE_LIMIT_WRITES_PER_MIN` (1–10 000, Standard 60),
   `HV_RATE_LIMIT_READS_PER_MIN` (60–100 000, Standard 1 200), `HV_RATE_LIMIT_ANON_PER_MIN` (10–100 000, Standard 600),
   `HV_RATE_LIMIT_LOGIN_PER_MIN` (1–10 000, Standard 120), `HV_RATE_LIMIT_LOGIN_GLOBAL_PER_MIN` (10–100 000, Standard
   600), `HV_RATE_LIMIT_PROBES_PER_MIN` (10–100 000, Standard 600), `HV_RATE_LIMIT_PREFLIGHT_PER_MIN` (10–100 000,
   Standard 1 200), `HV_DB_STATEMENT_TIMEOUT_MS` (500–60 000, Standard 5 000), `HV_DB_LOCK_TIMEOUT_MS` (100–60 000,
   Standard 3 000), `HV_DB_QUERY_TIMEOUT_MS` (1 000–60 000, Standard 6 000), `HV_DB_IDLE_TX_TIMEOUT_MS`
   (1 000–600 000, Standard 15 000). Das Body-Limit (256 KiB) bleibt fest. Die Standardwerte sind die aus 034a
   (dort begründet, Verfügbarkeitsabwägung).
3. **Regeln über mehrere Variablen.** `HV_DATABASE_URL` und `HV_EVENT_LOG` schließen sich aus (heute ein `throw` in
   `server.ts`). `HV_DEMO=1` mit `HV_OIDC_ISSUER` → Start verweigert (ADR 0004; die Prüfung in `createApp` bleibt als
   Bibliotheksschutz, `demo-lock.test.ts` unverändert). Anmeldung ist **alles oder nichts**: ist eine der Variablen
   `HV_OIDC_*` oder `HV_AUTH_ENCRYPTION_KEY` gesetzt, müssen alle fünf gültig gesetzt sein, dazu `HV_DATABASE_URL` und
   der vollständige Transparenzhinweis; sonst Start verweigert (fängt Tippfehler, statt still mit 401 zu laufen). Keine
   davon gesetzt und kein Demo-Modus → Start wie heute mit der festen Warnung „no complete sign-in configuration“.
   Issuer und Redirect-URI: `https:`, ausgenommen Loopback-Hosts (`localhost`, `127.0.0.1`; genau die, die `createOidcFlow` in `apps/api/src/auth/oidc.ts` heute zulässt, kein `[::1]`) für
   Keycloak-CI und Entwicklung; kein Benutzer/Passwort in der URL. Zeitgrenzen:
   `HV_DB_LOCK_TIMEOUT_MS` < `HV_DB_STATEMENT_TIMEOUT_MS` < `HV_DB_QUERY_TIMEOUT_MS` < `HV_REQUEST_TIMEOUT_MS` <
   `HV_DB_IDLE_TX_TIMEOUT_MS` (wie 034a).
4. **Pfade (T-G2-E-02).** `HV_EVENT_LOG` nur mit `HV_DEMO=1` (JSONL ist Entwicklungsadapter, 027; Standard, vom
   Eigentümer als Konfigurationsfrage änderbar), absoluter Pfad, Elternverzeichnis vorhanden und beschreibbar, nicht
   innerhalb von `HV_ACCESS_LOG_DIR`. `HV_ACCESS_LOG_DIR` (033a-Regeln unverändert) und neu die **Rechte des
   Verzeichnisses** (Befund 033a): per `lstat` ein echtes Verzeichnis (kein Symlink), `(mode & 0o027) === 0` (keine
   Schreibrechte für Gruppe, keine Rechte für andere; erlaubt z. B. 0700, 0750), sonst Start verweigert mit
   `HV-Tool API: refusing to start: HV_ACCESS_LOG_DIR must not be writable by group or accessible by others.` Kein
   Eigentümervergleich mit der Prozess-UID (eingehängte Datenträger im Container; 037 legt Eigentümer fest).
5. **Unbekannte Variablen.** Eine `HV_`-Variable, die das Schema nicht kennt, verhindert den Start nicht (CI und
   Werkzeuge setzen eigene), erzeugt aber eine feste stderr-Zeile mit den **Namen** (nie Werten), ausgenommen die
   bekannten Werkzeugvariablen `HV_MIGRATION_DATABASE_URL`, `HV_DB_RUNTIME_ROLE`, `HV_REQUIRE_POSTGRES_TESTS`,
   `HV_WEB_MODE`.
6. **Übergabe an `createApp`.** `server.ts` reicht jeden Wert ausdrücklich als Option weiter (Demo, OIDC, Schlüssel,
   Transparenzhinweis, Event-Log, Seed-Akteur, Zugriffslog, NTP, Grenzen, Timeout, CORS, Quelle) und baut Pool und
   Node-Server aus dem Schema. Die Rückfälle auf `process.env` in `app.ts` bleiben als Bibliotheksstandard für Tests
   bestehen (Standard; ein Entfernen berührte viele Tests), werden beim Prozessstart aber nie erreicht, weil jede
   Option gesetzt ist. `readObservabilityConfig` (`observability/config.ts`) und `parseNtpEnv` (`clock/ntp.ts`)
   bleiben als dünne Hüllen über dem Schema exportiert, damit die Tests aus 033a unverändert gelten.
7. **CORS-Allowlist aus Konfiguration (T-G1-T-05).** `HV_CORS_ORIGINS`: kommagetrennte Herkünfte der Form
   `scheme://host[:port]` ohne Pfad, Query, Benutzer, Platzhalter und `null`, höchstens 10; außerhalb der Demo nur
   `https:`. Fehlt die Variable: im Demo-Modus `http://localhost:5173` (heutiges Verhalten), sonst **kein**
   CORS-Middleware (gleiche Herkunft, Vertrag `servers: /v1`). Gilt für `/v1/*` und `/auth/*`. Erlaubte Header:
   `Content-Type`, `If-Match`, `Idempotency-Key`, `X-CSRF-Token`, im Demo-Modus zusätzlich `X-Actor`; `exposeHeaders`:
   `ETag`, `X-Server-Time`, `Retry-After`; Methoden `GET`, `POST`, `PUT`, `PATCH`, `OPTIONS`; `maxAge` 600;
   `credentials: true` nur außerhalb der Demo. Eine nicht gelistete Herkunft erhält keinen
   `Access-Control-Allow-Origin` (auch nicht bei Preflight); Vergleich exakt nach Normalisierung (Kleinschreibung von
   Schema und Host, Standardport entfernt). Preflights zählen auf den eigenen Preflight-Zähler aus 034a,
   nicht auf die Grenze für nicht angemeldete Anfragen; Antworten 408, 413, 429 und 503 an eine erlaubte Herkunft tragen
   die CORS-Header (034a Punkt 1).
8. **Quelle hinter einem vertrauenswürdigen Proxy.** `HV_TRUSTED_PROXY_CIDRS`: kommagetrennte IPv4-/IPv6-CIDR-Blöcke
   (höchstens 16, keine `0.0.0.0/0` und `::/0`). `X-Forwarded-For` wird **nur** ausgewertet, wenn die TCP-Gegenstelle
   in einem dieser Blöcke liegt; dann ist die Quelle der am weitesten rechts stehende Eintrag, der **nicht** in einem
   vertrauenswürdigen Block liegt (Einträge von rechts nach links, vertrauenswürdige Proxys übersprungen). Ist der
   Header dann leer, fehlerhaft oder besteht nur aus vertrauenswürdigen Adressen, gilt die Verbindungsadresse. Kommt
   die Verbindung nicht von einem vertrauenswürdigen Proxy, wird der Header ignoriert und die Verbindungsadresse gilt
   (ein Client kann seine Quelle nicht selbst wählen). Standard leer: immer die Verbindungsadresse. Die Quelle bleibt
   außerhalb jedes Logs (034a Punkt 3). `HV_TRUST_PROXY_HOPS` aus der ersten Fassung entfällt zugunsten der CIDR-Liste.
   *Nachtrag nach dem Review (29.09.2026):* Blöcke ohne Host-Bits (`10.0.0.1/8` wird abgelehnt), Mindestpräfix IPv4 /8,
   IPv6 /32 (schließt `/0`, `0.0.0.0/1` mit `128.0.0.0/1` und `::/8`). Ein IPv6-Block innerhalb von `::ffff:0:0/96`
   (Präfix ab 96) gilt als sein IPv4-Äquivalent (Präfix minus 96) mit den IPv4-Regeln (`::ffff:10.0.0.0/104` ist `10.0.0.0/8`,
   `::ffff:0:0/97` ist IPv4 /1 und wird abgelehnt); ein IPv6-Block mit Präfix unter 96, der `::ffff:0:0/96` enthält, wird
   abgelehnt, weil `BlockList` IPv4-Gegenstellen dagegen prüft.
9. **Startzeile als Erkennung.** Nach erfolgreichem Start schreibt `server.ts` eine feste Zeile mit Betriebsart
   (`demo` oder `service`), Persistenz (`postgres`, `jsonl`, `none`), Anmeldung (`oidc` oder `none`), den erlaubten
   CORS-Herkünften und den vertrauenswürdigen Proxy-Blöcken (Konfiguration, kein Geheimnis); keine anderen Werte.
10. **`.env.example`** unter `apps/api/.env.example`: jede Variable des Schemas genau einmal, mit Kommentar (Zweck,
    Standard, erlaubter Bereich, „aus der Plattform“ bei Geheimnissen) und Platzhalter ohne echten oder
    echt aussehenden Wert (Geheimnisse leer). Ein Drift-Test vergleicht die Schlüsselmenge der Datei mit der des
    Schemas in beide Richtungen; gitleaks bleibt grün.

## Nicht-Ziele

Keine neue Grenze und kein geänderter Standardwert (034a). Keine Konfigurationsprüfung im Container-Image, keine
Secrets aus einer Plattform, kein Proxy, keine CSP für das Web-Dokument (037). Keine Konfiguration der
Migrations-CLI. Kein Entfernen der `process.env`-Rückfälle in `app.ts`. Keine Laufzeitänderung der Konfiguration
(Neustart nötig). Keine Oberflächenänderung, keine Vertragsänderung.

## Bedrohungen, Missbrauchsfall und Test je ID

| ID | Rolle in 034b | Test (Datei) |
|---|---|---|
| T-Q-T-04 | berührt (Anteil 034: typisiertes Schema, Start verweigert; Seed nur in `training` bleibt 042) | fehlende Pflichtvariable außerhalb der Demo (Zugriffslog, Schlüssel), unvollständige Anmeldung (nur `HV_OIDC_ISSUER`), `HV_DEMO=1` mit Issuer, `HV_DB_TLS=yes`, Zeitgrenzen in falscher Reihenfolge, Zahl außerhalb des Bereichs: je ein fester Satz mit dem Variablennamen, kein Wert im Satz (Marker-Wert) (`config034b.test.ts`) |
| T-G2-E-02 | schließen (Rest: Container ohne Root 037) | `HV_EVENT_LOG` ohne Demo, relativ, innerhalb des Log-Verzeichnisses → verweigert; Log-Verzeichnis 0700 und 0750 angenommen, 0770, 0755, 0777 und Symlink auf ein Verzeichnis verweigert (`config034b.test.ts`, temporäre Verzeichnisse) |
| T-G1-T-05 | berührt (CSRF bleibt 029b) | gelistete Herkunft → `Access-Control-Allow-Origin` gleich der Herkunft und `Access-Control-Allow-Credentials: true` (ohne Demo); fremde Herkunft, `null`, Herkunft mit Pfad → kein Allow-Header, auch nicht im Preflight; Demo ohne Variable → nur `http://localhost:5173`; `X-Actor` nur im Demo-Modus in `Access-Control-Allow-Headers`; `Retry-After` in `Access-Control-Expose-Headers` (`cors034b.test.ts`) |
| T-G2-S-01 | berührt (Secrets aus der Plattform 037) | kein Geheimnis in Startzeile, Fehlersätzen und stderr (Marker-Werte für Client-Secret, Verschlüsselungsschlüssel, Hash-Schlüssel, Metrics-Token) (`config034b.test.ts`) |
| T-G1-D-01 | berührt (Konfiguration der Grenzen) | gesetzte Grenzen aus dem Schema wirken (z. B. `HV_RATE_LIMIT_WRITES_PER_MIN=2` → 3. Schreibvorgang 429); Verbindung von einer vertrauenswürdigen Proxy-Adresse mit `X-Forwarded-For: <gefälscht>, <Client>` → Quelle `<Client>`; **direkte Verbindung** (nicht in `HV_TRUSTED_PROXY_CIDRS`) mit `X-Forwarded-For` → Quelle ist die Verbindungsadresse; `0.0.0.0/0` in der Liste → Start verweigert; `HV_REQUEST_TIMEOUT_MS=6000` → Start verweigert (`config034b.test.ts`, Quelle über die Option `sourceOf` bzw. die Verbindungsadresse der Test-Anfrage) |

`.env.example`-Drift: Variable im Schema, aber nicht in der Datei, und umgekehrt → Test rot; unbekannte `HV_`-Variable
→ eine feste stderr-Zeile mit dem Namen (`config034b.test.ts`).

**Missbrauchsfall (SC-06): MF-08 „Demo-Schalter in Staging“** (Bedrohungsmodell Abschnitt 7) und neu **MF-11
„Fremde Herkunft in der CORS-Allowlist“**. *MF-08:* bei einem Deploy bleibt `HV_DEMO=1` gesetzt. *Verhindert durch:*
Startabbruch bei Demo mit Issuer (029a) und das Schema (Anmeldung alles oder nichts, `HV_EVENT_LOG` nur in der Demo).
*Erkennung (neu):* die Startzeile nennt `mode demo`; der Health-Smoke nach dem Deploy vergleicht sie mit der erwarteten
Betriebsart (037). *MF-11 Ablauf:* jemand trägt beim Deploy eine fremde oder zu weite Herkunft in `HV_CORS_ORIGINS`
ein, damit eine fremde Seite im Browser einer angemeldeten Person Antworten lesen kann. *Verhindert durch:* keine
Platzhalter, kein `null`, außerhalb der Demo nur `https:`, höchstens 10 exakte Herkünfte, `SameSite=Lax`-Cookie und
CSRF-Token (029b). *Erkennung:* die Startzeile listet die erlaubten Herkünfte; der Betrieb prüft sie beim Deploy gegen
die Eigentümer-Checkliste (037). *Signal und Empfänger:* Startzeile im Plattformprotokoll, Empfänger technischer
Betrieb; bis 037 manuell beim Tagesstart. *Ausnahme mit Eigentümer und Ablauf:* fehlender automatischer Vergleich,
Eigentümer technischer Betrieb, Ablauf mit Merge von 037, spätestens 30.10.2026. *Nachweis:* `cors034b.test.ts`,
Startzeilen-Test in `config034b.test.ts`.

## Files allowed

- `docs/slices/034b-konfigurationsschema-cors.md`
- `apps/api/src/config/**` (neu: Schema, Fehlersätze, Normalisierung der Herkünfte)
- `apps/api/src/server.ts` (Schema zuerst, ausdrückliche Optionen an createApp, Pool und Node-Server aus dem Schema, Startzeile)
- `apps/api/src/app.ts` (nur CORS aus Option, Übergabe der Grenzen-, Timeout- und Quellen-Optionen)
- `apps/api/src/limits/**` (nur Quelle aus X-Forwarded-For hinter vertrauenswürdigen Proxys und Übernahme konfigurierter Werte)
- `apps/api/src/observability/config.ts` (Hülle über dem Schema, Verzeichnisrechte)
- `apps/api/src/clock/ntp.ts` (nur parseNtpEnv als Hülle über dem Schema)
- `apps/api/.env.example` (neu)
- `apps/api/package.json`, `pnpm-lock.yaml` (nur zod)
- `apps/api/src/__tests__/config034b.test.ts`, `apps/api/src/__tests__/cors034b.test.ts` (neu)
- `scripts/keycloak-ci-029b.mjs` (nur falls der Start nach dem Schema einen Wert verlangt, den der Lauf heute nicht setzt, oder die Rechte des temporären Log-Verzeichnisses auf 0700 gesetzt werden müssen)
- `docs/sicherheit/bedrohungsmodell.md` (nur Status und Nachweise der oben genannten IDs, MF-08 Erkennung, neuer Missbrauchsfall MF-11)
- `docs/folgeliste.md` (nur nicht blockierende Reviewbefunde dieser Scheibe; Befund 033a „Rechte des Log-Verzeichnisses“ als erledigt markieren)

Weitere Dateien sind Scope-Befunde: erst Spec klären, nicht still ausweichen.

## Vor dem Bau prüfen

1. 034a ist gemergt; Optionen für Grenzen, Timeout und Quelle sind in `CreateAppOptions` vorhanden. Auf den dann
   aktuellen Kopf aufsetzen.
2. `grep -rn "process.env\[" apps/api/src --include=*.ts | grep -v __tests__`: jede gelesene Variable steht im Schema
   (Liste in Punkt 2 an diesem Stand abgleichen; 033b `HV_METRICS_TOKEN`). Fehlt eine, Spec klären.
3. Tests aus 033a, die `readObservabilityConfig`, `parseNtpEnv` oder die `REFUSE_*`-Sätze nutzen
   (`access-log033a.test.ts`, `ntp033a.test.ts`), bleiben ohne Änderung grün; `demo-lock.test.ts` und
   `seedActor.test.ts` ebenso. `platform033a.test.ts:106-108` (Demo-CORS) bleibt grün.
4. `scripts/keycloak-ci-029b.mjs` startet ohne Demo mit `...process.env`: prüfen, dass Loopback-HTTP für Issuer und
   Redirect angenommen wird und das temporäre Log-Verzeichnis die Rechteprüfung besteht (`mkdtemp` legt 0700 an).
5. zod: aktuelle Version per `pnpm view zod version`, exakt pinnen; `pnpm audit:check` grün; Lizenz im Bericht.
6. `.env.example` darf keinen gitleaks-Treffer erzeugen (leere Geheimnisse, beschreibende Platzhalter in Kommentaren).

## Tests zuerst und Abnahme

1. Vor der Implementierung rot: `config034b.test.ts` (jede Regel aus Punkt 2–5 mit Positiv- und Negativfall, fester
   Satz ohne Wert, Verzeichnisrechte, Drift `.env.example`, Startzeile ohne Geheimnis) und `cors034b.test.ts`.
2. `pnpm gates` auf sauberem Baucommit grün, wörtlicher Schluss im Bericht; Keycloak- und Postgres-CI-Lauf grün;
   vollständige E2E-Suite, soweit ein Browser verfügbar ist (keine Oberflächenänderung).
3. Manuelle Probe: `pnpm --filter @hv/api start` ohne Demo und ohne Zugriffslog → Exit ≠ 0 mit dem festen Satz aus
   033a; mit `HV_ACCESS_LOG_DIR` auf ein Verzeichnis mit 0755 → Exit ≠ 0 mit dem Rechtesatz; nur `HV_OIDC_ISSUER`
   gesetzt → Exit ≠ 0 mit den Sätzen der fehlenden Anmeldevariablen; `pnpm --filter @hv/api dev` → Startzeile
   `mode demo`. Ausgaben im Bericht.
4. Unabhängiges Review in frischem Kontext mit Perspektive Security/Betrieb; Blocker/Major sowie jede Sicherheits- oder
   Datenschutzfrage vor Merge, übrige Befunde in `docs/folgeliste.md`. PR-CI auf dem letzten Commit grün. Jeder Commit
   nennt „Scheibe 034b“ und endet `[skip netlify]`. Kein Deploy.

## Nachweise

`pnpm gates`-Schluss, Testnamen je Bedrohungs-ID, Ausgaben der Startverweigerungen und der Startzeile, zod-Version und
Lizenz, Keycloak-CI-Schritt grün.

## Nachweis

**Gates-Commit:** `4976877` (Baucommit "Scheibe 034b: Konfigurationsschema (zod), .env.example, CORS-Allowlist, Proxy-Quelle"),
`CONTRACT_GATE_STRICT=1 pnpm gates` auf sauberem Baum, Exit 0. Umgebung: lokale Postgres-DB `hv_s034b`
(`TEST_DATABASE_URL`, `TEST_RUNTIME_DATABASE_URL`, `HV_DB_RUNTIME_ROLE=hv_runtime`), Node 22.22.2, pnpm 10.33.0.
Testdateien/Tests: domain 14/231, web 13/254, api 34/477 (davon neu `config034b.test.ts` und `cors034b.test.ts`), Skripte 234.
`slice-scope`: 18 geänderte Dateien, alle innerhalb von „Files allowed" (15 Muster). zod 4.6.5 exakt gepinnt, Lizenz MIT, keine
Laufzeitabhängigkeiten.

Wörtlicher Schluss der Ausgabe von `pnpm gates`:

```
# todo 0
# duration_ms 13070.980578
> @hv/web@0.0.0 build /home/user/wt/s034bb/apps/web
> tsc -b && vite build
vite v8.2.2 building client environment for production...
transforming...
✓ 1725 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-CA8a643A.css                        42.33 kB │ gzip:   9.09 kB
dist/assets/index-BYKUsmVP.js                        620.09 kB │ gzip: 181.57 kB │ map: 2,559.49 kB
[plugin @tailwindcss/vite:generate:build] [33m[SOURCEMAP_BROKEN] [0mSourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.12s
mark-test-run: wrote /home/user/wt/s034bb/.claude/state/last-test-run (clean tree) at commit 4976877, tree 3dca399a7df2…
```

E2E (`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium E2E_PORT=4420 pnpm --filter @hv/web e2e -- --timeout=240000`), Schluss:

```
  ✓  129 [chromium] › e2e/abnahme.spec.ts:88:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (1.0m)
  4 skipped
  127 passed (8.2m)
```

Die Konfiguration berührt den Web-Demo-Start nicht (E2E startet nur Vite mit dem Demo im Browser); der Lauf ist die
Sammelprobe ohne Oberflächenänderung. Die dabei neu erzeugten Screenshots wurden verworfen, nicht committet.
Der Keycloak-CI-Lauf konnte hier nicht laufen (kein Docker-Daemon); `scripts/keycloak-ci-029b.mjs` bleibt unverändert: mit
denselben Variablen wie das Skript besteht das Schema (Anmeldung `oidc`, Persistenz `postgres`, Loopback-HTTP für Issuer und
Redirect, `mkdir` mit 0700), geprüft per `readServiceConfig` in einem Wegwerfaufruf.

Startproben (Ausgaben wörtlich): ohne Demo und ohne Zugriffslog Exit 1 mit den beiden 033a-Sätzen; Verzeichnis 0755 Exit 1 mit
`HV-Tool API: refusing to start: HV_ACCESS_LOG_DIR must not be writable by group or accessible by others.`; nur
`HV_OIDC_ISSUER` gesetzt Exit 1 mit je einem Satz für die fehlenden Anmelde-, Datenbank- und Hinweisvariablen; `HV_DEMO=1` Startzeile
`HV-Tool API: start mode=demo persistence=none auth=none cors=http://localhost:5173 trusted-proxies=none`.

Verhaltensänderungen (im Bericht zu nennen):

- `HV_DEMO`: nur `1` oder fehlend; `0` und jeder andere Wert verweigert den Start (vorher wirkte `0` wie „aus").
- Ein ungültiger `HV_DSFA_SUMMARY_URL` (kein http/https, mit Zugangsdaten) verweigert den Start (vorher stilles Verwerfen).
- Ein leerer Wert zählt als nicht gesetzt, außer bei `HV_ACCESS_LOG_DIR`, `HV_ACCESS_LOG_HASH_KEY`,
  `HV_ACCESS_LOG_RETENTION_DAYS`, `HV_CLOCK_MAX_DRIFT_MS`, `HV_EVENT_LOG` und `HV_SEED_ACTOR` (dort ist leer ein Fehler).
- `HV_TRUSTED_PROXY_CIDRS`: strenger als die erste Fassung: nie `/0`, IPv4 ab /8, IPv6 ab /32, keine Host-Bits, IPv4-abgebildete
  IPv6-Blöcke als IPv4 gelesen (siehe Nachtrag zu Entscheidung 8).
- `PORT` wird streng geprüft (ganze Zahl 1 bis 65535); vorher `parseInt`, `8080abc` ging.
- `HV_DATABASE_URL` muss mit `postgres://` oder `postgresql://` beginnen.
- Eine unvollständige Anmeldekonfiguration verweigert den Start (vorher Warnung und 401 auf geschützten Anfragen).
- `HV_OIDC_CLIENT_ID` und `HV_OIDC_CLIENT_SECRET` aus reinen Leerzeichen verweigern den Start.
- Der Rechtesatz für das Log-Verzeichnis gilt auch im Demo-Modus, wenn dort ein Verzeichnis gesetzt ist.

Offen (aus der Folgeliste hierher verschoben, kein Reviewbefund):

- Kein Eigentümervergleich des Log-Verzeichnisses und keine Prüfung im Container-Image: 037.
- Die `process.env`-Rückfälle in `app.ts` bleiben als Bibliotheksstandard, beim Prozessstart nie erreicht.
- Der Keycloak-CI-Lauf gegen das neue Schema war im Bau nicht möglich (kein Docker); nur ein Wegwerfaufruf von `readServiceConfig`
  mit den Variablen des Skripts. Die PR-CI ist der Nachweis.
- Die Rechte des Log-Verzeichnisses werden nur beim Start geprüft (TOCTOU über das Elternverzeichnis, Restrisiko im
  Bedrohungsmodell, Ziel 037). Die Senke (`observability/accessLog.ts`) steht nicht in „Files allowed"; ein `lstat` vor jeder neuen
  Tagesdatei wäre dort nachzuziehen.

Bedrohungs-ID → Test:

| ID | Test (Datei, Block) |
|---|---|
| T-Q-T-04 | `config034b.test.ts`: „defaults and shape", „numeric ranges and time order", „rules across variables", „process start" (Exit 1, feste Sätze ohne Marker-Wert) |
| T-G2-E-02 | `config034b.test.ts`: „paths and directory rights" (`HV_EVENT_LOG` ohne Demo, relativ, im Log-Verzeichnis; 0700/0750 angenommen; 0770/0755/0777/Symlink verweigert) |
| T-G1-T-05 | `cors034b.test.ts`: alle Blöcke (gelistete Herkunft, fremde Herkunft/`null`/Pfad ohne Header auch im Preflight, Demo-Standard, `X-Actor` nur in der Demo, `Retry-After` exponiert, Preflight-Zähler) |
| T-G2-S-01 | `config034b.test.ts`: „start line and secrets" (Marker für Client-Secret, Schlüssel, Hash-Schlüssel, Metrics-Token, DB-Passwort) |
| T-G1-D-01 | `config034b.test.ts`: „configured limits take effect" (`HV_RATE_LIMIT_WRITES_PER_MIN=2` gibt 429 beim dritten Schreibvorgang), „trusted proxy list" (vertrauenswürdiger Proxy mit gefälschtem Eintrag, direkte Verbindung mit `X-Forwarded-For` zählt unter der Verbindungsadresse, `0.0.0.0/0`, `::/0`, `::ffff:0:0/96`, `::/8`, `0.0.0.0/1`, `10.0.0.0/7` und Host-Bits verweigert), `HV_REQUEST_TIMEOUT_MS=6000` verweigert |
| `.env.example`-Drift | `config034b.test.ts`: „.env.example (drift)" und „reads every variable it lists" |

## Bericht (nach Bau ausfüllen)

```
Slice: 034b-konfigurationsschema-cors
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; Keycloak-CI-Lauf; Startproben
Bedrohungs-ID → Test: <je Zeile der Tabelle oben>
Open: Prüfung im Image, Secrets aus der Plattform, automatischer Vergleich der Startzeile (037, Ausnahme bis 30.10.2026); process.env-Rückfälle in app.ts bleiben als Bibliotheksstandard; Migrations-CLI ohne Schema; HV_DEMO=0 verweigert jetzt den Start (vorher „aus“)
Touched: <Dateiliste>
```

## Lesebefund vor dem Bau

Lesebefund in frischem Kontext (Opus, 29.09.2026, gemeinsam mit 034a): kein Blocker; für 034b eingearbeitet:
`X-Forwarded-For` nur von vertrauenswürdigen Proxys nach CIDR-Liste, direkte Verbindung mit gefälschtem Header zählt
unter der Verbindungsadresse (M7); Preflights auf eigenem Zähler, CORS-Header auf Grenzantworten (M8); Minimum des
Request-Timeouts 7 000 ms über dem `/readyz`-Budget (m13); Startzeile nennt die Proxy-Blöcke, `HV_DEMO=0` verweigert
künftig den Start und steht im Bericht (m14); neue Variablen für Lese-, Proben- und Preflight-Grenzen und
`query_timeout` (aus 034a m10–m12); Checkliste um SC-01 und SC-11 ergänzt (m7); Abhängigkeitsangabe (m1).

## Review findings

folgt
