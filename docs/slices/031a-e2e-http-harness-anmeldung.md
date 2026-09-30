# Scheibe 031a — HTTP-Projekt der e2e-Suite: Harness, Keycloak, Anmeldung und CI-Job

**Status:** spec (nach Lesebefund 30.09.2026 nachgebessert und geteilt)
**Risikoklasse:** hoch · 2,5 AStd · 23.10.2026 (W4) · Lanes: e2e, infra, docs-sicherheit
**Rolle:** Implementierer-Oberfläche mit Infra-Anteil (Harness, CI-Job); unabhängiges Review in frischem Kontext mit Perspektive Security/Betrieb, zusätzlich Sicherheits-Checkliste des Reviewers (SC-05, SC-06, SC-10, SC-12, SP-1, SP-3, SP-5, SP-6, SP-7) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue fachliche Regel, keine neue Regel-ID, keine Änderung an `ROLE_PERMISSIONS`, der Übergangstabelle, dem Vertrag oder am Produktcode (`apps/api/src`, `apps/web/src` außer einem Unit-Test); AGENTS.md R2 (Nachweis), R4 (Rollennamen nur in Testhilfen), R6 (Oberfläche nur über `HvApi`), R11 (nur synthetische Daten, Geheimnisse je Lauf)
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/031a (Teil 1 der am 30.09.2026 geteilten Scheibe 031), §5.4/084 (Job-Matrix: „PR voll … http-Projekt ab 031“); ADR 0002 Ergänzung, ADR 0004 (BFF im Dienst); `docs/folgeliste.md` (030, 029b nit, 027 nit, 033b nit); Lehren aus 034a/034b (CSP `default-src 'none'`, Grenzen, Konfigurationsschema); Bedrohungsmodell T-G1-S-02, T-G1-S-03, T-G1-T-05, T-Q-I-01, T-G2-I-02, 029b-Nachtrag; Leitplanken §4, 6.8
**Depends on:** 030, 027 und 034b (gemergt); 084 ist nicht gebaut und wird nicht vorausgesetzt (Entscheidung 10)
**Perspektive:** Security/Betrieb · **Glossar: neue Begriffe:** nein

## Warum geteilt und warum hoch

Die erste Fassung (031, eine Spec, 3 AStd) war nach dem Lesebefund vom 30.09.2026 nicht baureif (5 major). Teilung
(Entscheidung des Orchestrators): **031a** baut das HTTP-Projekt mit Harness, Keycloak, Anmeldung, eigenen Tests
H1–H8, der Verdrahtung von `030` und dem CI-Job; **031b** stellt die fünf gemeinsamen Dateien auf beide Projekte um und
liefert den Nachweis für ADR 0002. Die Teilung von Test 003 ist ein eigener kleiner Takt (Folgeliste), nicht Teil
von 031. Zwei getrennt prüfbare Flächen: Sicherheits- und Infrastrukturgrenze (031a) gegen Portierung fachlicher
Szenarien (031b).

031a ist **hoch** (Leitplanken §4): es fährt Identität und Sitzung Ende zu Ende im Browser (Cookie-Attribute, CSRF,
Subject-Sperre), führt Geheimnisse je Lauf in der Pipeline, schreibt Rollenzuordnungen am Verwaltungsweg vorbei in
eine Datenbank und legt die Netzgrenze Oberfläche–Dienst für den Test fest. Der Plan führte 031 als „mittel“; eine
Heraufstufung braucht keine Freigabe.

## Ziel und Entscheidungen vor Bau

Ein Playwright-Projekt `http` fährt den HTTP-Modus der Oberfläche gegen den echten Hono-Dienst mit Postgres und
Keycloak-Testrealm, ohne `page.route`-Attrappe für den Dienst; das Projekt `in-process` bleibt. Offene Punkte sind auf
Standard gebaut und als solche markiert. „HTTP-Modus“ heißt hier: der Vite-Entwicklungsserver mit
`HV_WEB_MODE=http`, nicht das Produktionsbundle (Offen).

1. **Projekte.** `apps/web/playwright.config.ts` definiert `in-process` (bisher `chromium`; Demo-Modus, Vite auf
   `E2E_PORT`, Standard 4173) immer. `http-setup` und `http` gibt es nur bei `E2E_HTTP=1` (setzt nur das Harness);
   ohne diese Variable verhält sich `pnpm --filter @hv/web e2e` wie heute. Für `http` kommt ein zweiter
   `webServer`-Eintrag hinzu: `vite --port <E2E_HTTP_PORT> --strictPort`, Umgebung `HV_WEB_MODE=http` und
   `HV_API_ORIGIN=<E2E_HTTP_API_ORIGIN>`, `reuseExistingServer: false`. Der Port kommt überall (Vite, Redirect-URI,
   Realm, Basis-URL) aus `E2E_HTTP_PORT`, Standard 4174. Zuordnung per `testMatch`/`testIgnore` mit ausdrücklichen
   Dateinamen: `in-process` alle heutigen Dateien außer `030-anmeldung.spec.ts` und `031-http-betriebsart.spec.ts`;
   `http` in 031a genau `030-anmeldung.spec.ts` und `031-http-betriebsart.spec.ts` (031b erweitert die Liste).
2. **Feste Reihenfolge und ein Worker.** Das Harness startet `http` mit `--workers=1`. Playwright ordnet Dateien nach
   Pfad; die Reihenfolge wird ausdrücklich gepinnt: `scripts/e2e-http-031.test.mjs` vergleicht die Ausgabe von
   `playwright test --list --project=http` (mit `E2E_HTTP=1`) mit der festen Liste `030-anmeldung.spec.ts`,
   `031-http-betriebsart.spec.ts` in dieser Reihenfolge. Eine Datenbank je Lauf (Entscheidung 6).
3. **Lokaler Modus `E2E_HTTP_IDP=none` in der Konfiguration.** Ist die Variable gesetzt, hat `http` keine Abhängigkeit
   von `http-setup`, keinen Standard-`storageState`, `testMatch` nur `030` und `031` und `grepInvert: /@idp/`;
   `http-setup` wird nicht definiert. Das Harness startet dann kein Keycloak; der Issuer zeigt auf einen geschlossenen
   Loopback-Port (Anmeldung 503).
4. **Keine Traces, keine Videos, kein HTML-Protokoll (Sicherheit).** Für `http-setup` und `http`: `trace: 'off'`,
   `video: 'off'`, `screenshot: 'only-on-failure'`. Bei `E2E_HTTP=1` ist der Reporter nur `[['list']]` (kein
   `html`), weil das HTML-Protokoll `fill`-Werte zeigt, also Passwörter der Testpersonen. `scripts/e2e-http-031.test.mjs`
   sichert das: es lädt die Konfiguration in einem Kindprozess mit Arbeitsverzeichnis `apps/web` und `E2E_HTTP=1`
   (einmal mit, einmal ohne `E2E_HTTP_IDP=none`), gibt Reporter und `use` der Projekte als JSON aus und prüft
   `trace === 'off'` und `video === 'off'` in beiden HTTP-Projekten sowie das Fehlen eines `html`-Reporters.
5. **Gleiche Herkunft über den Vite-Proxy, kein CORS (Lehre 034a/034b).** Die Oberfläche läuft vom Vite-Origin; `/v1`
   und `/auth` leitet der vorhandene Proxy in `apps/web/vite.config.ts` an den Dienst weiter. Kein `HV_CORS_ORIGINS`,
   kein `HV_TRUSTED_PROXY_CIDRS`. Gründe: (a) der HTTP-Client ist gleiche Herkunft gebaut (relative Pfade,
   `credentials: 'same-origin'` in `apps/web/src/api/http.ts`), Cross-Origin bräuchte eine Produktänderung; (b) das
   Schema aus 034b lässt außerhalb der Demo nur `https:`-Herkünfte zu, `http://localhost:<Port>` würde den Start
   verweigern, eine Lockerung wäre MF-12; (c) Zielbild ist ein BFF gleicher Herkunft (ADR 0004); (d) die CSP des
   Dienstes (`default-src 'none'`) wirkt nur auf Dokumente des Dienstes. Alle Dokumente kommen von Vite; vom Dienst
   kommen nur `fetch`-Antworten und die 302-Weiterleitungen von `/auth/login` und `/auth/callback`. Kein Test öffnet
   eine JSON-Seite des Dienstes als Dokument und ruft dort `fetch`.
   **Cookies:** `hv_session` und `hv_auth_state` tragen `Secure; HttpOnly; SameSite=Lax`. Chromium nimmt `Secure`-Cookies
   von `http://localhost` an; H4 prüft das mit `context.cookies()`. Wird das Cookie nicht gespeichert: anhalten, Spec
   klären (Rückfall wäre HTTPS für Vite), **nie** ein Cookie ohne `Secure` im Dienst. Cookies gelten je Host, nicht je
   Port: `hv_session` erreicht auch Keycloak und den Dienst direkt; im Test ohne Folge.
   **SameSite:** `Lax` genügt, weil (1) der Rückruf `/auth/callback` eine Top-Level-GET-Navigation ist, bei der
   `Lax`-Cookies auch websiteübergreifend mitgesendet werden (`hv_auth_state`), und (2) alle `fetch`-Aufrufe gleiche
   Herkunft haben. Im Test sind Keycloak und Oberfläche ohnehin dieselbe Site (`localhost`, der Port zählt nicht); das
   websiteübergreifende Verhalten beweist der Test also nicht (Offen).
   **CSRF:** `X-CSRF-Token` aus `/auth/me`, nur im Speicher (030); kein Preflight. `HV_OIDC_REDIRECT_URI` ist
   `http://localhost:<E2E_HTTP_PORT>/auth/callback`; `createApp` setzt kein `serviceOrigin`, der Rückruf darf auf dem
   Proxy-Origin liegen.
6. **Harness `scripts/e2e-http-031.mjs`** (tsx-Lader wie 029b), Stufen fest, bei Fehler nur der Stufenname auf stderr
   (Muster 029b):
   1. Keycloak starten (Entscheidung 8) oder bei `E2E_HTTP_IDP=none` auslassen.
   2. Frische Datenbank `hv_e2e031_<8 Hex>` über `TEST_DATABASE_URL` (Owner), Migrationen mit
      `pnpm --filter @hv/api db:migrate up` und `HV_MIGRATION_DATABASE_URL`, `HV_DB_RUNTIME_ROLE`.
   3. **Bootstrap (Pflichtpfad):** In-Process-Kern auf einem In-Memory-Speicher mit `SYSTEM_ACTOR` wie in 029b,
      erst `seedDemo` mit `seeder: seedEvents` und `CORPUS_DEMO` (gleicher Umfang wie `in-process`), danach
      `assignRole` je Testperson für `actorIdForIdentity(issuer, userId)` (Experte mit Fachbereich `unit-fin`). Die so
      gestempelten Ereignisse schreibt das Harness in **einer** Transaktion mit `insertPostgresEvents` aus
      `apps/api/src/persistence/postgres.ts` (füllt `events` und `persons`); kein handgeschriebenes SQL für Ereignisse.
      Geseedet wird nur hier, in eine leere Datenbank, bevor der Dienst läuft (SP-1); der Dienst selbst seedet
      außerhalb der Demo nie.
   4. Dienst starten (Entscheidung 7), Startzeile und stderr prüfen.
   5. `pnpm --filter @hv/web exec playwright test --project=http --workers=1` mit `E2E_HTTP=1`, `E2E_HTTP_PORT`,
      `E2E_HTTP_API_ORIGIN`, `E2E_HTTP_STATE_DIR`, `E2E_HTTP_IDP`.
   6. Dienst stoppen, Zugriffslog prüfen: jede Zeile genau die acht Schlüssel aus 033a; kein Client-Secret, Passwort,
      Sitzungscookie, CSRF-Token, keine Actor-ID und keiner der Texte, die die Suite schreibt. Die Texte kommen aus
      einer gemeinsamen Konstante `apps/web/e2e/support/e2e-texts.ts`, die Tests und Harness gleichermaßen importieren
      (031b ergänzt die Texte der gemeinsamen Dateien dort).
   7. Container entfernen, Datenbank löschen, Temp-Verzeichnis löschen, auch im Fehlerfall.

   Modus `--check` prüft ohne Docker und Datenbank Realm-Struktur und Dienstumgebung. Geheimnisse entstehen je Lauf
   zufällig, stehen nur in Kindprozess-Umgebungen und in Dateien mit 0600 unter `E2E_HTTP_STATE_DIR` (Verzeichnis 0700,
   außerhalb des Repositoriums) und werden nie ausgegeben. Steuervariablen heißen `E2E_*` und gehen nicht an den Dienst;
   keine Variable `HV_E2E_*`.
7. **Test-Dienst besteht die Startprüfung aus 034b (Lehre d).** Start von `apps/api/src/server.ts` mit **ausdrücklicher**
   Umgebung (nicht `...process.env`): `PATH`, `PORT=18091`, `HV_DATABASE_URL` (Laufzeitrolle, frische Datenbank),
   `HV_OIDC_ISSUER`, `HV_OIDC_CLIENT_ID`, `HV_OIDC_CLIENT_SECRET`, `HV_OIDC_REDIRECT_URI`, `HV_AUTH_ENCRYPTION_KEY`
   (32 Zufallsbyte, base64url), `HV_ACCESS_LOG_DIR` (`mkdir(…, { mode: 0o700 })` in einem `mkdtemp`-Verzeichnis),
   `HV_ACCESS_LOG_HASH_KEY` (32 Zufallsbyte), `HV_TRANSPARENCY_NOTICE_VERSION=e2e-synthetic-1`,
   `HV_TRANSPARENCY_NOTICE_DE`, `HV_TRANSPARENCY_NOTICE_EN` (feste synthetische Sätze aus `e2e-texts.ts`),
   `HV_DSFA_SUMMARY_URL=https://example.org/hv-e2e-dsfa`, `HV_RATE_LIMIT_WRITES_PER_MIN`, `HV_RATE_LIMIT_READS_PER_MIN`
   (Entscheidung 9). Nicht gesetzt: `NODE_ENV`, `HV_DEMO`, `HV_EVENT_LOG`, `HV_CORS_ORIGINS`, `HV_TRUSTED_PROXY_CIDRS`,
   `HV_NTP_SERVERS`, `HV_REQUEST_TIMEOUT_MS` (Standard 10 000 ms, über dem Minimum 7 000), alle übrigen Grenzen
   (Standard). Das Harness prüft: stdout enthält wörtlich
   `HV-Tool API: start mode=service persistence=postgres auth=oidc cors=none trusted-proxies=none`; stderr enthält weder
   `refusing to start` noch `ignoring unknown variables` noch `limit reached`. Bereitschaft wie in 029b:
   `/auth/transparency-notice` 200, dann `/readyz` mit `db` und `migrations` = `ok`; 503 nur mit
   `clock.code = not_configured`. Der Dienst bindet ohne `hostname` an alle Schnittstellen (`serve` in `server.ts`, nicht
   in dieser Scheibe änderbar); lokal lauscht er also während des Laufs auf Port 18091 aller Schnittstellen, nur mit
   synthetischen Daten (Offen, Folgeliste).
8. **Keycloak-Infrastruktur erweitern, nicht verdoppeln.** Neues Modul `scripts/lib/keycloak-ci.mjs` mit dem aus 029b
   herausgelösten Teil: Image-Kennung, Containerstart (`start-dev --import-realm`, Port nur an 127.0.0.1), Warten auf
   Discovery, Entfernen, Realm-Aufbau mit einem vertraulichen Client und N Personen. Image per Tag **und** Digest:
   `quay.io/keycloak/keycloak:26.7.4@sha256:<digest>` (Folgeliste 029b nit). Die Formprüfung in
   `scripts/keycloak-ci-029b.mjs:70` wird dafür zu `/^quay\.io\/keycloak\/keycloak:26\.7\.4@sha256:[0-9a-f]{64}$/`;
   sonst nutzt 029b das Modul ohne Änderung seiner Prüfungen und Ausgaben (`--check` bleibt). 031a: Realm
   `hv-e2e-031`, Port 18080, Client mit genau einer Redirect-URI (Entscheidung 5), **9 synthetische Personen**
   (Benutzername und Kennung zufällige UUID, Adresse `@example.test`, Passwort je Lauf zufällig): `moderation`, `capture`,
   `coordination`, `expert` (`unit-fin`), `legal`, `approver`, `podium`, `norole` (ohne Zuordnung) und `revoke`
   (`capture`, nur H6). Rollenzuordnung im Bootstrap mit `SYSTEM_ACTOR` wie in 029b; `admin` hätte
   `admin.roles.manage` zwar (`packages/domain/src/permissions.ts:74-75`), der Weg über den Dienst scheidet aber aus,
   weil der Dienst außerhalb der Demo nicht seedet und die Zuordnung vor dem ersten Start stehen muss.
9. **Grenzen aus 034a im Test (Lehre b).** Angehoben werden nur die Grenzen je Person, alle übrigen bleiben auf dem
   Standard, damit der 429-Wächter die Standardwerte für Anmeldung, anonyme Aufrufe, Proben und Preflights echt prüft:

   | Variable | Standard | Test | Bereich (`schema.ts`) | Grund |
   |---|---|---|---|---|
   | `HV_RATE_LIMIT_WRITES_PER_MIN` | 60 | 1 000 | 1–10 000 | 031b: Podium-Schleife der Abnahme bis 130 Runden mit je bis zu 2 Schreibvorgängen |
   | `HV_RATE_LIMIT_READS_PER_MIN` | 1 200 | 20 000 | 60–100 000 | Neuladen der Listen nach jeder Aktion derselben Person |
   | Anmeldung je Quelle / gesamt, anonym, Proben, Preflight | 120 / 600, 600, 600, 1 200 | Standard | — | alle Anfragen kommen über den Proxy von einer Quelle; `http-setup` meldet 8 Personen an, H4–H7 weitere 4; weit unter 120 je Minute |

   Harness-Regel: die gesamte Anmeldegrenze ist nie kleiner als die je Quelle (Standard 600 ≥ 120; das Harness prüft
   es an seiner eigenen Umgebung). `apps/web/e2e/support/http-guard.ts` lässt jeden Test des `http`-Projekts scheitern,
   sobald eine Antwort des Dienstes 429 trägt (Pfad im Fehlertext, ohne Header und Body). 031a behauptet nicht, dass die
   Standardwerte im Betrieb reichen (Messung 071/078).
10. **CI: eigener Job `e2e-http`, 084 nicht vorausgesetzt.** In `.github/workflows/*.yml` gibt es keine Job-Matrix aus
    084 (Job `gates` auf `push` und `pull_request`, dazu `nightly`); 031a baut den PR-Teil („PR voll … http-Projekt ab
    031“) als zweiten Job in `.github/workflows/gates.yml`, 084 übernimmt ihn später. Job `e2e-http`:
    `if: github.event_name == 'pull_request'`, `runs-on: ubuntu-latest`, `timeout-minutes: 15`; **erbt** die
    Workflow-Rechte `contents: read`, `pull-requests: read` (kein eigener `permissions`-Block, weder enger noch weiter).
    Eigener Postgres-Dienst mit denselben Test-Zugangsdaten wie `gates`, Image per Digest. Schritte in dieser
    Reihenfolge: `actions/checkout` per Commit-Hash mit `fetch-depth: 0` und `persist-credentials: false`;
    `pnpm/action-setup` (Hash wie in `gates`); `actions/setup-node` per Commit-Hash; Install; Doku-Filter wie in `gates`
    (bei reiner Doku alle folgenden Schritte übersprungen, der Job meldet trotzdem); „Create separate Postgres runtime
    login for grant tests“ (wie in `gates`); „Install Chromium for Playwright“ (`timeout-minutes: 4`); „End-to-end http
    project against Hono, Postgres and Keycloak“ (`timeout-minutes: 9`,
    `node --import ./apps/api/node_modules/tsx/dist/loader.mjs scripts/e2e-http-031.mjs`); Upload nur von
    `docs/evidence/031-*.png` als Artefakt `evidence-031-http` (Upload-Baustein per Hash v4.6.2). **Kein** Upload von
    `playwright-report`, Traces oder Videos. Ein Schritt „Run operational migration command“ auf `hv_test` entfällt in
    diesem Job: der Keycloak-Schritt aus 029b bleibt in `gates` (siehe unten), und das Harness migriert seine eigene
    Datenbank in Stufe 2 mit derselben CLI.
    **Keycloak-Schritt 029b bleibt in `gates`.** Er zieht erst in einem späteren Takt in `e2e-http` um, wenn der
    Eigentümer `e2e-http` zum Pflicht-Check gemacht hat (Eigentümerfrage 1); bis dahin laufen im PR zwei
    Keycloak-Container nacheinander in zwei Jobs.
    **Pins (SC-10):** `postgres:16` per Digest in beiden Jobs (Folgeliste 027 nit); der zweite
    `actions/upload-artifact@v4` in `gates` (Evidence) auf den vollen Hash v4.6.2 wie beim Katalog (Folgeliste 033b nit);
    jeder neue Baustein per Commit-Hash.
11. **Laufzeitbudget (feste Zahlen).** Heute rund 10 min je Lauf im Job `gates`; der bleibt unverändert (≤ 10 min, keine
    neuen Schritte außer den Pins). `e2e-http`: Ziel ≤ 12 min, harte Grenze 15 min. Summe der festen Schrittgrenzen
    Chromium 4 + Harness 9 = 13 min; für Checkout, Install, Filter und Upload ohne eigene Grenze bleiben bewusst 2 min bis
    zur Job-Grenze von 15 min. Überschreitet der Job sie, bricht er ab; das ist ein Befund, keine Grenze wird still
    angehoben. Das `http`-Projekt selbst in 031a ≤ 3 min. Beide Jobs laufen parallel.
12. **Neue Datei `apps/web/e2e/031-http-betriebsart.spec.ts`**, feste Kennungen; `@idp` braucht Keycloak. Die Tests
    berühren den geteilten Datenbankzustand so wenig wie möglich: kein Test ändert Fragen oder Wortmeldungen des Korpus;
    nur H8 schreibt, und zwar auf einem Redebeitrag, den er selbst anlegt.
    - **H1** Anmeldeseite aus dem echten Dienst, leerer Zustand: Hinweistext DE und EN aus `e2e-texts.ts`, Link zur
      DSFA-Zusammenfassung gleich `HV_DSFA_SUMMARY_URL`, Anmeldelink `/auth/login?returnTo=…`, kein Rollenumschalter,
      axe ohne Verstoß ab „ernst“.
    - **H2** Altes Demo-Protokoll wird im HTTP-Modus ignoriert: Alt-Protokoll unter `hv-demo-events-v1` wie in `024`,
      kein Reset-Banner, Anmeldeseite, Eintrag unverändert; Screenshot `031-http-altes-demoprotokoll.png`.
    - **H3** Gleiche Herkunft: die Anfrage an `/auth/me` geht an den Vite-Origin; die Antwort trägt kein
      `Access-Control-Allow-Origin`, aber `Content-Security-Policy` mit `default-src 'none'` und `X-Server-Time`.
    - **H4** `@idp`, leerer Zustand: Anmeldung durch das Keycloak-Formular als `capture` aus `/speakers?round=2`, Rückkehr
      genau dorthin; Rollenanzeige der Sitzung; kein Rollenumschalter, kein Demo-Zurücksetzen; `hv_session` in
      `context.cookies()` mit `httpOnly: true`, `secure: true`, `sameSite: 'Lax'`; kein Schlüssel `hv-demo*` in
      `localStorage`; Screenshot `031-http-angemeldet.png`.
    - **H5** `@idp`, seriell nach H4 in derselben `describe.serial`-Gruppe und demselben Kontext: Abmelden sendet
      `X-CSRF-Token`, danach Anmeldeseite, danach `/auth/me` mit dem alten Cookie 401. Beendet nur die in H4 erzeugte
      Sitzung, nie den `capture`-Zustand aus `http-setup`.
    - **H6** `@idp` Sitzungsentzug mitten in der Sitzung (Folgeliste 030): Person `revoke` angemeldet (eigener Zustand);
      der Test liest Laufzeit-DB-URL und `oidc_…`-Kennung aus der Datei `revoke.json` (0600) unter `E2E_HTTP_STATE_DIR`,
      ruft `apps/api/src/auth/subject-block-cli.ts` mit ausdrücklicher Umgebung `{ PATH, HV_DATABASE_URL }` und
      `stdio: 'ignore'` auf, der nächste Abruf ist 401, die Oberfläche zeigt die Anmeldeseite ohne Fachdaten;
      Screenshot `031-http-401.png`.
    - **H7** `@idp` Person `norole`: echtes 403 mit CSRF-Token, Seite „Keine aktive Rolle“, Abmelden funktioniert.
    - **H8** `@idp` Zwei Schreiber, echtes 412: `moderation` legt über die Oberfläche eine neue Wortmeldung an, `capture`
      öffnet deren Redebeitrag; eine zweite `capture`-Sitzung (Request-Kontext mit Cookie und CSRF-Token aus
      `http-setup`) ändert ihn mit gültigem `If-Match`; die Oberfläche schreibt mit der alten Version, erhält 412 und
      zeigt das Veraltet-Banner; der unbestätigte Text bleibt; Screenshot `031-http-412.png`. Texte aus `e2e-texts.ts`.
13. **Setup und Verdrahtung von `030`.** `apps/web/e2e/http/anmeldung.setup.ts` (Projekt `http-setup`) meldet die 8
    Personen mit Rolle über das echte Keycloak-Formular an und speichert je Rolle einen `storageState` unter
    `E2E_HTTP_STATE_DIR`; die Passwörter liest es aus einer Datei mit 0600 dort. In 031a hat `http` keinen
    Standard-`storageState`; jeder Test wählt seinen Zustand ausdrücklich (031b führt `capture` als Standard ein).
    `030-anmeldung.spec.ts` verliert sein Selbst-Überspringen (`HV_WEB_MODE`) und läuft über `testMatch` nur im
    Projekt `http`, weiter mit `page.route` und leerem Zustand.
14. **Screenshots (Lehre c).** Ein e2e-Lauf schreibt viele Dateien unter `docs/evidence/` neu. Gestaged werden nur
    ausdrücklich benannte Pfade (`git add docs/evidence/031-http-altes-demoprotokoll.png` usw.), nie `git add -A` oder
    `git add .`; alle anderen geänderten Bilder werden vor dem Commit mit `git restore` verworfen, der Bericht nennt sie.
    Die `@idp`-Screenshots (H4, H6, H8) entstehen nur in der PR-CI. `gh` ist in der Bauumgebung nicht verfügbar:
    Rückfall ist das Laden des Artefakts `evidence-031-http` über die GitHub-API bzw. das GitHub-MCP; gelingt das nicht,
    stehen Lauf-ID und Artefaktname im Nachweis und die drei PNGs unter „Offen“.
15. **Lokal ohne Docker.** Pflicht vor dem PR: `pnpm gates`; Projekt `in-process` vollständig;
    `node --import ./apps/api/node_modules/tsx/dist/loader.mjs scripts/e2e-http-031.mjs --check`;
    `E2E_HTTP_IDP=none pnpm e2e:http` gegen lokales Postgres (H1–H3 und die vier Tests aus `030`). Kein Ersatz-IdP.
    Der Keycloak-Nachweis ist die PR-CI (wie 034a/034b).

## Nicht-Ziele

Keine Änderung an Produktcode, Vertrag, `ROLE_PERMISSIONS` oder Standardwerten der Grenzen. Kein Cross-Origin-Betrieb,
kein Ersatz-IdP, kein HTTPS-Entwicklungsserver (nur nach Spec-Klärung). Die fünf gemeinsamen Dateien und der
ADR-0002-Nachweis sind 031b; die Teilung von 003 ist ein eigener Takt. Kein Umzug des Keycloak-Schritts 029b. Kein SSE
(035), keine CSP des Web-Dokuments (037), kein Deploy, kein Netlify-Build, kein Zeitbudget-Tor (084), keine Lastmessung
(071/078), kein Firefox/WebKit, kein Produktionsbundle im HTTP-Modus.

## Folgeliste: Einträge zu 030/031

| Eintrag (`docs/folgeliste.md`) | Wo | Wie |
|---|---|---|
| 030 · `030-anmeldung.spec.ts` überspringt sich ohne `HV_WEB_MODE=http`; kein HTTP-Build in CI · „in 031 verdrahten“ | 031a | Projekt `http`, Job `e2e-http`; erledigt markieren |
| 030 · `http.test.ts` „zwei Aufrufe → verschiedene Idempotenzschlüssel“; 401 mitten in der Sitzung nur als Unit-Test | 031a | Unit-Test in `apps/web/src/api/http.test.ts`; H6; erledigt markieren |
| 029b nit · Keycloak-Image per Tag | 031a, nur dieser Teil | Digest (Entscheidung 8); `CURRENT_TIMESTAMP` und CLI-Rechenhilfe bleiben |
| 027 nit · `postgres:16` per Digest | 031a, nur dieser Teil | beide Jobs; TLS (037) und Owner-Trigger (038) bleiben |
| 033b R1 nit · zweites `actions/upload-artifact@v4` ungepinnt | 031a | voller Hash; erledigt markieren |
| Nachprüfung e2e · `003-answers-stage.spec.ts:44` > 90 s | eigener Takt | nicht in 031 (Folgeliste vermerkt) |
| 030 nit · Auth-Fehlertexte `'de'`; `CORPUS_DEMO` im HTTP-Build; `Idempotency-Key` an Logout | nein | Produktcode, bleibt |
| 080b R1 minor · `STORAGE_KEY` versionieren | nein | Produktcode; H2 und `024` sichern das heutige Verhalten |
| 028 · `lastWriteEtag()` bei gleichzeitigen Anfragen (In-Memory/JSONL) | nein | `http` nutzt Postgres, bleibt |
| 027 · `HV_REQUIRE_POSTGRES_TESTS=1` | nein | Dienst-Tests, bleibt |

Neu aufzunehmen (Implementierer, je eine Zeile): `apps/web/vite.config.ts` · Proxy-Standard `HV_API_ORIGIN`
`http://localhost:3000` passt nicht zu `PORT` 8787; `apps/api/src/server.ts` · `serve` ohne `hostname` bindet an alle
Schnittstellen · Bindeadresse konfigurierbar (mit 037).

## Bedrohungen, Missbrauchsfall und Test je ID

| ID | Rolle in 031a | Test (Datei) |
|---|---|---|
| T-G1-S-02 | berührt (Nachweis im Browser; Mechanik 029b) | H4 Cookie-Attribute; H5 Abmelden, altes Cookie 401; H6 Subject-Sperre wirkt ohne Neustart (`031-http-betriebsart.spec.ts`) |
| T-G1-S-03 | Teil schließen (HTTP-Modus gegen echten Dienst ohne Rollenumschalter) | H1, H4; `030-anmeldung.spec.ts` im Projekt `http` |
| T-G1-T-05 | berührt (CSRF im Browser; CORS-Teil 034b) | H5 `X-CSRF-Token`; H3 keine CORS-Antwort; H8 Schreiben nur mit Token |
| T-Q-I-01 | berührt (Geheimnisse in CI) | `scripts/e2e-http-031.test.mjs`: Zufallswerte, `--check` gibt keinen Marker-Wert aus, `trace`/`video` aus, kein `html`-Reporter; Job ohne Report-, Trace- und Video-Upload (Review gegen `gates.yml`) |
| T-G2-I-02 | berührt (Zugriffslog ohne Nutzdaten) | Harness-Stufe 6 mit den Texten aus `e2e-texts.ts` |

**Missbrauchsfall (SC-06), neu MF-12 „Test-Hintertür im Produktpfad“.** *Ablauf:* um die `http`-Suite grün zu
bekommen, fügt jemand einen Testschalter in Dienst oder Oberfläche ein (Anmeldung überspringen, `HV_E2E_*`-Variable,
Cross-Origin für `http:` außerhalb der Demo, Grenzen im Standard angehoben) oder übernimmt die Test-Umgebung in
Staging. *Verhindert durch:* „Files allowed“ ohne Produktcode (außer einem Unit-Test); nur öffentliche Konfiguration
innerhalb der Schema-Bereiche; Werte nur im Harness, nicht in `.env.example`. *Erkennung:* Startzeile und stderr im
Harness wörtlich geprüft (eine unbekannte Variable erzeugt `ignoring unknown variables`, Lauf rot); Reviewer prüft SC-12
über `.github/**` und `scripts/**`; Staging gegen die Eigentümer-Checkliste (037). *Signal und Empfänger:* roter Job
`e2e-http`, Empfänger Orchestrator und Reviewer. *Ausnahme:* keine.

## Files allowed

- `docs/slices/031a-e2e-http-harness-anmeldung.md`
- `apps/web/playwright.config.ts` (drei Projekte, zweiter Eintrag für den Entwicklungsserver, lokaler Modus, Reporter und Optionen der HTTP-Projekte)
- `apps/web/e2e/031-http-betriebsart.spec.ts` (neu, H1–H8)
- `apps/web/e2e/http/anmeldung.setup.ts` (neu, Setup-Projekt)
- `apps/web/e2e/support/http-guard.ts` (neu, 429-Wächter)
- `apps/web/e2e/support/e2e-texts.ts` (neu, gemeinsame synthetische Texte für Tests und Zugriffslog-Prüfung)
- `apps/web/e2e/support/node-fs.d.ts` (nur Typen für Umgebungsvariablen, Datei lesen/schreiben/Rechte und Kindprozesse)
- `apps/web/e2e/030-anmeldung.spec.ts` (nur Selbst-Überspringen entfernen)
- `apps/web/src/api/http.test.ts` (nur Test „zwei Aufrufe → verschiedene Idempotenzschlüssel“)
- `scripts/e2e-http-031.mjs` (neu), `scripts/e2e-http-031.test.mjs` (neu)
- `scripts/lib/keycloak-ci.mjs` (neu)
- `scripts/keycloak-ci-029b.mjs` (nur Umstellung auf das Modul und die Formprüfung des Images mit Digest; übrige Prüfungen und Ausgaben unverändert)
- `.github/workflows/gates.yml` (neuer Job; Digest- und Hash-Pins; der Keycloak-Schritt bleibt, wo er ist)
- `package.json` (Wurzel; nur das Skript für den HTTP-Lauf)
- `AGENTS.md` (nur eine Zeile unter „Commands“ für den HTTP-Lauf)
- `docs/agentische-entwicklung-plan.md` (nur eine neue Zeile in Abschnitt 5.3 „Zwei Betriebsarten (e2e)“ mit dem Stand „läuft (CI: End-to-end http project against Hono, Postgres and Keycloak)“)
- `docs/sicherheit/bedrohungsmodell.md` (nur Nachweisspalte von T-G1-S-02, T-G1-S-03, T-G1-T-05 und T-Q-I-01, der 029b-Nachtrag über den Keycloak-Nachweis in CI, neuer Missbrauchsfall MF-12)
- `docs/folgeliste.md` (nur die Einträge der Tabelle oben als erledigt markieren, die zwei neuen Zeilen, nicht blockierende Reviewbefunde dieser Scheibe)
- `docs/produktplan-beta.md` (nur Stand-Zeile Etappe B nach dem Merge)
- `docs/evidence/031-*.png` (neu: altes Demo-Protokoll, angemeldet, 401, 412; Namen in Entscheidung 12)

Weitere Dateien sind Scope-Befunde: erst Spec klären, nicht still ausweichen. Insbesondere die Vite-Konfiguration, der
Quellcode des Dienstes und die fünf gemeinsamen e2e-Dateien (031b) sind nicht erlaubt.

## Vor dem Bau prüfen

1. 030, 027 und 034b gemergt; 084 weiter ungebaut (sonst Entscheidung 10 gegen dessen Matrix abgleichen).
2. **Secure-Cookie über `http://localhost`:** Wegwerfprobe mit dem gepinnten Chromium; ein lokaler Server setzt
   `Secure; HttpOnly; SameSite=Lax`, `context.cookies()` enthält es. Scheitert die Probe: anhalten, Spec klären.
3. Vite-Proxy reicht zwei `Set-Cookie`-Felder und die relative `Location` des Rückrufs unverändert durch; `Host` bleibt
   der Vite-Origin (`changeOrigin` aus); der Dienst nimmt den Rückruf an.
4. `/v1/meeting` und die übrigen Aliasrouten des HTTP-Clients finden den einen Jahrgang aus dem Bootstrap;
   `insertPostgresEvents` füllt die Personentabelle (Sprechernamen sichtbar); die Hash-Kette besteht die Prüfung beim
   ersten Lesen des Dienstes.
5. Lokales Postgres: Owner darf `CREATE DATABASE`, Laufzeitrolle existiert (`TEST_DATABASE_URL`,
   `TEST_RUNTIME_DATABASE_URL`, `HV_DB_RUNTIME_ROLE` wie in 034b).
6. `formatStartLine` (`apps/api/src/config/startLine.ts`) gibt ohne Herkünfte und Proxys `cors=none trusted-proxies=none`
   aus; `SESSION_IDLE_MS` (30 min) liegt über der Laufzeit des `http`-Projekts.
7. Digests über die Registry-API (kein Docker nötig): Keycloak 26.7.4 und `postgres:16`; Commit-Hashes von
   `actions/checkout` v4 und `actions/setup-node` v4 per `git ls-remote`; `actions/upload-artifact` v4.6.2 steht in
   `gates.yml`.
8. Playwright: mehrere `webServer`-Einträge mit eigener `env`, Projektabhängigkeiten, `testMatch` je Projekt, `--list`
   liefert die Dateireihenfolge; Node lädt `playwright.config.ts` im Kindprozess (Typentfernung ab Node 22.18) für den
   Konfigurationstest, sonst über den tsx-Lader.
9. Die e2e-Dateien werden von `pnpm -r typecheck` erfasst; die Typen in `node-fs.d.ts` decken H6 und das Setup ab.
10. Heutige Laufzeit der e2e- und Keycloak-Schritte aus einem aktuellen CI-Lauf ablesen (Ausgangswert für
    Entscheidung 11).

## Tests zuerst und Abnahme

1. Vor der Implementierung rot: `031-http-betriebsart.spec.ts` (H1–H8) und `scripts/e2e-http-031.test.mjs` (Realm: 9
   Personen, eine Redirect-URI aus `E2E_HTTP_PORT`, Adressen `@example.test`; Dienstumgebung: keine der verbotenen
   Variablen, nur Schreib- und Lesegrenze gesetzt, Anmeldegrenze gesamt ≥ je Quelle, Pflichtvariablen vollständig;
   `--check` ohne Marker-Wert; Konfiguration: `trace`/`video` aus, kein `html`-Reporter, lokaler Modus ohne Setup;
   Dateireihenfolge des `http`-Projekts).
2. Lokal: `pnpm gates` auf sauberem Baucommit grün; `in-process` vollständig grün; `--check` grün;
   `E2E_HTTP_IDP=none pnpm e2e:http` grün. Laufzeiten notieren.
3. PR-CI auf dem letzten Commit: Jobs `gates` (mit dem unveränderten Keycloak-Schritt 029b) und `e2e-http` grün;
   H4–H8 grün. Laufzeiten beider Jobs.
4. Sichtung der vier `031-*.png`.
5. Unabhängiges Review in frischem Kontext mit Perspektive Security/Betrieb; Blocker/Major sowie jede Sicherheits- oder
   Datenschutzfrage vor Merge, übrige Befunde in `docs/folgeliste.md`. Jeder Commit nennt „Scheibe 031a“ und endet
   `[skip netlify]`. Kein Deploy.

## Nachweise

`pnpm gates`-Schluss; Laufzeiten (lokal `in-process`, lokal `http` ohne `@idp`, CI beide Jobs mit Lauf-ID); Testnamen je
Bedrohungs-ID; wörtliche Startzeile des Test-Dienstes; Digests und Hashes; Artefakt `evidence-031-http`.

## Nachweis

(nach dem Bau ausfüllen)

**Gates-Commit:** `<sha>` (Baucommit „Scheibe 031a: …“), `pnpm gates` auf sauberem Baum, Exit 0, Umgebung (Node, pnpm,
Postgres).

Wörtlicher Schluss der Ausgabe von `pnpm gates`:

```
<Schluss einfügen>
```

| Lauf | Projekt | Tests (bestanden/übersprungen) | Laufzeit |
|---|---|---|---|
| lokal | `in-process` | | |
| lokal, `E2E_HTTP_IDP=none` | `http` (ohne `@idp`) | | |
| PR-CI Lauf `<id>`, Job `gates` | `in-process` | | Job gesamt: |
| PR-CI Lauf `<id>`, Job `e2e-http` | `http-setup` + `http` | | Job gesamt: |

Startzeile: `<wörtlich>`. Digests/Hashes: `<…>`. Verworfene, neu erzeugte Screenshots: `<Liste>`.

## Bericht (nach Bau ausfüllen)

```
Slice: 031a-e2e-http-harness-anmeldung
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; Laufzeiten; PR-CI-Lauf <id> (gates, e2e-http); docs/evidence/031-*.png oder Lauf-ID und Artefaktname
Bedrohungs-ID → Test: <je Zeile der Tabelle oben>
Open: Pflicht-Check e2e-http (Eigentümerfrage 1) und danach Umzug des Keycloak-Schritts 029b; Produktionsbundle im HTTP-Modus nicht geprüft; websiteübergreifendes SameSite-Verhalten nicht geprüft; Dienst bindet an alle Schnittstellen; Standardgrenzen im Betrieb nicht gemessen (071/078)
Touched: <Dateiliste>
```

## Offene Eigentümerfragen

1. **Pflicht-Check.** „Beide Pflicht auf PR“ braucht in den Repository-Einstellungen den Job `e2e-http` neben `gates`
   als erforderlichen Status-Check für PRs auf den Integrationszweig und `main`. Das kann nur der Eigentümer einstellen.
   Bis dahin hält der Orchestrator den Merge ohne grünen `e2e-http` von Hand an, und der Keycloak-Schritt 029b bleibt in
   `gates`; sein Umzug ist ein späterer Takt mit dieser Einstellung als Bedingung.

## Lesebefund vor dem Bau

Lesebefund in frischem Kontext (Opus, 30.09.2026) zur ersten Fassung (Spec 031): nicht baureif, 5 major, 12 minor,
9 nits. Eingearbeitet in 031a:

| Befund | Stand |
|---|---|
| M1 Keycloak-Schritt 029b nicht umziehen | Entscheidung 10 (bleibt in `gates`), Eigentümerfrage 1, Bedrohungsmodell-Nachtrag in Files allowed |
| M2 Migrationsschritt in `e2e-http` | Entscheidung 10: entfällt, weil 029b nicht in `e2e-http` läuft; Harness migriert eigene Datenbank (Entscheidung 6, Stufe 2) |
| M3 Traces, Videos, HTML-Reporter | Entscheidung 4, Test in `scripts/e2e-http-031.test.mjs` |
| M4 Reihenfolge und geteilter Zustand | Entscheidung 2 (gepinnte Reihenfolge mit Test), Entscheidung 12 (Tests berühren den Korpus nicht); Halteregel für `abnahme` in 031b |
| M5 Teilung | 031a/031b, Takt für 003 (Abschnitt „Warum geteilt“) |
| m6 Image-Formprüfung | Entscheidung 8, Files allowed |
| m7 Rechte des Jobs | Entscheidung 10 (erbt, ohne eigenen Block) |
| m8 Pins, `persist-credentials` | Entscheidung 10 |
| m9 falsche Prämisse zu `admin.roles.manage` | Entscheidung 8 korrigiert |
| m10 Bootstrap-Pflichtpfad, SP-1 | Entscheidung 6 Stufe 3, Checkliste im Kopf |
| m11 H6-Datei, CLI-Umgebung, Typen | Entscheidung 12 H6, Files allowed |
| m12 H4/H5 Zustand | Entscheidung 12 |
| m13 lokaler Modus in der Konfiguration | Entscheidung 3 |
| m14 kein `gh` | Entscheidung 14 |
| m15 Ausschluss von 003 | 031b (Tabelle, Offen) |
| m16 Bedrohungsmodell T-Q-I-01, 029b-Absatz | Files allowed |
| m17 nur Schreib- und Lesegrenze anheben | Entscheidung 9 |
| n18 SameSite-Begründung | Entscheidung 5 |
| n19 `NODE_ENV` | Entscheidung 7 (nicht gesetzt) |
| n20 Port, `reuseExistingServer` | Entscheidung 1 |
| n21 Entwicklungsserver statt Bundle | Ziel, Nicht-Ziele, Bericht „Open“ |
| n22 Grenzregel im Harness | Entscheidung 9 |
| n23 Bindung an alle Schnittstellen | Entscheidung 7, Folgeliste-Zeile |
| n24 Eigentümerfrage 1 eng | durch die Teilung in 031b verengt |
| n25 gemeinsame Textkonstante | Entscheidung 6 Stufe 6, `e2e-texts.ts` |
| n26 Summe der Schrittgrenzen | Entscheidung 11 |

## Review findings

folgt
