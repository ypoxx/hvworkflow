# Scheibe 037a — Lokales Betriebspaket (Container und Compose) für die Freigabe-Demo

**Status:** spec (03.10.2026; gelesen auf `acb7f45`; Teil 1 der geteilten Scheibe 037, Zuschnitt im Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 2,5 AStd (Teil a; Schätzung für 037b rund 2 AStd, Summe 4,5 statt 2,5 laut Plan) · Plan 037: 30.10.2026 (W5); 037a frühestens nach dem Go zu Eigentümerfrage 1, Ziel vor der Freigabe-Demo · Lanes: infra; docs-betrieb; scripts (nur die eigenen neuen Dateien und die Auslagerung aus dem 031a-Harness)
**Rolle:** implementierer-backend. Review in frischem Kontext mit den Perspektiven **Betrieb** (Installierbarkeit, Wiederanlauf, Anleitung) und **Security** (Secrets, Ports, Nutzer im Container, Lieferkette). Lesebefund der Spec vor dem Bau; nie gebündelt (Leitplanken §4, hoch). Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine fachliche Regel-id (kein Übergang, kein Recht, keine Vertragsänderung). Angewandt: AGENTS.md R2, R4, R6 (nicht berührt: keine neue Operation), R11, R12; Bedrohungsmodell T-G2-E-02, T-G2-S-01, T-Q-S-02, T-Q-I-01, T-G1-D-01 (Proxy-Teil)
**Quellen-IDs:**
- `docs/produktplan-beta.md` Eintrag 037 (Zeile 613–618), Eintrag 038 (Zeile 619–624, hängt an 037), §4 Zeile 244 (ADR 0007), §11 (Zielpfad Beta-2)
- Eigentümerentscheidung 03.10.2026 „Freigabe-Demo“ (Auftrag an den Architekten): eine Person, die den Betrieb solcher Anwendungen kennt, soll sehen, dass die Anwendung gut dokumentiert, leicht installierbar und robust ist; kein gehosteter Server, Deploy erst nach ausdrücklichem Go (R11)
- ADR 0007 (zwei Artefakte, Konfigurationsschema, `/healthz` und `/readyz`), ADR 0003 (Postgres, Eigentümer- und Laufzeitrolle), ADR 0004 (OIDC, BFF), ADR 0013 (Zugriffslog)
- Specs 027 (Migrationen, `HV_DB_RUNTIME_ROLE`), 029b und 031a (Keycloak-Testrealm, CI-Harness), 033a (Zugriffslog, NTP), 034a (Grenzen), 034b (Konfigurationsschema, Hinweise an 037)
- `docs/folgeliste.md`: 033a R1 minor (synchrones Schreiben des Zugriffslogs → 037), 031a Bau (Bindeadresse → 037), 034b Review nit (ACLs des Log-Verzeichnisses → 037)
- Register E10, E39, E56

**Depends on:** 027, 029b, 031a, 033a, 033b, 034a, 034b (alle gemergt; der Code auf `acb7f45` enthält Schema, Migrationen, Harness und Health-Endpunkte)
**Perspektive:** Betrieb, Security · **Glossar: neue Begriffe:** nein (Betriebspaket, Stack und Image sind Betriebswörter, keine Oberflächentexte)

## Teilung und Zuschnitt

Die Planzeile 037 (2,5 AStd) bündelt drei Dinge: das Container-Image, die Pipeline mit drei Umgebungen und die
Betriebsauswertung mit Alarmen. Die Freigabe-Demo braucht davon nur das, was ohne Server und ohne Go läuft. Daraus folgt
die Teilung, **ein PR je Spec** (R12):

| Teil | Inhalt | Klasse · AStd |
|---|---|---|
| **037a** (diese Spec) | Image des Dienstes, Image des Webs, Compose-Stack mit Postgres und Keycloak-Testrealm, ein Befehl für Start, Befüllung und Rauchtest, Installationsseite, CI-Nachweis „Images bauen, Stack wird gesund“ | hoch · 2,5 |
| **037b** | Pipeline mit Image-Push und Digest, Umgebungen demo / staging-synthetic / rehearsal, Approval-Environment, Health-Smoke nach Deploy mit Rollback, Freeze-Regel, Betriebsauswertung mit Alarmversand (Füllstand und Schreibfehler der Zugriffslog-Senke), UDP/123 nur zu den NTP-Servern, CSP mit CSP-Report im e2e gegen den Produktions-Build, Härtungs-Checkliste Host, Eigentümer-Checkliste Secrets | hoch · rund 2 |

037b baut auf den Images aus 037a auf. Was 037b vorfindet, steht im Abschnitt „Hinweise an 037b“. 038 (Backup, Restore)
hängt im Plan an 037. Für den Restore-Drill genügt 037a, für den nightly Job auf Staging braucht es 037b.

**Vorgeschlagene Änderung am Plan** (nicht in dieser Spec umgesetzt; der Orchestrator trägt sie nach dem Go zu
Eigentümerfrage 1 in `docs/produktplan-beta.md` ein):

```
- **037 · Container, Pipeline, drei Umgebungen, Betriebsauswertung, Freeze-Regel** — hoch · 2,5 AStd · …
  - *Ziel:* 037 geteilt: 037a lokal, 037b Pipeline/Staging. 037a (03.10.2026, Freigabe-Demo): Images für Dienst und Web,
    Compose-Stack mit Postgres und Keycloak-Testrealm, ein Befehl, Installationsseite docs/betrieb/installation.md,
    CI-Job „Stack wird gesund“. 037b: alles Übrige dieses Eintrags (Pipeline, Umgebungen, Approval, Freeze, Alarme,
    CSP, Härtungs- und Secrets-Checkliste). Aufwand neu: 037a 2,5 AStd, 037b rund 2 AStd.
```

Ob der Eintrag dafür zwei Planzeilen `037a` und `037b` bekommt (das Format von plan-graph erlaubt `\d{3}[a-z]?`) oder
nur den Teilungsvermerk, entscheidet der Orchestrator mit dem Kalender.

## Befund (Ist-Stand, gelesen auf `acb7f45`)

- **Kein Container, kein Compose.** Die Suche nach Dateien mit `docker` oder `compose` im Namen außerhalb von
  `node_modules` findet nichts. Der Dienst startet aus dem Quelltext mit `tsx` (`apps/api/package.json`, Skript `start`).
  Ein JavaScript-Build gibt es nicht: `build` ist `tsc --noEmit`.
- **Laufzeit braucht tsx.** Der Kern importiert mit `.js`-Endungen auf `.ts`-Dateien (`packages/domain/src/index.ts`).
  Das eingebaute Type-Stripping von Node 22 löst `./types.js` nicht auf `types.ts` auf. Der Dienst liest zur Laufzeit
  `packages/contract/openapi.yaml` über `require.resolve('@hv/contract/openapi.yaml')` (`apps/api/src/contractSchema.ts:20`)
  und importiert `catalog.json` mit Import-Attribut. Ein Bündel müsste beides nachbilden. `tsx` steht nur in den
  `devDependencies` von `@hv/api`, obwohl `start` es im Betrieb braucht.
- **CI startet den Stack schon, ohne Compose.** `.github/workflows/gates.yml` hat zwei Wege:
  - Job `gates`: Postgres als Service mit `postgres:16@sha256:1a6a…4b54`, Eigentümer `hv_owner`, Laufzeitrolle
    `hv_runtime` per `psql` angelegt, `HV_DB_RUNTIME_ROLE=hv_runtime`, Migration mit `pnpm --filter @hv/api db:migrate up`
    und `HV_MIGRATION_DATABASE_URL`.
  - Job `e2e-http` (`scripts/e2e-http-031.mjs`): Keycloak per `docker run` aus `scripts/lib/keycloak-ci.mjs`
    (`KEYCLOAK_IMAGE` 26.7.4 per Digest, `start-dev --import-realm`, Port nur auf `127.0.0.1`, Realm mit einem
    vertraulichen Client und synthetischen Personen aus `buildRealm`, alle Secrets je Lauf zufällig). Danach Datenbank,
    Migration, Bootstrap von Korpus und Rollen (Funktion `bootstrap`: `seedDemo` mit `CORPUS_DEMO`, `assignRole` je
    Person, Einfügen der Ereignisse als Eigentümer in einer Transaktion, **bevor** der Dienst startet). Der Dienst bekommt
    eine ausdrückliche Umgebung ohne `...process.env` (`ALLOWED_SERVICE_VARIABLES`, `FORBIDDEN_SERVICE_VARIABLES`) und
    seine Startzeile wird geprüft.
  - Auf dem Runner `ubuntu-latest` sind Docker und Compose v2 vorhanden. `e2e-http` nutzt Docker bereits.
- **Konfigurationsschema (034b)** (`apps/api/src/config/schema.ts`): Issuer und Redirect-URI müssen `https` sein, `http`
  nur für `localhost` und `127.0.0.1`. CORS außerhalb der Demo nur `https`. `HV_DEMO=1` und OIDC schließen sich aus.
  Außerhalb der Demo verweigert der Start ohne `HV_ACCESS_LOG_DIR` (echtes Verzeichnis, 0700 oder 0750) und ohne
  `HV_ACCESS_LOG_HASH_KEY`. Einen „lokalen Modus“ kennt das Schema nicht. Das braucht es auch nicht: Die Loopback-Regel
  verweigert eine `http`-Einrichtung auf jedem anderen Host schon heute (Entscheidung 6).
- **Web im HTTP-Modus** (`apps/web/vite.config.ts`): `HV_WEB_MODE=http` ist ein Build-Schalter. Der Browser spricht
  same-origin mit `/v1` und `/auth`; im Entwicklungs- und Preview-Server leitet ein Proxy beides an den Dienst weiter. Der
  Dienst liefert **keine** statischen Dateien aus (kein `serveStatic` in `apps/api/src`). Die Redirect-URI ist
  `http://localhost:<Webport>/auth/callback`, der Rückruf läuft über den Proxy.
- **Cookies** tragen `Secure`. Chromium und Firefox nehmen sie auf `http://localhost` an, so arbeitet auch 031a.
- **`/readyz`** prüft Uhr, Datenbank und Migrationen. Ohne `HV_NTP_SERVERS` ist die Uhr `not_configured` und die Antwort
  503. 031a nimmt das hin und prüft `db` und `migrations` einzeln (`waitForService`).
- **Bindeadresse:** `serve` ohne `hostname` bindet an alle Schnittstellen. Im Container ist das nötig. Der Port des
  Dienstes wird im Stack nicht veröffentlicht (Entscheidung 5).
- **Diese Arbeitsumgebung:** Docker-CLI 29.3.1 und Compose v5.1.1 sind installiert, ein Daemon läuft nicht. Probe des
  Architekten am 03.10.2026: `dockerd` lässt sich als root mit `--storage-driver=vfs` und kurzen Pfaden unter `/tmp`
  starten, `docker run --rm hello-world` lief durch. Der Implementierer kann den Stack also lokal beweisen und den
  Screenshot committen. E56 (CI-Artefakt statt PNG) ist nur der Rückfall.

## Ziel

Wer das Repository auscheckt, startet mit **einem Befehl** einen vollständigen lokalen Betrieb: Dienst, Web im HTTP-Modus,
Postgres mit Eigentümer- und Laufzeitrolle und Keycloak mit einem synthetischen Testrealm. Der Stack ist mit dem
Demo-Korpus befüllt und hat neun Testpersonen mit Rollen. Ein Rauchtest bestätigt, dass er gesund ist. Eine
Installationsseite führt durch Voraussetzungen, Start, Anmeldung, Health-Checks, Stoppen, Zurücksetzen und Fehlersuche.
Die Images sind dieselben, die 037b später ausrollt: gleiches Konfigurationsschema, Nutzer ohne Root, Basis-Images per
Digest. Die CI beweist auf jedem Code-PR, dass beide Images bauen und der Stack gesund wird.

## Entscheidungen vor Bau

1. **Dateiorte.** Images und Stack liegen unter `deploy/`, nicht in `apps/` (Lane infra, kein Anwendungscode). Build-Kontext
   ist die Wurzel des Repositoriums, weil beide Images Workspace-Pakete brauchen. Eine `.dockerignore` an der Wurzel.
2. **Image des Dienstes:** mehrstufig.
   - Baustufe auf `node:22-bookworm-slim` (Digest): `pnpm install --frozen-lockfile --prod --filter @hv/api...`.
   - Laufzeitstufe auf `gcr.io/distroless/nodejs22-debian12:nonroot` (Digest; Plan 037 verlangt distroless und
     non-root). Nutzer 65532, keine Shell, kein Paketmanager.
   - Das Image behält die Pfade des Repositoriums unter `/app` (`apps/api`, `packages/domain`, `packages/contract`,
     `scripts/lib` für die Befüllung). Startbefehl wie heute: Node mit dem tsx-Loader auf `apps/api/src/server.ts`.
   - **`tsx` wandert in `apps/api/package.json` von `devDependencies` nach `dependencies`.** Es ist heute schon die
     Laufzeit von `start`, und so bringt die Produktionsinstallation es mit.
   - Verworfen: ein esbuild-Bündel. Es bräuchte eine neue Abhängigkeit, müsste `openapi.yaml` und das JSON-Import-Attribut
     nachbilden und wäre ein zweiter Startweg neben dem, den CI testet.
   - `HEALTHCHECK` auf `/healthz` mit dem Node des Images (`node -e` mit `fetch`, kein curl). Die Bereitschaft (`/readyz`)
     prüft der Rauchtest (Entscheidung 8).
   - Das Verzeichnis `/var/lib/hv/access-log` wird im Image mit 0700 und Eigentümer 65532 angelegt. Ein neues benanntes
     Volume übernimmt Rechte und Eigentümer, so besteht die Prüfung aus 034b, und der Eigentümer ist festgelegt
     (034b-Hinweis „037 legt Eigentümer fest“).
3. **Image des Webs:** Baustufe `HV_WEB_MODE=http pnpm --filter @hv/web build`, Laufzeit `nginxinc/nginx-unprivileged`
   (alpine, Digest, Nutzer 101, Port 8080). Die nginx-Konfiguration liefert `dist` aus, mit Rückfall auf `index.html` für
   die Routen der Oberfläche. Sie leitet `/v1` und `/auth` an den Dienst weiter, wie der Vite-Proxy.
   - Für `/v1/stream`: `proxy_buffering off`, `proxy_read_timeout` deutlich über dem Heartbeat von 15 s, HTTP/1.1 ohne
     `Connection: close`. Das ist der erste reale Prüfstand für 035b Frage 3, lokal.
   - Sicherheitsheader wie in `netlify.toml` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
     `Referrer-Policy: no-referrer`), `server_tokens off`.
   - `X-Forwarded-For` wird mit `$remote_addr` **überschrieben**, nicht ergänzt.
   - Keine CSP in 037a. Sie kommt mit 037b zusammen mit dem CSP-Report-Test; eine ungeprüfte CSP könnte die Demo brechen.
   - Verworfen: der Dienst liefert die statischen Dateien aus. Das wäre Anwendungscode in `apps/api/src` und widerspräche
     ADR 0007 (zwei Artefakte).
4. **Issuer auf `localhost` im Container.** Das Schema erlaubt `http` nur für `localhost`. Im Container des Dienstes ist
   `localhost` aber der Container selbst. Der Dienst muss Keycloak unter **derselben** URL erreichen wie der Browser,
   sonst scheitert die Issuer-Prüfung (`oidc.ts:76`).
   - Lösung: Der Dienst teilt den Netz-Namensraum von Keycloak (`network_mode: service:keycloak`). Keycloak hört auf Port
     8180 im Container und ist auf `127.0.0.1:8180` des Rechners veröffentlicht. Der Issuer
     `http://localhost:8180/realms/hv-local` gilt so für Browser und Dienst gleich.
   - nginx erreicht den Dienst als `keycloak:8787`. Der Name ist ungewohnt; die Compose-Datei begründet ihn im Kommentar.
   - Verworfen:
     - Eine Ausnahme im Schema für einen Compose-Hostnamen. Das wäre eine Sicherheitsänderung an 034b für eine
       Bequemlichkeit.
     - Ein `extra_hosts`-Eintrag für `localhost`. Unzuverlässig, die erste Zeile in `/etc/hosts` gewinnt.
     - TLS mit eigener CA. Für die lokale Demo zu viel, gehört zu 037b.
   - Grenze: Startet Keycloak neu, verliert der Dienst seinen Namensraum. `depends_on` mit `restart: true` hilft bei
     `docker compose restart`, nicht beim Absturz. Das steht als Einschränkung auf der Installationsseite. Die Proben zur
     Robustheit (Test S16) zielen auf Dienst und Postgres.
5. **Ports nur auf Loopback.** Veröffentlicht werden nur `127.0.0.1:8480` (Web) und `127.0.0.1:8180` (Keycloak, Anmeldung
   und Admin-Konsole). Postgres und der Dienst bleiben ohne veröffentlichten Port. Die Ports lassen sich beim ersten Start
   mit `HV_STACK_WEB_PORT` und `HV_STACK_IDP_PORT` ändern. Sie stehen dann im Zustand; ein späterer anderer Wert wird mit
   einem Hinweis auf `stack:reset` verweigert, weil Realm und Issuer daran hängen.
6. **Keine Standardpasswörter, Secrets je Installation.** Der erste Start erzeugt alle Secrets zufällig:
   Postgres-Eigentümer und -Laufzeitrolle, Client-Secret, `HV_AUTH_ENCRYPTION_KEY`, `HV_ACCESS_LOG_HASH_KEY`,
   Keycloak-Admin und die neun Personenpasswörter. Damit ist dieselbe Lage erreicht wie in 031a, nur dauerhaft statt je Lauf.
   - Ablage: ein Zustandsverzeichnis **außerhalb des Repositoriums**, `${XDG_STATE_HOME:-$HOME/.local/state}/hv-tool-stack`,
     Rechte 0700, Dateien 0600. Darin `state.json` und die Umgebungsdateien je Dienst, die bei jedem `up` aus `state.json`
     neu geschrieben werden: `api.env`, `postgres.env`, `migrate.env`, `seed.env`, `keycloak.env`, `realm.json` (0644, wie
     in 031a vom Keycloak-Nutzer zu lesen; das Verzeichnis bleibt 0700).
   - Jeder Dienst bekommt nur seine eigene Datei (`env_file`). **Der Dienst sieht nie das Eigentümerpasswort**; nur
     `migrate` und `seed` halten die Eigentümer-URL.
   - In versionierten Dateien steht kein Secret. Die Compose-Datei enthält nur Nicht-Geheimes: Transparenzhinweis mit
     Demo-Text, Ports, Pfade, Grenzen.
   - **Lokale Grenze, die schon erzwungen ist:** Das Schema verweigert `http` für Issuer und Redirect außerhalb von
     Loopback (Test S15). Das Skript verweigert einen entfernten Docker-Daemon (`DOCKER_HOST` oder Kontext mit `tcp://`
     oder `ssh://`): Ein Start dort wäre ein Deploy ohne Go (R11). `start-dev` von Keycloak ist in Compose-Kommentar und
     Installationsseite als „nur lokal“ markiert.
7. **Befüllung wiederverwenden, nicht neu erfinden.**
   - Die Funktion `bootstrap` aus `scripts/e2e-http-031.mjs` wandert unverändert nach `scripts/lib/demo-bootstrap.mjs`.
     031a importiert sie von dort; das ist die einzige Änderung am Harness.
   - `buildRealm` in `scripts/lib/keycloak-ci.mjs` bekommt einen optionalen Parameter für lesbare Nutzernamen. Ohne ihn
     bleibt das Verhalten byte-gleich (031a und 029b unverändert).
   - Personen und Rollen sind dieselben neun wie `PERSONS` in 031a, mit lesbaren Namen: moderation, capture, coordination,
     expert (Einheit `unit-fin`), legal, approver, podium, norole, revoke. Die Liste wird importiert, nicht kopiert. Für die
     Demo heißt `revoke` auf der Installationsseite „zweite Erfassung“.
   - Die Befüllung läuft als einmaliger Compose-Dienst `seed` im Image des Dienstes. Sie läuft **vor** dem Start des
     Dienstes, wie in 031a: Der Dienst hält einen Ketten-Cache und darf keine Ereignisse unter sich wachsen sehen.
   - Sie schreibt nur in ein leeres Ereignislog. Ist das Log nicht leer, endet sie mit Exit 0 und dem festen Satz „bereits
     befüllt“. Neu befüllen geht nur über `stack:reset`.
   - Die Migration läuft als einmaliger Dienst `migrate` mit dem vorhandenen Migrations-CLI
     (`apps/api/src/persistence/migrate-cli.ts`, `HV_DB_RUNTIME_ROLE=hv_runtime`).
   - Die Laufzeitrolle legt ein Init-Skript von Postgres an: LOGIN, kein Superuser, Passwort aus `postgres.env`, über eine
     psql-Variable, nie im Klartext im Skript und nie ausgegeben. Das ist dieselbe Rolle wie im CI-Schritt „Create separate
     Postgres runtime login“.
8. **Ein Befehl, ohne npm-Abhängigkeit.** `scripts/stack.mjs` braucht nur Node-Bordmittel und `scripts/lib`, also kein
   `pnpm install`. Der Aufruf ist `node scripts/stack.mjs <befehl>`, Kurzformen in `package.json`:
   - `pnpm stack:up`: Voraussetzungen prüfen (Docker-Daemon lokal, Compose v2, Ports frei), Zustand anlegen oder lesen,
     Images bauen, Stack starten, warten, bis Postgres, Keycloak, Dienst und Web gesund sind und `migrate` und `seed` mit 0
     beendet sind (Mechanismus frei: `docker compose up --wait` oder eigenes Abfragen), dann Rauchtest. Schluss ist eine
     feste Zeile mit der Web-URL und dem Hinweis auf `stack:credentials`.
   - `pnpm stack:smoke`: nur der Rauchtest (Test S12).
   - `pnpm stack:credentials`: der einzige Befehl, der Nutzernamen und Passwörter der Testpersonen und des Keycloak-Admins
     ausgibt, auf ausdrücklichen Aufruf. `up`, `smoke`, Fehlerausgaben und CI geben nie einen Wert aus.
   - `pnpm stack:down`: stoppt, Daten bleiben erhalten.
   - `pnpm stack:reset -- --yes`: `down` mit Volumes, Zustandsverzeichnis löschen. Ohne `--yes` keine Wirkung.
   - `pnpm stack:login`: Playwright meldet `moderation` an und macht den Screenshot (Test S13). Braucht `pnpm install`.
   - Auf einen Fehler folgt der Name der Stufe auf stderr, wie in 031a, nie eine Treiber- oder Docker-Meldung mit Werten.
     Für die Fehlersuche verweist die Installationsseite auf `docker compose logs`.
9. **Uhrprüfung:** Standard ohne `HV_NTP_SERVERS`, wie in CI. `/readyz` meldet dann `clock: not_configured` (503); der
   Rauchtest nimmt genau diesen Fall hin, `db` und `migrations` müssen `ok` sein. `HV_STACK_NTP_SERVERS` reicht einen Wert
   an `HV_NTP_SERVERS` durch; dann muss `/readyz` 200 sein. Die Installationsseite erklärt beides.
10. **Quelle hinter dem Proxy.** Der Compose-Netz bekommt ein festes Subnetz, das Web eine feste Adresse. Der Dienst
    vertraut genau dieser Adresse als `/32` (`HV_TRUSTED_PROXY_CIDRS`). Sonst teilten sich alle Browser die Grenzen je
    Quelle der nginx-Adresse (034a).
11. **Neustart-Politik und Härtung im Compose.**
    - `restart: unless-stopped` für Postgres, Keycloak, Dienst und Web; `restart: "no"` für `migrate` und `seed`.
    - Dienst und Web: `read_only: true`, `tmpfs` für `/tmp` (und für nginx dessen Cache- und PID-Pfade), `cap_drop: [ALL]`,
      `security_opt: [no-new-privileges:true]`.
    - Postgres und Keycloak: `no-new-privileges` (ihre Images wechseln selbst den Nutzer).
    - Benannte Volumes: `hv-pgdata`, `hv-access-log`. Keycloak hat kein Volume: `start-dev` mit H2 im Container, der Realm
      wird bei jeder Neuanlage aus `realm.json` importiert.
    - Projektname fest `hv-tool`, Images `hv-tool/api:local` und `hv-tool/web:local`.
12. **Kein Anwendungscode.** `apps/api/src`, `apps/web/src`, `packages/**/src` und der Vertrag bleiben unverändert. Das
    Paket betreibt den Dienst so, wie er ist; das ist der Kern der Aussage an die Betriebsperson. Braucht der Bau doch eine
    Codeänderung (etwa am Startverhalten), ist das ein Befund und eine eigene Scheibe.

## Nicht-Ziele

- Keine Pipeline, kein Image-Push, keine Registry, kein Deploy, keine Umgebung außer dem lokalen Rechner (037b; R11).
- Kein TLS, keine CSP, keine Härtungs-Checkliste für einen Host, keine Secrets aus einer Plattform (037b).
- Keine Betriebsauswertung, kein Prometheus oder Grafana, keine Alarme. `/metrics` bleibt ohne `HV_METRICS_TOKEN` (401).
- Kein Backup, kein Restore, kein Export (038). `stack:reset` löscht, es sichert nicht.
- Keycloak nicht mit Postgres, ohne MFA, ohne Kontenverfahren (088). Der Testrealm ist synthetisch und nur lokal.
- Keine Demo-Betriebsart (`HV_DEMO=1`) im Paket. Das Paket zeigt den Dienstbetrieb, die In-Process-Demo bleibt Netlify.
- Keine Änderung an `apps/api/src`, `apps/web/src`, `packages/domain/src`, `packages/contract/**`, am Konfigurationsschema
  oder an `apps/api/.env.example`.
- Keine Unterstützung ohne Docker (Podman nur „kann gehen“, nicht geprüft). Kein Windows-nativer Weg ohne Docker Desktop.
  CI prüft nur amd64; die gepinnten Digests sind Multi-Arch-Indizes, arm64 ist „sollte gehen“.
- Kein SBOM, keine Signatur, kein Image-Scan (039/074).
- Keine Lastmessung (071).

## Files allowed

Images und Stack:

- `deploy/docker/api.Dockerfile` (neu)
- `deploy/docker/web.Dockerfile` (neu)
- `deploy/docker/nginx.conf` (neu)
- `deploy/compose/compose.yaml` (neu)
- `deploy/compose/postgres-init/10-runtime-role.sh` (neu)
- `.dockerignore` (neu)

Skripte:

- `scripts/stack.mjs` (neu)
- `scripts/stack.test.mjs` (neu; läuft mit pnpm test:scripts in den Gates)
- `scripts/stack-seed.mjs` (neu; Einstieg der Befüllung im Container)
- `scripts/stack-login.mjs` (neu; Playwright-Anmeldung und Screenshot)
- `scripts/lib/demo-bootstrap.mjs` (neu; die Funktion bootstrap aus 031a, unverändert verschoben)
- `scripts/lib/keycloak-ci.mjs` (nur: optionaler Parameter für lesbare Nutzernamen in buildRealm; ohne ihn byte-gleiches Verhalten)
- `scripts/e2e-http-031.mjs` (nur: die Funktion bootstrap aus der neuen Bibliotheksdatei importieren, PERSONS bleibt exportiert; sonst nichts)

Manifest:

- `package.json` (nur die sechs Skripte stack:up, stack:down, stack:reset, stack:smoke, stack:credentials, stack:login)
- `apps/api/package.json` (nur: tsx von devDependencies nach dependencies, gleiche Version)
- `pnpm-lock.yaml` (nur die Folge der Verschiebung)

CI:

- `.github/workflows/gates.yml` (nur der neue Job stack-037a; die Jobs gates und e2e-http bleiben unverändert)

Dokumente und Nachweise:

- `docs/betrieb/installation.md` (neu)
- `README.md` (nur ein Absatz mit Verweis auf die Installationsseite)
- `docs/sicherheit/bedrohungsmodell.md` (nur: Restspalte von T-G2-E-02 „Container ohne Root“ mit Nachweis aus 037a; T-Q-S-02 um „Image lokal gebaut, Digest der Basis-Images gepinnt; Push mit Digest 037b“; T-Q-I-01 um „Secrets des lokalen Stacks je Installation, außerhalb des Repositoriums“; Zeile 037 in der Scheibenübersicht um „037a“)
- `docs/evidence/037a-stack-angemeldet.png` (neu; Screenshot aus Test S13)
- `docs/evidence/037a-stack-protokoll.txt` (neu; Ausgabe von `stack:up`, `stack:smoke` und den Robustheitsproben, ohne Secrets)
- `docs/folgeliste.md` (nur neue nicht blockierende Befunde aus dem Bau; keine Sicherheits-, Datenschutz- oder Rechtspunkte)
- `docs/slices/037a-lokales-betriebspaket.md` (diese Spec: Bericht, Review findings)
- `docs/produktplan-beta.md` (nur durch den Orchestrator und nur nach dem Go zu Eigentümerfrage 1: Teilungsvermerk im Eintrag 037, wie oben vorgeschlagen)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

Alles unter `apps/api/src`, `apps/web/src`, `apps/web/e2e`, `packages/domain`, `packages/contract`, die Konfiguration
`apps/web/vite.config.ts` und `apps/web/playwright.config.ts`, `apps/api/.env.example`, `netlify.toml`, `scripts/e2e-http-031.test.mjs`,
`scripts/keycloak-ci-029b.mjs`, `docs/adr/**`, `docs/glossar.md`. Dieser Abschnitt steht bewusst außerhalb von „Files
allowed“, damit das Scheibenumfang-Tor seine Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. **Daemon in der Arbeitsumgebung.** `dockerd` als root mit `--storage-driver=vfs` und Pfaden unter `/tmp` starten (Pfad
   des containerd-Sockets höchstens 104 Zeichen). Läuft er nicht, bleibt nur der CI-Nachweis nach E56; das steht dann im
   Bericht.
2. **`docker compose up --wait` mit einmaligen Diensten.** Prüfen, ob die Compose-Version in Arbeitsumgebung und Runner
   erfolgreich beendete `migrate`/`seed` als Erfolg wertet. Sonst wartet `stack.mjs` selbst.
3. **Health-Probe von Keycloak.** `KC_HEALTH_ENABLED=true`, Management-Port 9000, `/health/ready`. Prüfen, welches
   Werkzeug das Image dafür mitbringt (bash mit `/dev/tcp`). Es kommen keine Pakete ins Image. Notfalls die Probe auf das
   Discovery-Dokument. Im Bericht nennen, welche gewählt wurde.
4. **tsx in der Produktionsinstallation.** Nach der Verschiebung prüfen, dass
   `pnpm install --prod --frozen-lockfile --filter @hv/api...` `tsx` und den Kern bringt und dass der Loader in distroless
   ohne Schreibzugriff außerhalb von `/tmp` läuft (tsx-Cache: `TMPDIR` auf das tmpfs).
5. **Digests.** Alle Basis-Images per Tag und Digest des Multi-Arch-Index aus der Registry lesen (Docker Hub über
   `mirror.gcr.io` wie in 031a). Postgres und Keycloak **gleich** den Werten in `gates.yml` und `KEYCLOAK_IMAGE`.
6. **Distroless-Node-Version.** `nodejs22` muss `engines` (`>=22`) erfüllen und `fetch` für den HEALTHCHECK haben.
7. **Gelöschtes Volume übernimmt Rechte.** Prüfen, dass ein neues `hv-access-log` 0700 und 65532 aus dem Image übernimmt
   und der Dienst ohne „refusing to start: HV_ACCESS_LOG_DIR“ startet.

## Tests zuerst (rot, dann grün)

**Ohne Docker** (`scripts/stack.test.mjs`, `node --test`, Teil von `pnpm gates`). Die Compose-Datei wird mit `yaml` aus
`apps/api` gelesen, über `createRequire` wie in 031a.

- **S1 Pinning.** Jedes `FROM` in beiden Dockerfiles und jedes `image:` in der Compose-Datei hat die Form
  `name:tag@sha256:<64 hex>`. Postgres ist gleich dem Image in `gates.yml`, Keycloak gleich `KEYCLOAK_IMAGE`. Negativ:
  dieselbe Prüfung auf einen Text mit `postgres:16` ohne Digest schlägt fehl.
- **S2 Ports.** Jeder veröffentlichte Port bindet `127.0.0.1`. Postgres, Dienst, `migrate` und `seed` veröffentlichen
  keinen Port. Negativ: ein `8480:8080` ohne Adresse schlägt fehl.
- **S3 Keine Secrets in versionierten Dateien.**
  - Kein `environment:`-Eintrag der Compose-Datei, dessen Name `PASSWORD`, `SECRET`, `KEY` oder `TOKEN` enthält, hat
    einen Literalwert.
  - Jedes `env_file` zeigt in das Zustandsverzeichnis.
  - Dockerfiles ohne `ARG` oder `ENV` mit solchen Namen.
  - Negativ: ein eingeschleuster `POSTGRES_PASSWORD: x` schlägt fehl.
- **S4 Härtung.**
  - Image des Dienstes: `USER` 65532. Web: 101.
  - Dienst und Web: `read_only`, `cap_drop: [ALL]`, `no-new-privileges`.
  - Alle vier Dauerdienste mit `restart: unless-stopped`, `migrate` und `seed` mit `"no"`.
  - Dienst mit `network_mode: service:keycloak`.
- **S5 Umgebung des Dienstes gegen das echte Schema.** Die von `stack.mjs` erzeugte `api.env` (mit Marker-Secrets)
  besteht `readServiceConfig`:
  - keine unbekannte Variable;
  - Startzeile genau
    `HV-Tool API: start mode=service persistence=postgres auth=oidc cors=none trusted-proxies=<Web-Adresse>/32`;
  - keine Variable aus `FORBIDDEN_SERVICE_VARIABLES` von 031a außer `HV_TRUSTED_PROXY_CIDRS` und, nur mit Option,
    `HV_NTP_SERVERS`;
  - kein `HV_DEMO`, kein `HV_EVENT_LOG`, kein `HV_SEED_ACTOR`, keine Eigentümer-URL.
- **S6 Zustand.**
  - Verzeichnis 0700, Dateien 0600 (`realm.json` 0644), außerhalb des Repositoriums (`assertOutsideRepository` aus 031a).
  - Zwei Neuanlagen ergeben verschiedene Secrets. Die neun Passwörter sind paarweise verschieden und keines gleicht dem
    Client-Secret.
  - Ein zweites Lesen ist idempotent und erzeugt nichts neu.
  - Ein geänderter Port gegenüber dem Zustand wird verweigert.
  - Negativ: Ein Zustandsverzeichnis mit 0755 wird verweigert (Satz nennt Pfad und Regel, keinen Inhalt).
- **S7 Realm.**
  - Gebaut über `buildRealm`: ein vertraulicher Client, `redirectUris` genau `[http://localhost:<Webport>/auth/callback]`,
    `directAccessGrantsEnabled: false`, `registrationAllowed: false`.
  - Neun Personen mit lesbaren Namen und Adressen auf `@example.test`.
  - `buildRealm` ohne den neuen Parameter liefert dieselbe Struktur wie vorher (Nutzernamen `synthetic-<uuid>`).
  - `node --import ./apps/api/node_modules/tsx/dist/loader.mjs scripts/e2e-http-031.mjs --check` bleibt grün.
- **S8 Entfernter Daemon.** Die reine Funktion für die Daemon-Prüfung verweigert `tcp://…` und `ssh://…` und nimmt
  `unix://…`, `npipe://…` und „nicht gesetzt“ an.
- **S9 `.dockerignore`.** Enthält mindestens `.git`, `**/node_modules`, `.env`, `.env.*`, `docs/evidence`,
  `**/playwright-report`, `**/test-results`, `**/dist`.
- **S10 Ausgabe ohne Werte.** Die Formatierer der Ausgaben von `up`, `smoke` und Fehlern bekommen einen Zustand mit
  Marker-Secrets; kein Marker erscheint in der Ausgabe. Nur `credentials` gibt sie aus.

**Mit Docker** (lokal mit dem Daemon aus „Vor dem Bau prüfen“ 1 und im CI-Job `stack-037a`):

- **S11 Start aus dem Nichts.** Nach `stack:reset -- --yes` baut `pnpm stack:up` beide Images. Alle Dauerdienste werden
  gesund, `migrate` und `seed` enden mit 0, und die Schlusszeile erscheint. Zeit und Image-Größen stehen im Protokoll.
  Ziel: Dienst ≤ 300 MB, Web ≤ 80 MB; eine Überschreitung ist ein Befund, kein Abbruch.
- **S12 Rauchtest** (`pnpm stack:smoke`):
  1. `GET http://localhost:8480/` → 200, `text/html`, die drei Header aus Entscheidung 3.
  2. `GET http://localhost:8480/auth/transparency-notice` → 200. Das beweist den Weg Web → Dienst.
  3. Discovery von Keycloak unter dem Issuer → 200, `issuer` gleich dem konfigurierten Wert.
  4. Im Container des Dienstes (`docker compose exec api` mit dem Node des Images): `/healthz` 200. `/readyz` mit `db` und
     `migrations` `ok`; `clock` `ok`, oder `not_configured` bei 503 ohne `HV_STACK_NTP_SERVERS`.
  5. Das Protokoll des Dienstes enthält genau die Startzeile aus S5, kein „refusing to start“, kein „ignoring unknown
     variables“.
  6. Die Ereigniszahl in Postgres ist größer null (`docker compose exec postgres psql` als Eigentümer, nur eine Zahl).
  7. Die Laufzeitrolle ist kein Superuser und hat keine Rechte für `UPDATE` oder `DELETE` auf dem Ereignislog (Abfrage
     auf `pg_roles` und `has_table_privilege`).
- **S13 Anmeldung mit Screenshot** (`pnpm stack:login`). Chromium headless meldet `moderation` über das Keycloak-Formular
  an. Das Passwort liest das Skript aus dem Zustand, gibt es nie aus, kein Trace, kein Video. Danach steht die Oberfläche
  auf Deutsch mit der Wortmeldeliste aus dem Demo-Korpus. Screenshot `docs/evidence/037a-stack-angemeldet.png`.
  Negativ: `norole` meldet sich an und sieht keine Arbeitsansicht (Ergebnis wie in 031a/takt-023, nur geprüft, kein
  Screenshot).
- **S14 Nicht root.** `docker image inspect` zeigt `User` 65532 (Dienst) und 101 (Web). `docker top` für Dienst und Web
  zeigt keine Prozesse mit UID 0.
- **S15 Schema im Image.**
  - `docker run --rm hv-tool/api:local` ohne Umgebung endet mit Exit 1. Auf stderr steht
    `HV-Tool API: refusing to start: HV_ACCESS_LOG_DIR …` ohne Wert.
  - Mit einer vollständigen Umgebung, aber `HV_OIDC_ISSUER=http://keycloak:8180/realms/hv-local`, endet der Start mit
    Exit 1 und dem Satz zu `HV_OIDC_ISSUER`. Das beweist, dass die `http`-Einrichtung nur auf Loopback läuft
    (Entscheidung 6).
- **S16 Robustheit.**
  1. `docker compose restart postgres`: `/readyz` meldet `db` vorübergehend nicht `ok` und innerhalb von 60 s wieder `ok`.
     Der Dienst wird dabei nicht neu gestartet (Neustartzähler unverändert).
  2. `docker compose kill -s SIGKILL api`: Die Neustart-Politik bringt den Dienst innerhalb von 60 s gesund zurück, die
     Ereigniszahl ist unverändert.
  3. `stack:down`, dann `stack:up`: Die Daten bleiben (Ereigniszahl gleich). `seed` meldet „bereits befüllt“ und schreibt
     nichts.
  4. `stack:reset -- --yes`: Volumes und Zustandsverzeichnis sind weg. Das folgende `up` befüllt neu, mit neuen Secrets.
- **S17 Installationsseite befolgt.** Der Implementierer führt die Befehle der Seite in ihrer Reihenfolge aus einem
  sauberen Zustand aus. Das Protokoll (`docs/evidence/037a-stack-protokoll.txt`) folgt der Gliederung der Seite. Der
  Reviewer prüft, dass jeder Befehl der Seite im Protokoll vorkommt (Leitplanken 6.11).
- **S18 CI-Job `stack-037a`.**
  - Läuft nur auf `pull_request`, mit demselben Dokumentenfilter wie `e2e-http`, `timeout-minutes: 25`, Rechte wie der
    Workflow.
  - Schritte: Checkout, pnpm, Node 22, `pnpm install --frozen-lockfile`, Chromium, `stack:up`, `stack:smoke`, S14, S15,
    S16, `stack:login`.
  - Danach immer (`if: always()`) `stack:reset -- --yes` und das Hochladen nur des Screenshots als Artefakt
    `evidence-037a-stack` (Aktion per Hash wie in `gates.yml`).
  - Kein Schritt ruft `stack:credentials` auf. Das Log enthält kein Secret, Prüfung mit einem Marker-Lauf in S10.
  - Der Job ist kein Pflicht-Check (Eigentümerfrage 2).

## Akzeptanzkriterium

Auf einem Rechner mit Docker und Node 22 bringt `pnpm stack:up` aus dem Nichts den Stack gesund hoch. Danach meldet sich
`moderation` im Browser unter `http://localhost:8480` über Keycloak an und arbeitet mit dem Demo-Korpus. Der Stack übersteht
den Neustart von Postgres und den Absturz des Dienstes ohne Datenverlust. Kein Secret steht im Repositorium, in einem
Image, im CI-Log oder im Screenshot. Die Prozesse von Dienst und Web laufen ohne root. Nur Loopback-Ports sind offen.
`docs/betrieb/installation.md` führt eine fremde Person ohne Vorwissen bis zur Anmeldung. Die Tests S1 bis S18 sind grün,
`pnpm gates` ist grün, der CI-Job `stack-037a` ist auf dem letzten Commit des PRs grün.

## Installationsseite (`docs/betrieb/installation.md`, Gliederung verbindlich)

Deutsch, ohne Hauskürzel ohne Erklärung, für eine Betriebsperson ohne Projektwissen:

1. **Was Sie bekommen:** vier Dienste und zwei einmalige Schritte; ein Satz je Dienst; Bild der Ports (Web 8480, Anmeldung
   8180, sonst nichts offen). Ausdrücklich: nur lokal, synthetische Daten und Testpersonen, kein Produktivbetrieb.
2. **Voraussetzungen:** Docker Engine mit Compose v2 (Mindestversionen aus dem Bau), Node 22, für `stack:login` zusätzlich
   pnpm; rund 3 GB Speicher frei und 4 GB Arbeitsspeicher; freie Ports. Browser Chromium, Edge oder Firefox. Safari kann
   `Secure`-Cookies auf `http://localhost` ablehnen.
3. **Ein Befehl:** `pnpm stack:up` (ohne pnpm: `node scripts/stack.mjs up`), erwartete Dauer, erwartete Schlusszeile.
4. **Anmelden:** `pnpm stack:credentials`, Tabelle der neun Testpersonen mit Rolle und Zweck (Rollennamen nur hier und in
   der Ausgabe des Befehls, nie im Code; R4). Admin-Konsole von Keycloak: Adresse, Hinweis „nur lokal“.
5. **Gesundheit prüfen:** `pnpm stack:smoke`; was `/healthz` und `/readyz` bedeuten; warum `clock: not_configured` ohne
   NTP normal ist und wie `HV_STACK_NTP_SERVERS` es ändert; `docker compose -p hv-tool ps`.
6. **Stoppen, Starten, Zurücksetzen:** `stack:down` (Daten bleiben), `stack:up`, `stack:reset -- --yes` (alles weg, neue
   Passwörter).
7. **Robustheit, die Sie selbst prüfen können:** die drei Proben aus S16 als Befehle mit erwartetem Ergebnis.
8. **Sicherheit des Pakets:** Secrets je Installation im Zustandsverzeichnis (Pfad), keine Standardpasswörter, Nutzer ohne
   root, nur Loopback, Laufzeitrolle ohne Eigentümerrechte, Schema verweigert `http` außerhalb von Loopback, Keycloak
   `start-dev` nur lokal, entfernter Docker-Daemon verweigert.
9. **Fehlersuche:** Port belegt; Docker läuft nicht; `up` hängt an Keycloak (Speicher, erste Ladezeit); „refusing to
   start“ im Protokoll (Satz nennt die Variable); Anmeldung springt zurück (Browser, Cookies, falscher Port); `/readyz`
   503; Keycloak neu gestartet und der Dienst hat kein Netz mehr (`docker compose -p hv-tool up -d api`); `docker compose
   -p hv-tool logs <dienst>`.
10. **Was fehlt bis zum Betrieb auf einem Server:** TLS, Secrets aus der Plattform, Alarme, Backup (037b, 038), mit einem
    Satz je Punkt.

## Sicherheit und Datenschutz

| Punkt | Festlegung in 037a | Test |
|---|---|---|
| Secrets | je Installation zufällig, außerhalb des Repositoriums (0700/0600), je Dienst nur die eigenen; der Dienst sieht kein Eigentümerpasswort; keine Ausgabe außer `stack:credentials` | S3, S5, S6, S10, S18 |
| Standardpasswörter | keine; auch der Keycloak-Admin ist zufällig | S6 |
| Ports | nur `127.0.0.1:8480` und `127.0.0.1:8180`; Postgres und Dienst ohne Port | S2 |
| Nutzer | Dienst 65532 (distroless nonroot), Web 101; `read_only`, `cap_drop: ALL`, `no-new-privileges` | S4, S14 |
| Lieferkette | alle Basis-Images per Tag und Digest; Postgres und Keycloak identisch zu CI; `.dockerignore` hält `.git`, `.env*` und Nachweise aus dem Build-Kontext | S1, S9 |
| Datenbankrechte | Laufzeitrolle ohne Superuser und ohne `UPDATE`/`DELETE` auf dem Ereignislog (Migrationen 027) | S12.7 |
| Lokale Grenze | Schema verweigert `http`-Issuer außerhalb von Loopback; Skript verweigert entfernten Daemon (R11) | S8, S15 |
| Daten | nur `CORPUS_DEMO` aus `seed.ts`, Personen auf `@example.test`; keine echten Daten (R11) | S7, S12.6 |
| Screenshot und Artefakt | kein Passwortfeld mit Inhalt im Bild, kein Trace, kein Video; nur der Screenshot wird hochgeladen | S13, S18 |
| Zugriffslog | Volume mit 0700 und Eigentümer 65532, lokaler Datenträger (das ist die Betriebsvorgabe aus dem 033a-Befund für den lokalen Stack); Füllstandsalarm 037b | S11, S12.5 |

**Missbrauchsfall (Leitplanken 6.5).**
- *Ablauf:* Jemand übernimmt `compose.yaml` mit einer `http`-Einrichtung auf einen erreichbaren Server, um „schnell“ zu
  zeigen.
- *Wirkung:* Der Dienst verweigert den Start, weil der Issuer nicht Loopback ist (S15). Bleibt der Issuer auf `localhost`,
  funktioniert die Anmeldung von außen nicht. Die Ports binden nur Loopback. Das Skript verweigert einen entfernten Daemon.
- *Restrisiko:* Jemand ändert die Port-Bindung von Hand und stellt das Web ohne TLS ins Netz. Für die Anmeldung braucht
  er dann einen eigenen Issuer. *Signal:* Startzeile mit `auth=oidc` auf einem Nicht-Entwicklungsrechner.
  *Empfänger:* technischer Betrieb ab 037b.
- *Ausnahme mit Eigentümer und Ablauf:* bis 037b nur die Installationsseite (Abschnitt 8). Eigentümer technischer Betrieb,
  Ablauf mit dem Merge von 037b.

**Lizenzen der Images:** Keycloak (Apache 2.0), nginx (BSD-2), Postgres (PostgreSQL License), distroless (Apache 2.0).
Für eine lokale Demo ohne Weitergabe des Images genügt das. Bei Weitergabe des Images prüft 037b die Hinweise.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch
Ausgelöst: [x] Vertrag, Ereignis, Konfiguration (nur Betrieb der vorhandenen Konfiguration) [x] Persistenz (Rollen,
Migration und Befüllung im Stack) [x] Rolle, Recht, Identität (Testrealm, Rollenzuordnung per Befüllung) [x] Betrieb,
Wiederherstellung [x] Dokumentation, Schulung
Perspektive(n): Betrieb, Security · Reviewer. Nachweise: S1–S18, Screenshot, Protokoll, CI-Lauf. Offene Entscheidung: E10
(Hosting) bleibt offen, 037a ist davon unabhängig.

**Warum hoch und nicht mittel.** Leitplanken §4 nennt „Deployment, Secrets, Netzgrenzen“ als Hoch-Auslöser. 037a erzeugt
und verteilt Secrets und legt fest, welche Ports offen sind und unter welchem Nutzer die Prozesse laufen. Es baut die
Images, die 037b ausrollt. Dass alles lokal bleibt, senkt die Wirkung, nicht die Klasse. Herabstufen entscheidet nur der
Mensch. Der Plan führt 037 als hoch. Daraus folgen: Lesebefund der Spec vor dem Bau, ein Review in frischem Kontext mit
Perspektive Betrieb und Security, nie gebündelt, Positiv- und Negativtest je Auslöser und ein Wiederherstellungsfall
(S16).

## Offene Eigentümerfragen

1. **Teilung von 037 (Planänderung).** Standard: 037a wie hier, 037b mit dem Rest, Planvermerk wie oben vorgeschlagen.
   037a wird vorgezogen, vor das Planfenster 30.10.2026, damit es zur Freigabe-Demo steht. Ohne Go bleibt 037 eine
   Scheibe mit beiden Teilen. Dann wartet das lokale Paket auf das Hosting (E10), und die Freigabe-Demo zeigt keinen
   Installationsnachweis.
2. **CI-Job `stack-037a` als Pflicht-Check?** Er kostet rund 10 bis 15 Minuten je Code-PR (Image-Build ohne Cache,
   Keycloak-Start). Standard: läuft auf jedem Code-PR, ist aber kein Pflicht-Check, wie `e2e-http` bis zur Entscheidung zu
   031a Frage 1. Alternative: Pflicht-Check, oder nur bei Änderungen unter `deploy/**`, `apps/**`, `packages/**` und
   `pnpm-lock.yaml`.

Alles Übrige ist technisch und hier entschieden (Basis-Images, Ports, Uhrprüfung, Ablage der Secrets).

## Hinweise an 037b

- Die Images aus 037a sind die Artefakte. 037b ergänzt Push mit Digest, nicht einen zweiten Build. Basis-Digests
  aktualisiert ein Takt, Postgres und Keycloak zusammen mit `gates.yml` und `KEYCLOAK_IMAGE` (S1 erzwingt die Gleichheit).
- `network_mode: service:keycloak` ist eine lokale Krücke für den `http`-Issuer. Auf Staging gilt ein `https`-Issuer mit
  echtem Hostnamen, dann entfällt sie.
- Offen für 037b: Bindeadresse des Dienstes (031a-Befund), ACLs auf dem Log-Datenträger (034b nit), synchrones Schreiben
  der Senke (033a minor), CSP mit Report-Test, Sourcemaps im Web-Image (T-Q-I-02), Füllstandsalarm, NTP ausgehend.
- Der Weg `/v1/stream` durch nginx (Entscheidung 3) ist der lokale Beleg für 035b Frage 3. Der Konzern-Proxy bleibt offen.

## Nachweise

- `pnpm gates` grün auf dem Bau-Commit, Schluss der Ausgabe wörtlich im Bericht (R2).
- `docs/evidence/037a-stack-angemeldet.png` (S13). Lokal erzeugt; nur wenn der Daemon lokal nicht läuft, gilt nach E56
  das CI-Artefakt `evidence-037a-stack` mit Artefaktname, Lauf-ID, Artefakt-ID und Digest im Bericht.
- `docs/evidence/037a-stack-protokoll.txt`: Ausgabe von S11, S12, S14, S15 und S16 in der Gliederung der
  Installationsseite (S17), mit Image-IDs, Image-Größen und Startdauer, ohne Secrets.
- CI-Job `stack-037a` grün auf dem letzten Commit des PRs (Lauf-ID im Bericht).

## Bericht (nach Bau ausfüllen)

```
Slice: 037a-lokales-betriebspaket
Done:
Evidence:
Open:
Touched:
```

**Stand Eigentümerfragen 1 und 2:**

**Vor dem Bau prüfen (Ergebnisse).**
1. Daemon lokal:
2. `--wait` mit einmaligen Diensten:
3. Health-Probe Keycloak (gewählt):
4. tsx in der Produktionsinstallation:
5. Digests (Tag und Digest je Image):
6. Distroless-Node-Version:
7. Rechte des neuen Volumes:

**Images.** Tag, Image-ID, Größe, `User`:

**Startdauer** (`stack:up` aus dem Nichts, mit und ohne Image-Cache):

**Rauchtest (S12), Ausgabe:**

**Robustheit (S16), Ausgabe:**

**CI-Job `stack-037a`:** Lauf-ID, Dauer, Ergebnis:

**`pnpm gates` (Schluss, Commit):**

```
```

## Review findings
