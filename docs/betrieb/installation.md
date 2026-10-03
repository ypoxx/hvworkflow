# HV-Tool lokal betreiben – Installation und Betrieb

Diese Seite führt Sie durch den lokalen Betrieb des HV-Tools auf Ihrem eigenen Rechner: Voraussetzungen, Start,
Anmeldung, Gesundheitsprüfung, Stoppen, Aktualisieren, Zurücksetzen, Deinstallieren und Fehlersuche. Sie brauchen kein
Wissen über das Projekt. Alle Befehle laufen im Wurzelverzeichnis des ausgecheckten Repositoriums.

Begriffe: Das HV-Tool verwaltet Fragen und Antworten der Hauptversammlung (HV) einer börsennotierten Gesellschaft.
„Stack“ meint hier die Gesamtheit der Container, die zusammen den Betrieb bilden.

## 1. Was Sie bekommen

Vier Dienste und zwei einmalige Schritte, alle als Container mit Docker Compose (Projektname `hv-tool`):

| Container | Aufgabe |
|---|---|
| `web` | nginx liefert die Oberfläche aus und leitet `/v1/` und `/auth/` an den Dienst weiter; setzt Grenzen und Sicherheitsheader. |
| `api` | Der HV-Tool-Dienst (Node, Image ohne Shell, ohne root); spricht mit Postgres und Keycloak. |
| `postgres` | Postgres 16 mit dem Ereignislog; die Anwendung hat dort keine Superuser-Rechte. |
| `keycloak` | Anmeldung (OpenID Connect) mit einem Test-Realm `hv-local` und neun synthetischen Testpersonen; Entwicklungsmodus, nur lokal. |
| `migrate` (einmalig) | Legt das Datenbankschema an oder bringt es auf den neuesten Stand. |
| `seed` (einmalig) | Befüllt eine leere Datenbank mit dem synthetischen Demo-Korpus und den Rollen der Testpersonen; bei vorhandenen Daten schreibt es nichts. |

Offene Ports, nur auf `127.0.0.1` (Ihr Rechner, nicht das Netz):

- **8480** – Web-Oberfläche: `http://localhost:8480`
- **8180** – Anmeldung (Keycloak): `http://localhost:8180`

Sonst ist nichts offen; Postgres und der Dienst haben keinen veröffentlichten Port.

**Nur lokal, nur synthetische Daten, kein Produktivbetrieb.** Für einen Server fehlen noch Teile (Abschnitt 11).

## 2. Voraussetzungen

- **Docker Engine ab Version 28 mit Docker Compose v2 ab Version 2.20.** Ältere Engines konnten unter Umständen Rechnern
  im selben Netzsegment Zugriff auf Ports geben, die nur auf `127.0.0.1` veröffentlicht sind. `pnpm stack:up` prüft beide
  Versionen. Prüfen Sie selbst mit `docker version` und `docker compose version`. Docker Desktop erfüllt das in aktuellen
  Versionen. Der Docker-Daemon muss auf diesem Rechner laufen; ein entfernter Daemon (`DOCKER_HOST` oder Kontext mit
  `tcp://` oder `ssh://`) wird verweigert.
- **Node 22.** Für `pnpm stack:login` (automatische Anmeldung mit Screenshot) zusätzlich **pnpm** (über corepack:
  `corepack enable`) und einmalig `pnpm install`.
- **Rund 3 GB freier Plattenplatz und 4 GB Arbeitsspeicher** für Images und Container.
- **Freie Ports** 8480 und 8180 auf `127.0.0.1` (andere Ports: Abschnitt 10).
- **Browser** Chromium, Google Chrome, Microsoft Edge oder Firefox. Safari kann `Secure`-Cookies auf `http://localhost`
  ablehnen; dann springt die Anmeldung zurück.

## 3. Ein Befehl

```
pnpm stack:up
```

Ohne pnpm geht dasselbe mit `node scripts/stack.mjs up`. Der Befehl braucht kein `pnpm install`.

Was passiert: Voraussetzungen prüfen, beim ersten Start Passwörter, Schlüssel und Test-Realm erzeugen, drei Images
bauen (`hv-tool/api:local`, `hv-tool/seed:local`, `hv-tool/web:local`), den Stack starten, warten, bis alle Dienste
gesund sind, und einen Rauchtest fahren (Abschnitt 5).

**Dauer:** beim ersten Mal einige Minuten (Basis-Images laden, Images bauen, Keycloak startet beim ersten Mal langsam);
danach meist unter einer Minute.

Am Ende steht die feste Schlusszeile:

```
HV-Stack bereit: http://localhost:8480 – Zugangsdaten der Testpersonen mit pnpm stack:credentials.
```

Bricht der Befehl ab, nennt er die Stufe, in der es klemmt (etwa „Voraussetzungen“ oder „Warten auf gesunde Dienste“),
und gegebenenfalls einen festen Satz mit der Abhilfe. Scheitert der Start oder der Rauchtest, folgt eine Diagnose: die
Meldung von Docker Compose, der Zustand jedes Containers und die letzten 80 Protokollzeilen jedes Dienstes, der nicht
gesund ist oder mit Fehler endete. Passwörter und Schlüssel aus dem Zustandsverzeichnis sind darin durch `***` ersetzt.
In GitHub Actions (CI) zeigt die Diagnose nur Statuszeilen und den Zustand der Container, keine Protokolle; einzige
Ausnahme ist ein fester Satz „HV-Tool API: refusing to start: …“ des Dienstes.
Weiter in Abschnitt 10.

## 4. Anmelden

Die Zugangsdaten zeigt nur dieser Befehl, und nur, wenn Sie ihn ausdrücklich aufrufen:

```
pnpm stack:credentials
```

Er listet je Zeile eine der neun Testpersonen: Nutzername, interne Rollenbezeichnung und Passwort; die letzte Zeile ist
der Zugang zur Keycloak-Admin-Konsole. Öffnen Sie
`http://localhost:8480`, wählen Sie „Anmelden“ und melden Sie sich im Keycloak-Formular mit Nutzername und Passwort an.
Die Adresse jeder Person ist `<Nutzername>@example.test`.

| Nutzername | Rolle (Anzeige in der Oberfläche) | Zweck |
|---|---|---|
| `moderation` | Versammlungsbüro | Wortmeldeliste führen; der Einstieg für eine Vorführung |
| `capture` | Erfassung | Redebeiträge erfassen und in Einzelfragen zerlegen |
| `coordination` | Koordination | Einzelfragen den Antwortpfaden zuordnen |
| `expert` | Fachbereich (Einheit `unit-fin`, Finanzen) | Antworten entwerfen |
| `legal` | Recht | Rechtliche Prüfung (Legal Clearing) |
| `approver` | Freigabe | Antworten freigeben |
| `podium` | Podium | Freigegebene Antworten auf der Bühne |
| `norole` | keine | Hat keine Rolle: die Anmeldung wird abgewiesen, es entsteht keine Sitzung (Gegenprobe) |
| `revoke` | Erfassung (zweite Erfassung) | Zweite Person der Erfassung, etwa um eine Sperre vorzuführen |

Die Rollen werden beim ersten Start einmal ins Ereignislog geschrieben. Sie bleiben über `stack:down` und `stack:up`
erhalten, weil der Realm mit denselben Kennungen bei jedem Start neu eingelesen wird.

**Keycloak-Admin-Konsole, nur lokal:** `http://localhost:8180/admin/`, Nutzer und Passwort aus `pnpm stack:credentials`.
Änderungen dort gehen beim nächsten Neuaufbau des Keycloak-Containers verloren (der Realm kommt immer aus dem
Zustandsverzeichnis).

**Automatische Anmeldung mit Screenshot (optional):** `pnpm stack:login` meldet `moderation` in einem Chromium ohne
Fenster an, prüft die Wortmeldeliste und legt `docs/evidence/037a-stack-angemeldet.png` ab; danach prüft es, dass
`norole` keine Sitzung bekommt. Braucht `pnpm install` und einmalig
`pnpm --filter @hv/web exec playwright install chromium`; alternativ zeigt `PW_CHROMIUM_PATH` auf ein vorhandenes
Chromium. `pnpm stack:login -- --no-screenshot` meldet nur an und prüft, ohne Bild.

## 5. Gesundheit prüfen

```
pnpm stack:smoke
```

Der Rauchtest prüft unter anderem: Sicherheitsheader auf Oberfläche, Dienstantworten und Fehlerseiten (auch 502 bei
angehaltenem Dienst), die Weiterleitung zum Dienst, die Abweisung fremder Host-Namen (421), die Body-Grenze (413), dass Proben und Metriken über den Webport
nicht erreichbar sind, die Gesundheit im Container, die Startzeile des Dienstes, die Befüllung, die Datenbankrollen
und die Anmelde-Discovery von Keycloak. Jede Zeile beginnt mit `PASS` oder `FAIL`.

- **`/healthz`** antwortet 200, solange der Prozess des Dienstes läuft.
- **`/readyz`** prüft Datenbank, Migrationsstand und Uhr; 200 heißt „bereit“.
- **Falle:** `/readyz` antwortet im Stack **503 mit `clock: not_configured`**. Das ist normal: Ohne NTP-Server prüft der
  Dienst die Uhr nicht. Der Rauchtest nimmt das hin und schreibt „Uhrprüfung nicht eingerichtet (erwartet ohne
  HV_STACK_NTP_SERVERS); Datenbank und Migrationen bereit.“ Wollen Sie die Uhrprüfung, setzen Sie beim Start
  `HV_STACK_NTP_SERVERS` (kommagetrennte Hostnamen, etwa `HV_STACK_NTP_SERVERS=ptbtime1.ptb.de,ptbtime2.ptb.de pnpm stack:up`);
  dann muss `/readyz` 200 liefern (UDP/123 nach draußen nötig).
- Die Proben `/healthz`, `/readyz` und `/metrics` sind über `http://localhost:8480` **bewusst nicht erreichbar** (404);
  sie laufen nur im Container. Der Rauchtest fragt sie dort ab.
- Überblick über alle Container: `docker compose -p hv-tool ps` (Spalte STATUS: `healthy` bei den vier Diensten,
  `migrate` und `seed` sind nach dem Start mit `Exited (0)` beendet).

## 6. Stoppen, Starten, Aktualisieren, Zurücksetzen, Deinstallieren

- **Stoppen:** `pnpm stack:down`. Die Container werden entfernt, **die Daten bleiben** (Datenbank und Zugriffslog liegen
  in Volumes, Passwörter im Zustandsverzeichnis).
- **Starten:** `pnpm stack:up`. Es verwendet dieselben Passwörter und denselben Realm; die Befüllung meldet „bereits
  befüllt“.
- **Aktualisieren:** `git pull`, dann `pnpm stack:up`. Die Images werden neu gebaut, die Daten bleiben, neue
  Migrationen laufen von selbst.
- **Zurücksetzen:** `pnpm stack:reset --yes`. Löscht Container, Volumes (alle lokalen Daten) und das
  Zustandsverzeichnis. Der nächste `pnpm stack:up` erzeugt neue Passwörter und befüllt neu. Ohne `--yes` passiert nichts.
- **Deinstallieren:** `pnpm stack:reset --yes`, dann
  `docker image rm hv-tool/api:local hv-tool/seed:local hv-tool/web:local`. Die gepinnten Basis-Images (node, distroless,
  nginx, postgres, keycloak) löschen Sie bei Bedarf selbst (`docker image ls`).

## 7. Robustheit, die Sie selbst prüfen können

Jede Probe läuft gegen den laufenden Stack und endet mit `PASS`-Zeilen oder einem `FAIL`.

| Befehl | Was passiert | Erwartetes Ergebnis |
|---|---|---|
| `node scripts/stack.mjs probe postgres-restart` | Startet Postgres neu und beobachtet `/readyz` im Container | `db` ist kurz nicht `ok`, nach wenigen Sekunden (höchstens 60 s) wieder `ok`; der Dienst wird nicht neu gestartet (RestartCount gleich) |
| `node scripts/stack.mjs probe api-crash` | Beendet den Node-Prozess des Dienstes hart (SIGKILL) | Docker startet den Dienst neu (RestartCount steigt), er ist binnen 60 s wieder gesund, die Zahl der Ereignisse ist unverändert; `docker compose stop api` endet in unter 3 s |
| `node scripts/stack.mjs probe images` | Prüft Images und laufende Prozesse | Dienst und Befüllung laufen als Nutzer 65532, Web als 101, kein Prozess als root; das Image `api` enthält keinen Befüllungscode |
| `node scripts/stack.mjs probe refusals` | Startet Dienst und Befüllung mit falscher Einrichtung, ohne Netz | Beide verweigern mit einem festen Satz ohne Werte |
| `pnpm stack:down`, dann `pnpm stack:up` | Stoppen und neu starten | gleiche Zahl der Ereignisse, „bereits befüllt“, Anmeldung mit `moderation` geht weiter |

**Nach einem Neustart von Keycloak:** Der Dienst teilt sich das Netz mit dem Keycloak-Container (Abschnitt 8). Wird
Keycloak neu erstellt, verlieren Dienst und Web ihr Ziel. Abhilfe:

```
pnpm stack:up -- --recreate api web
```

Bitte immer über diesen Befehl, nie direkt mit `docker compose … up`: Nur das Skript übergibt die gespeicherten Ports
und das Zustandsverzeichnis; ein direkter Aufruf bricht mit „set by scripts/stack.mjs“ ab.

## 8. Sicherheit des Pakets

- **Secrets je Installation, keine Standardpasswörter.** Der erste Start erzeugt alle Passwörter und Schlüssel zufällig
  (auch Keycloak-Admin und Datenbank-Superuser) und legt sie im **Zustandsverzeichnis** ab:
  `${XDG_STATE_HOME:-$HOME/.local/state}/hv-tool-stack` (Verzeichnis 0700, Dateien 0600; `realm.json` 0644, damit der
  Keycloak-Container sie lesen kann). Es liegt außerhalb des Repositoriums; im Repositorium steht kein Secret. Jeder
  Container bekommt nur seine eigene Datei. Weitere Starts erzeugen nichts neu.
- **Ohne root, nur Loopback.** Dienst und Befüllung laufen als Nutzer 65532, Web als 101, mit nur lesbarem
  Dateisystem, ohne Linux-Capabilities und mit `no-new-privileges`. Alle Ports binden `127.0.0.1`.
- **Nur unter `localhost` und `127.0.0.1`.** nginx beantwortet jeden anderen Host-Namen mit 421. Eine fremde Webseite,
  deren Name auf `127.0.0.1` zeigt (DNS-Rebinding), erreicht so weder Oberfläche noch Dienst.
- **Datenbankrollen.** Der Dienst verbindet sich als `hv_runtime` (kein Eigentümer, kein Superuser; darf das
  Ereignislog nicht ändern oder löschen). Migration und Befüllung laufen als `hv_owner`, Eigentümer der Datenbank `hv`,
  aber ohne Superuser-Rechte. Der Superuser `postgres` dient nur der Ersteinrichtung.
- **Nur lokal erzwungen.** Der Dienst verweigert den Start mit einer `http`-Anmeldeadresse außerhalb von `localhost`;
  die Befüllung verweigert fremde Anmeldeadressen und Datenbanken; Keycloak läuft im Entwicklungsmodus (`start-dev`),
  der nur lokal taugt; ein entfernter Docker-Daemon wird verweigert.
- **Cookie auf `localhost`.** Das Sitzungscookie `hv_session` gilt für alle Ports von `localhost`, nicht nur für 8480.
  Andere lokale Anwendungen im selben Browserprofil bekommen es mitgeschickt. Verwenden Sie für die Demo deshalb ein
  eigenes Browserprofil oder melden Sie sich nach der Demo ab.
- **Docker-Rechte sind root-gleich.** `docker inspect` zeigt auf den Containern `migrate` und `seed` die
  Datenbankadresse des Eigentümers mit Passwort. Wer Docker bedienen darf, hat ohnehin root-gleiche Rechte auf dem
  Rechner.

## 9. Zugriffslog

- **Ort:** Docker-Volume `hv-tool_hv-access-log`, im Container `/var/lib/hv/access-log` (Rechte 0700, Nutzer 65532).
- **Inhalt:** eine Zeile je Anfrage mit genau acht Schlüsseln (Version, Laufnummer, Zeit, Anfrage-ID, Operation,
  Status, Dauer, pseudonymer Subject-Hash), keine Texte, keine Cookies, keine Klarnamen (ADR 0013,
  `docs/adr/0013-zwei-protokollebenen.md`). Der Subject-Hash ist ein HMAC mit einem Schlüssel je Installation:
  pseudonym, nicht anonym.
- **Aufbewahrung:** 30 Tage, ältere Tagesdateien löscht der Dienst selbst.
- **Ansehen** nur mit Docker-Rechten, mit dem gebauten Dienst-Image als dessen Nutzer 65532, ohne Netz, ohne Registry-Abruf (`--pull never`) und nur lesend:
  `docker run --rm --pull never --read-only --network none -v hv-tool_hv-access-log:/var/lib/hv/access-log:ro --entrypoint /nodejs/bin/node hv-tool/api:local -e "console.log(require('fs').readdirSync('/var/lib/hv/access-log'))"`
  listet die Tagesdateien; eine Datei zeigt
  `docker run --rm --pull never --read-only --network none -v hv-tool_hv-access-log:/var/lib/hv/access-log:ro --entrypoint /nodejs/bin/node hv-tool/api:local -e "process.stdout.write(require('fs').readFileSync('/var/lib/hv/access-log/access-JJJJ-MM-TT.jsonl'))"`.
- `pnpm stack:reset --yes` löscht es mit.

## 10. Fehlersuche

| Meldung oder Lage | Ursache und Abhilfe |
|---|---|
| „Port 8480 auf 127.0.0.1 ist belegt“ (oder 8180) | Ein anderes Programm nutzt den Port. Beenden Sie es, oder wählen Sie **beim ersten Start** andere Ports: `HV_STACK_WEB_PORT=9480 HV_STACK_IDP_PORT=9180 pnpm stack:up` (1024 bis 65535). Die Ports gehören dann zur Installation; ein späterer anderer Wert wird verweigert, weil Realm und Anmeldeadresse daran hängen. Wechsel nur mit `pnpm stack:reset --yes`. |
| „Docker läuft nicht oder ist für diesen Nutzer nicht erreichbar“ | Docker starten (Docker Desktop öffnen oder `sudo systemctl start docker`); unter Linux den Nutzer in die Gruppe `docker` aufnehmen oder Docker Desktop verwenden. |
| „Docker Engine ab Version 28 ist Pflicht“ / „Docker Compose v2 ab Version 2.20 ist Pflicht“ | Docker aktualisieren. |
| „Ein entfernter Docker-Daemon … wird verweigert“ | `DOCKER_HOST` leeren und mit `docker context use default` auf den lokalen Daemon wechseln. |
| Stufe „Images bauen“ bricht mit Zertifikatsfehlern ab (`SELF_SIGNED_CERT_IN_CHAIN`, `unable to get local issuer certificate`) | Ihr Netz prüft TLS mit einer eigenen Zertifizierungsstelle (Firmen-Proxy). Geben Sie deren Stammzertifikat (PEM) nur für den Bau mit: `HV_STACK_BUILD_CA=/pfad/zur/firmen-ca.pem pnpm stack:up`. Es wird nur während der Installation der Abhängigkeiten eingehängt und landet in keinem Image. |
| Stufe „Stack starten“ bricht ab | Meist kann ein Basis-Image nicht geladen werden (Netz, Proxy, Rate-Limit von Docker Hub). Laden Sie die Images einzeln mit `docker pull <name>`, um die Meldung zu sehen; die Namen stehen in `deploy/compose/compose.yaml` (`image:`) und in den Dockerfiles unter `deploy/docker/` (`FROM`). Danach `pnpm stack:up` erneut. |
| `up` hängt bei „Warten auf gesunde Dienste“, vor allem beim ersten Start | Keycloak braucht beim ersten Start oft ein bis zwei Minuten und rund 1 GB Arbeitsspeicher. Geben Sie Docker mehr Speicher (Docker Desktop: Einstellungen, Ressourcen). Bleibt ein Dienst ungesund, bricht `up` nach einigen Minuten ab, spätestens nach 15 Minuten. Stand ansehen: `docker compose -p hv-tool ps`. |
| „Der einmalige Schritt migrate (oder seed) endete mit Fehler“ | Protokoll lokal ansehen: `docker compose -p hv-tool logs migrate` (oder `seed`). Hilft nichts: `pnpm stack:reset --yes`, dann `pnpm stack:up`. |
| Im Protokoll des Dienstes steht „refusing to start“ | Der Satz nennt die Variable und die Regel, nie den Wert. Im Stack setzt das Skript alle Variablen; meist hilft `pnpm stack:up` (schreibt die Dateien neu). |
| Die Anmeldung springt zurück auf die Anmeldeseite | Browser: Safari kann das Cookie auf `http://localhost` ablehnen; Chromium, Edge oder Firefox nehmen. Cookies für `localhost` erlaubt? Die Adresse muss genau `http://localhost:8480` sein (nicht `127.0.0.1`), weil der Realm nur diese Rücksprungadresse kennt. |
| Die Seite antwortet mit 421 „Misdirected Request“ | Aufruf über einen anderen Namen als `localhost` oder `127.0.0.1` (etwa den Rechnernamen). Nutzen Sie `http://localhost:8480`. |
| `/readyz` antwortet 503 | Mit `clock: not_configured` normal (Abschnitt 5). Mit `db` nicht `ok`: Postgres prüfen (`docker compose -p hv-tool ps postgres`). Mit `migrations_pending`: `pnpm stack:up`. |
| Keycloak wurde neu gestartet, Dienst oder Web haben kein Ziel mehr (502, Anmeldung bricht ab) | `pnpm stack:up -- --recreate api web` (nie direkt mit `docker compose`, sonst gehen die gespeicherten Ports verloren). |
| „Das Datenbank-Volume … besteht ohne Zustandsverzeichnis“ oder „Das Zustandsverzeichnis besteht, das Datenbank-Volume … aber nicht mehr“ | Zustand und Daten passen nicht mehr zusammen (etwa nach einem händischen `docker volume rm`). `pnpm stack:reset --yes`, dann `pnpm stack:up`. |
| „Das Zustandsverzeichnis … muss ein eigenes Verzeichnis mit den Rechten 0700 sein“ | Rechte zurücksetzen: `chmod 700 ~/.local/state/hv-tool-stack` (oder unter `$XDG_STATE_HOME`). |
| Protokolle ansehen | `docker compose -p hv-tool logs <dienst>` (`api`, `web`, `postgres`, `keycloak`, `migrate`, `seed`), nur lokal. Die Protokolle enthalten keine Secrets, aber Pfade. |

## 11. Was bis zum Betrieb auf einem Server fehlt

Diese Punkte kommen in den Scheiben 037b (Pipeline und Staging) und 038 (Sicherung):

- **TLS:** Lokal läuft alles über `http://localhost`; ein Server braucht HTTPS mit echtem Zertifikat.
- **Secrets aus der Plattform:** Statt einer Datei im Zustandsverzeichnis kommen Passwörter und Schlüssel aus einem
  Secret-Speicher der Plattform, mit Eigentümer-Checkliste.
- **Proxy-Vertrauen:** Hinter einem echten Proxy muss der Dienst dessen Adressen kennen (`HV_TRUSTED_PROXY_CIDRS`), damit
  die Grenzen je Quelle wirken.
- **CSP:** Eine Content Security Policy für das Web-Dokument, mit Test gegen den Produktions-Build.
- **Alarme:** Betriebsauswertung mit Alarmversand (etwa Füllstand und Schreibfehler des Zugriffslogs).
- **Backup:** Sicherung und Wiederherstellung der Datenbank (038).
- **Image-Scan:** Prüfung der gebauten Images auf bekannte Schwachstellen vor dem Ausrollen.
