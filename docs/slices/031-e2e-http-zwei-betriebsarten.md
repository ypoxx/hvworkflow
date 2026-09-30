# Scheibe 031 — e2e gegen Hono, Postgres und Keycloak in beiden Betriebsarten

**Status:** spec (Entwurf, 30.09.2026; Lesebefund vor dem Bau ausstehend)
**Risikoklasse:** hoch · 3 AStd (Plan bisher 1,5 AStd, siehe Entscheidung 15) · 23.10.2026 (W4) · Lanes: e2e, infra; docs-adr nur Architekt
**Rolle:** Implementierer-Oberfläche (Suite) mit Infra-Anteil (Harness, CI-Job); Architekt für die ADR-0002-Ergänzung (Lane docs-adr, „nur Architekt“, Plan 5.1); unabhängiges Review in frischem Kontext mit Perspektive Security/Betrieb, zusätzlich Sicherheits-Checkliste des Reviewers (SC-05, SC-06, SC-10, SC-12, SP-3, SP-5, SP-6, SP-7) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue fachliche Regel, keine neue Regel-ID, keine Änderung an `ROLE_PERMISSIONS`, der Übergangstabelle, dem Vertrag oder dem Code unter `apps/api/src` und `apps/web/src`; AGENTS.md R2 (Nachweis), R4 (Rechte: Rollennamen nur in Testhilfen, nie im Produktcode), R6 (Oberfläche nur über `HvApi`), R11 (nur synthetische Daten und Geheimnisse je Lauf)
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/031 (Ziel, Abhängigkeiten 030, 027, 084, Nachweise), §5.4/084 (Job-Matrix: „PR voll … http-Projekt ab 031“), Zielpfad Beta-2 Etappe B; ADR 0002 Ergänzung (Nachweis „Scheibe 031“), ADR 0004 (BFF im Dienst); `docs/folgeliste.md` (Einträge 030, Nachprüfung e2e 003, 029b nit, 027 nit, 033b nit); Lehren aus 034a/034b (CSP `default-src 'none'`, Grenzen, Konfigurationsschema); Bedrohungsmodell T-G1-S-02, T-G1-S-03, T-G1-T-05, T-Q-I-01, T-G2-I-02; Leitplanken §4, 6.8
**Depends on:** 030 und 027 (gemergt), 034b (gemergt, Konfigurationsschema und CORS); 084 ist nicht gebaut und wird nicht vorausgesetzt (Entscheidung 11)
**Perspektive:** Security/Betrieb · **Glossar: neue Begriffe:** nein

## Warum hoch statt mittel

Der Plan führt 031 als „mittel“. Nach Leitplanken §4 gilt die höchste ausgelöste Klasse, bei Unklarheit hoch. 031
ändert keinen Produktcode, aber es (1) fährt Identität und Sitzung Ende zu Ende im echten Browser (Cookie-Attribute,
CSRF, Sitzungsentzug über die Subject-Sperre) und macht dieses Ergebnis zum Pflicht-Tor, (2) führt Geheimnisse je
Lauf in der Pipeline (Client-Secret, Passwörter der synthetischen Testpersonen, Verschlüsselungs- und Hash-Schlüssel),
(3) schreibt Rollenzuordnungen am Verwaltungsweg vorbei in eine Datenbank und (4) legt die Netzgrenze zwischen
Oberfläche und Dienst für den Test fest (gleiche Herkunft über einen Proxy). Jede dieser Stellen kann bei einem Fehler
eine Hintertür oder ein Geheimnis in ein Artefakt tragen. Eine Heraufstufung braucht keine Freigabe; der Planeintrag
ist angeglichen.

## Ziel und Entscheidungen vor Bau

Die Playwright-Suite läuft in zwei Betriebsarten: `in-process` (Demo-Build, Kern im Browser, wie heute) und `http`
(HTTP-Build gegen den echten Hono-Dienst mit Postgres und Keycloak-Testrealm, ohne `page.route`-Attrappe für
den Dienst). Beide sind auf jedem PR Pflicht. Offene Punkte sind auf Standard gebaut und als solche markiert.

1. **Projekte und Auswahl.** `apps/web/playwright.config.ts` definiert das Projekt `in-process` (bisher `chromium`;
   Demo-Build, Vite auf `E2E_PORT`, Standard 4173) immer. Die Projekte `http-setup` und `http` (HTTP-Build,
   `HV_WEB_MODE=http`, Vite auf `E2E_HTTP_PORT`, Standard 4174, als zweiter Eintrag in `webServer` mit
   `HV_API_ORIGIN`) gibt es nur, wenn das Harness `E2E_HTTP=1` setzt; ohne diese Variable verhält sich
   `pnpm --filter @hv/web e2e` wie heute. `http` hängt von `http-setup` ab (Projektabhängigkeit). Die Zuordnung der
   Dateien geschieht über `testMatch`/`testIgnore` mit ausdrücklichen Dateinamen, nicht über `test.skip` in der Datei.
   Das `http`-Projekt läuft mit einem Worker (`--workers=1` im Harness; eine Datenbank je Lauf, Entscheidung 6).
2. **Welche Szenarien in welchem Projekt (Standard, Eigentümerfrage 1).** Der Planwortlaut „alle Szenarien“ und
   ADR 0002 („dieselbe e2e-Suite“) sind wörtlich nicht in 1,5 bis 3 AStd erfüllbar: 12 der 17 Dateien prüfen
   Oberflächenzustände mit Fehlerinjektion im Browser-Kern (`import('/src/api/index.ts')`), mit dem Demo-Speicher
   (`localStorage`) oder mit dem Rollenumschalter selbst; gegen den Dienst hätten sie keinen Gegenstand oder bräuchten
   je Test eine frische Datenbank. Standard: **alle Szenarien, die Verhalten des Dienstes berühren, laufen in beiden
   Projekten; Oberflächenszenarien mit Fehlerinjektion im Browser bleiben `in-process`.** Feste Liste:

   | Datei | in-process | http | Grund |
   |---|---|---|---|
   | `abnahme.spec.ts` | ja | ja | Abnahmesatz über sieben Rollen, Kern der Dual-Mode-Aussage |
   | `002-speakers-capture.spec.ts` | ja | ja | Wortmeldung und Erfassung schreiben gegen den Dienst |
   | `021b-koordination.spec.ts` | ja | ja | Klassifizieren und Zuweisen gegen den Dienst |
   | `021c-rechtsfreigabe.spec.ts` | ja | ja | Rechtsfreigabe, Freigabe, Bühne gegen den Dienst |
   | `080-sprecher-zustand.spec.ts` | ja | ja | Wortmeldeliste aus dem Dienst |
   | `030-anmeldung.spec.ts` | nein | ja | braucht den HTTP-Build; bleibt mit `page.route` (Oberflächenzustände der Anmeldung), überspringt sich nicht mehr selbst |
   | `031-http-betriebsart.spec.ts` (neu) | nein | ja | Anmeldung, Sitzung, gleiche Herkunft, Reset-Banner, 412 gegen den echten Dienst |
   | `024-ereignis-umschlag.spec.ts` | ja | nein | Demo-Protokoll im Browser; Test 1 ist der Reset-Banner-Test der Demo |
   | `001`, `003`, `010b`, `010c`, `010d`, `013`, `020`, `028`, `090`, `takt-009` | ja | nein | Rollenumschalter-Oberfläche, Demo-Speicher oder Fehlerinjektion im Browser-Kern; der 412-Pfad aus `028` hat im `http`-Projekt ein echtes Gegenstück (H8) |

   Ergebnis: `in-process` 16 Dateien (alle heutigen außer `030`), `http` 7 Dateien plus `http-setup`.
3. **Gleiche Herkunft über den Vite-Proxy, kein CORS (Lehre 034a/034b).** Die Oberfläche läuft vom Vite-Origin
   `http://localhost:4174`; `/v1` und `/auth` leitet der vorhandene Proxy in `apps/web/vite.config.ts` (HTTP-Modus,
   `HV_API_ORIGIN`) an den Dienst weiter. Kein `HV_CORS_ORIGINS`, kein `HV_TRUSTED_PROXY_CIDRS`. Begründung:
   (a) der HTTP-Client ist gleiche Herkunft gebaut (relative Pfade `/v1/…`, `/auth/login?returnTo=…`,
   `credentials: 'same-origin'` in `apps/web/src/api/http.ts`); Cross-Origin bräuchte eine Produktänderung;
   (b) das Schema aus 034b lässt außerhalb der Demo nur `https:`-Herkünfte zu, `http://localhost:4174` würde den Start
   verweigern; eine Lockerung für Tests wäre genau die Hintertür aus MF-12; (c) das Zielbild ist ein BFF gleicher
   Herkunft (ADR 0004), ein Cross-Origin-Test prüfte eine Anordnung, die es im Betrieb nicht gibt; (d) die CSP des
   Dienstes (`default-src 'none'`) wirkt nur auf Dokumente des Dienstes. Alle Dokumente kommen von Vite; vom Dienst
   lädt der Browser nur `fetch`-Antworten und die 302-Weiterleitungen von `/auth/login` und `/auth/callback`, die nie
   als Dokument gerendert werden. Kein Test öffnet eine JSON-Seite des Dienstes als Dokument und ruft dort `fetch`.
   **Cookies:** `hv_session` und `hv_auth_state` tragen `Secure; HttpOnly; SameSite=Lax`. Chromium behandelt
   `http://localhost` als vertrauenswürdig und nimmt `Secure`-Cookies dort an; H4 prüft die Attribute im Browser
   (`context.cookies()`). Wird das Cookie nicht gespeichert: Bau anhalten und Spec klären (Rückfall wäre HTTPS für
   Vite mit Wegwerfzertifikat), **nie** ein Cookie ohne `Secure` im Dienst. Cookies gelten je Host, nicht je Port:
   `hv_session` erreicht auch Keycloak (18080) und den Dienst direkt (18091); im Test ohne Folge, vermerkt.
   `SameSite=Lax` reicht, weil Rückruf und Oberfläche dieselbe Herkunft haben (Top-Level-GET von Keycloak auf
   `/auth/callback`). **CSRF:** `X-CSRF-Token` aus `/auth/me`, nur im Speicher (030); gleiche Herkunft, kein Preflight.
   `HV_OIDC_REDIRECT_URI` ist `http://localhost:4174/auth/callback` (Vite-Origin; `createApp` setzt kein
   `serviceOrigin`, der Rückruf darf also auf dem Proxy-Origin liegen).
4. **Test-Dienst besteht die Startprüfung aus 034b (Lehre d).** Das Harness startet `apps/api/src/server.ts` mit einer
   **ausdrücklichen** Umgebung (nicht `...process.env`): `PATH`, `NODE_ENV=test`, `PORT=18091`,
   `HV_DATABASE_URL` (Laufzeitrolle, frische Datenbank), `HV_OIDC_ISSUER`, `HV_OIDC_CLIENT_ID`,
   `HV_OIDC_CLIENT_SECRET`, `HV_OIDC_REDIRECT_URI`, `HV_AUTH_ENCRYPTION_KEY` (32 Zufallsbyte, base64url),
   `HV_ACCESS_LOG_DIR` (in einem `mkdtemp`-Verzeichnis mit `mkdir(…, { mode: 0o700 })`),
   `HV_ACCESS_LOG_HASH_KEY` (32 Zufallsbyte), `HV_TRANSPARENCY_NOTICE_VERSION=e2e-synthetic-1`,
   `HV_TRANSPARENCY_NOTICE_DE`, `HV_TRANSPARENCY_NOTICE_EN` (feste synthetische Sätze),
   `HV_DSFA_SUMMARY_URL=https://example.org/hv-e2e-dsfa`, die Grenzen aus Entscheidung 5. Nicht gesetzt: `HV_DEMO`,
   `HV_EVENT_LOG`, `HV_CORS_ORIGINS`, `HV_TRUSTED_PROXY_CIDRS`, `HV_NTP_SERVERS`, `HV_REQUEST_TIMEOUT_MS`
   (Standard 10 000 ms, über dem Minimum 7 000). Das Harness prüft nach dem Start: stdout enthält wörtlich
   `HV-Tool API: start mode=service persistence=postgres auth=oidc cors=none trusted-proxies=none`; stderr enthält
   weder `refusing to start` noch `ignoring unknown variables`. Bereitschaft wie in 029b: `/auth/transparency-notice`
   200, dann `/readyz` mit `db` und `migrations` = `ok`; 503 nur mit `clock.code = not_configured` (kein NTP in CI).
5. **Grenzen aus 034a im Test (Lehre b).** Alle Anfragen des Browsers kommen über den Proxy von einer Quelle
   (Loopback); die Quellgrenzen zählen also die ganze Suite. Die Abnahme liest als Podium bis zu 130 Fragen hintereinander
   vor (`MAX_STAGE_ROUNDS`), jede Aktion lädt die Listen neu. Werte über die Variablen aus 034b, alle innerhalb der
   Bereiche in `apps/api/src/config/schema.ts`:

   | Variable | Standard | Test | Bereich | Grund |
   |---|---|---|---|---|
   | `HV_RATE_LIMIT_WRITES_PER_MIN` | 60 | 1 000 | 1–10 000 | Podium-Schleife der Abnahme: bis zu 2 Schreibvorgänge je Runde, 130 Runden |
   | `HV_RATE_LIMIT_READS_PER_MIN` | 1 200 | 20 000 | 60–100 000 | Neuladen der Listen nach jeder Aktion derselben Person |
   | `HV_RATE_LIMIT_ANON_PER_MIN` | 600 | 5 000 | 10–100 000 | Anmeldeseiten, `/auth/me` vor der Anmeldung, alles aus einer Quelle |
   | `HV_RATE_LIMIT_LOGIN_PER_MIN` | 120 | 1 000 | 1–10 000 | `http-setup` meldet 8 Personen an, H4–H7 weitere, alles eine Quelle |
   | `HV_RATE_LIMIT_LOGIN_GLOBAL_PER_MIN` | 600 | 5 000 | 10–100 000 | muss ≥ Quellgrenze bleiben |
   | `HV_RATE_LIMIT_PROBES_PER_MIN` | 600 | 600 (Standard) | 10–100 000 | Harness fragt höchstens 2-mal je Sekunde |
   | `HV_RATE_LIMIT_PREFLIGHT_PER_MIN` | 1 200 | 1 200 (Standard) | 10–100 000 | gleiche Herkunft, keine Preflights |

   Absicherung statt Vermutung: eine Hilfe in `apps/web/e2e/support/http-guard.ts` lässt jeden Test des
   `http`-Projekts scheitern, sobald eine Antwort des Dienstes 429 trägt (mit Pfad im Fehlertext, ohne Header oder
   Body); das Harness scheitert, wenn stderr des Dienstes eine Grenzmeldung enthält (`limit reached`). 031 behauptet
   **nicht**, dass die Standardwerte im Betrieb reichen (Messung 071/078); die Grenzen selbst prüfen die Tests aus
   034a/034b.
6. **Harness `scripts/e2e-http-031.mjs`** (gestartet mit dem tsx-Lader wie 029b). Ablauf mit festen Stufen, bei Fehler
   nur der Stufenname auf stderr (Muster 029b, keine Treiber- oder Anbieterfehler): (1) Keycloak starten
   (Entscheidung 7) oder bei `E2E_HTTP_IDP=none` auslassen; (2) frische Datenbank `hv_e2e031_<8 Hex>` über
   `TEST_DATABASE_URL` (Owner) anlegen, Migrationen mit `HV_MIGRATION_DATABASE_URL` und `HV_DB_RUNTIME_ROLE`;
   (3) Bootstrap: genau ein Jahrgang mit dem Demo-Korpus (`CORPUS_DEMO`, gleicher Umfang wie `in-process`, damit die
   Zählerwartungen der gemeinsamen Dateien gelten) und je Testperson eine Rollenzuordnung (`RoleAssigned` für
   `actorIdForIdentity(issuer, userId)`), geschrieben über den Schreibweg von Kern und Postgres-Adapter, sodass die
   Personentabelle gefüllt ist; nur wenn der Adapter keinen solchen Weg bietet, das Einfügen der Ereigniszeilen wie in
   029b plus Personenzeilen (im Bericht nennen); (4) Dienst starten (Entscheidung 4); (5)
   `pnpm --filter @hv/web exec playwright test --project=http --workers=1` mit `E2E_HTTP=1`, `E2E_HTTP_PORT`,
   `E2E_HTTP_API_ORIGIN`, `E2E_HTTP_STATE_DIR`, `E2E_HTTP_IDP`; (6) Dienst stoppen, Zugriffslog prüfen (jede Zeile
   genau die acht Schlüssel aus 033a; kein Client-Secret, Passwort, Sitzungscookie, CSRF-Token, keine Actor-ID und
   keiner der Fragetexte und Redebeiträge, die die Suite schreibt); (7) Container entfernen, Datenbank löschen,
   Temp-Verzeichnis löschen, auch im Fehlerfall. Modus `--check` prüft ohne Docker und Datenbank Realm-Struktur und
   Dienstumgebung (keine verbotene Variable, Grenzen im Bereich, alle Pflichtvariablen). Alle Geheimnisse entstehen je
   Lauf zufällig, stehen nur in Kindprozess-Umgebungen und in Dateien mit 0600 unter `E2E_HTTP_STATE_DIR` (0700,
   außerhalb des Repositoriums) und werden nie ausgegeben. Keine Variable mit Präfix `HV_E2E_`; Steuervariablen heißen
   `E2E_*` und gehen nicht an den Dienst.
7. **Keycloak-Infrastruktur erweitern, nicht verdoppeln.** Neues Modul `scripts/lib/keycloak-ci.mjs` mit dem aus 029b
   herausgelösten Teil: Image-Kennung, Containerstart (`start-dev --import-realm`, Port nur an 127.0.0.1), Warten auf
   Discovery, Entfernen, Realm-Aufbau mit einem vertraulichen Client und N Personen. Das Image wird zusätzlich zum Tag
   per Digest gepinnt (`quay.io/keycloak/keycloak:26.7.4@sha256:<digest>`; Folgeliste 029b nit). 029b nutzt das Modul
   ohne Änderung seiner Prüfungen und Ausgaben (`--check` bleibt). 031: Realm `hv-e2e-031`, Port 18080 (029b läuft im
   selben Job vorher und entfernt seinen Container), Client mit genau einer Redirect-URI
   `http://localhost:4174/auth/callback`, **9 synthetische Personen** (Benutzername und Kennung zufällige UUID, Adresse
   `@example.test`, Passwort je Lauf zufällig): `moderation`, `capture`, `coordination`, `expert` (Fachbereich
   `unit-fin`, wie die Demo-Person `u-exp-fin`), `legal`, `approver`, `podium`, `norole` (ohne Zuordnung) und
   `revoke` (Rolle `capture`, nur für H6).
8. **Anmeldung in der Suite.** `apps/web/e2e/http/anmeldung.setup.ts` (Projekt `http-setup`) meldet die 8 Personen mit
   Rolle über das echte Keycloak-Formular an (Start über `/auth/login` am Vite-Origin) und speichert je Rolle einen
   `storageState` unter `E2E_HTTP_STATE_DIR`. Das `http`-Projekt startet standardmäßig mit dem Zustand `capture`
   (entspricht der Standardperson der Demo, `DEMO_ACTORS[1]`), damit die gemeinsamen Dateien in beiden Projekten am
   selben Punkt beginnen; H1–H3 und `030` setzen ausdrücklich einen leeren Zustand. `apps/web/e2e/support/roles.ts` stellt `asRole(page, role)` bereit: `in-process` über den
   Rollenumschalter wie heute; `http` durch Ersetzen der Cookies durch die der Rolle, Neuladen und Warten auf die
   Rollenanzeige der Sitzung. Die fünf gemeinsamen Dateien nutzen nur noch diese Hilfe; erwartet ein Test Oberflächenzustand
   über einen Rollenwechsel hinweg, stellt er ihn danach in beiden Projekten ausdrücklich her. Rollennamen stehen nur in
   den Testhilfen (R4 betrifft Oberflächen- und Dienstcode).
9. **Reset-Banner in beiden Betriebsarten (ADR 0002).** `in-process`: `024-ereignis-umschlag.spec.ts`, Test „old demo
   log requires an explicit reset in German and English“, unverändert; er ist der Reset-Banner-Test der Demo. `http`:
   H2 legt dasselbe Alt-Protokoll unter `hv-demo-events-v1` ab und zeigt, dass der HTTP-Build es nie liest: kein
   Reset-Banner, Anmeldeseite, Eintrag unverändert. Beide Tests stehen namentlich im Nachweis.
10. **Neue Datei `apps/web/e2e/031-http-betriebsart.spec.ts`**, Tests mit fester Kennung; `@idp` braucht Keycloak:
    - **H1** Anmeldeseite aus dem echten Dienst: Hinweistext DE und EN gleich den Harness-Werten, Link zur
      DSFA-Zusammenfassung gleich `HV_DSFA_SUMMARY_URL`, Anmeldelink `/auth/login?returnTo=…`, kein Rollenumschalter,
      axe ohne Verstoß ab „ernst“.
    - **H2** Altes Demo-Protokoll wird im HTTP-Build ignoriert (Entscheidung 9); Screenshot
      `031-http-altes-demoprotokoll.png`.
    - **H3** Gleiche Herkunft: die Anfrage an `/auth/me` geht an den Vite-Origin; die Antwort trägt kein
      `Access-Control-Allow-Origin`, aber `Content-Security-Policy` mit `default-src 'none'` und `X-Server-Time` des
      Dienstes (Beweis, dass der Proxy den echten Dienst erreicht).
    - **H4** `@idp` Anmeldung durch das Keycloak-Formular aus `/speakers?round=2`, Rückkehr genau dorthin; Rollenanzeige
      `capture`; kein Rollenumschalter und kein Demo-Zurücksetzen; `hv_session` in `context.cookies()` mit
      `httpOnly: true`, `secure: true`, `sameSite: 'Lax'`; kein Schlüssel `hv-demo*` in `localStorage`; Screenshot
      `031-http-angemeldet.png`.
    - **H5** `@idp` Abmelden sendet `X-CSRF-Token`, danach Anmeldeseite, danach `/auth/me` mit dem alten Cookie 401.
    - **H6** `@idp` Sitzungsentzug mitten in der Sitzung (Folgeliste 030): Person `revoke` angemeldet, Test sperrt das
      Subject mit `apps/api/src/auth/subject-block-cli.ts` (Laufzeit-URL aus der Harness-Umgebung), nächster Abruf
      401, Oberfläche zeigt die Anmeldeseite ohne Fachdaten; Screenshot `031-http-401.png`.
    - **H7** `@idp` Person ohne Rolle: echtes 403 mit CSRF-Token, Seite „Keine aktive Rolle“, Abmelden funktioniert.
    - **H8** `@idp` Zwei Schreiber, echtes 412: Erfassung öffnet einen Redebeitrag, derselbe Redebeitrag wird über eine
      zweite angemeldete Sitzung (`capture`, Request-Kontext mit deren Cookie und CSRF-Token) mit gültigem `If-Match`
      geändert, die Oberfläche schreibt mit der alten Version, erhält 412 und zeigt das Veraltet-Banner; der
      unbestätigte Text bleibt; Screenshot `031-http-412.png`.
11. **CI: eigener Job `e2e-http`, 084 nicht vorausgesetzt.** In `.github/workflows/*.yml` gibt es keine Job-Matrix aus
    084 (ein Job `gates` auf `push` und `pull_request`, dazu `nightly`); 084 ist nicht gebaut. 031 wartet nicht darauf,
    sondern baut den PR-Teil der 084-Matrix („PR voll … http-Projekt ab 031“) als zweiten Job in
    `.github/workflows/gates.yml`; 084 übernimmt ihn später in seine Matrix (Planregel: der Orchestrator löst
    Abhängigkeiten beim Spec-Schreiben, Zielpfad Beta-2). Job `e2e-http`: `if: github.event_name == 'pull_request'`,
    `runs-on: ubuntu-latest`, `timeout-minutes: 15`, `permissions` wie der Workflow (`contents: read`), eigener
    Postgres-Dienst (gleiche Test-Zugangsdaten wie `gates`), Schritte: Checkout, pnpm, Node 22, Install,
    Doku-Filter wie in `gates` (bei reiner Doku alle folgenden Schritte übersprungen, der Job meldet trotzdem),
    Laufzeitrolle anlegen, Chromium installieren, der **aus `gates` hierher verschobene** Schritt „Keycloak browser
    login against migrated Postgres“ (Name unverändert), dann Schritt „End-to-end http project against Hono, Postgres
    and Keycloak“ (`timeout-minutes: 10`, `node --import ./apps/api/node_modules/tsx/dist/loader.mjs
    scripts/e2e-http-031.mjs`), zuletzt Upload nur von `docs/evidence/031-*.png` als Artefakt `evidence-031-http`.
    **Kein** Upload von `playwright-report`, Traces oder Videos aus diesem Job (das HTML-Protokoll zeigt
    `fill`-Werte, also Passwörter der Testpersonen); das `http`-Projekt setzt `trace: 'off'`, `video: 'off'`,
    `screenshot: 'only-on-failure'`. Pins (SC-10): `postgres:16` in beiden Jobs per Digest (Folgeliste 027 nit),
    `actions/upload-artifact` des Evidence-Uploads in `gates` auf den vollen Hash v4.6.2 wie beim Katalog
    (Folgeliste 033b nit), jeder neue Baustein per Commit-Hash. Der Job `gates` behält „End-to-end acceptance
    scenario“ (jetzt nur Projekt `in-process`). Pflicht-Check: siehe Eigentümerfrage 2.
12. **Laufzeitbudget (feste Zahlen).** Heute rund 10 min je Lauf im Job `gates`. Ziel: `gates` ≤ 10 min (erwartet
    1 bis 2 min weniger, weil der Keycloak-Schritt wandert), `e2e-http` ≤ 12 min (harte Grenze 15 min), der
    Harness-Schritt ≤ 10 min, das `http`-Projekt selbst ≤ 6 min. Beide Jobs laufen parallel; die Wandzeit eines PR
    bleibt damit bei rund 10 bis 12 min. Überschreitet ein Wert das Ziel, steht das im Bericht mit Messung; keine
    Grenze wird still angehoben. Push-Läufe ohne PR fahren nur `gates` (084: Push ≤ 12 min).
13. **Test 003 teilen (Folgeliste „Nachprüfung e2e“).** Der Test `backlog, approval, podium and history @screenshot`
    in `003-answers-stage.spec.ts` wird an der Seitengrenze in zwei Tests geteilt (Beantwortung bis „Freigabe
    erloschen, Diff geöffnet“; Backlog, Bühne und Historie), jeder für sich lauffähig (eigener Aufbau, kein
    Zustand aus dem anderen Test) und auf der Maschine des Implementierers je < 60 s; kein `test.slow()`, kein höheres
    Timeout. Dateinamen der Screenshots bleiben; ihr Inhalt wird gesichtet.
14. **Screenshots und Nachweisdateien (Lehre c).** Ein e2e-Lauf schreibt viele Dateien unter `docs/evidence/` neu.
    Regel: eine Hilfe `apps/web/e2e/support/evidence.ts` schreibt im `http`-Projekt nur für `030` und `031` nach
    `docs/evidence/`, für die gemeinsamen Dateien in das Testausgabeverzeichnis (sonst überschrieben beide Projekte
    dieselben Bilder). Gestaged werden nur ausdrücklich benannte Pfade (`git add docs/evidence/031-http-….png`), nie
    `git add -A` oder `git add .`; alle anderen geänderten Bilder werden vor dem Commit mit `git restore` verworfen und
    der Bericht nennt das. Die `@idp`-Screenshots (H4, H6, H8) entstehen nur in der PR-CI: der Implementierer lädt das
    Artefakt `evidence-031-http` des grünen Laufs (`gh run download`) und committet die drei Dateien in einem
    Doku-Commit mit Lauf-ID im Nachweis.
15. **Aufwand.** Der Umfang (Harness, Keycloak-Modul, CI-Job, Setup-Projekt, neue Datei mit acht Tests, Hilfen in fünf
    Dateien, Teilung 003, Pins) liegt bei rund 3 AStd statt 1,5; der Planeintrag ist angeglichen. Eine weitere
    Teilung lohnt nicht, weil Harness und Suite nur zusammen prüfbar sind.
16. **Lokal ohne Docker.** Lokal gibt es keinen Docker-Daemon, also kein Keycloak. Lokal prüfbar und Pflicht vor dem
    PR: `pnpm gates`; das Projekt `in-process` vollständig; `node … scripts/e2e-http-031.mjs --check`;
    `E2E_HTTP_IDP=none pnpm e2e:http` gegen lokales Postgres: der Dienst startet mit derselben Umgebung (Issuer auf
    einen geschlossenen Loopback-Port, Anmeldung also 503), das Harness lässt `http-setup` aus und das `http`-Projekt
    läuft nur mit `030` und `031` und dort mit `grepInvert: /@idp/`: H1, H2, H3 und die vier Tests aus `030`
    (H4–H8 tragen `@idp` im Titel; die gemeinsamen Dateien brauchen angemeldete Zustände und laufen lokal nur
    `in-process`). Kein Ersatz-IdP (ein zweiter Anbieter wäre eine Attrappe genau der Grenze, die getestet werden soll). Der
    Keycloak-Nachweis ist die PR-CI (wie in 034a/034b).

## Nicht-Ziele

Keine Änderung an Produktcode (`apps/api/src`, `apps/web/src` außer dem einen Unit-Test in `http.test.ts`), am Vertrag,
an `ROLE_PERMISSIONS` oder an Standardwerten der Grenzen. Kein Cross-Origin-Betrieb, keine CORS-Konfiguration, kein
Ersatz-IdP, kein HTTPS-Entwicklungsserver (nur als Rückfall nach Spec-Klärung). Die zehn `in-process`-only-Dateien
werden nicht portiert (Eigentümerfrage 1). Kein SSE (035), keine CSP-Prüfung des Web-Dokuments und kein CSP-Report
(037), kein Deploy, kein Netlify-Build, kein Zeitbudget-Tor bei 800 Fragen (084), keine Lastmessung (071/078), kein
Firefox oder WebKit. Keine Nacharbeit an den übrigen Folgeliste-Punkten (Tabelle unten).

## Folgeliste: Einträge zu 030/031

| Eintrag (`docs/folgeliste.md`) | In 031 | Wie |
|---|---|---|
| 030 · `030-anmeldung.spec.ts` überspringt sich ohne `HV_WEB_MODE=http`; kein HTTP-Build in CI · „in 031 verdrahten“ (HTTP-Modus der e2e-Suite in CI) | ja | Projekt `http` mit HTTP-Build, Datei per `testMatch`, Job `e2e-http`; als erledigt markieren |
| 030 · `http.test.ts` „zwei Aufrufe → verschiedene Idempotenzschlüssel“ nicht geprüft; 401 mitten in der Sitzung nur als Unit-Test | ja | Unit-Test in `apps/web/src/api/http.test.ts`; H6 als e2e; erledigt markieren |
| Nachprüfung e2e · `003-answers-stage.spec.ts:44` > 90 s · teilen oder `test.slow()` | ja | Entscheidung 13; erledigt markieren |
| 029b nit · Keycloak-Image per Tag | nur dieser Teil | Digest-Pin im Modul (Entscheidung 7); `CURRENT_TIMESTAMP` und CLI-Rechenhilfe bleiben offen |
| 027 nit · `postgres:16` per Digest pinnen | nur dieser Teil | beide Jobs; TLS (037) und Owner-Trigger (038) bleiben |
| 033b R1 nit · zweites `actions/upload-artifact@v4` ungepinnt · „mit der nächsten Infra-Scheibe“ | ja | voller Hash v4.6.2; erledigt markieren |
| 030 nit · Auth-Fehlertexte fest `'de'`; `CORPUS_DEMO` im HTTP-Build; `Idempotency-Key` an Logout | nein | Produktcode (Lane web-api), bleibt |
| 080b R1 minor · `STORAGE_KEY` versionieren | nein | Produktcode; H2 und 024 sichern das heutige Verhalten |
| 028 · `lastWriteEtag()` bei gleichzeitigen Anfragen (In-Memory/JSONL) | nein | `http`-Projekt nutzt Postgres und einen Worker; bleibt |
| 027 · `HV_REQUIRE_POSTGRES_TESTS=1` fehlt | nein | Dienst-Tests (Lane service), bleibt |
| 010c/090 e2e-Nits | nein | Dateien laufen nur `in-process`, unverändert |

Neu aufzunehmen (vom Implementierer, eine Zeile): `apps/web/vite.config.ts` · Proxy-Standard `HV_API_ORIGIN`
`http://localhost:3000` passt nicht zum Dienst-Standard `PORT` 8787 · Standard angleichen (das Harness setzt den Wert
ausdrücklich, deshalb kein Teil von 031).

## Bedrohungen, Missbrauchsfall und Test je ID

| ID | Rolle in 031 | Test (Datei) |
|---|---|---|
| T-G1-S-02 | berührt (Nachweis im Browser; Mechanik 029b) | H4 Cookie-Attribute `HttpOnly`, `Secure`, `SameSite=Lax`; H5 Abmelden, altes Cookie 401; H6 Subject-Sperre wirkt ohne Neustart auf die laufende Sitzung (`031-http-betriebsart.spec.ts`) |
| T-G1-S-03 | Teil schließen (HTTP-Build gegen echten Dienst ohne Rollenumschalter) | H1, H4: kein `role-switcher`, kein `demo-reset`; `030-anmeldung.spec.ts` im Projekt `http` |
| T-G1-T-05 | berührt (CSRF im Browser; CORS-Teil 034b) | H5 `X-CSRF-Token` beim Abmelden; H3 keine CORS-Antwort, gleiche Herkunft; gemeinsame Dateien schreiben nur mit Token (sonst 403, Test rot) |
| T-Q-I-01 | berührt (Geheimnisse in CI) | `scripts/e2e-http-031.test.mjs`: Realm und Dienstumgebung aus Zufallswerten, keine Ausgabe eines Geheimnisses (Marker-Werte in stdout/stderr des `--check`-Laufs); Job lädt kein HTML-Protokoll und keine Traces hoch (Review gegen `gates.yml`) |
| T-G2-I-02 | berührt (Zugriffslog ohne Nutzdaten) | Harness-Stufe 6: Zugriffslog nach dem Lauf ohne Fragetext, Redebeitrag, Cookie, Token, Passwort und Actor-ID |

**Missbrauchsfall (SC-06), neu MF-12 „Test-Hintertür im Produktpfad“.** *Ablauf:* um die `http`-Suite grün zu
bekommen, fügt jemand einen Testschalter in Dienst oder Oberfläche ein (Anmeldung überspringen, `HV_E2E_*`-Variable,
Cross-Origin für `http:` außerhalb der Demo, Grenzen im Standard angehoben) oder übernimmt die Test-Umgebung mit
angehobenen Grenzen in Staging. *Verhindert durch:* „Files allowed“ ohne `apps/api/src` und `apps/web/src` (außer
einem Unit-Test); das Harness nutzt nur öffentliche Konfiguration innerhalb der Schema-Bereiche; die Werte stehen nur
im Harness, nicht in `.env.example`. *Erkennung:* Startzeile und stderr werden im Harness wörtlich geprüft (eine
unbekannte Variable erzeugt die Zeile `ignoring unknown variables`, Lauf rot); Reviewer prüft SC-12 über `.github/**`,
`scripts/**`; Staging-Konfiguration gegen die Eigentümer-Checkliste (037). *Signal und Empfänger:* roter Job
`e2e-http` im PR, Empfänger Orchestrator und Reviewer. *Ausnahme:* keine.

## Files allowed

- `docs/slices/031-e2e-http-zwei-betriebsarten.md`
- `apps/web/playwright.config.ts` (drei Projekte, zweiter Eintrag für den Entwicklungsserver, Optionen des HTTP-Projekts)
- `apps/web/e2e/031-http-betriebsart.spec.ts` (neu, H1–H8)
- `apps/web/e2e/http/anmeldung.setup.ts` (neu, Setup-Projekt)
- `apps/web/e2e/support/roles.ts` (neu, Rollenwechsel für beide Projekte)
- `apps/web/e2e/support/evidence.ts` (neu, Nachweispfade je Projekt)
- `apps/web/e2e/support/http-guard.ts` (neu, 429-Wächter)
- `apps/web/e2e/support/node-fs.d.ts` (nur Typen für Kindprozesse, falls H6 sie braucht)
- `apps/web/e2e/abnahme.spec.ts`, `apps/web/e2e/002-speakers-capture.spec.ts`, `apps/web/e2e/021b-koordination.spec.ts`, `apps/web/e2e/021c-rechtsfreigabe.spec.ts`, `apps/web/e2e/080-sprecher-zustand.spec.ts` (nur gemeinsame Rollenwechsel- und Nachweishilfe, ausdrückliches Wiederherstellen von Zustand nach einem Rollenwechsel)
- `apps/web/e2e/030-anmeldung.spec.ts` (nur Selbst-Überspringen entfernen und Nachweishilfe)
- `apps/web/e2e/003-answers-stage.spec.ts` (nur Teilung, Entscheidung 13)
- `apps/web/src/api/http.test.ts` (nur Test „zwei Aufrufe → verschiedene Idempotenzschlüssel“)
- `scripts/e2e-http-031.mjs` (neu), `scripts/e2e-http-031.test.mjs` (neu)
- `scripts/lib/keycloak-ci.mjs` (neu)
- `scripts/keycloak-ci-029b.mjs` (nur Umstellung auf das Modul; Prüfungen und Ausgaben unverändert)
- `.github/workflows/gates.yml` (neuer Job, verschobener Keycloak-Schritt, Digest- und Hash-Pins)
- `package.json` (Wurzel; nur das Skript für den HTTP-Lauf)
- `AGENTS.md` (nur eine Zeile unter „Commands“ für den HTTP-Lauf)
- `docs/agentische-entwicklung-plan.md` (nur eine neue Zeile in Abschnitt 5.3 „Zwei Betriebsarten (e2e)“ mit dem Stand „läuft (CI: End-to-end http project against Hono, Postgres and Keycloak)“)
- `docs/adr/0002-demo-betriebsart-in-process.md` (nur Abschnitt „Ergänzung“: Wortlaut zur gemeinsamen Suite nach Eigentümerfrage 1 und Nachweis; **geschrieben vom Architekten**, nicht vom Implementierer; steht hier, damit dessen Commit auf dem Baubranch das Scheibenumfang-Tor passiert)
- `docs/sicherheit/bedrohungsmodell.md` (nur Nachweisspalte von T-G1-S-02, T-G1-S-03, T-G1-T-05 und neuer Missbrauchsfall MF-12)
- `docs/folgeliste.md` (nur die Einträge der Tabelle oben als erledigt markieren, die neue Zeile zum Proxy-Standard, nicht blockierende Reviewbefunde dieser Scheibe)
- `docs/produktplan-beta.md` (nur Stand-Zeile Etappe B nach dem Merge)
- `docs/evidence/031-*.png` (neu: altes Demo-Protokoll, angemeldet, 401, 412; Namen in Entscheidung 10)

Weitere Dateien sind Scope-Befunde: erst Spec klären, nicht still ausweichen. Insbesondere die Vite-Konfiguration
und jede Datei im Quellcode des Dienstes sind nicht erlaubt (Nicht-Ziele).

## Vor dem Bau prüfen

1. 030, 027 und 034b sind gemergt; auf den dann aktuellen Kopf aufsetzen. 084 ist weiter ungebaut (sonst Entscheidung
   11 gegen dessen Matrix abgleichen).
2. **Secure-Cookie über `http://localhost`:** Wegwerfprobe mit dem gepinnten Chromium (`/opt/pw-browsers/chromium-1194`
   bzw. CI-Installation): ein lokaler Server setzt `Secure; HttpOnly; SameSite=Lax`, `context.cookies()` enthält es.
   Scheitert die Probe: anhalten, Spec klären (Entscheidung 3).
3. Vite-Proxy: reicht zwei `Set-Cookie`-Felder und relative `Location` des Rückrufs unverändert durch; `Host` bleibt
   `localhost:4174` (`changeOrigin` aus); der Rückruf wird vom Dienst angenommen.
4. `/v1/meeting` und die übrigen Aliasrouten, die der HTTP-Client nutzt, finden den einen Jahrgang aus dem Bootstrap;
   der gewählte Bootstrap-Weg füllt die Personentabelle (Sprechernamen sichtbar). `apps/web/src/api/http.ts`
   implementiert jede `HvApi`-Methode, die die fünf gemeinsamen Dateien auslösen.
5. Wer darf Rollen zuordnen: `admin` hat `admin.roles.manage` nicht; 029b ordnet über den Kern mit `SYSTEM_ACTOR`
   zu. Denselben Weg nutzen; der Zuordnungsweg bleibt außerhalb des Dienstes (nur Harness).
6. Lokales Postgres: Owner darf `CREATE DATABASE`, Laufzeitrolle existiert (`TEST_DATABASE_URL`,
   `TEST_RUNTIME_DATABASE_URL`, `HV_DB_RUNTIME_ROLE` wie in 034b).
7. `formatStartLine` gibt ohne Herkünfte und Proxys `cors=none trusted-proxies=none` aus
   (`apps/api/src/config/startLine.ts`); Leerlauf der Sitzung `SESSION_IDLE_MS` = 30 min liegt über der Laufzeit des
   `http`-Projekts (sonst Zustände je Datei neu anlegen).
8. Digests ermitteln (Registry-API über den Proxy; kein Docker nötig): Keycloak 26.7.4 und `postgres:16`; Hash von
   `actions/upload-artifact` v4.6.2 steht bereits in `gates.yml`.
9. Playwright: mehrere `webServer`-Einträge mit eigener `env`, Projektabhängigkeiten, `testMatch` je Projekt; die
   e2e-Dateien werden von `pnpm -r typecheck` erfasst (Typen für `node:child_process` in H6).
10. Die heutige Laufzeit der e2e-Schritte in CI aus einem aktuellen Lauf ablesen (Ausgangswert für Entscheidung 12).

## Tests zuerst und Abnahme

1. Vor der Implementierung rot: `031-http-betriebsart.spec.ts` (H1–H8) und `scripts/e2e-http-031.test.mjs`
   (Realm: 9 Personen, eine Redirect-URI, Adressen `@example.test`; Dienstumgebung: keine der verbotenen Variablen,
   Grenzen aus Entscheidung 5 im Bereich, Pflichtvariablen vollständig; `--check` gibt keinen Marker-Wert aus).
2. Lokal: `pnpm gates` auf sauberem Baucommit grün; Projekt `in-process` vollständig grün; `--check` grün;
   `E2E_HTTP_IDP=none pnpm e2e:http` grün (H1–H3 und `030`). Laufzeiten notieren.
3. PR-CI auf dem letzten Commit: Jobs `gates` und `e2e-http` grün, im Protokoll von `e2e-http` beide Keycloak-Schritte
   (029b und 031) mit PASS; H4–H8 und die fünf gemeinsamen Dateien im Projekt `http` grün. Laufzeiten beider Jobs.
4. Manuelle Sichtung: die vier `031-*.png` und die Bilder der geteilten 003-Tests.
5. ADR-0002-Ergänzung vom Architekten vor dem Merge (siehe Rolle); liegt sie zu Baubeginn nicht vor, baut der
   Implementierer ohne sie, der Merge wartet darauf.
6. Unabhängiges Review in frischem Kontext mit Perspektive Security/Betrieb; Blocker/Major sowie jede Sicherheits- oder
   Datenschutzfrage vor Merge, übrige Befunde in `docs/folgeliste.md`. Jeder Commit nennt „Scheibe 031“ und endet
   `[skip netlify]`. Kein Deploy.

## Nachweise

`pnpm gates`-Schluss; Laufzeiten beider Projekte (lokal und CI); Lauf-ID und Laufzeiten der Jobs `gates` und
`e2e-http`; Testnamen je Bedrohungs-ID; Name der beiden Reset-Banner-Tests; wörtliche Startzeile des Test-Dienstes;
Digests; ADR-0002-Ergänzung mit Nachweis.

## Nachweis

(nach dem Bau ausfüllen)

**Gates-Commit:** `<sha>` (Baucommit „Scheibe 031: …“), `pnpm gates` auf sauberem Baum, Exit 0, Umgebung (Node, pnpm,
Postgres).

Wörtlicher Schluss der Ausgabe von `pnpm gates`:

```
<Schluss einfügen>
```

e2e-Laufzeiten:

| Lauf | Projekt | Tests (bestanden/übersprungen) | Laufzeit |
|---|---|---|---|
| lokal | `in-process` | | |
| lokal, `E2E_HTTP_IDP=none` | `http` (ohne `@idp`) | | |
| PR-CI Lauf `<id>`, Job `gates` | `in-process` | | Job gesamt: |
| PR-CI Lauf `<id>`, Job `e2e-http` | `http-setup` + `http` | | Job gesamt: |

Reset-Banner: `024-ereignis-umschlag.spec.ts` › „024: old demo log requires an explicit reset in German and English“
(`in-process`) und `031-http-betriebsart.spec.ts` › H2 (`http`). Startzeile: `<wörtlich>`. Digests: `<…>`.
Verworfene, neu erzeugte Screenshots: `<Liste>`.

## Bericht (nach Bau ausfüllen)

```
Slice: 031-e2e-http-zwei-betriebsarten
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; e2e-Laufzeiten beider Projekte; PR-CI-Lauf <id> (gates, e2e-http); docs/evidence/031-*.png
Bedrohungs-ID → Test: <je Zeile der Tabelle oben>
Open: zehn Dateien nur in-process (Eigentümerfrage 1); Pflicht-Check e2e-http in den Repository-Einstellungen (Eigentümerfrage 2); Standardgrenzen im Betrieb nicht gemessen (071/078); Folgeliste-Punkte „nein“
Touched: <Dateiliste>
```

## Offene Eigentümerfragen

1. **Umfang „dieselbe e2e-Suite“ (ADR 0002 Ergänzung, Prüfpunkt 1).** Gebaut auf Standard: dienstberührende Szenarien
   in beiden Projekten, zehn Oberflächendateien mit Fehlerinjektion im Browser nur `in-process` (Tabelle in
   Entscheidung 2). Der Architekt fasst den Satz der Ergänzung entsprechend; der Eigentümer bestätigt oder verlangt die
   Portierung (eigene Folgescheibe).
2. **Pflicht-Check.** „Beide Pflicht auf PR“ braucht in den Repository-Einstellungen den Job `e2e-http` neben `gates`
   als erforderlichen Status-Check für PRs auf den Integrationszweig und `main`. Das kann nur der Eigentümer einstellen;
   bis dahin hält der Orchestrator den Merge ohne grünen `e2e-http` von Hand an.

## Review findings

folgt
