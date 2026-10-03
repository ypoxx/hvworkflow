# Scheibe 037a — Lokales Betriebspaket (Container und Compose) für die Freigabe-Demo

**Status:** spec (03.10.2026; gelesen auf `acb7f45`; überarbeitet nach dem Lesebefund zu `111b0d9`: 0 blocker, 8 major, Minor; Teil 1 der geteilten Scheibe 037, Zuschnitt im Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 4 AStd (Teil a, nach Kürzung; Schätzung für 037b rund 2 AStd, Summe 6 statt 2,5 laut Plan) · Plan 037: 30.10.2026 (W5); 037a frühestens nach dem Go zu Eigentümerfrage 1, Ziel vor der Freigabe-Demo · Lanes: infra; docs-betrieb; scripts (nur die eigenen neuen Dateien und die Auslagerung aus dem 031a-Harness)
**Rolle:** implementierer-backend. Review in frischem Kontext mit den Perspektiven **Betrieb** (Installierbarkeit, Wiederanlauf, Anleitung) und **Security** (Secrets, Ports, Nutzer im Container, Lieferkette, Datenbankrollen). Lesebefund der Spec vor dem Bau; nie gebündelt (Leitplanken §4, hoch). Die Befolgung der Installationsseite (S17) macht ein **eigener Agent in frischem Kontext**, nicht der Implementierer. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine fachliche Regel-id (kein Übergang, kein Recht, keine Vertragsänderung). Angewandt: AGENTS.md R2, R4, R6 (nicht berührt: keine neue Operation), R11, R12. Bedrohungsmodell: T-G2-E-02, T-G2-S-01, T-Q-S-02, T-Q-I-01, T-Q-I-02, T-G1-D-01 (Proxy-Teil), T-G1-S-02 (Cookie auf `localhost`) und das Restrisiko der SECURITY-DEFINER-Funktion `auth_purge_login_states` (Migration 0003)
**Quellen-IDs:**
- `docs/produktplan-beta.md` Eintrag 037 (Zeile 613–618), Eintrag 038 (Zeile 619–624, hängt an 037), §4 Zeile 244 (ADR 0007), §11 (Zielpfad Beta-2)
- Eigentümerentscheidung 03.10.2026 „Freigabe-Demo“ (Auftrag an den Architekten). Eine Person, die den Betrieb solcher Anwendungen kennt, soll sehen, dass die Anwendung gut dokumentiert, leicht installierbar und robust ist. Es gibt keinen gehosteten Server; ein Deploy kommt erst nach ausdrücklichem Go (R11).
- ADR 0007 (zwei Artefakte, Konfigurationsschema, `/healthz` und `/readyz`), ADR 0003 (Postgres, Eigentümer- und Laufzeitrolle), ADR 0004 (OIDC, BFF), ADR 0013 (Zugriffslog)
- Specs 027 (Migrationen, `HV_DB_RUNTIME_ROLE`), 029b und 031a (Keycloak-Testrealm, CI-Harness), 033a (Zugriffslog, NTP), 034a (Grenzen; `server.ts:52-56` übergibt die Grenze vor der Anwendung an 037), 034b (Konfigurationsschema, Hinweise an 037)
- `docs/folgeliste.md`: 033a R1 minor (synchrones Schreiben des Zugriffslogs → 037), 031a Bau (Bindeadresse → 037), 034b Review nit (ACLs des Log-Verzeichnisses → 037)
- Register E10, E39, E56
- Lesebefund zu Spec 037a (03.10.2026, zu `111b0d9`)

**Depends on:** 027, 029b, 031a, 033a, 033b, 034a, 034b (alle gemergt; der Code auf `acb7f45` enthält Schema, Migrationen, Harness und Health-Endpunkte)
**Perspektive:** Betrieb, Security · **Glossar: neue Begriffe:** nein (Betriebspaket, Stack und Image sind Betriebswörter, keine Oberflächentexte)

## Teilung und Zuschnitt

Die Planzeile 037 (2,5 AStd) bündelt drei Dinge: das Container-Image, die Pipeline mit drei Umgebungen und die
Betriebsauswertung mit Alarmen. Die Freigabe-Demo braucht davon nur, was ohne Server und ohne Go läuft. Deshalb wird 037
geteilt, **ein PR je Spec** (R12):

| Teil | Inhalt | Klasse · AStd |
|---|---|---|
| **037a** (diese Spec) | Image des Dienstes, getrenntes Image der Befüllung, Image des Webs mit Grenzen am Proxy, Compose-Stack mit Postgres (Eigentümer ohne Superuser) und Keycloak-Testrealm, ein Befehl für Start, Befüllung und Rauchtest, Installationsseite, CI-Nachweis „Images bauen, Stack wird gesund“ | hoch · 4 |
| **037b** | Pipeline mit Image-Push und Digest, Umgebungen demo / staging-synthetic / rehearsal, Approval-Environment, Health-Smoke nach Deploy mit Rollback, Freeze-Regel, Betriebsauswertung mit Alarmversand (Füllstand und Schreibfehler der Zugriffslog-Senke), UDP/123 nur zu den NTP-Servern, CSP mit CSP-Report im e2e gegen den Produktions-Build, Image-Scan, vertrauenswürdiger Proxy (`HV_TRUSTED_PROXY_CIDRS`) mit Test, Härtungs-Checkliste Host, Eigentümer-Checkliste Secrets | hoch · rund 2 |

037b baut auf den Images aus 037a auf. Was 037b vorfindet, steht im Abschnitt „Hinweise an 037b“. 038 (Backup, Restore)
hängt im Plan an 037. Für den Restore-Drill genügt 037a, für den nightly Job auf Staging braucht es 037b.

**Aufwand, ehrlich geschätzt.** Die erste Fassung nannte 2,5 AStd. Der Lesebefund schätzt 4 bis 5. Diese Fassung kürzt
dreierlei:
- **kein neuer Parameter in `buildRealm`:** `stack.mjs` setzt die lesbaren Nutzernamen auf das Ergebnis, die Bibliothek
  bleibt unverändert;
- **CI nur mit S16.1 und S16.2:** S16.3 und S16.4 laufen nur lokal und stehen im Protokoll;
- **kein vertrauenswürdiger Proxy lokal:** Entscheidung 10, der Test wandert nach 037b.

Mit den Zusätzen aus dem Lesebefund (Image der Befüllung, Eigentümer ohne Superuser, Grenzen am Proxy, stabiler Realm,
Init-Prozess, Befolgung durch einen frischen Agenten) bleiben **4 AStd**. Das ist mehr als eine übliche Agentenschicht.
Eine weitere Teilung wäre möglich (Images und Stack ohne CI-Job, dann der CI-Job als Takt). Sie bringt aber zwei Reviews
derselben Sicherheitsfläche. Deshalb ist sie nicht der Standard (Eigentümerfrage 1).

**Vorgeschlagene Änderung am Plan.** Sie ist nicht in dieser Spec umgesetzt. Der Orchestrator trägt sie nach dem Go zu
Eigentümerfrage 1 in `docs/produktplan-beta.md` ein:

```
- **037 · Container, Pipeline, drei Umgebungen, Betriebsauswertung, Freeze-Regel** — hoch · 2,5 AStd · …
  - *Ziel:* 037 geteilt: 037a lokal, 037b Pipeline/Staging. 037a (03.10.2026, Freigabe-Demo): Images für Dienst, Befüllung
    und Web, Compose-Stack mit Postgres und Keycloak-Testrealm, ein Befehl, Installationsseite docs/betrieb/installation.md,
    CI-Job „Stack wird gesund“. 037b: alles Übrige dieses Eintrags (Pipeline, Umgebungen, Approval, Freeze, Alarme,
    CSP, Image-Scan, Proxy-Vertrauen, Härtungs- und Secrets-Checkliste). Aufwand neu: 037a 4 AStd, 037b rund 2 AStd.
```

Der Orchestrator entscheidet mit dem Kalender, ob der Eintrag zwei Planzeilen `037a` und `037b` bekommt (das Format von
plan-graph erlaubt `\d{3}[a-z]?`) oder nur den Teilungsvermerk.

## Befund (Ist-Stand, gelesen auf `acb7f45`)

- **Kein Container, kein Compose.** Die Suche nach Dateien mit `docker` oder `compose` im Namen außerhalb von
  `node_modules` findet nichts.
- **Der Dienst startet aus dem Quelltext** mit `tsx` (`apps/api/package.json`, Skript `start`). Ein JavaScript-Build gibt es
  nicht: `build` ist `tsc --noEmit`.
- **Laufzeit braucht tsx.**
  - Der Kern importiert mit `.js`-Endungen auf `.ts`-Dateien (`packages/domain/src/index.ts`). Das eingebaute
    Type-Stripping von Node 22 löst `./types.js` nicht auf `types.ts` auf.
  - Der Dienst liest zur Laufzeit `packages/contract/openapi.yaml` über `require.resolve` (`apps/api/src/contractSchema.ts:20`)
    und importiert `catalog.json` mit Import-Attribut.
  - `tsx` steht nur in den `devDependencies` von `@hv/api`, obwohl `start` es im Betrieb braucht.
- **CI startet den Stack schon, ohne Compose** (`.github/workflows/gates.yml`).
  - **Job `gates`:**
    - Postgres als Service mit `postgres:16@sha256:1a6a…4b54`.
    - `POSTGRES_USER: hv_owner`. Damit ist der Eigentümer **Superuser** des Clusters.
    - Die Laufzeitrolle `hv_runtime` legt ein `psql`-Schritt an. Dazu `HV_DB_RUNTIME_ROLE=hv_runtime`.
    - Migration mit `pnpm --filter @hv/api db:migrate up`.
  - **Job `e2e-http`** (`scripts/e2e-http-031.mjs`):
    - Keycloak per `docker run` aus `scripts/lib/keycloak-ci.mjs`: `KEYCLOAK_IMAGE` 26.7.4 per Digest,
      `start-dev --import-realm`, Port nur auf `127.0.0.1`.
    - Realm mit einem vertraulichen Client und synthetischen Personen aus `buildRealm`. Jeder Aufruf erzeugt neue
      zufällige IDs, Nutzernamen und Passwörter.
    - Danach Datenbank, Migration und Bootstrap. Die Funktion `bootstrap` liest das modulweite `PERSONS` desselben
      Harness. Sie importiert über die Pfade `../apps/api/src/…` und `../packages/domain/src/…`, relativ zu `scripts/`, und
      schreibt die Ereignisse als Eigentümer, **bevor** der Dienst startet.
    - Der Dienst bekommt eine ausdrückliche Umgebung ohne `...process.env`.
  - Auf dem Runner `ubuntu-latest` sind Docker und Compose v2 vorhanden.
- **Migrationen und Superuser.** `grantRuntimeAccess` (`apps/api/src/persistence/migrations.ts:143-186`) prüft, dass die
  Laufzeitrolle weder Superuser noch Eigentümerin ist. Es entzieht `PUBLIC` das Recht CREATE auf dem Schema und vergibt
  Rechte. Migration 0003 legt `auth_purge_login_states` als `SECURITY DEFINER` an. Die Funktion läuft mit den Rechten des
  Eigentümers. Ist der Eigentümer Superuser, wird eine Lücke in dieser Funktion zur Lücke mit Superuser-Rechten.
  Keine Migration braucht nach Lesart des Architekten Superuser-Rechte: keine Extension, kein `CREATE ROLE`, kein
  `ALTER ROLE`. Bestätigen muss das „Vor dem Bau prüfen“ 8.
- **Konfigurationsschema (034b)** (`apps/api/src/config/schema.ts`):
  - Issuer und Redirect-URI müssen `https` sein, `http` nur für `localhost` und `127.0.0.1`.
  - CORS außerhalb der Demo nur `https`.
  - `HV_DEMO=1` und OIDC schließen sich aus.
  - Außerhalb der Demo verweigert der Start ohne `HV_ACCESS_LOG_DIR` (echtes Verzeichnis, 0700 oder 0750) und ohne
    `HV_ACCESS_LOG_HASH_KEY`.
  - Einen „lokalen Modus“ gibt es nicht. Die Loopback-Regel verweigert eine `http`-Einrichtung auf jedem anderen Host schon
    heute.
- **Web im HTTP-Modus.** `HV_WEB_MODE=http` ist ein Build-Schalter. Der Browser spricht same-origin mit `/v1` und `/auth`;
  der Dienst liefert keine statischen Dateien aus. `apps/web/vite.config.ts` baut mit `sourcemap: true`.
- **Grenze vor der Anwendung.** `server.ts:52-56` setzt nur die Header- und Request-Timeouts von Node. Sichtbarkeit und
  Grenze am Proxy übergibt der Kommentar an 037. Die Body-Grenze der Anwendung ist `BODY_LIMIT_BYTES` (262144,
  `apps/api/src/limits/config.ts`).
- **Cookies** tragen `Secure`. Chromium und Firefox nehmen sie auf `http://localhost` an. Cookies gelten je Host, nicht je
  Port: Jede andere Anwendung auf `localhost` bekommt `hv_session` mitgeschickt.
- **`/readyz`** ohne `HV_NTP_SERVERS`: `clock: not_configured`, Antwort 503. 031a nimmt das hin und prüft `db` und
  `migrations` einzeln.
- **Node als PID 1.** Der Server registriert keinen SIGTERM-Handler. Als PID 1 im Container ignoriert Node Signale mit
  Standardaktion, `docker stop` wartet die 10 s bis SIGKILL.
- **Diese Arbeitsumgebung.** Docker-CLI 29.3.1 und Compose v5.1.1 sind installiert, ein Daemon läuft nicht. Probe des
  Architekten am 03.10.2026: `dockerd` startet als root mit `--storage-driver=vfs` und kurzen Pfaden unter `/tmp`, und
  `docker run --rm hello-world` lief durch.

## Ziel

Wer das Repository auscheckt, startet mit **einem Befehl** einen vollständigen lokalen Betrieb. Dazu gehören der Dienst,
das Web im HTTP-Modus mit Grenzen am Proxy, Postgres mit Eigentümer ohne Superuser und Laufzeitrolle, und Keycloak mit
einem synthetischen Testrealm, der über Neustarts stabil bleibt. Der Stack wird mit dem Demo-Korpus und neun Testpersonen
mit Rollen befüllt. Ein Rauchtest bestätigt, dass er gesund ist.

Eine Installationsseite führt durch alle Schritte des Betriebs: Voraussetzungen, Start, Anmeldung, Health-Checks,
Stoppen, Aktualisieren, Zurücksetzen, Deinstallieren und Fehlersuche.

Das Image des Dienstes ist dasselbe, das 037b später ausrollt: gleiches Konfigurationsschema, Nutzer ohne Root,
Basis-Images per Digest, **kein Befüllungscode im Image**. Die CI beweist auf jedem Code-PR, dass alle Images bauen und der
Stack gesund wird.

## Entscheidungen vor Bau

1. **Dateiorte.**
   - Images und Stack liegen unter `deploy/`, nicht in `apps/`. Das ist die Lane infra, kein Anwendungscode.
   - Build-Kontext ist die Wurzel des Repositoriums, weil die Images Workspace-Pakete brauchen.
   - An der Wurzel liegen eine `.dockerignore` und eine `.gitattributes` mit `*.sh text eol=lf` (das Init-Skript läuft auch
     unter Windows-Checkouts).
2. **Image des Dienstes** (`deploy/docker/api.Dockerfile`, Ziel `api`, das letzte Ziel der Datei und damit der Standard):
   - **Baustufe** auf `node:22-bookworm-slim` (Digest):
     - pnpm über corepack, gepinnt mit Hash. `packageManager` in `package.json` wird
       `pnpm@10.33.0+sha512.<hash>`, corepack prüft den Hash.
     - Danach `pnpm install --frozen-lockfile --prod --filter @hv/api...`.
   - **Laufzeitstufe** auf `gcr.io/distroless/nodejs22-debian12:nonroot` (Digest). Plan 037 verlangt distroless und
     non-root. Nutzer 65532, keine Shell, kein Paketmanager.
   - **Pfade wie im Repositorium** unter `/app`, nur `apps/api`, `packages/domain` und `packages/contract` mit ihren
     Produktionsabhängigkeiten. **Kein `/app/scripts`.** Startbefehl wie heute: Node mit dem tsx-Loader auf
     `apps/api/src/server.ts`.
   - **`tsx` wandert in `apps/api/package.json` von `devDependencies` nach `dependencies`.** Es ist heute schon die
     Laufzeit von `start`. Verworfen: ein esbuild-Bündel. Es bräuchte eine neue Abhängigkeit, müsste `openapi.yaml` und das
     JSON-Import-Attribut nachbilden und wäre ein zweiter Startweg neben dem, den CI testet.
   - **`HEALTHCHECK`** auf `/healthz` mit dem Node des Images (`node -e` mit `fetch`).
   - **Verzeichnisse im Image:**
     - `/var/lib/hv`: root:root, 0755.
     - `/var/lib/hv/access-log`: 65532:65532, 0700. Ein neues benanntes Volume übernimmt Rechte und Eigentümer. Damit
       besteht die Prüfung aus 034b, und der Eigentümer ist festgelegt (Hinweis aus 034b).
   - **`TMPDIR=/tmp`** für den Cache von tsx. Compose hängt dort ein tmpfs ein.
3. **Image der Befüllung** (dieselbe Datei, Ziel `seed`, Tag `hv-tool/seed:local`; Major SP-1):
   - Es baut auf der Laufzeitstufe auf und fügt `scripts/stack-seed.mjs`, `scripts/lib/demo-bootstrap.mjs` und
     `scripts/lib/demo-persons.mjs` hinzu.
   - Nur der einmalige Dienst `seed` nutzt es. Das Image `api` enthält diesen Code nie. 037b rollt nur `api` aus, `seed`
     wird nie gepusht.
   - `stack-seed.mjs` schreibt Rollenzuordnungen mit Eigentümerrechten direkt ins Log, am Rechtepfad vorbei. Darum
     verweigert es (Exit 1, fester Satz ohne Wert), wenn eine dieser Bedingungen nicht erfüllt ist:
     1. Der Issuer aus seiner Umgebung ist `http://localhost:<port>/…` oder `http://127.0.0.1:<port>/…`.
     2. Das Ereignislog ist leer. Ist es nicht leer, ist das kein Fehler: Exit 0 mit dem festen Satz „bereits befüllt“,
        es wird nichts geschrieben.
     3. Die Datenbank-URL zeigt auf den Compose-Host `postgres`.
   - `stack-seed.mjs` lädt `pg` über `createRequire` aus `apps/api/package.json`, wie 031a (`apiRequire`). pnpm hebt `pg`
     nicht an die Wurzel, ein nackter Import aus `scripts/` fände es nicht.
4. **Image des Webs** (`deploy/docker/web.Dockerfile`).
   - **Baustufe:** `HV_WEB_MODE=http pnpm --filter @hv/web build`.
   - **Laufzeit:** `nginxinc/nginx-unprivileged` (alpine, Digest, Nutzer 101, Port 8080).
   - **`deploy/docker/nginx.conf`:**
     - **Auslieferung:** `dist` mit Rückfall auf `index.html` für die Routen der Oberfläche.
     - **Weiterleitung:** `/v1` und `/auth` an den Dienst, wie der Vite-Proxy. `X-Forwarded-For` wird mit `$remote_addr`
       **überschrieben**.
     - **Strom:** für `/v1/stream` `proxy_buffering off`, `proxy_read_timeout` deutlich über dem Heartbeat von 15 s,
       HTTP/1.1 ohne `Connection: close`.
     - **Grenzen vor der Anwendung** (T-G1-D-01, Proxy-Teil; Übergabe aus `server.ts:52-56`):
       - `client_header_timeout 10s` und `client_body_timeout 10s`, wie im Dienst;
       - `send_timeout 30s`;
       - `keepalive_timeout 15s`, `keepalive_requests 1000`;
       - `large_client_header_buffers 4 8k`;
       - `client_max_body_size 257k`, knapp über 262144 Byte. Die eigene 413 des Dienstes entscheidet die Grenze, nginx
         fängt nur Größeres ab.
       - Kein `limit_req`: Die Grenzen je Quelle und Subject setzt der Dienst (034a).
     - **Sicherheitsheader:** die drei aus `netlify.toml` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
       `Referrer-Policy: no-referrer`).
       - Jeweils mit `add_header … always` in **jeder** `location`. nginx erbt `add_header` nicht in Blöcke mit eigenem
         `add_header`.
       - `always` sorgt dafür, dass die Header auch auf 4xx und 5xx des Proxys stehen, etwa 502 bei gestopptem Dienst.
       - Für weitergeleitete Antworten **ersetzt** nginx die drei Header des Dienstes: `proxy_hide_header` für dieselben
         drei, dann `add_header … always`. So steht jeder genau einmal da. Weil die Werte gleich denen des Dienstes sind
         (034a), ändert sich nichts. Alle anderen Header des Dienstes reicht nginx unverändert durch.
     - **Keine Quelltextkarten:** `location ~ \.map$ { return 404; }` (T-Q-I-02, die sicherere Wahl). Das Netlify-Demo
       bleibt unverändert; das ist 037b.
       - nginx prüft Regex-Locations vor einfachen Präfix-Locations. Diese Regex greift deshalb auch für einen Pfad unter
         `/v1`, der auf `.map` endet. Die Präfix-Locations für `/v1` und `/auth` haben kein `^~`.
       - Ein Kommentar in `nginx.conf` sagt das ausdrücklich, damit niemand später ein `^~` ergänzt oder die Regex für
         eine Lücke hält. Der Dienst hat keinen Pfad auf `.map`.
     - **Nicht weitergeleitet:** `/healthz`, `/readyz` und `/metrics` beantwortet nginx auf 8480 mit 404, als exakte
       `location`, damit sie nicht in den Rückfall auf `index.html` fallen. Die Proben laufen im Container
       (Rauchtest S12.4).
     - `server_tokens off`.
   - **Keine CSP in 037a.** Sie kommt in 037b zusammen mit dem CSP-Report-Test. Eine ungeprüfte CSP könnte die Demo
     brechen.
   - Verworfen: Der Dienst liefert die statischen Dateien selbst aus. Das wäre Anwendungscode und widerspräche ADR 0007.
5. **Issuer auf `localhost` im Container.**
   - Das Schema erlaubt `http` nur für `localhost`. Im Container des Dienstes ist `localhost` aber der Container selbst. Der
     Dienst muss Keycloak unter **derselben** URL erreichen wie der Browser (`oidc.ts:76`, Issuer-Prüfung).
   - **Lösung:** Der Dienst teilt den Netz-Namensraum von Keycloak (`network_mode: service:keycloak`). Keycloak hört **im
     Container auf demselben Port wie auf dem Rechner** (`KC_HTTP_PORT` gleich `HV_STACK_IDP_PORT`, Standard 8180). Dieser
     Port ist auf `127.0.0.1` veröffentlicht. Der Issuer `http://localhost:<port>/realms/hv-local` gilt so für Browser und
     Dienst gleich.
   - nginx erreicht den Dienst als `keycloak:8787`. Die Compose-Datei begründet das im Kommentar.
   - **Verworfen:**
     - eine Ausnahme im Schema (Sicherheitsänderung an 034b für eine Bequemlichkeit);
     - `extra_hosts` für `localhost` (unzuverlässig);
     - TLS mit eigener CA (037b).
   - **Grenze:** Startet Keycloak neu, verlieren Dienst und, über den Namen, nginx ihr Ziel. Die Installationsseite nennt
     die Abhilfe: `pnpm stack:up -- --recreate api web`. Der Neuaufbau läuft immer über `stack.mjs`, weil nur das Skript die gespeicherten Ports aus `state.json` an Compose übergibt; ein direkter `docker compose … up` fiele auf die Standardports zurück (Codex P2 auf #124). Die Robustheitsproben zielen auf Dienst und
     Postgres.
6. **Ports nur auf Loopback.**
   - Veröffentlicht werden nur `127.0.0.1:<Webport>` (Standard 8480, im Container 8080) und `127.0.0.1:<IdP-Port>`
     (Standard 8180, im Container derselbe Port, Entscheidung 5). Postgres und der Dienst haben keinen veröffentlichten Port.
   - Die Ports lassen sich beim ersten Start mit `HV_STACK_WEB_PORT` und `HV_STACK_IDP_PORT` ändern (1024 bis 65535). Sie
     stehen dann im Zustand. Ein späterer anderer Wert wird mit Hinweis auf `stack:reset` verweigert, weil Realm und Issuer
     daran hängen.
   - **Docker Engine ≥ 28 ist Pflicht** und wird in `stack:up` geprüft. Ältere Versionen ließen Rechner im selben Netzsegment
     unter Umständen direkt an Ports, die nur auf `127.0.0.1` veröffentlicht sind. Compose v2 mit der Mindestversion aus dem
     Bau wird ebenfalls geprüft.
7. **Keine Standardpasswörter, Secrets und Realm je Installation, einmal erzeugt** (Major 4).
   - **Was der erste Start erzeugt:**
     - die Passwörter des Postgres-Bootstrap-Superusers, des Eigentümers `hv_owner` und der Laufzeitrolle `hv_runtime`;
     - `HV_AUTH_ENCRYPTION_KEY` und `HV_ACCESS_LOG_HASH_KEY`;
     - den Keycloak-Admin;
     - den **ganzen Realm** über `buildRealm` mit Client-ID, Client-Secret, Personen-IDs und Passwörtern. Danach setzt
       `stack.mjs` lesbare Nutzernamen und Adressen auf `@example.test`.
   - **Ablage:** Alles steht in `state.json` und wird **nie neu erzeugt**. Bei jedem `up` werden aus `state.json`
     byte-gleich geschrieben: `realm.json` und die Umgebungsdateien je Dienst (`api.env`, `postgres.env`, `migrate.env`,
     `seed.env`, `keycloak.env`).
   - **Folge für Keycloak:** Es hat kein Volume (`start-dev`, H2 im Container) und importiert bei jeder Neuanlage denselben
     Realm mit denselben IDs. Die Rollenzuordnungen im Log (Akteur aus Issuer und Subject) bleiben gültig.
   - **Zustandsverzeichnis:** `${XDG_STATE_HOME:-$HOME/.local/state}/hv-tool-stack`, **außerhalb des Repositoriums**.
     Rechte 0700, Dateien 0600. Ausnahme: `realm.json` mit 0644, damit der Keycloak-Nutzer sie lesen kann wie in 031a; das
     Verzeichnis bleibt 0700.
   - **Wer was bekommt:** Jeder Dienst bekommt nur seine eigene Datei (`env_file`).
     - Das Bootstrap-Passwort des Superusers steht **nur** in `postgres.env`.
     - Der Dienst sieht nie ein Eigentümer- oder Superuser-Passwort.
     - Nur `migrate` und `seed` halten die Eigentümer-URL. `docker inspect` zeigt sie auf diesen beiden Containern. Wer
       Docker bedienen darf, ist ohnehin root-gleich; die Installationsseite nennt das.
   - **In versionierten Dateien steht kein Secret.**
   - **Lokale Grenze, schon erzwungen:**
     - Das Schema verweigert `http` außerhalb von Loopback (S15).
     - Das Skript verweigert einen entfernten Docker-Daemon (`DOCKER_HOST` oder Kontext mit `tcp://` oder `ssh://`). Ein
       Start dort wäre ein Deploy ohne Go (R11).
     - `start-dev` ist in Compose-Kommentar und Installationsseite als „nur lokal“ markiert.
   - **Drift zwischen Zustand und Volumes** (Minor 16): Gibt es `hv-tool_hv-pgdata` ohne Zustandsverzeichnis, oder ein
     Zustandsverzeichnis ohne dieses Volume (nach einem ersten erfolgreichen Start), verweigert `stack:up`. Der feste Satz
     verweist auf `stack:reset`.
8. **Datenbankrollen ohne Superuser für die Anwendung** (Major 2).
   - `POSTGRES_USER` ist ein eigener Bootstrap-Superuser (`postgres`). Sein Passwort steht nur in `postgres.env`, nichts
     anderes nutzt ihn.
   - **`POSTGRES_DB` ist nicht gesetzt**, oder es ist `postgres`; **`POSTGRES_DB=hv` ist verboten**. Sonst legt der
     Entrypoint `hv` mit Eigentümer `postgres` an, bevor das Init-Skript läuft. Dann kann `hv_owner` nicht migrieren.
     S3 prüft das: Die Compose-Datei und `postgres.env` enthalten kein `POSTGRES_DB=hv`.
   - Das Init-Skript (`deploy/compose/postgres-init/10-roles.sh`, SQL als Heredoc, nicht `psql -c`, Passwörter über
     psql-Variablen, nichts ausgegeben) legt an:
     1. `hv_owner` LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB;
     2. die Datenbank `hv` mit Eigentümer `hv_owner`;
     3. `hv_runtime` LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB;
     4. in `hv`: `REVOKE ALL ON DATABASE hv FROM PUBLIC`, `GRANT CONNECT` an `hv_runtime`.
   - **Migrationen laufen als `hv_owner`.** Weil `hv_owner` die Datenbank besitzt, ist er Mitglied von `pg_database_owner`
     und damit Eigentümer des Schemas `public` (Postgres ≥ 15). Damit läuft `REVOKE CREATE ON SCHEMA public FROM PUBLIC`.
   - `migrate` und `seed` verbinden sich als `hv_owner`, der Dienst als `hv_runtime`.
   - **Folge:** Die SECURITY-DEFINER-Funktion `auth_purge_login_states` läuft im Stack mit den Rechten eines Eigentümers
     ohne Superuser. Damit ist das Restrisiko aus dem Bedrohungsmodell (Zeile T-G1-D-05) im Stack **verringert**: Eine
     Lücke in der Funktion hätte Eigentümerrechte auf `hv`, keine Superuser-Rechte. Geschlossen ist es nicht. In CI
     bleibt es unverändert, weil dort `hv_owner` Superuser ist; die Zeile T-G1-D-05 sagt das.
9. **Befüllung wiederverwenden, Umbau benannt** (Major 5).
   - **`PERSONS`** wandert aus `scripts/e2e-http-031.mjs` nach `scripts/lib/demo-persons.mjs`. `e2e-http-031.mjs`
     importiert und re-exportiert es; `scripts/e2e-http-031.test.mjs` bleibt unverändert grün.
   - **`bootstrap`** wandert nach `scripts/lib/demo-bootstrap.mjs`:
     - mit `persons` als Parameter statt dem modulweiten `PERSONS`;
     - mit Importpfaden relativ zu `scripts/lib/`, also `../../apps/api/src/…` und `../../packages/domain/src/…`;
     - sonst unverändert.
     - `e2e-http-031.mjs` ruft es mit `PERSONS` auf.
   - **`buildRealm`** bleibt unverändert. Die lesbaren Namen setzt `stack.mjs` (Kürzung, Abschnitt „Teilung“).
   - **Personen:** dieselben neun wie in 031a, mit lesbaren Namen: moderation, capture, coordination, expert (Einheit
     `unit-fin`), legal, approver, podium, norole, revoke. Auf der Installationsseite heißt `revoke` „zweite Erfassung“.
   - **Reihenfolge:** `seed` läuft **vor** dem Start des Dienstes, wie in 031a. Der Dienst hält einen Ketten-Cache.
   - **Migration:** `migrate` läuft mit dem vorhandenen Migrations-CLI im Image `api` (`HV_DB_RUNTIME_ROLE=hv_runtime`).
10. **Kein vertrauenswürdiger Proxy lokal** (Major 7, sicherere Wahl).
    - Der Dienst läuft mit `trusted-proxies=none`, wie in 031a. Alle Browser teilen sich die Grenzen je Quelle der
      nginx-Adresse. Bei einer Person am Rechner ist das kein Nachteil.
    - Kein festes Subnetz. Damit gibt es keinen Zusammenstoß mit VPN- oder Docker-Netzen und keine Scheinsicherheit: Mit
      docker-proxy sähe der Dienst lokal ohnehin keine echte Quelle.
    - `HV_TRUSTED_PROXY_CIDRS` mit Test kommt in 037b, auf dem Host mit echtem Proxy.
11. **Ein Befehl, ohne npm-Abhängigkeit.** `scripts/stack.mjs` braucht nur Node-Bordmittel und `scripts/lib`, also kein
    `pnpm install`. Aufruf `node scripts/stack.mjs <befehl>`, Kurzformen in `package.json`:
    - **`pnpm stack:up`** (mit `-- --recreate <dienst…>` baut es die genannten Dienste mit den gespeicherten Ports neu auf; S2 prüft, dass dabei eine Port-Überschreibung erhalten bleibt):
      1. Voraussetzungen prüfen: Docker-Daemon lokal, Engine ≥ 28, Compose v2, Ports frei, keine Drift.
      2. Zustand anlegen oder lesen.
      3. Images bauen, Stack starten.
      4. Warten, bis Postgres, Keycloak, Dienst und Web gesund sind und `migrate` und `seed` mit 0 beendet sind. Der
         Mechanismus ist frei.
      5. Rauchtest.
      6. Feste Schlusszeile mit Web-URL und Hinweis auf `stack:credentials`.
    - **`pnpm stack:smoke`:** nur der Rauchtest (S12).
    - **`pnpm stack:credentials`:** der einzige Befehl, der Nutzernamen und Passwörter ausgibt, nur auf ausdrücklichen Aufruf.
    - **`pnpm stack:down`:** stoppt, Daten bleiben.
    - **`pnpm stack:reset --yes`:** `down` mit Volumes, Zustandsverzeichnis löschen. `--yes` wird mit und ohne
      vorangestelltes `--` angenommen. Ohne `--yes` keine Wirkung.
    - **`pnpm stack:login`:** Playwright meldet eine Person an (Standard `moderation`) und macht den Screenshot (S13).
      Braucht `pnpm install`.
    - **Fehler:** Auf einen Fehler folgt der Name der Stufe auf stderr, wie in 031a, nie eine Treiber- oder Docker-Meldung
      mit Werten.
    - **CI-Log** (Minor 11):
      - Läuft das Skript mit `GITHUB_ACTIONS=true`, gibt es für jedes erzeugte Secret einmal `::add-mask::` aus, bevor
        irgendetwas anderes geschrieben wird.
      - Das Skript und der CI-Job führen nie `docker compose config` aus. Diese Ausgabe enthielte die Werte aus den
        `env_file`.
      - Kein automatischer Abzug von `docker compose logs` oder `docker inspect` in CI.
      - **Nachtrag des Orchestrators (03.10.2026, nach dem ersten CI-Lauf):** Scheitert der Start oder der Rauchtest,
        gibt `stack.mjs` eine Diagnose aus. **Lokal** vollständig: Meldung von `docker compose up`, `ps -a` und die
        letzten 80 Protokollzeilen jedes nicht gesunden Dienstes, jeder Wert aus `state.json` durch `***` ersetzt.
        **In CI** (`GITHUB_ACTIONS=true`) nur die Statuszeilen von Compose und die `ps -a`-Zeilen (Dienst, Zustand, Health,
        Exit-Code), keine Protokolle; einzige Ausnahme sind die festen Sätze `^HV-Tool API: refusing to start: …` des
        Dienstes, je Satz einmal. Das Init-Skript setzt `log_min_error_statement = panic`, damit ein scheiternder
        `CREATE ROLE … PASSWORD` nie im Postgres-Protokoll steht. Tests: Schwärzung und CI-Modus in `scripts/stack.test.mjs`.
12. **Uhrprüfung.**
    - **Standard:** ohne `HV_NTP_SERVERS`. `/readyz` meldet dann `clock: not_configured` (503). Der Rauchtest nimmt genau
      diesen Fall hin und gibt dazu die feste Zeile aus: „Uhrprüfung nicht eingerichtet (erwartet ohne
      HV_STACK_NTP_SERVERS); Datenbank und Migrationen bereit.“
    - **Mit `HV_STACK_NTP_SERVERS`:** Der Wert geht an `HV_NTP_SERVERS`, dann muss `/readyz` 200 sein.
13. **Prozesse, Neustart und Härtung im Compose** (Major 6).
    - **Init-Prozess:** `init: true` für `api`, `migrate` und `seed`. Der Init-Prozess von Docker leitet SIGTERM weiter, und
      Node beendet sich ohne eigenen Handler sofort.
    - **Neustart-Politik:** `restart: unless-stopped` für Postgres, Keycloak, Dienst und Web; `restart: "no"` für `migrate`
      und `seed`.
    - **Healthcheck:** Für `migrate` und `seed` ist er ausgeschaltet (`healthcheck: disable: true`). Das Image erbt sonst
      den `HEALTHCHECK` des Dienstes.
    - **Härtung von Dienst, Web und Befüllung:** `read_only: true`, `tmpfs` für `/tmp` (bei nginx dazu dessen Cache- und
      PID-Pfade), `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`.
    - **Postgres und Keycloak:** `no-new-privileges`. Ihre Images wechseln selbst den Nutzer.
    - **Benannte Volumes:** `hv-pgdata`, `hv-access-log`.
    - **Namen:** Projektname fest `hv-tool`. Images `hv-tool/api:local`, `hv-tool/seed:local`, `hv-tool/web:local`.
14. **Kein Anwendungscode.**
    - `apps/api/src`, `apps/web/src`, `packages/**/src` und der Vertrag bleiben unverändert. Das Paket betreibt den Dienst,
      wie er ist.
    - Braucht der Bau doch eine Codeänderung, ist das ein Befund und eine eigene Scheibe. Beispiele: ein SIGTERM-Handler,
      eine Umschaltung für Quelltextkarten.

## Nicht-Ziele

- Keine Pipeline, kein Image-Push, keine Registry, kein Deploy, keine Umgebung außer dem lokalen Rechner (037b; R11).
- Kein TLS, keine CSP, kein vertrauenswürdiger Proxy, keine Härtungs-Checkliste für einen Host, keine Secrets aus einer
  Plattform (037b).
- Keine Betriebsauswertung, kein Prometheus, keine Alarme. `/metrics` bleibt ohne `HV_METRICS_TOKEN` (401) und ist auf
  8480 nicht erreichbar.
- Kein Backup, kein Restore, kein Export (038). `stack:reset` löscht, es sichert nicht.
- Keycloak nicht mit Postgres, ohne MFA, ohne Kontenverfahren (088).
- Keine Demo-Betriebsart (`HV_DEMO=1`) im Paket.
- Keine Änderung an `apps/api/src`, `apps/web/src`, `packages/domain/src`, `packages/contract/**`, am Konfigurationsschema,
  an `apps/web/vite.config.ts` oder an `apps/api/.env.example`.
- Keine Unterstützung ohne Docker. Podman „kann gehen“, ist aber nicht geprüft. CI prüft nur amd64; die Digests sind
  Multi-Arch-Indizes, arm64 „sollte gehen“.
- Kein SBOM, keine Signatur (039/074). Der Image-Scan ist eine benannte Ausnahme (Abschnitt „Sicherheit“).
- Keine Lastmessung (071).

## Files allowed

Images und Stack:

- `deploy/docker/api.Dockerfile` (neu; Ziele api und seed)
- `deploy/docker/web.Dockerfile` (neu)
- `deploy/docker/nginx.conf` (neu)
- `deploy/compose/compose.yaml` (neu)
- `deploy/compose/postgres-init/10-roles.sh` (neu)
- `.dockerignore` (neu)
- `.gitattributes` (neu; nur die Zeile für Shell-Skripte)

Skripte:

- `scripts/stack.mjs` (neu)
- `scripts/stack.test.mjs` (neu; läuft mit pnpm test:scripts in den Gates)
- `scripts/stack-seed.mjs` (neu; Einstieg der Befüllung, nur im Image seed)
- `scripts/stack-login.mjs` (neu; Playwright-Anmeldung und Screenshot)
- `scripts/lib/demo-persons.mjs` (neu; PERSONS aus 031a)
- `scripts/lib/demo-bootstrap.mjs` (neu; bootstrap aus 031a mit persons als Parameter und angepassten Importpfaden)
- `scripts/e2e-http-031.mjs` (nur: PERSONS und bootstrap aus den zwei neuen Bibliotheksdateien importieren, PERSONS re-exportieren, bootstrap mit PERSONS aufrufen; sonst nichts)

Manifest:

- `package.json` (nur die sechs Skripte stack:up, stack:down, stack:reset, stack:smoke, stack:credentials, stack:login und der Hash an packageManager)
- `apps/api/package.json` (nur: tsx von devDependencies nach dependencies, gleiche Version)
- `pnpm-lock.yaml` (nur die Folge der Verschiebung)

CI:

- `.github/workflows/gates.yml` (nur der neue Job stack-037a; die Jobs gates und e2e-http bleiben unverändert)

Dokumente und Nachweise:

- `docs/betrieb/installation.md` (neu)
- `README.md` (nur ein Absatz mit Verweis auf die Installationsseite)
- `docs/sicherheit/bedrohungsmodell.md` (nur die Zeilen, die der Abschnitt „Bedrohungsmodell“ dieser Spec nennt)
- `docs/evidence/037a-stack-angemeldet.png` (neu; Screenshot aus S13)
- `docs/evidence/037a-stack-protokoll.txt` (neu; Ausgabe von S11, S12, S14 bis S16, ohne Secrets)
- `docs/evidence/037a-installation-befolgt.txt` (neu; Protokoll des frischen Agenten aus S17)
- `docs/folgeliste.md` (nur neue nicht blockierende Befunde aus dem Bau; keine Sicherheits-, Datenschutz- oder Rechtspunkte)
- `docs/slices/037a-lokales-betriebspaket.md` (diese Spec: Bericht, Review findings)
- `docs/produktplan-beta.md` (nur durch den Orchestrator und nur nach dem Go zu Eigentümerfrage 1: Teilungsvermerk im Eintrag 037)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

Alles unter `apps/api/src`, `apps/web/src`, `apps/web/e2e`, `packages/domain`, `packages/contract`. Dazu
`apps/web/vite.config.ts`, `apps/web/playwright.config.ts`, `apps/api/.env.example`, `netlify.toml`,
`scripts/e2e-http-031.test.mjs`, `scripts/lib/keycloak-ci.mjs`, `scripts/keycloak-ci-029b.mjs`, `docs/adr/**` und
`docs/glossar.md`. Dieser Abschnitt steht bewusst außerhalb von „Files allowed“, damit das Scheibenumfang-Tor seine
Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. **Daemon in der Arbeitsumgebung.** `dockerd` als root mit `--storage-driver=vfs` und Pfaden unter `/tmp` starten. Der
   Pfad des containerd-Sockets darf höchstens 104 Zeichen lang sein. Läuft der Daemon nicht, bleibt nur der CI-Nachweis
   nach E56; das steht dann im Bericht.
2. **`docker compose up --wait` mit einmaligen Diensten.** Wertet die Compose-Version erfolgreich beendete `migrate` und
   `seed` als Erfolg? Wenn nicht, wartet `stack.mjs` selbst.
3. **Health-Probe von Keycloak.** `KC_HEALTH_ENABLED=true`, Management-Port 9000, `/health/ready`, mit dem Werkzeug, das das
   Image mitbringt (bash mit `/dev/tcp`), ohne neue Pakete. Notfalls die Probe auf das Discovery-Dokument.
4. **tsx in der Produktionsinstallation.** Bringt `pnpm install --prod --frozen-lockfile --filter @hv/api...` `tsx` und den
   Kern mit? Läuft der Loader mit `read_only` und tmpfs auf `/tmp`?
5. **Digests.** Alle Basis-Images per Tag und Digest des Multi-Arch-Index aus der Registry lesen. Postgres und Keycloak
   **gleich** `gates.yml` und `KEYCLOAK_IMAGE`. Den Hash von pnpm 10.33.0 für `packageManager` aus der Registry lesen.
6. **Distroless-Node-Version.** `nodejs22` muss `engines` erfüllen und `fetch` mitbringen.
7. **Rechte des neuen Volumes.** Übernimmt ein neues `hv-access-log` 0700 und 65532? Startet der Dienst ohne „refusing to
   start: HV_ACCESS_LOG_DIR“?
8. **Migrationen ohne Superuser.** `db:migrate up` gegen ein frisches Postgres 16 mit `hv_owner` NOSUPERUSER NOCREATEROLE
   NOCREATEDB als Datenbankeigentümer laufen lassen, danach `down` und erneut `up`. Braucht eine Migration doch
   Superuser-Rechte, ist das ein Befund an den Architekten, bevor weitergebaut wird. Ein Superuser-Eigentümer als Rückfall
   ist nicht erlaubt.
9. **Signale.** Mit `init: true`: Endet `docker compose stop api` in unter 3 s? Ohne `init` braucht es 10 s, zur Kontrolle.
   Ergibt ein SIGKILL an den Node-Kindprozess (nicht an den Init) einen Exit ungleich 0 und einen Neustart mit erhöhtem
   `RestartCount`?

## Tests zuerst (rot, dann grün)

### Ohne Docker

`scripts/stack.test.mjs`, `node --test`, Teil von `pnpm gates`. Die Compose-Datei wird mit `yaml` aus `apps/api` gelesen,
über `createRequire` wie in 031a.

- **S1 Pinning.**
  - Positiv: Jedes `FROM` in beiden Dockerfiles und jedes `image:` hat die Form `name:tag@sha256:<64 hex>`.
  - Postgres gleicht `gates.yml`, Keycloak gleicht `KEYCLOAK_IMAGE`.
  - `packageManager` trägt `+sha512.`.
  - Negativ: `postgres:16` ohne Digest schlägt fehl.
- **S2 Ports.**
  - Positiv: Jeder veröffentlichte Port bindet `127.0.0.1`. Postgres, Dienst, `migrate` und `seed` veröffentlichen keinen
    Port.
  - Keycloak: Port im Container gleich Port auf dem Rechner, auch mit überschriebenem `HV_STACK_IDP_PORT`.
  - Negativ: `8480:8080` ohne Adresse schlägt fehl.
- **S3 Keine Secrets in versionierten Dateien.**
  - Kein `environment:`-Eintrag mit `PASSWORD`, `SECRET`, `KEY` oder `TOKEN` im Namen hat einen Literalwert.
  - Jedes `env_file` zeigt ins Zustandsverzeichnis.
  - Dockerfiles ohne `ARG` oder `ENV` mit solchen Namen.
  - Das Init-Skript enthält kein Passwort-Literal und kein `psql -c`.
  - Weder die Compose-Datei noch die erzeugte `postgres.env` enthält `POSTGRES_DB=hv` (Entscheidung 8). Negativ: ein eingeschleustes `POSTGRES_DB: hv` schlägt fehl.
  - Negativ: ein eingeschleustes `POSTGRES_PASSWORD: x` schlägt fehl.
- **S4 Härtung und Prozesse.**
  - Image `api`: `USER` 65532, Web 101.
  - Dienst, Web und `seed`: `read_only`, `cap_drop: [ALL]`, `no-new-privileges`.
  - `init: true` an `api`, `migrate` und `seed`.
  - `migrate` und `seed`: `healthcheck.disable: true` und `restart: "no"`.
  - Alle vier Dauerdienste: `restart: unless-stopped`.
  - Dienst: `network_mode: service:keycloak`.
  - Dienst ohne feste IP, kein `ipam` und kein `HV_TRUSTED_PROXY_CIDRS` (Entscheidung 10).
  - Im Dockerfile `/var/lib/hv` mit root:root 0755 und `access-log` mit 65532 0700.
  - Ziel `api` kopiert nichts aus `scripts/`. Negativ: ein eingeschleustes `COPY scripts` im Ziel `api` schlägt fehl.
- **S5 Umgebung des Dienstes gegen das echte Schema.**
  - Ein Unterprozess mit dem tsx-Loader prüft die erzeugte `api.env` (Marker-Secrets) gegen `readServiceConfig`.
    `HV_ACCESS_LOG_DIR` zeigt dabei auf ein temporäres Verzeichnis mit 0700.
  - Ergebnis: keine unbekannte Variable, Startzeile genau
    `HV-Tool API: start mode=service persistence=postgres auth=oidc cors=none trusted-proxies=none`.
  - Keine Variable aus `FORBIDDEN_SERVICE_VARIABLES` von 031a außer `HV_NTP_SERVERS` (nur mit Option).
  - Kein `HV_DEMO`, keine URL mit `hv_owner` oder `postgres@`.
- **S6 Zustand und stabiler Realm.**
  - Rechte: Verzeichnis 0700, Dateien 0600 (`realm.json` 0644), außerhalb des Repositoriums (`assertOutsideRepository`).
  - Zwei **Neuanlagen** ergeben verschiedene Secrets. Die neun Passwörter sind paarweise verschieden, keines gleicht dem
    Client-Secret.
  - Zwei Schreibläufe aus **demselben** `state.json` ergeben byte-gleiche `realm.json` und Umgebungsdateien.
  - Ein geänderter Port wird verweigert.
  - Negativ: Ein Zustandsverzeichnis mit 0755 wird verweigert (der Satz nennt Pfad und Regel).
  - Drift-Prüfung als reine Funktion: Volume ohne Zustand und Zustand ohne Volume werden verweigert.
- **S7 Realm.**
  - Ein vertraulicher Client. `redirectUris` genau `[http://localhost:<Webport>/auth/callback]`.
  - `directAccessGrantsEnabled: false`, `registrationAllowed: false`.
  - Neun Personen mit lesbaren Namen auf `@example.test`.
  - `scripts/lib/keycloak-ci.mjs` ist unverändert (`git diff` leer).
  - `node --import ./apps/api/node_modules/tsx/dist/loader.mjs scripts/e2e-http-031.mjs --check` bleibt grün.
  - `scripts/e2e-http-031.test.mjs` bleibt grün.
- **S8 Lokale Grenzen als reine Funktionen.**
  - Die Daemon-Prüfung verweigert `tcp://…` und `ssh://…` und nimmt `unix://…`, `npipe://…` und „nicht gesetzt“ an.
  - Die Versionsprüfung verweigert Engine 27.x und nimmt 28.0 an.
  - Die Issuer-Prüfung von `stack-seed.mjs` verweigert `https://idp.example`, `http://keycloak:8180/…` und
    `http://10.0.0.1/…` und nimmt `http://localhost:8180/…` an.
  - Die Host-Prüfung der Datenbank-URL von `stack-seed.mjs` nimmt `postgres://hv_owner:x@postgres:5432/hv` an. Sie
    verweigert `…@localhost:5432/hv`, `…@db.example:5432/hv`, `…@10.0.0.5/hv` und eine URL ohne Host. Der Satz nennt die
    Regel, nicht die URL.
  - `reset` ohne `--yes` hat keine Wirkung; `--yes` und `-- --yes` werden beide angenommen.
- **S9 `.dockerignore`.** Enthält mindestens `.git`, `**/node_modules`, `.env`, `.env.*`, `docs/evidence`,
  `**/playwright-report`, `**/test-results` und `**/dist`.
- **S10 Ausgabe ohne Werte.**
  - Die Formatierer von `up`, `smoke` und Fehlern bekommen Marker-Secrets; kein Marker erscheint.
  - Mit `GITHUB_ACTIONS=true` kommen die `::add-mask::`-Zeilen vor jeder anderen Ausgabe.
  - Nur `credentials` gibt Werte im Klartext aus.

### Mit Docker

Lokal mit dem Daemon aus „Vor dem Bau prüfen“ 1. Im CI-Job `stack-037a` laufen alle Tests außer S16.3 und S16.4.

- **S11 Start aus dem Nichts.**
  - Nach `stack:reset --yes` baut `pnpm stack:up` drei Images. Alle Dauerdienste werden gesund, `migrate` und `seed` enden
    mit 0, die Schlusszeile erscheint.
  - Zeit und Image-Größen stehen im Protokoll. Ziel: Dienst ≤ 300 MB, Web ≤ 80 MB. Eine Überschreitung ist ein Befund.
- **S12 Rauchtest** (`pnpm stack:smoke`):
  1. **Header.** Die drei Header aus Entscheidung 4, je genau einmal, auf:
     - `GET /` (200, `text/html`);
     - `GET /v1/meetings` ohne Sitzung (Antwort des Dienstes);
     - einer Datei unter `/assets/`;
     - **und auf einem 502**: Dienst mit `docker compose stop api` angehalten, `GET /v1/meetings`; danach `start api`.
  2. **Proxy-Pfade.**
     - `GET /auth/transparency-notice` → 200 (Weg Web → Dienst).
     - `GET /healthz`, `/readyz` und `/metrics` auf 8480 → 404 (nicht `index.html`).
     - Eine `.map`-Datei → 404.
     - Ein Body von 300 KB → 413.
  3. **Keycloak.** Die Discovery unter dem Issuer → 200; `issuer` gleicht dem konfigurierten Wert.
  4. **Proben im Container** (`docker compose exec api` mit dem Node des Images): `/healthz` 200. `/readyz` mit `db` und
     `migrations` `ok`. `clock` ist `ok`, oder `not_configured` bei 503 mit der festen Zeile aus Entscheidung 12.
  5. **Startzeile.** Das Protokoll des Dienstes enthält genau die Startzeile aus S5, kein „refusing to start“ und kein
     „ignoring unknown variables“. `stack.mjs` liest nur diese Zeilen und gibt das Protokoll nicht aus.
  6. **Befüllung.** Die Ereigniszahl ist größer null (`psql` als `hv_owner`, nur eine Zahl).
  7. **Rollen.**
     - `hv_owner` und `hv_runtime` sind kein Superuser, `rolcreaterole` und `rolcreatedb` sind falsch (`pg_roles`).
     - `hv_runtime` hat auf dem Ereignislog kein `UPDATE` und kein `DELETE` (`has_table_privilege`).
     - Der Eigentümer von `auth_purge_login_states` ist `hv_owner`.
- **S13 Anmeldung mit Screenshot** (`pnpm stack:login`).
  - Chromium headless meldet `moderation` über das Keycloak-Formular an. Das Passwort kommt aus dem Zustand, wird nie
    ausgegeben; kein Trace, kein Video.
  - Danach steht die Oberfläche auf Deutsch mit der Wortmeldeliste aus dem Demo-Korpus. Screenshot
    `docs/evidence/037a-stack-angemeldet.png`.
  - Negativ: `norole` sieht keine Arbeitsansicht (geprüft, kein Screenshot).
- **S14 Nicht root, kein Befüllungscode.**
  - `docker image inspect`: `User` 65532 (api, seed) und 101 (web).
  - `docker top` für Dienst und Web zeigt keine UID 0, abgesehen vom Init-Prozess von Docker, falls er als root läuft.
    Der Bericht nennt die beobachtete UID.
  - Im Image `api` gibt es kein `/app/scripts`: `docker run --rm --entrypoint /nodejs/bin/node hv-tool/api:local -e …` mit
    `fs.existsSync` gibt falsch aus.
  - Rechte im Image: `/var/lib/hv` ist 0755 root und `access-log` 0700 65532, geprüft mit `fs.statSync` auf demselben Weg.
- **S15 Schema und Befüllung verweigern außerhalb von Loopback.**
  - `docker run --rm hv-tool/api:local` ohne Umgebung: Exit 1, auf stderr `HV-Tool API: refusing to start:
    HV_ACCESS_LOG_DIR …` ohne Wert.
  - Mit vollständiger Umgebung, aber `HV_OIDC_ISSUER=http://keycloak:8180/realms/hv-local`: Exit 1 mit dem Satz zu
    `HV_OIDC_ISSUER`.
  - `hv-tool/seed:local` mit einem Issuer, der nicht Loopback ist: Exit 1 mit festem Satz, **bevor** eine
    Datenbankverbindung entsteht. Geprüft ohne erreichbare Datenbank.
- **S16 Robustheit** (CI: 1 und 2; lokal alle vier).
  1. **Postgres-Neustart.** `docker compose restart postgres`: `/readyz` meldet `db` vorübergehend nicht `ok`, innerhalb
     von 60 s wieder `ok`. Der `RestartCount` des Dienstes bleibt gleich.
  2. **Absturz des Dienstes.** Im Container ein SIGKILL an den **Node-Kindprozess**, nicht an den Init. Das läuft über
     `docker compose exec api` mit dem Node des Images.
     - Die Probe sucht über `/proc/*/cmdline` den Prozess mit `apps/api/src/server.ts`. Ihre eigene PID
       (`process.pid`) und PID 1 schließt sie aus. Genau ein Treffer ist Pflicht, sonst bricht sie ohne Kill ab.
     - Der Kill beendet den Container und damit auch das `exec`. Ein Exit ungleich 0 oder ein abgerissenes `exec` ist an
       dieser Stelle **kein** Fehler. Das Ergebnis zählt erst danach: `RestartCount` ist gestiegen, der Dienst ist
       innerhalb von 60 s wieder gesund und die Ereigniszahl ist unverändert.
     - Dazu: `docker compose stop api` endet in unter 3 s (SIGTERM kommt an).
  3. **Stoppen und Starten.** `stack:down`, dann `stack:up`:
     - Die Ereigniszahl ist gleich.
     - `realm.json` ist byte-gleich mit dem Stand vor `down` (Hash im Protokoll).
     - `seed` meldet „bereits befüllt“.
     - **Danach meldet `stack:login` `moderation` an**, und die Rolle wirkt: Die Wortmeldeliste ist sichtbar.
  4. **Zurücksetzen.** `stack:reset --yes`: Volumes und Zustandsverzeichnis sind weg. Das folgende `up` befüllt neu, mit
     neuen Secrets.
- **S17 Installationsseite befolgt durch einen frischen Agenten** (Leitplanken 6.11).
  - Nach dem Bau, vor dem Review, startet der Orchestrator einen eigenen Agenten in frischem Kontext. Er bekommt nur
    einen frischen Klon des PR-Zweigs, die Installationsseite und den Auftrag „bis zur Anmeldung kommen und alles
    protokollieren“. Spec, Diff und Bericht bekommt er nicht.
  - Der Orchestrator stellt in der Umgebung des Agenten einen laufenden Docker-Daemon bereit, wie in „Vor dem Bau
    prüfen“ 1. Die Seite selbst erklärt nicht, wie man in dieser Arbeitsumgebung einen Daemon startet; sie setzt Docker
    voraus wie bei jeder Betriebsperson.
  - Läuft kein Daemon, gilt S17 als **nicht erfüllt**, nicht als übersprungen. Der Agent befolgt die Seite dann bis zur
    Voraussetzungsprüfung und protokolliert, ob `stack:up` mit dem richtigen Satz abbricht. Der Bericht nennt die Lücke,
    und S17 wird vor dem Merge mit Daemon wiederholt.
  - Er befolgt die Seite Schritt für Schritt und schreibt `docs/evidence/037a-installation-befolgt.txt`: Befehl, Ergebnis,
    jede Stelle, an der die Seite unklar oder falsch war. Secrets enthält das Protokoll nicht; `stack:credentials` wird
    ausgeführt, die Ausgabe aber als „ausgeführt, 9 Personen“ notiert.
  - Jede gefundene Unklarheit ist ein Befund an die Installationsseite und wird vor dem Review behoben.
- **S18 CI-Job `stack-037a`.**
  - Nur auf `pull_request`, mit demselben Dokumentenfilter wie `e2e-http`, `timeout-minutes: 25`, Rechte wie der Workflow.
  - Schritte: Checkout, pnpm, Node 22, `pnpm install --frozen-lockfile`, Chromium, dann `stack:up`, `stack:smoke`, S14,
    S15, S16.1, S16.2 und `stack:login`.
  - Danach immer (`if: always()`) `stack:reset --yes` und das Hochladen **nur** des Screenshots als Artefakt
    `evidence-037a-stack` (Aktion per Hash wie in `gates.yml`).
  - Kein Schritt ruft `stack:credentials`, `docker compose config`, `docker compose logs` oder `docker inspect` mit
    Umgebung auf.
  - Kein Pflicht-Check (Eigentümerfrage 2).
  - **Nachtrag des Orchestrators (03.10.2026):** Gleich nach dem Checkout entfernt ein eigener Schritt einen
    eingecheckten Screenshot; das Hochladen läuft nur mit `always()` und echter Codeänderung. Nach `stack:login` läuft
    S16.3 in CI: `stack.mjs down`, `pnpm stack:up` (erwartet „bereits befüllt“, realm.json byte-gleich per Hash),
    `pnpm stack:login -- --no-screenshot`. Bei einem Fehler gilt der CI-Modus der Diagnose (Entscheidung 11, Nachtrag).
    Ein Test liest `jobs['stack-037a']` als YAML (nur PR, keine eigenen Rechte, 25 min, keine verbotenen Befehle, genau ein
    Upload nur des Screenshots, Aktionen per Hash).

## Akzeptanzkriterium

Ein Rechner hat Docker Engine ≥ 28 und Node 22. Dort bringt `pnpm stack:up` aus dem Nichts den Stack gesund hoch. Danach
gilt:
- `moderation` meldet sich im Browser unter `http://localhost:8480` über Keycloak an und arbeitet mit dem Demo-Korpus,
  auch nach `stack:down` und `stack:up`.
- Der Stack übersteht den Neustart von Postgres und den Absturz des Dienstes ohne Datenverlust.
- Kein Secret steht im Repositorium, in einem Image, im CI-Log oder im Screenshot.
- Dienst und Web laufen ohne root. Das Image `api` enthält keinen Befüllungscode.
- Die Anwendung hat in Postgres keine Superuser-Rechte.
- Nur Loopback-Ports sind offen. Der Proxy setzt Grenzen und Header auch auf Fehlerantworten.
- Ein frischer Agent kommt allein mit `docs/betrieb/installation.md` bis zur Anmeldung.
- S1 bis S18 sind grün, `pnpm gates` ist grün, der CI-Job `stack-037a` ist auf dem letzten Commit des PRs grün.

## Installationsseite (`docs/betrieb/installation.md`, Gliederung verbindlich)

Auf Deutsch, für eine Betriebsperson ohne Projektwissen. Hauskürzel stehen nur mit Erklärung.

1. **Was Sie bekommen:**
   - vier Dienste und zwei einmalige Schritte, ein Satz je Dienst;
   - die Ports (Web 8480, Anmeldung 8180, sonst nichts offen);
   - ausdrücklich: nur lokal, synthetische Daten, kein Produktivbetrieb.
2. **Voraussetzungen:**
   - Docker Engine ≥ 28 mit Compose v2 (Mindestversion), mit dem Grund für ≥ 28;
   - Node 22, für `stack:login` zusätzlich pnpm;
   - rund 3 GB Plattenplatz und 4 GB Arbeitsspeicher;
   - freie Ports;
   - Browser Chromium, Edge oder Firefox. Safari kann `Secure`-Cookies auf `http://localhost` ablehnen.
3. **Ein Befehl:** `pnpm stack:up`, ohne pnpm `node scripts/stack.mjs up`. Dazu Dauer und Schlusszeile.
4. **Anmelden:**
   - `pnpm stack:credentials`;
   - Tabelle der neun Testpersonen mit Rolle und Zweck. Rollennamen stehen nur hier und in der Ausgabe des Befehls, nie
     im Code (R4);
   - Admin-Konsole von Keycloak, „nur lokal“.
5. **Gesundheit prüfen:**
   - `pnpm stack:smoke`;
   - Bedeutung von `/healthz` und `/readyz`;
   - **Falle:** `/readyz` 503 mit `clock: not_configured` ist ohne NTP normal; `HV_STACK_NTP_SERVERS` ändert das;
   - die Proben sind auf 8480 bewusst nicht erreichbar, nur im Container;
   - `docker compose -p hv-tool ps`.
6. **Stoppen, Starten, Aktualisieren, Zurücksetzen, Deinstallieren:**
   - `stack:down` (Daten bleiben), `stack:up`;
   - **Aktualisieren:** `git pull`, dann `stack:up`. Die Images werden neu gebaut, die Daten bleiben; Migrationen laufen
     von selbst;
   - `stack:reset --yes`: alles weg, neue Passwörter;
   - **Deinstallieren:** `stack:reset --yes`, dann `docker image rm hv-tool/api:local hv-tool/seed:local hv-tool/web:local`.
     Die gepinnten Basis-Images löschen Sie bei Bedarf selbst.
7. **Robustheit, die Sie selbst prüfen können:** die Proben aus S16 als Befehle mit erwartetem Ergebnis. Dazu das
   Neuerstellen von Dienst und Web nach einem Keycloak-Neustart (Entscheidung 5).
8. **Sicherheit des Pakets:**
   - Secrets je Installation im Zustandsverzeichnis (Pfad), keine Standardpasswörter;
   - Nutzer ohne root, nur Loopback;
   - Laufzeitrolle ohne Eigentümerrechte, Eigentümer ohne Superuser;
   - das Schema verweigert `http` außerhalb von Loopback, `start-dev` nur lokal, ein entfernter Daemon wird verweigert;
   - **Cookie auf `localhost`:** `hv_session` gilt für alle Ports von `localhost`. Andere lokale Anwendungen im selben
     Browserprofil bekommen es mitgeschickt. Für die Demo deshalb ein eigenes Browserprofil oder nach der Demo abmelden;
   - `docker inspect` zeigt auf `migrate` und `seed` die Eigentümer-URL. Wer Docker bedienen darf, ist root-gleich.
9. **Zugriffslog:**
   - Ort (Volume `hv-tool_hv-access-log`), Inhalt (acht Schlüssel, pseudonym, ADR 0013), Aufbewahrung 30 Tage;
   - ansehen nur mit Docker-Rechten;
   - mit `stack:reset` gelöscht.
10. **Fehlersuche:**
    - Port belegt; Docker läuft nicht oder ist zu alt;
    - `up` hängt an Keycloak (Speicher, erste Ladezeit);
    - „refusing to start“ im Protokoll: der Satz nennt die Variable;
    - Anmeldung springt zurück: Browser, Cookies, Port;
    - `/readyz` 503;
    - Keycloak neu gestartet, Dienst und Web haben kein Ziel mehr: `pnpm stack:up -- --recreate api web` (nie direkt mit `docker compose`, sonst gehen gespeicherte Ports verloren);
    - Drift-Meldung: dann `stack:reset`;
    - `docker compose -p hv-tool logs <dienst>`, lokal; das Protokoll enthält keine Secrets, aber Pfade.
11. **Was bis zum Betrieb auf einem Server fehlt:** TLS, Secrets aus der Plattform, Proxy-Vertrauen, CSP, Alarme, Backup,
    Image-Scan (037b, 038), ein Satz je Punkt.

## Sicherheit und Datenschutz

| Punkt | Festlegung in 037a | Test |
|---|---|---|
| **SP-1 Befüllung am Rechtepfad vorbei** (T-G2-T-04, T-Q-T-04) | eigenes Image `seed`, nie gepusht, das Image `api` enthält kein `/app/scripts`; `stack-seed.mjs` verweigert ohne Loopback-Issuer, ohne Compose-Datenbank und schreibt nur in ein leeres Log; der Eigentümer hat dabei keine Superuser-Rechte | S4, S8, S14, S15, S16.3 |
| Datenbankrollen | Bootstrap-Superuser nur in `postgres.env`; `hv_owner` und `hv_runtime` NOSUPERUSER NOCREATEROLE NOCREATEDB; SECURITY DEFINER läuft ohne Superuser; Laufzeitrolle ohne `UPDATE`/`DELETE` am Log | S12.7, Vor dem Bau 8 |
| Secrets | je Installation einmal zufällig, außerhalb des Repositoriums (0700/0600), je Dienst nur die eigenen; keine Ausgabe außer `stack:credentials`; `::add-mask::` in CI; nie `docker compose config` in CI | S3, S5, S6, S10, S18 |
| Standardpasswörter | keine, auch der Keycloak-Admin und der Bootstrap-Superuser sind zufällig | S6 |
| Ports | nur `127.0.0.1:8480` und `127.0.0.1:8180`; Docker ≥ 28 | S2, S8 |
| Proxy (T-G1-D-01) | Timeouts, Keepalive, Header-Puffer, Body-Grenze knapp über der des Dienstes; Header `always` in jeder `location`; Proben und `/metrics` nicht auf 8480; kein Proxy-Vertrauen lokal | S12.1, S12.2 |
| Quelltextkarten (T-Q-I-02) | `.map` → 404 im Web-Image | S12.2 |
| Nutzer | Dienst und Befüllung 65532, Web 101; `read_only`, `cap_drop: ALL`, `no-new-privileges`; `/var/lib/hv` root 0755 | S4, S14 |
| Lieferkette | alle Basis-Images per Tag und Digest; pnpm mit Hash über corepack; Postgres und Keycloak identisch zu CI; `.dockerignore` | S1, S9 |
| Secret- und Abhängigkeitsscan | gitleaks im Job `gates` prüft jeden PR-Diff, also auch die neuen Dateien; `pnpm audit:check` prüft das Lockfile, jetzt mit `tsx` als Produktionsabhängigkeit | CI `gates` |
| Image-Scan | **benannte Ausnahme:** kein Scan der gebauten Images in 037a. Eigentümer: technischer Betrieb (Umsetzer). Ablauf: Merge von 037b, spätestens 30.11.2026. Begründung: lokal, synthetisch, nicht gepusht | — |
| Cookie (T-G1-S-02) | `hv_session` gilt je Host, nicht je Port; Hinweis auf der Installationsseite §8 und im Bedrohungsmodell | — |
| Lokale Grenze | Schema verweigert `http`-Issuer außerhalb von Loopback; Skript verweigert entfernten Daemon (R11) | S8, S15 |
| Daten | nur `CORPUS_DEMO`, Personen auf `@example.test` (R11) | S7, S12.6 |
| Screenshot und Artefakt | kein Passwortfeld mit Inhalt, kein Trace, kein Video; nur der Screenshot wird hochgeladen | S13, S18 |
| Zugriffslog | Volume 0700, Eigentümer 65532, lokaler Datenträger (Betriebsvorgabe zum 033a-Befund); Füllstandsalarm 037b | S11, S14 |

**Missbrauchsfall 1 (Leitplanken 6.5): Paket auf einem erreichbaren Server.**
- *Ablauf:* Jemand übernimmt `compose.yaml` mit einer `http`-Einrichtung auf einen erreichbaren Server.
- *Wirkung:* Mit einem Issuer, der nicht Loopback ist, verweigert der Dienst den Start, und `seed` verweigert die
  Befüllung (S15). Mit einem Issuer auf `localhost` scheitert die Anmeldung von außen. Die Ports binden nur Loopback, und
  das Skript verweigert einen entfernten Daemon.
- *Restrisiko:* Jemand ändert die Port-Bindung von Hand und stellt das Web ohne TLS ins Netz.
- *Signal:* Startzeile mit `auth=oidc` auf einem Rechner, der kein Entwicklungsrechner ist. *Empfänger:* technischer
  Betrieb ab 037b.
- *Ausnahme:* bis 037b nur die Installationsseite §8. Eigentümer: technischer Betrieb. Ablauf: Merge von 037b.

**Missbrauchsfall 2: Image der Befüllung gegen eine fremde Datenbank.**
- *Ablauf:* Jemand startet `hv-tool/seed:local` mit Eigentümerzugang gegen eine andere Datenbank, um sich Rollen
  zuzuschreiben.
- *Wirkung:* Verweigert wird, wenn der Issuer nicht Loopback ist, wenn der Host nicht `postgres` ist oder wenn das Log
  nicht leer ist. Wer ohnehin den Eigentümerzugang einer leeren lokalen Datenbank hat, gewinnt dadurch nichts.
- *Signal:* Das Image ist nie in einer Registry; 037b prüft, dass nur `api` gepusht wird.

**Lizenzen der Images:**
- Keycloak: Apache 2.0;
- nginx: BSD-2-Clause;
- Postgres: PostgreSQL License;
- distroless: Build-Rezept Apache 2.0; der Inhalt sind Debian-Pakete mit eigenen Lizenzen.

Lokal ohne Weitergabe genügt das. Bei Weitergabe prüft 037b die Hinweise.

## Bedrohungsmodell (Änderungen, die der Bau einträgt)

- **T-G2-E-02:** Rest „Container ohne Root“ geschlossen für den lokalen Stack, Nachweis S4 und S14.
- **T-Q-S-02:** „Images lokal gebaut, Basis-Digests gepinnt, Befüllung in eigenem Image; Push mit Digest 037b“.
- **T-Q-I-01:** „Secrets des lokalen Stacks je Installation, außerhalb des Repositoriums, Maskierung in CI“.
- **T-Q-I-02:** im Web-Image geschlossen (`.map` → 404). Für das Netlify-Demo bleibt es offen bis 037b.
- **T-G1-D-01, Proxy-Teil:** Grenzen am Proxy im lokalen Stack (S12).
- **T-G1-S-02:** Restrisiko „Cookie auf `localhost` gilt für alle Ports“, nur im lokalen Stack.
- **T-G1-D-05 (SECURITY-DEFINER-Funktion `auth_purge_login_states`):** Restrisiko im Stack durch den Eigentümer ohne
  Superuser verringert, nicht geschlossen. In CI bleibt es unverändert (`POSTGRES_USER: hv_owner`).
- **T-G2-T-04 und T-Q-T-04:** Nachweis „Befüllung nur in ein leeres Log, nur mit Loopback-Issuer und Compose-Host, nur im
  Image `seed`“ (S8, S14, S15).
- **Scheibenübersicht:** Zeile 037 um „037a“.

## Qualitätswirkung

**Reifestufe:** pilot · **Risikoklasse:** hoch

**Ausgelöst:**
- [x] Konfiguration (nur Betrieb der vorhandenen);
- [x] Persistenz (Rollen, Migration, Befüllung);
- [x] Rolle, Identität (Testrealm, Rollenzuordnung per Befüllung);
- [x] Betrieb, Wiederherstellung;
- [x] Dokumentation.

**Perspektiven:** Betrieb und Security, Reviewer. **Nachweise:** S1–S18, Screenshot, zwei Protokolle, CI-Lauf.
**Offene Entscheidung:** E10 bleibt offen; 037a ist davon unabhängig.

**Warum hoch.** Leitplanken §4 nennt „Deployment, Secrets, Netzgrenzen“ als Hoch-Auslöser. 037a erzeugt Secrets, legt
Ports, Nutzer und Datenbankrollen fest und baut das Image, das 037b ausrollt. Dass alles lokal bleibt, senkt die Wirkung,
nicht die Klasse. Herabstufen entscheidet nur der Mensch. Daraus folgen:
- Lesebefund vor dem Bau;
- ein Review mit Perspektive Betrieb und Security, nie gebündelt;
- Positiv- und Negativtest je Auslöser;
- Wiederherstellungsfälle (S16).

## Offene Eigentümerfragen

1. **Teilung von 037 und Aufwand.**
   - **Standard:** 037a wie hier mit 4 AStd, 037b mit dem Rest, Planvermerk wie vorgeschlagen. 037a wird vor das
     Planfenster 30.10.2026 gezogen.
   - **Alternative:** 037a weiter teilen. Erst Images und Stack, dann der CI-Job als Takt. Das kostet zwei Reviews
     derselben Sicherheitsfläche.
   - **Ohne Go** bleibt 037 eine Scheibe, und die Freigabe-Demo zeigt keinen Installationsnachweis.
2. **CI-Job `stack-037a` als Pflicht-Check?** Er kostet rund 10 bis 15 Minuten je Code-PR.
   - **Standard:** läuft auf jedem Code-PR, ist aber kein Pflicht-Check, wie `e2e-http`.
   - **Alternative:** Pflicht-Check, oder nur bei Änderungen unter `deploy/**`, `apps/**`, `packages/**` und `pnpm-lock.yaml`.

Alles Übrige ist technisch und hier entschieden.

## Hinweise an 037b

- **Artefakte:** Nur das Image `api` wird gepusht, mit Digest. `seed` nie; ein Test in der Pipeline prüft das.
- **Digests:** Basis-Digests aktualisiert ein Takt. Postgres und Keycloak ändern sich zusammen mit `gates.yml` und
  `KEYCLOAK_IMAGE`; S1 erzwingt die Gleichheit.
- **Lokale Krücke:** `network_mode: service:keycloak` entfällt mit einem `https`-Issuer.
- **Proxy-Vertrauen:** `HV_TRUSTED_PROXY_CIDRS` kommt mit Test auf dem Host mit echtem Proxy.
- **CI-Datenbank:** In CI ist `hv_owner` noch Superuser (Job `gates`). 037b oder ein Takt stellt das auf das Rollenmodell
  aus Entscheidung 8 um.
- **Offen für 037b:**
  - Bindeadresse des Dienstes (031a);
  - ACLs auf dem Log-Datenträger (034b);
  - synchrones Schreiben der Senke (033a);
  - CSP mit Report-Test;
  - Quelltextkarten im Netlify-Demo;
  - Image-Scan (Ausnahme bis 30.11.2026);
  - Füllstandsalarm, NTP ausgehend;
  - ein SIGTERM-Handler im Dienst, falls die Plattform kein Init-Prozess stellt.
- **Strom:** Der Weg `/v1/stream` durch nginx ist der lokale Beleg für 035b Frage 3.

## Nachweise

- `pnpm gates` grün auf dem Bau-Commit, der Schluss der Ausgabe wörtlich im Bericht (R2).
- `docs/evidence/037a-stack-angemeldet.png` (S13), lokal erzeugt. Nach E56 gilt nur als Rückfall das CI-Artefakt
  `evidence-037a-stack` mit Artefaktname, Lauf-ID, Artefakt-ID und Digest.
- `docs/evidence/037a-stack-protokoll.txt`: S11, S12, S14, S15 und S16 mit Image-IDs, Größen, Startdauer und
  `realm.json`-Hash, ohne Secrets.
- `docs/evidence/037a-installation-befolgt.txt`: S17, vom frischen Agenten.
- CI-Job `stack-037a` grün auf dem letzten Commit des PRs (Lauf-ID im Bericht).

## Bericht (nach Bau ausfüllen)

```
Slice: 037a-lokales-betriebspaket
Done: Images api (distroless, 65532, ohne scripts/), seed (eigenes Ziel) und web (nginx-unprivileged, 101, Grenzen und
      Header am Proxy); Compose-Stack mit Postgres (hv_owner ohne Superuser, hv_runtime), Keycloak-Testrealm (einmal
      erzeugt, byte-gleich), migrate und seed; scripts/stack.mjs (up, smoke, credentials, down, reset, probe) mit Secrets
      je Installation außerhalb des Repositoriums; Installationsseite; CI-Job stack-037a; S1–S10 in test:scripts.
Evidence: pnpm gates grün auf 61d204a (letzter Code-Stand, Schluss im Abschnitt „CI-Job stack-037a“), davor auf 8ac36d4; docs/evidence/037a-stack-protokoll.txt (S11, S12, S14–S16 lokal);
      docs/evidence/037a-stack-angemeldet.png fehlt lokal (quay.io gesperrt) → Rückfall CI-Artefakt evidence-037a-stack (E56)
Open: S12.3, S13 und die Anmeldung in S16.3 lokal nicht lauffähig (Keycloak-Image von quay.io durch die Egress-Richtlinie
      der Arbeitsumgebung gesperrt) → Nachweis im CI-Job stack-037a; S17 (frischer Agent, Orchestrator); CI-Lauf-ID
      (PR öffnet der Orchestrator); Eigentümerfragen 1 und 2
Touched: .dockerignore, .gitattributes, .github/workflows/gates.yml, README.md, apps/api/package.json, package.json,
      pnpm-lock.yaml, deploy/compose/compose.yaml, deploy/compose/postgres-init/10-roles.sh, deploy/docker/api.Dockerfile,
      deploy/docker/nginx.conf, deploy/docker/web.Dockerfile, docs/betrieb/installation.md,
      docs/evidence/037a-stack-protokoll.txt, docs/folgeliste.md, docs/sicherheit/bedrohungsmodell.md,
      scripts/e2e-http-031.mjs, scripts/lib/demo-bootstrap.mjs, scripts/lib/demo-persons.mjs, scripts/stack-login.mjs,
      scripts/stack-seed.mjs, scripts/stack.mjs, scripts/stack.test.mjs, diese Spec
```

**Stand Eigentümerfragen 1 und 2:** gebaut nach dem Standard beider Fragen (037a mit 4 AStd; CI-Job nur auf PRs, kein
Pflicht-Check). Das Go zu Frage 1 und der Planvermerk liegen beim Orchestrator.

**Vor dem Bau prüfen (Ergebnisse).**
1. Daemon lokal: `dockerd --storage-driver=vfs` mit `--data-root`/`--exec-root` unter `/tmp/d`, Engine 29.3.1, Compose
   5.1.1; `docker run --rm hello-world` lief. Zusätzlich nötig in dieser Umgebung: `--registry-mirror=https://mirror.gcr.io`
   (Rate-Limit von Docker Hub) und für den Bau das CA-Bündel des TLS-prüfenden Proxys (`HV_STACK_BUILD_CA`, Abweichung 1).
   **quay.io ist durch die Egress-Richtlinie gesperrt** (403 auf CONNECT): das Keycloak-Image lässt sich hier nicht laden;
   nicht umgangen (kein Ersatz-Registry).
2. `--wait` mit einmaligen Diensten: Compose 5.1.1 wertet `migrate` und `seed` mit Exit 0 als Erfolg (`up --wait` Exit 0).
   `stack.mjs` wartet trotzdem selbst über `docker compose ps --format json` (läuft auch mit älteren Compose-Versionen,
   erkennt einen Einmaldienst mit Exit ≠ 0 sofort).
3. Health-Probe Keycloak (gewählt): `bash -c` mit `/dev/tcp/127.0.0.1/9000`, `GET /health/ready`, Treffer auf `"UP"`;
   `KC_HEALTH_ENABLED=true`. Syntax lokal gegen den Platzhalter geprüft (bash im node-Image); gegen das echte
   Keycloak-Image nur im CI-Job (quay.io gesperrt).
4. tsx in der Produktionsinstallation: ja. `pnpm install --frozen-lockfile --prod --filter '@hv/api...'` bringt `tsx`,
   `@hv/domain` und `@hv/contract` mit; der Loader läuft mit `--read-only` und tmpfs auf `/tmp` (Startzeile und
   Verweigerungssätze kommen aus kompiliertem TypeScript). Der Manifest von `apps/web` muss in die Baustufe, sonst passt
   das gefrorene Lockfile nicht; er wird danach gelöscht.
5. Digests (Index-Digest je Tag, gelesen mit `docker buildx imagetools inspect`):
   `node:22-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c`,
   `gcr.io/distroless/nodejs22-debian12:nonroot@sha256:13593b7570658e8477de39e2f4a1dd25db2f836d68a0ba771251572d23bb4f8e`,
   `nginxinc/nginx-unprivileged:1.30-alpine@sha256:ed04ec1ff34502c339ee5c3ae3f855442398edc1d05591e2b98981dcbbd20b1e`;
   Postgres und Keycloak gleich `gates.yml` und `KEYCLOAK_IMAGE` (S1 erzwingt das). pnpm 10.33.0: `dist.integrity` aus
   der Registry, hex `sha512.10568bb4…8649319` in `packageManager`.
6. Distroless-Node-Version: v22.22.0 (erfüllt `engines` `>=22`), `fetch` vorhanden, `process.getuid()` 65532.
7. Rechte des neuen Volumes: ein neues benanntes Volume auf `/var/lib/hv/access-log` übernimmt 0700 und 65532:65532
   (erst mit `COPY --chmod=0700` auf ein eigenes Quellverzeichnis; ein COPY auf ein schon vorhandenes Verzeichnis hätte
   root als Eigentümer gelassen). Der Dienst startet ohne „refusing to start: HV_ACCESS_LOG_DIR“.
8. Migrationen ohne Superuser (up, down, up): gegen das lokale Postgres 16 mit `p8_owner` NOSUPERUSER NOCREATEROLE
   NOCREATEDB als Datenbankeigentümer: up, down, up je „Postgres migration … completed.“; Eigentümer von
   `auth_purge_login_states` danach `p8_owner`, Laufzeitrolle ohne UPDATE/DELETE an `events`. Keine Migration braucht
   Superuser-Rechte. Im Stack bestätigt durch S12.7.
9. Signale: `docker stop` mit `--init` 0,15 s (Exit 143), ohne `--init` 10,2 s (SIGKILL, Exit 137). Im Stack:
   `docker compose stop api` 0,1 s; SIGKILL an den Node-Kindprozess → Container endet, RestartCount 0 → 1, nach 6,3 s
   wieder gesund (S16.2).

**Images.** (Bau aus 8ac36d4-Stand der Dockerfiles, lokal)

| Tag | Image-ID | Größe | `User` | kein `/app/scripts` |
|---|---|---|---|---|
| `hv-tool/api:local` | `41708e034ca8` | 172 MB (Ziel ≤ 300) | `65532:65532` | ja (PASS) |
| `hv-tool/seed:local` | `3fe370498f4c` | 172 MB | `65532:65532` | enthält genau `stack-seed.mjs` und zwei Bibliotheksdateien |
| `hv-tool/web:local` | `696550806865` | 55 MB (Ziel ≤ 80) | `101` | – |

`docker top`: Dienst nur UID 65532 (auch der Init-Prozess von Docker), Web nur UID 101.

**Startdauer** (`stack:up` aus dem Nichts): ohne Image-Cache (Build-Cache gelöscht, Basis-Images vorhanden) Bau der drei
Images 36 s, danach Start bis „alle gesund“ 25 s mit dem Keycloak-Platzhalter; mit Image-Cache Bau 2 s, Start 24 s. Die
Startzeit des echten Keycloak ist hier nicht messbar (quay.io); sie steht im CI-Lauf.

**Rauchtest (S12), Ausgabe:** vollständig in `docs/evidence/037a-stack-protokoll.txt`. Lokal 18 × PASS (S12.1, S12.2,
S12.4 bis S12.7), dazu die feste Zeile „Uhrprüfung nicht eingerichtet …“; S12.3 (Keycloak-Discovery) FAIL gegen den
Platzhalter, wie erwartet. Die Prüfung S12.3 steht im Rauchtest zuletzt (Abweichung 3).

**Robustheit (S16), Ausgabe (CI: 1–2, lokal: 1–4):**
- S16.1: `db` zeitweise `unreachable`, nach 0,6 s wieder `ok`; RestartCount des Dienstes unverändert.
- S16.2: genau ein Node-Prozess gefunden, RestartCount 0 → 1, nach 6,3 s gesund, 1748 Ereignisse unverändert,
  `stop api` 0,1 s.
- S16.3: `stack:down`, `stack:up`: realm.json sha256 `d46a9a620ef60ddf` vorher und nachher gleich, 1748 Ereignisse
  gleich, `seed`: „HV-Stack-Befüllung: bereits befüllt, nichts geschrieben.“. Die Anmeldung danach ist lokal nicht
  möglich (kein Keycloak); im CI-Job läuft S16.3 nicht (Spec), die Anmeldung nach `down`/`up` ist damit **offen** bis zu
  einem Lauf mit erreichbarem quay.io.
- S16.4: `stack:reset --yes`: keine Volumes `hv-tool_*`, Zustandsverzeichnis weg; folgendes `up`: neue Secrets (Hash der
  Secret-Liste verschieden), `seed` schreibt neu (1748 Ereignisse).

**Befolgung durch den frischen Agenten (S17):** offen, läuft durch den Orchestrator. Voraussetzungen in dieser
Arbeitsumgebung: Docker-Daemon (vfs, kurze Pfade unter `/tmp`), Registry-Spiegel `mirror.gcr.io`, freie Ports 8480 und
8180; **ohne Freigabe von quay.io kann der Agent die Anmeldung nicht erreichen** und S17 gilt dann nach der Spec als nicht
erfüllt. Den TLS-prüfenden Proxy behandelt die Installationsseite (§10, `HV_STACK_BUILD_CA`).

**CI-Job `stack-037a` (Nachtrag des Orchestrators, E56):** grün auf dem letzten Code-Stand `61d204a` (PR #129,
Workflow-Lauf 37131208429), mit S11, S12 (inklusive Keycloak-Discovery S12.3 gegen das echte Image), S13 (Anmeldung mit
Screenshot), S14, S15, S16.1, S16.2 und S16.3 (Anmeldung nach `down`/`up`, Realm-Hash gleich, „bereits befüllt“).
Rückfall für den Screenshot `docs/evidence/037a-stack-angemeldet.png` nach E56: Artefakt `evidence-037a-stack`,
Lauf-ID 37131208429, Artefakt-ID 11277151085, Digest
`sha256:42265426246530ada90992c04176ce35a54748ee481614c4a924d43b92b19897`. Frühere grüne Läufe: `850055f` (Lauf
37130033938, Artefakt 11276443054). Auf `18049f5` und `47e9c14` rot (Ursache: Rechte des Zugriffslog-Verzeichnisses je
BuildKit-Version, Nachtrag Runde 2).

**`pnpm gates` auf `61d204a`** (sauberer Baum, Exit 0), Schluss:

```
1..315
# tests 315
# pass 315
# fail 0
✓ built in 1.87s
mark-test-run: wrote /home/user/wt/s037a-2/.claude/state/last-test-run (clean tree) at commit 61d204a, tree e8cd17a55887…
```

Danach nur Doku-Commits.

**Abweichungen von der Spec (im Bau entschieden, Review bitte prüfen).**
1. **Optionale Bau-CA `HV_STACK_BUILD_CA`.** Beide Dockerfiles hängen in der Installationsstufe ein Build-Secret
   `build_ca` ein (`RUN --mount=type=secret`); ist die Datei nicht leer, setzt der Schritt `NODE_EXTRA_CA_CERTS`. Compose
   definiert das Secret als `${HV_STACK_STATE_DIR}/build-ca.pem`, `stack.mjs` schreibt die Datei aus
   `HV_STACK_BUILD_CA` oder leer. Grund: Hinter einem TLS-prüfenden Proxy (diese Umgebung, viele Firmennetze) scheitert
   sonst `pnpm install` im Bau. Das Secret landet in keiner Schicht; in CI ist die Datei leer.
2. Die Web-Baustufe löscht die `.map`-Dateien zusätzlich zur 404-Regel in nginx (die Regel bleibt und ist getestet:
   ohne sie käme `index.html`).
3. Im Rauchtest steht die Keycloak-Discovery (S12.3) zuletzt, damit die übrigen Prüfungen auch bei einem IdP-Problem
   berichten.
4. Compose hat keine Standardports: `${HV_STACK_*:?set by scripts/stack.mjs}`; ein direkter `docker compose up` bricht
   ab, statt still auf 8480/8180 zurückzufallen (ergänzt Codex P2 auf #124). `migrate` nutzt das Image `api` mit
   `pull_policy: never`.
5. Die Proben S14 bis S16.2 sind Unterbefehle `node scripts/stack.mjs probe images|refusals|postgres-restart|api-crash`
   (kein siebtes Paketskript); CI und Installationsseite §7 rufen sie so auf.
6. `.dockerignore` schließt mehr aus als das Minimum (`docs`, `.github`, `.claude`, Tests, `apps/web/e2e`, `netlify.toml`).
7. nginx leitet `/v1/` und `/auth/` (mit Schrägstrich) weiter; das Zugriffsprotokoll von nginx schreibt den Pfad ohne
   Query (Code und State der Anmeldung bleiben draußen).
8. Der Keycloak-Admin heißt fest `hv-admin` (Passwort zufällig), damit die Admin-Konsole lesbar bleibt.
9. `stack-seed.mjs` verweigert zusätzlich eine unvollständige Personenliste und verlangt im Issuer einen ausdrücklichen
   Port (wie „`http://localhost:<port>/…`“ in Entscheidung 3).
10. Compose-Mindestversion 2.20. Die Portprüfung entfällt, wenn der Stack schon läuft (die Ports gehören dann ihm).
11. S7 vergleicht `keycloak-ci.mjs` gegen die Integrationsbasis nur auf einem `claude/slice-037a-…`-Zweig; sonst nur den
    Arbeitsstand (der Test bleibt in den Gates, spätere Scheiben dürfen die Datei ändern).
12. Der Job `stack-037a` steht in `gates.yml` zwischen `gates` und `e2e-http`: die Workflow-Tests von 031a (Datei nicht
    änderbar) lesen `e2e-http` als letzten Job der Datei. Er entfernt vor `stack:login` einen eingecheckten Screenshot,
    damit nie ein alter hochgeladen wird.
13. Bedrohungsmodell: neuer Abschnitt „Stand Scheibe 037a“ mit genau den genannten IDs (Muster von 031a und 034b) und
    Zeile 037 der Scheibenübersicht.

**Sicherheitsrelevante Beobachtungen.**
- quay.io gesperrt (Egress-Richtlinie), nicht umgangen; S13 und der Screenshot hängen am CI-Job.
- Der Dienst sendet `Strict-Transport-Security` auch über `http://localhost`; Browser ignorieren das über http, lokal
  ohne Wirkung. Mit TLS in 037b relevant (HSTS auf `localhost` würde andere lokale Dienste betreffen).
- Das Image `api` enthält tsx samt esbuild-Binärdatei; im Container läuft ein esbuild-Dienstprozess (UID 65532). Größere
  Angriffsfläche als ein Bündel, bewusst nach Entscheidung 2; Image-Scan 037b.
- In CI bleibt `hv_owner` Superuser (Job `gates`); unverändert, Hinweis an 037b steht in der Spec.
- `docker inspect` auf `migrate` und `seed` zeigt die Eigentümer-URL (Installationsseite §8).

**Nachtrag nach CI** (PR #129, Lauf 37128708706, Job 111219258268 auf `18049f5`: Stufe „Stack starten“ rot nach rund
33 s, einzige Ausgabe der Stufenname; erster Lauf mit dem echten Keycloak-Image). Minimaler Fix, Ursache noch nicht
belegt, der nächste CI-Lauf zeigt sie:
1. **Diagnose bei Fehlern** (`scripts/stack.mjs`): scheitert „Stack starten“, „Warten auf gesunde Dienste“ oder der
   Rauchtest (auch `stack:smoke`), gibt das Skript die Meldung von `docker compose up`, `docker compose ps -a` (Dienst,
   Zustand, Health, Exit-Code) und die letzten 80 Protokollzeilen jedes Dienstes aus, der nicht gesund läuft oder nicht
   mit 0 endete. Jeder Wert aus `state.json` (16 Secrets, auch URL-kodiert) wird durch `***` ersetzt
   (`formatDiagnostics`, `redact`; Test „Nachtrag: the diagnostics dump …“ in `scripts/stack.test.mjs`). Das weicht
   bewusst von „nie eine Docker-Meldung“ und „kein automatischer Abzug von `docker compose logs` in CI“ ab (Auftrag des
   Orchestrators, Fehlersuche); die Maskierung per `::add-mask::` läuft in CI weiterhin vorher. Erledigt damit auch den
   Folgelisten-Punkt „Image-Name bei Pull-Fehler“.
2. **Health-Probe von Keycloak** (`deploy/compose/compose.yaml`): Das Image beruht auf UBI micro; bash ist vorhanden, `grep`
   nach allem, was zu UBI micro bekannt ist, nicht (lokal nicht prüfbar, quay.io gesperrt). Die Probe nutzt jetzt nur
   bash-Builtins (`/dev/tcp`, `read`, Mustervergleich) und wertet auch eine letzte Zeile ohne Zeilenende aus (der
   JSON-Körper von `/health/ready`). Lokal gegen einen Testserver geprüft: `"UP"` → 0, `"DOWN"` → 1, kein Server → 1.
   `start_period` von 20 s auf 60 s (Realm-Import auf einem CI-Runner; ein Erfolg zählt sofort). `KC_HEALTH_ENABLED=true`
   war schon gesetzt; `start-dev --import-realm` mit `KC_HOSTNAME=http://localhost:<Port>` und `KC_HTTP_PORT` bleibt
   (Keycloak 26, Hostname v2; `start` bräuchte TLS).
3. Bekannte Grenze: Eine nie gesunde Probe allein erklärt die 33 s nicht (ungesund erst nach 60 Fehlversuchen); näher liegt
   ein Container, der früh endet. Die Diagnose des nächsten Laufs entscheidet.

**Nachtrag nach CI, Runde 2** (Lauf 37129170181 auf `47e9c14`: Keycloak gesund, die neue Probe wirkt mit dem echten
Image; `migrate` und `seed` mit 0; der Dienst startet im Kreis mit „HV-Tool API: refusing to start: HV_ACCESS_LOG_DIR must
not be writable by group or accessible by others.“) und Befunde des Reviews:
- **Ursache belegt:** `COPY --chmod=0700` auf ein Verzeichnis setzt den Modus des Zielverzeichnisses nur auf neuem
  BuildKit. Lokal (v0.28.1): 0700; mit buildx-Buildern v0.20.2 (Docker 28, CI-Runner) und v0.17.3: 0755, Eigentümer
  65532. Die Vermutung „Einhängereihenfolge“ ist widerlegt: nur `api` hängt `hv-access-log` ein. **Fix:** die Baustufe
  legt `/out/hv/access-log` mit 65532 und 0700 an, kopiert wird der Elternordner ohne `--chown`/`--chmod`
  (Eigentümer und Modus der Quelle). Belegt auf v0.28.1, v0.20.2 und v0.17.3, auch für ein neues benanntes Volume auf
  v0.20.2. Test „the mode of the access-log volume depends neither on the BuildKit version nor on the mount order“;
  `probe images` prüft zusätzlich das Volume im laufenden Dienst.
- Review 1 (S16.3): CI-Schritt `down` → `stack:up` (Hash von realm.json gleich, „bereits befüllt“) →
  `stack:login -- --no-screenshot`.
- Review 2: CI-Modus der Diagnose und `log_min_error_statement = panic` im Init-Skript (Entscheidung 11 und S18,
  Nachtrag des Orchestrators), Test.
- Review 3: `assertLocalDocker` (erst `DOCKER_HOST`, dann der Kontext) am Anfang von up, down, reset, smoke, probe und
  login; Test mit `DOCKER_HOST=tcp://…` und leerem `PATH` (kein docker-Aufruf, `reset --yes` löscht nichts).
- Review 4: `.dockerignore` mit `**/.env`, `**/.env.*`, `!**/.env.example`; S9 erweitert.
- Review 5: nginx `server_name localhost 127.0.0.1;`, `default_server` mit 421 (DNS-Rebinding); Rauchtest prüft einen
  fremden Host-Header; Bedrohungsmodell T-G1-S-04 (Hinweis an 074).
- Review 6: Installationsseite zeigt das Zugriffslog mit dem gepinnten Dienst-Image als 65532, `--network none`, nur lesend.
- Review 7: `pull_policy: build` für api, seed und web; `migrate` bleibt `never` auf dem gebauten Image (Test).
- Review 8: eigener Schritt entfernt den eingecheckten Screenshot nach dem Checkout; Upload nur mit Codeänderung.
- Review 9: S18-Test über `jobs['stack-037a']`; die 031a-Workflow-Tests bleiben grün.
- stack-login.mjs ohne festen Chromium-Pfad (PW_CHROMIUM_PATH oder Playwrights eigenes Chromium).

**`pnpm gates` (Schluss, Commit `8ac36d4`, sauberer Arbeitsbaum):**

```
1..306
# tests 306
# suites 0
# pass 306
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 15666.526821

> @hv/web@0.0.0 build /home/user/wt/s037a/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1730 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-DiRcK_jR.css                        42.35 kB │ gzip:   9.10 kB
dist/assets/index-D_XXpNDR.js                        647.75 kB │ gzip: 190.56 kB │ map: 2,753.79 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.16s
mark-test-run: wrote /home/user/wt/s037a/.claude/state/last-test-run (clean tree) at commit 8ac36d4, tree 51412fa63644…
```

**Nachtrag nach CI, Runde 3** (Lauf auf `850055f` grün, auch `stack-037a`; zwei Sicherheitsbefunde der engen
Nachprüfung, behoben statt Folgeliste):
- **Diagnosefilter enger:** Im CI-Modus von `formatDiagnostics` lässt das Muster für Container, Image, Network und Volume
  nach einem begrenzten Namen nur noch ein bekanntes Compose-Statuswort zu (Creating bis Built, optional ✔/✘ und eine
  Dauer), keinen freien Text. `dependency failed to start` nennt nur einen begrenzten Containernamen; „Error response
  from daemon“ hat den Zeichenvorrat und die 200-Zeichen-Grenze von `REFUSAL_LINE`. Test „CI compose lines are
  verb-bound and daemon errors character-limited“ (Markierung, die kein Secret ist, erscheint nicht; die bekannten
  Statuszeilen bleiben).
- **`--pull never`:** jedes `docker run` eines lokal gebauten Images (`probe images`, die Verweigerungsproben von api und
  seed) und beide Befehle zum Zugriffslog auf der Installationsseite, dort zusätzlich `--read-only`. Test „every docker
  run of a local image in stack.mjs carries --pull never“ (auch für die Installationsseite).

**Nachtrag nach CI, Runde 4** (Lauf 37132010223, Job 111228809454 auf `101cc15`, nur Doku: `probe postgres-restart`
rot mit „db zeitweise –, wieder ok nach – s (restart-Befehl 73.8 s)“; auf `850055f` und `61d204a` grün):
- **Ursache:** Die Probe startete den Beobachter per `docker compose exec` und gab ihm pauschal 1,5 s Vorsprung vor
  `docker compose restart postgres`. Der Ausfall dauert nur rund 0,6 s (Protokoll S16.1). Braucht der `exec`-Start auf
  dem Runner länger, liegt der ganze Ausfall vor der ersten Abfrage: kein „nicht ok“, der Beobachter läuft bis zu
  seiner Frist von 75 s. Die „73.8 s“ waren nicht die Dauer des Neustarts, sondern 75 s minus 1,5 s Vorsprung: die
  Zeit wurde erst nach dem Ende des Beobachters genommen. Die Vermutung „SIGTERM wartet auf den Pool“ trägt nicht, das
  Postgres-Image setzt schon `STOPSIGNAL SIGINT`.
- **Fix Probe:** Der Beobachter meldet `READY` erst nach einem `db ok`; erst dann startet der Host den Neustart, ohne
  auf ihn zu warten, und der Beobachter fragt alle 50 ms. „Nicht ok“ zählt nur ab dem Neustart, „wieder ok“ wird ab
  dem Neustart gemessen, der Neustart-Befehl eigens (mit Exit-Code). Ablauf und Bewertung sind rein
  (`observePostgresRestart`, `evaluatePostgresRestart`) und mit falscher Uhr und falschem Docker getestet.
- **Fix Compose:** `stop_signal: SIGINT` (ausdrücklich, gleich dem Image) und `stop_grace_period: 30s` für Postgres;
  davon profitieren auch `stop` und `stack:down` (kein SIGKILL mitten im Schluss-Checkpoint). Test.
- Installationsseite: Zeile zu `probe postgres-restart` beschreibt den neuen Ablauf.

## Review findings

**Lesebefund der Spec zu `111b0d9` (03.10.2026, frischer Kontext): 0 blocker, 8 major, Minor.** Alle in dieser Fassung
eingearbeitet. Sicherheitspunkte sind festgelegt, nicht verschoben.

| Nr. | Befund | Behebung |
|---|---|---|
| M1 | SP-1: Befüllungscode im auszurollenden Image | Ziel `seed`; das Image `api` hat kein `/app/scripts`; Verweigerung ohne Loopback, Compose-Host und leeres Log; SP-1 in der Tabelle; S14, S15 |
| M2 | Eigentümer ist Superuser (SECURITY DEFINER) | Entscheidung 8, Init-Skript, Vor dem Bau 8, S12.7 |
| M3 | Grenzen am Proxy behauptet, nicht gebaut | Entscheidung 4: Timeouts, Body-Grenze 257k, `add_header … always`, `.map` 404, Proben nicht auf 8480; S12.1, S12.2 |
| M4 | Realm je Aufruf zufällig, Rollen nach `down`/`up` verloren | ganzer Realm in `state.json`, einmal erzeugt; S6 byte-gleich; S16.3 mit Anmeldung |
| M5 | `bootstrap` nicht unverändert verschiebbar | `demo-persons.mjs`, `persons` als Parameter, Importpfade benannt, Files allowed vollständig |
| M6 | Node als PID 1, Kill ohne Neustart | `init: true`; S16.2 SIGKILL an den Kindprozess mit `RestartCount`; Vor dem Bau 9 |
| M7 | festes Subnetz, Proxy-Vertrauen lokal wirkungslos | kein Proxy-Vertrauen lokal (`trusted-proxies=none`), Test nach 037b |
| M8 | S17 durch den Implementierer | frischer Agent mit Klon und Seite; eigenes Protokoll |
| 9–12 | Cookie je Port, Docker ≥ 28, CI-Log, Rechte `/var/lib/hv` und `docker inspect` | Installationsseite §8, Bedrohungsmodell, S8, Entscheidung 11, S4, S14 |
| 13–18 | Port innen gleich außen, S5 als Unterprozess, kein Healthcheck für Einmaldienste, Heredoc, Drift, Seite erweitert, `.gitattributes`, pnpm-Hash, Scans | Entscheidungen 1, 2, 5–8, 13; S2, S5, S6; Sicherheitstabelle |
| 19 | Aufwand | 4 AStd nach drei Kürzungen (Abschnitt „Teilung“) |
| 20–22 | readyz-Satz, `--yes`, Lizenzzeile | Entscheidung 12, S8, Lizenzzeile |
