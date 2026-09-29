# Scheibe 034a — Grenzen, Timeouts, Sicherheitsheader und Aufräumen der Login-Zustände

**Status:** spec (nach Lesebefund 29.09.2026 nachgebessert)
**Risikoklasse:** hoch · 2 AStd · 27.10.2026 (W5) · Lanes: service, contract, persist, infra, docs-sicherheit, docs-register
**Rolle:** Implementierer-Backend; unabhängiges Review in frischem Kontext mit Perspektive Security/Betrieb, zusätzlich Sicherheits-Checkliste des Reviewers (SC-01, SC-05, SC-06, SC-08, SC-10, SC-11, SP-2, SP-3, SP-4, SP-5, SP-6) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue fachliche Regel, keine neue Regel-ID, keine Änderung an `ROLE_PERMISSIONS` oder der Übergangstabelle; AGENTS.md R4 (Rechte), R6 (Vertrag zuerst), R7 (nur anhängen; betrifft Ereignisse, nicht Login-Zustände), R8 (Zeit aus der injizierten Uhr), R11 (keine echten Daten)
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/034a (Teil 1 der am 29.09.2026 geteilten Scheibe 034); Befund 029b major (`docs/bautage/2026-09-27-29.md`, Tabelle Nachprüfung); `docs/folgeliste.md` Abschnitt „Sicherheit und Datenschutz aus der Nachprüfung“ (021c/takt-016 `maxLength`, 027 Pool-Timeouts, 024 leerer `Idempotency-Key`); Bedrohungsmodell Abschnitt 6 Zeile 034, BF-05, BF-06; Sicherheits-Checkliste SP-2, SC-08; ADR 0013 (Rate-Limit-Zähler flüchtig, nicht im Katalog), ADR 0015 (Vertragsversion); Entscheidungsregister E55 (Patch-Stufe für engere Anfrageschemas); Leitplanken §4, 6.4, 6.5, 6.7
**Depends on:** 033b (muss vor Baubeginn gemergt sein); baut auf dem Integrationsstand nach takt-029 (`ebf0ae2`, gemergt) auf. takt-028 (Domäne `revokeRole.reason` ≤ 500) ist heute nicht gemergt (siehe „Vor dem Bau prüfen“).
**Perspektive:** Security/Betrieb · **Glossar: neue Begriffe:** nein

## Warum geteilt

Der Planeintrag 034 bündelte Grenzen an der Anfragegrenze, Sicherheitsheader, das Konfigurationsschema und die
CORS-Allowlist. Die Nachprüfung vom 29.09.2026 hat drei harte Vorbedingungen ergänzt: anonymes `GET /auth/login`
schreibt je Aufruf eine Zeile in `auth_login_states` ohne Obergrenze und ohne Aufräumen (029b major), `maxLength` für
Freitextfelder im Vertrag (021c/takt-016, takt-028) und Pool-Timeouts (027). Zusammen mit Migration, Vertragsstufe und
Postgres-Tests liegt das über einer Agentenschicht. Getrennt prüfbar sind zwei Flächen: **034a** schützt die
Anfragegrenze (was eine einzelne Anfrage, eine Quelle oder ein Subject höchstens verbrauchen darf, was jede Antwort
trägt); **034b** prüft den Prozessstart (typisiertes Schema, `.env.example`, CORS aus Konfiguration, vertrauenswürdige
Proxys, Verzeichnisrechte). 034a arbeitet mit festen Standardwerten, die `createApp` als Option annimmt; 034b liest
dieselben Werte aus der Umgebung und ändert keinen Standardwert. 035 hängt an 034b, 037 prüft das Schema im Image.
Nach dem Lesebefund ist die Schätzung von 1,5 auf 2 AStd erhöht (503-Abbildung, Zähler für Proben und Preflights,
Lesegrenze, Katalogprüfung der Löschfunktion); eine weitere Teilung wurde verworfen, weil alle Teile in derselben
Middleware-Kette und denselben Tests sitzen.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch (Netzgrenze, Sitzung und Anmeldung, Produktivpersistenz und Migration,
Leitplanken §4). Ausgelöst: Vertrag und Konfiguration; Persistenz, Migration, Nebenläufigkeit; Identität (Anmeldestart);
Betrieb. Perspektive Security/Betrieb. Nachweise siehe „Tests zuerst und Abnahme“. Offene Entscheidung: **E55**
(Patch-Stufe für engere Anfrageschemas, Standard Patch); alle Zahlen unten sind Standard und in 034b konfigurierbar.

## Ziel und Entscheidungen vor Bau

Offene Punkte sind auf Standard gebaut und als solche markiert; eine abweichende Entscheidung des Eigentümers ist
Konfiguration (034b) oder eine Folgescheibe, keine stille Änderung im Bau.

### Feste Zahlen (Standard)

| Größe | Wert | Konfigurierbar ab 034b |
|---|---|---|
| Body-Limit | 262 144 Byte (256 KiB) je Anfrage, alle Methoden mit Body | nein (feste Grenze, eine Erhöhung ist eine Spec-Änderung) |
| Request-Timeout (Dienst) | 10 000 ms je Anfrage | ja, 7 000–60 000 (über dem `/readyz`-Budget von 6 000 ms) |
| Node-HTTP-Server | `headersTimeout` 10 000 ms, `requestTimeout` 30 000 ms | nein |
| Postgres `lock_timeout` | 3 000 ms | ja |
| Postgres `statement_timeout` | 5 000 ms | ja |
| Abfrage-Timer des Dienstes (eigener Timer je Abfrage, `QueryTimeoutError`; `pg`-eigenes `query_timeout` nicht gesetzt) | 6 000 ms (Netzausfall ohne Serverantwort) | ja |
| OIDC-Abruf (Discovery, Token-Austausch) | 5 000 ms je Aufruf | nein |
| Postgres `idle_in_transaction_session_timeout` | 15 000 ms | ja |
| Schreibvorgänge je Subject | 60 je Fenster | ja |
| Lesevorgänge je Subject | 1 200 je Fenster | ja |
| Nicht angemeldete Anfragen je Quelle | 600 je Fenster | ja |
| `GET /auth/login` je Quelle (jeder Aufruf) | 120 je Fenster | ja |
| `GET /auth/login` gesamt (jeder je Quelle zugelassene Aufruf) | 600 je Fenster | ja |
| Proben `/healthz`, `/readyz` je Quelle (eigener Zähler) | 600 je Fenster | ja |
| CORS-Preflights je Quelle (eigener Zähler) | 1 200 je Fenster | ja |
| Fenster | 60 s, feste Fenster nach der injizierten Uhr (`floor(ms / 60 000)`) | nein |
| Schlüssel je Zähler und Fenster | höchstens 10 000, darüber ein gemeinsamer Überlaufschlüssel | nein |
| `Retry-After` bei 429 | ganze Sekunden bis Fensterende, 1–60 | — |
| `Retry-After` bei 503 (Schreibwarteschlange, Statement-Abbruch) | 2 | nein |
| Aufräumen Login-Zustände | höchstens 500 Zeilen je Aufruf | nein |

Reihenfolge der Zeitgrenzen, als Test festgehalten: `lock_timeout` (3 s) < `statement_timeout` (5 s) < Abfrage-Timer
(6 s) < Request-Timeout (10 s) < `idle_in_transaction_session_timeout` (15 s). `/readyz` bleibt mit 3 × 2 000 ms
(`safeCheck`) unter dem Request-Timeout.

**Begründung der Anmelde- und Quellwerte (Verfügbarkeitsabwägung).** Die Grenzen je Quelle sind *fail closed*: ist ein
Kontingent erschöpft, bekommt jede weitere Anfrage dieser Quelle im Fenster 429. Im Betrieb kommen wahrscheinlich
alle Arbeitsplätze über **eine** Firmen-NAT-Adresse; eine Quelle ist dann das ganze Haus. Anmeldespitze am HV-Morgen:
etwa 65 Personen und bis zu 15 Stationen, also ≤ 80 Anmeldungen, verteilt über den Tagesstart; selbst alle in einer
Minute liegen unter 120 je Quelle (Reserve 1,5×), und je Anmeldung entstehen etwa vier nicht angemeldete Anfragen
(`/auth/login`, `/auth/callback`, Transparenzhinweis, erster `/auth/me`) = 320 < 600. Gesamt 600 entspricht fünf
vollen Quellen und begrenzt `auth_login_states` auf etwa 600 × 5 min = 3 000 offene Zeilen. Angemeldete Anfragen
zählen nie gegen die Quelle (Punkt 3), abgelaufene Sitzungen zählen nachträglich; das Web pollt ohne CSRF-Token nicht
weiter (`apps/web/src/api/http.ts:211`), eine abgelaufene Sitzung erzeugt also höchstens eine Handvoll 401. Restrisiko:
ein Innentäter hinter derselben NAT-Adresse kann das Anmeldekontingent des Hauses für jeweils ein Fenster erschöpfen
(MF-10); bestehende Sitzungen (14 h, in Postgres) arbeiten weiter. *Erkennung:* feste stderr-Zeile „sign-in start limit
reached.“; *Reaktion:* Wert über 034b anheben und Dienst neu starten (Sitzungen bleiben), vertrauenswürdige Proxys
setzen (034b), damit interne Adressen getrennt zählen; *Messung:* Anmeldespitze in der Generalprobe (078) und im
Lasttest (071), danach Standard anpassen.

### Entscheidungen

1. **Middleware-Reihenfolge** in `app.ts` (nach 033a; `app.use` in dieser Reihenfolge):
   (1) Zugriffslog/Korrelation/`X-Server-Time` (033a, unverändert äußerste) → (2) Sicherheitsheader → (3) CORS (heute
   nur Demo, 034b aus Konfiguration; beantwortet Preflights nach Prüfung des eigenen Preflight-Zählers und setzt die
   CORS-Header erlaubter Herkünfte auf **jede** Antwort, auch 408, 413, 429, 503) → (4) Request-Timeout →
   (5) Quellschicht: Probenzähler, Anmeldestartzähler, Zähler für nicht angemeldete Anfragen → (6) Body-Limit →
   (7) Akteur und Fehler (bestehend) → (8) Subject-Grenzen (Schreiben, Lesen) → Routen mit `guarded(operationId)`
   (takt-024, unverändert). Damit kostet eine abgewiesene Anfrage weder Sitzungslesung noch Datenbankverbindung noch
   die globale Schreibsperre (`pg_advisory_xact_lock`); ein 413 wird gezählt (Quellschicht liegt vor dem Body-Limit).
   Neuer Code liegt in `apps/api/src/limits/` (reine Zähler mit injizierter Uhr, Middleware-Fabriken); `app.ts`
   verdrahtet nur.
2. **Subject-Grenzen (429).** *Schreiben:* `POST`, `PUT`, `PATCH`, `DELETE` unter `/v1/` mit ermitteltem Akteur, auch
   im Demo-Modus und für künftige Systemakteure (T-G3-D-02); `/auth/logout` ist ausgenommen (Abmelden muss immer
   gehen). *Lesen:* `GET`/`HEAD` unter `/v1/` mit ermitteltem Akteur, 1 200 je Fenster (das Web lädt alle 30 s die
   Ansicht neu, das sind wenige Dutzend Aufrufe je Minute). Schlüssel ist der `subjectHash` aus 033a (HMAC der
   Actor-ID), nie die Actor-ID selbst. Eine Wiederholung mit gleichem `Idempotency-Key` zählt wie jeder
   Schreibvorgang. Die Prüfung liegt vor `guarded`: ein 429 schreibt kein Ereignis und hinterlässt keinen
   Idempotenz-Eintrag. Im Demo-Modus kann eine Person durch wechselnde `X-Actor`-Kennungen neue Zähler erzeugen
   (synthetische Daten, Demo nur lokal; im Bericht nennen).
3. **Quellschicht (429).** *Quelle* ist die Gegenstelle der TCP-Verbindung (`getConnInfo` aus
   `@hono/node-server/conninfo`, Option `sourceOf` in `CreateAppOptions` für Tests; ohne ermittelbare Adresse der
   Schlüssel „unbekannt“). IPv4-gemappte IPv6-Adressen zählen als IPv4, IPv6 wird auf das /64-Präfix gekürzt. Hinter
   einem vertrauenswürdigen Proxy liefert 034b die Auswertung von `X-Forwarded-For`; bis dahin gilt die
   Verbindungsadresse. Drei getrennte Zähler je Quelle, jeweils vor der Auth-Stufe:
   - **Proben:** exakt `/healthz` und `/readyz` zählen nur auf den Probenzähler (Überwachung bleibt unabhängig von
     einer Flut auf anderen Pfaden).
   - **Anmeldestart:** jeder `GET /auth/login` zählt auf den Anmeldestartzähler je Quelle, jeder je Quelle zugelassene Aufruf zusätzlich gesamt (eine schon abgewiesene Quelle verbraucht das Gesamtkontingent der anderen nicht), unabhängig
     von Cookies oder `X-Actor` (die Auth-Stufe überspringt diesen Pfad, `app.ts:333`). Ist einer erschöpft, antwortet
     der Dienst 429, bevor `authorizationUrl` oder `createLoginState` laufen (kein Datenbankzugriff, keine
     IdP-Anfrage).
   - **Nicht angemeldet:** alle übrigen Anfragen. Ohne Anmeldematerial (kein syntaktisch gültiges `hv_session`-Cookie
     laut `sessionTokenFromCookie`, im Demo-Modus kein `X-Actor`) werden sie vor der Auth-Stufe gezählt und bei
     erschöpftem Kontingent mit 429 abgewiesen. **Mit** Anmeldematerial laufen sie in die Auth-Stufe (Arbeitsplätze
     hinter derselben NAT-Adresse bleiben arbeitsfähig); steht danach kein Akteur fest (`subjectHash` null), zählt **jede**
     Antwort (auch 2xx/3xx, 403, 422, 400) nachträglich gegen die Quelle, und **ist das Kontingent der Quelle bereits erschöpft, wird jede Antwort mit
     `status >= 400` (statt 401, 403, 422, 400) durch 429 mit `Retry-After` ersetzt; 2xx und 3xx werden nie überschrieben; das gilt nur für `/auth/callback`: Pfade, die die Sitzung nie lesen (`/auth/transparency-notice`, `/metrics`), zählen unabhängig vom Cookie vorab als nicht angemeldet und werden vorab abgewiesen**
     (der 302 des Callbacks trägt das Sitzungscookie, sonst entstünde eine verwaiste Sitzung) und die Anfrage fällt unter die Protokollausnahme (Punkt 11). Ein gefälschtes,
     syntaktisch gültiges Cookie (`actor.ts:82` nimmt jedes `^[A-Za-z0-9_-]{43,}$`) umgeht die Grenze also nicht mehr;
     es kostet je Anfrage weiter eine Sitzungslesung (Restrisiko, Proxy-Grenze 037). Jede Antwort 413 zählt ebenso gegen die
     Quelle: vor dem Body-Limit (6) steht nie ein Akteur fest, auch nicht bei gefälschtem oder echtem Cookie. **Ist das
     Kontingent der Quelle bereits erschöpft, wird statt 413 ein 429 mit `Retry-After` geantwortet** und die Anfrage fällt
     unter die Protokollausnahme (Punkt 11); das gilt unabhängig vom Anmeldematerial (N1). Ein legitimer Arbeitsplatz
     mit zu großem Body bekommt bei erschöpfter Quelle also 429 statt 413 — beides ohne Wirkung.

   **Datenschutz:** Die Zählerschlüssel sind HMAC-SHA-256 der Quelle mit einem je Prozess zufälligen Schlüssel; die
   Quelle steht nie im Zugriffslog, im Fehlerlog, auf stderr, in `/metrics` oder auf der Platte (ADR 0013: Zähler
   flüchtig, nicht im Auswertungskatalog).
4. **CSRF-Fehlschläge bekannter Subjects.** Ein 403 `R-AUTH-01` entsteht in der Auth-Stufe vor den Subject-Grenzen und
   wird nicht gezählt. Er setzt eine gültige Sitzung ohne CSRF-Token voraus (gestohlenes Cookie) und kostet zwei
   Sitzungslesungen und eine Log-Zeile mit `subjectHash`. Restrisiko, benannt im Bedrohungsmodell (T-G1-D-01) mit Ziel
   037 (Proxy-Grenze); die Zeilen tragen den `subjectHash` und sind damit im Vorfall zuordenbar (Verfahren „nur zu
   zweit“).
5. **Aufräumen der Login-Zustände (Befund 029b).** Die Laufzeitrolle bekommt **kein** DELETE-Recht auf
   `auth_login_states` (bleibt wie in `grantRuntimeAccess` und `assertRuntimePrivileges` geprüft). Stattdessen legt
   eine neue Migration `0003_auth_login_purge` unter der Migrations-/Owner-Rolle an, alles in derselben Transaktion:
   - Funktion `auth_purge_login_states(p_now timestamptz) RETURNS integer`, `LANGUAGE sql SECURITY DEFINER`,
     `SET search_path = pg_catalog, pg_temp`, Tabelle schema-qualifiziert; löscht über eine Unterabfrage
     `SELECT state_hash … WHERE consumed_at IS NOT NULL OR expires_at <= p_now ORDER BY expires_at LIMIT 500
     FOR UPDATE SKIP LOCKED` und gibt die Anzahl zurück;
   - **`REVOKE ALL ON FUNCTION … FROM PUBLIC` in der Up-Migration selbst** (Funktionen sind sonst für PUBLIC
     ausführbar; `grantRuntimeAccess` läuft nur mit gesetzter Laufzeitrolle, `migrations.ts:214-215`);
   - Index auf `expires_at`.

   `grantRuntimeAccess` gibt `EXECUTE` nur an die Laufzeitrolle. Katalogprüfung in `assertSchemaConsistent` (für
   Version 3): `prosecdef = true`, `proconfig` enthält genau `search_path=pg_catalog, pg_temp`, `proowner` gleich
   Eigentümer der Tabelle, `proacl` ohne Eintrag für PUBLIC (`has_function_privilege` unterscheidet PUBLIC nicht von
   der Rolle, daher Prüfung über `aclexplode(proacl)`). `assertRuntimePrivileges` prüft zusätzlich EXECUTE auf genau
   dieser Funktion und weiterhin kein DELETE auf irgendeiner Tabelle; mit `requireTables = false` (Readiness,
   `postgres.ts:61,97,115`) fehlt die Funktion ohne Fehler, damit `/readyz` vor der Migration `migrations_pending`
   meldet statt `db unreachable`. Das EXECUTE auf eine löschende Funktion ist die **benannte Ausnahme** zur Regel „die
   Laufzeitrolle hat nur SELECT/INSERT und die drei Spalten-UPDATEs“ (SC-08); sie steht im Bedrohungsmodell.
   `AuthStore.createLoginState` ruft die Funktion mit dem `now` der injizierten Uhr **vor** dem INSERT auf (R8; kein
   Zeitgeber, kein Hintergrundjob). Ein Fehler beim Aufräumen blockiert die Anmeldung nicht („best effort“): INSERT
   läuft weiter, stderr erhält je Minute höchstens die feste Zeile `HV-Tool API: login state purge failed.`
   **Begründung des Wegs:** R7 gilt dem Ereignislog; Login-Zustände sind kurzlebige technische Einmalwerte
   (5 Minuten, verschlüsselt), deren Löschen keinen Nachweis umschreibt. Die Funktion ist enger als ein Tabellenrecht:
   eine kompromittierte Laufzeitrolle kann nur verbrauchte oder nach ihrem `p_now` abgelaufene Zustände entfernen
   (Restrisiko: ein vorgestelltes `p_now` entfernt laufende Anmeldungen, Folge: erneutes Anmelden). Down-Migration
   entfernt Funktion und Index ohne Datenprüfung (keine Tabelle); `migrations.ts` behandelt Version 3 in `up`, `down`
   und `assertSchemaConsistent`.
6. **Body-Limit 256 KiB (413).** Hono `bodyLimit` (`hono/body-limit`, keine neue Abhängigkeit) mit `maxSize: 262144`
   und eigener Fehlerantwort (Problem 413). Mit `Content-Length` > Grenze sofort 413, ohne den Body zu lesen; ohne
   `Content-Length` (chunked) bricht das Lesen beim ersten Byte über der Grenze ab. Der dabei aus `readJson`
   (`http.ts:12`) geworfene `BodyLimitError` wird auf 413 abgebildet, **ohne** Fehlerlog-Zeile (heute würde er über
   `problem.ts` ein 500 mit Fehlerlog). **Stand nach dem Bau:** `hono@4.13.5` kennt keine `BodyLimitError`-Klasse; sein
   `bodyLimit` liest den Body vorab und ruft `onError` (413-Problem) beim ersten Byte über der Grenze oder bei zu großem
   `Content-Length` selbst auf. Die Abbildung in `http.ts` entfällt; geprüft sind 413 mit und ohne `Content-Length`, ohne
   Fehlerlog-Zeile, und 262 144 Byte werden angenommen. Genau 262 144 Byte werden angenommen.
7. **Request-Timeout (408) ohne Festschreiben.** Eigene Middleware (nicht `hono/timeout`, weil diese den Handler nur
   überholt): ein Zeitgeber je Anfrage; läuft er ab, setzt die Middleware im Anfragekontext (033a,
   `observability/context.ts`) die Phase `timedOut` und antwortet mit Problem 408, **außer** die Phase ist bereits
   `committing` — dann wartet sie auf das Ende des COMMIT (durch `statement_timeout` und den Abfrage-Timer begrenzt) und
   gibt dessen Ergebnis zurück. Wettlauf ausgeschlossen: `postgresBoundary` prüft `timedOut` und setzt `committing`
   **synchron im selben Schritt ohne `await` dazwischen**, unmittelbar bevor sie `INSERT … ; COMMIT` absetzt; der
   Zeitgeber-Rückruf läuft auf derselben Ereignisschleife und sieht entweder `committing` oder setzt `timedOut` vorher.
   Zusätzlich prüft die Grenze `timedOut` direkt nach dem Erhalt der Schreibsperre und nach dem Laden des Snapshots und
   bricht dann früh mit `ROLLBACK` ab. Zusage: **ein 408 bedeutet „nichts festgeschrieben“** im Postgres-Pfad (läuft während des
   Wartens auf das COMMIT der Abfrage-Timer ab, gilt Punkt 8: 500 „Ergebnis unbekannt“, nie 408); ein
   erneuter Versuch mit demselben `Idempotency-Key` führt genau einmal aus. Im JSONL-Entwicklungsadapter und im
   In-Memory-Pfad gilt diese Zusage nicht, ebenso wenig „408 verbraucht keinen Schlüssel“ (dort kann ein Handler nach
   dem 408 fertig werden und anhängen; im Bericht nennen). Das Zugriffslog schreibt genau eine Zeile mit Status 408;
   ein später fertig werdender Handler ändert weder Antwort noch Log-Zeile. **Ausnahmeliste der 408-Stufe:** `/auth/login`,
   `/auth/callback` und `/auth/logout` (Codex P2 auf #71). Sie schreiben über `AuthStore` ohne phasenbewusste
   `postgresBoundary`; ein 408 könnte sonst die Cookie-Antwort verwerfen, während der Callback die Sitzung danach noch
   anlegt (verwaiste Sitzung) oder das Abmelden serverseitig gelingt, ohne dass der Browser das Löschen des Cookies
   erhält. Statt des 408-Timers haben diese Routen feste eigene Obergrenzen: jeder OIDC-Abruf (Discovery,
   `authorizationUrl`, Token-Austausch in `complete`) mit eigenem Timeout von 5 000 ms (Abbruch über `AbortSignal`
   bzw. die Fetch-Option von `openid-client`), Ablauf → 503 „Sign-in is unavailable.“ **bevor** eine Sitzung angelegt
   ist; jede Store-Abfrage läuft über dieselben Postgres-Timeouts und den Abfrage-Timer (Punkt 8), Ablauf → 503.
   Eine einmal begonnene Sitzungsanlage läuft zu Ende und liefert ihr Cookie. Die Obergrenze einer Anmeldeanfrage ist
   damit etwa OIDC 2 × 5 s plus wenige Abfragen à höchstens 6 s. 035 ergänzt `/v1/stream`. Der Node-Server erhält in `server.ts` `headersTimeout` und
   `requestTimeout` (Tabelle) gegen langsam tröpfelnde Header und Bodies. **Benannte Ausnahme** (Codex P2 auf #71):
   diese beiden Grenzen antwortet Node selbst mit einem leeren `408` und `Connection: close`, bevor die Anfrage Hono
   erreicht; diese Antwort trägt keine Sicherheitsheader und erzeugt keine Zugriffslog-Zeile. Gewählt wird die
   Eingrenzung statt eines `clientError`-Handlers, weil sie einfacher ist und nichts verliert: die Antwort hat keinen
   Inhalt, den ein Browser darstellen oder einbetten könnte (Header wie CSP, `nosniff`, Frame-Schutz wirken nur auf
   Inhalt), und für eine nie vollständig empfangene Anfrage gäbe es weder Methode noch `operationId` noch Akteur für
   eine sinnvolle Log-Zeile; ein eigener Handler bräuchte zudem einen Test über einen echten Socket. Restrisiko: eine
   Slowloris-Flut ist im Zugriffslog unsichtbar → Sichtbarkeit und Grenze am Proxy (037). Die Zusagen „jede Antwort
   trägt die Sicherheitsheader“ (Punkt 9) und „jede Anfrage erzeugt eine Log-Zeile“ (Punkt 11) gelten für Antworten
   der Anwendung (Hono). 408 statt 503/504: der Planeintrag und SP-2
   nennen 408, RFC 9110 erlaubt dem Client die Wiederholung, und 503 bleibt der überlasteten Persistenz vorbehalten
   (Punkt 8); der CHANGELOG nennt diese Begründung.
8. **Postgres-Pool-Timeouts und 503.** Die Pool-Optionen entstehen in einer testbaren Funktion unter
   `apps/api/src/limits/` (Werte aus der Tabelle, `connectionTimeoutMillis` 2 000 und TLS wie heute; dazu `keepAlive` und `client_connection_check_interval=1000`, **Mindestversion PostgreSQL 14**: bei älterem Server scheitert jede Verbindung, Betriebsvoraussetzung mit Prüfung in 037/038); `server.ts` nutzt
   sie. `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout` werden als Verbindungsparameter
   gesetzt. Den clientseitigen Abfrage-Timeout setzt der Dienst **selbst** (Codex P1 auf #71): mit `pg@8.23.0`
   (`apps/api/package.json` `^8.23.0`, Lockfile `pg@8.23.0`) meldet sich das `pg`-eigene `query_timeout` als schlichter
   `Error("Query read timeout")` ohne Code und ohne eigene Klasse, und Meldungstexte werden nicht verglichen. Ein
   Wrapper in `postgres.ts` (von der Postgres-Grenze, `loadPostgresSnapshot`, `insertPostgresEvents`, der Readiness und
   den `AuthStore`-Abfragen genutzt) legt je Abfrage einen Timer über 6 000 ms und wirft bei Ablauf einen eigenen,
   getaggten `QueryTimeoutError`; das `pg`-eigene `query_timeout` wird nicht gesetzt. Der Pool der Migrations-CLI bleibt unverändert (DDL darf länger laufen).
   `lock_timeout` trifft auch das Warten auf `pg_advisory_xact_lock` (`app.ts:397`): wartet ein Schreibvorgang länger
   als 3 s auf die globale Schreibsperre, bricht Postgres mit SQLSTATE `55P03` ab. Dieser Fall und der
   Statement-Abbruch `57014` sowie der `QueryTimeoutError` **vor** der Phase `committing` werden auf **503** mit
   `Retry-After: 2` und dem festen Text „Persistence is busy.“ abgebildet (Rollback, kein Ereignis, kein Treibertext;
   T-G2-I-02). Damit die Kennung nicht verloren geht: `loadPostgresSnapshot` (`postgres.ts:174-176`) und
   `insertPostgresEvents` (`postgres.ts:231-233`, `:243-244`) fangen Treiberfehler heute ab und werfen
   `PostgresPersistenceError`; dieser trägt künftig ein Kennzeichen `busy` (gesetzt bei `55P03`, `57014` und
   `QueryTimeoutError`, aus `code` bzw. `instanceof`, nie aus dem Meldungstext), ohne Treibertext (N2).
   **`QueryTimeoutError` während `committing`** (N3): der Zeitgeber ist clientseitig, der Server kann das COMMIT trotzdem
   ausgeführt haben, und das Web vergibt je Aufruf einen neuen Idempotenzschlüssel (`apps/web/src/api/http.ts:74`);
   ein 503 mit der Zusage „kein Ereignis“ könnte also zu doppelten Ereignissen führen. Deshalb: 500 mit dem festen Text
   „Persistence outcome is unknown.“, **ohne** `Retry-After` und ohne Zusage; kein `noteSeq`. Nach jedem
   `QueryTimeoutError` wird die Verbindung mit `client.release(error)` verworfen, nie in den Pool zurückgegeben (die
   hängende Abfrage stirbt mit der Verbindung; ohne empfangenes COMMIT rollt Postgres zurück). Ein
   `57014` während `committing` kann nicht auftreten, ohne dass Postgres das COMMIT abgelehnt hat, bleibt also 503.
   Das bestehende 503 „Migrations are pending.“ (`app.ts:391`) erhält `Retry-After: 30` und dieselbe Vertragsantwort
   (N4). Alle übrigen Persistenzfehler bleiben 500 „Persistence is unavailable.“. 3 s sind gewählt, weil ein Schreibvorgang die Sperre nur
   Millisekunden hält; eine Warteschlange über 3 s ist Überlast, die der Client mit Wiederholung (gleicher
   `Idempotency-Key`) übersteht. Messung im Lasttest (071).
9. **Sicherheitsheader auf jeder Antwort.** Eine Middleware setzt nach `await next()` auf **jede** Antwort (2xx, 3xx,
   4xx, 5xx, `notFound`, `onError`, 408, 413, 429, 503, die von der Postgres-Grenze ersetzte Antwort) genau diese Werte,
   sofern der Header noch fehlt:
   - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: no-referrer`
   - `Cross-Origin-Resource-Policy: same-origin`
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Strict-Transport-Security: max-age=31536000` (ohne `includeSubDomains` und `preload`: der Dienst kennt die
     Nachbardomänen des Eigentümers nicht; Browser werten den Header nur über HTTPS aus)
   - `Cache-Control: no-store` (Entwürfe und Rechtstexte dürfen in keinem Cache liegen; die bestehenden `no-store`
     der Anmeldepfade bleiben unverändert, kein doppelter Header)

   Die CSP gilt den Antworten des Dienstes (JSON, Problem-Details, Weiterleitungen); der Dienst liefert kein HTML. Die
   CSP für das Dokument der Weboberfläche und der CSP-Report im e2e-Lauf gehören zu 037 (Produktions-Build; der
   Vite-Entwicklungsserver der e2e-Suite braucht Inline-Skripte). Keine neue Abhängigkeit; `hono/secure-headers` nur
   mit ausdrücklich gesetzten Werten, sonst eigene Middleware.
10. **Antworten 429, 408, 413, 503.** Problem-Details (RFC 9457) mit passendem `status`, festem `title`/`detail` ohne
    Wert der Grenze oder der Quelle, `instance` wie in 033a, **ohne** `ruleId` (keine fachliche Regel). 429 und 503
    tragen `Retry-After`. CORS erlaubter Herkünfte nimmt `Retry-After` in `exposeHeaders` auf.
11. **Zugriffslog bei Flutung.** Jede Anfrage erzeugt weiter genau eine Zeile (033a), mit einer Ausnahme: nach der
    **ersten** 429-Abweisung eines Quellschlüssels (Proben, Anmeldestart, nicht angemeldet, Preflight, Überlauf) in
    einem Fenster werden weitere 429 **desselben** Schlüssels im selben Fenster nicht einzeln protokolliert. Stattdessen
    schreibt der Dienst je Minute höchstens eine feste stderr-Zeile je Zählerart mit der **Summe** der nicht einzeln
    protokollierten Abweisungen dieser Minute (Aggregat ohne Quelle, ohne Person), z. B.
    `HV-Tool API: anonymous rate limit reached; 1234 repeated rejections not logged individually.` Begründung: ohne
    diese Ausnahme schützt die Grenze die Datenbank, nicht den Log-Datenträger (033a Nicht-Ziel, T-G2-D-04). Relevante
    Zeilen gehen nicht verloren: angemeldete Anfragen, jede erste Abweisung je Schlüssel und Fenster und alle
    Abweisungen je Subject werden protokolliert. Restrisiko: viele verteilte Quellen knapp unter der Schwelle erzeugen
    weiter Zeilen (bis 037: Alarm auf den Füllstand, Proxy-Grenze). Die Schlüsselmenge der Log-Zeile bleibt exakt die
    aus 033a (`v` bleibt 1). Weitere feste stderr-Zeilen, je höchstens eine je Minute, ohne Quelle und Subject:
    `HV-Tool API: write rate limit reached.`, `HV-Tool API: read rate limit reached.`, `HV-Tool API: sign-in start
    limit reached.`, `HV-Tool API: rate limit key table full.`, `HV-Tool API: persistence busy.`
12. **Speichergrenze der Zähler.** Zähler liegen im Prozessspeicher, werden beim Fensterwechsel verworfen und halten je
    Zähler höchstens 10 000 Schlüssel; jeder weitere neue Schlüssel im selben Fenster zählt auf einen gemeinsamen
    Überlaufschlüssel mit derselben Grenze (unter einer Flut aus rotierenden Adressen werden neue Quellen gemeinsam
    gebremst, bekannte behalten ihren Zähler; Verfügbarkeitsfolge: eine neu hinzukommende legitime Quelle teilt dann das
    Überlaufkontingent, benannt in MF-10). Kein persistenter Zähler, keine Kennzahl, kein Eintrag im
    Auswertungskatalog (ADR 0013). Mehrere Prozesse vervielfachen die Grenzen (Beta: ein Prozess, 037).
13. **Vertrag (Patch-Stufe, aktueller Stand + 1 zum Bauzeitpunkt; E55).** Heute 0.3.8; plant 033b eine
    Ausnahmeänderung (0.3.9), wird 034a entsprechend 0.3.10. Inhalt:
    - Header `Retry-After` als `{ type: integer, minimum: 1, maximum: 60 }`, Pflicht an 429 und an `PersistenceBusy`
      (503; deckt „Persistence is busy.“ und „Migrations are pending.“ ab); die bestehende `ServiceUnavailable`-Antwort
      der Operationen ohne Anmeldung bleibt ohne Pflicht-`Retry-After`;
    - Beschreibung der 500-Antwort bzw. `info.description`: „Persistence outcome is unknown.“ bedeutet, dass ein
      Schreibvorgang festgeschrieben sein kann; der Client liest den Stand neu, bevor er erneut schreibt, oder
      wiederholt nur mit demselben `Idempotency-Key`;
    - neue gemeinsame Antworten `TooManyRequests` (429), `RequestTimeout` (408), `PayloadTooLarge` (413) und
      `PersistenceBusy` (503), je mit `X-Server-Time` und Problem-Schema mit `status`-`const`; 408 und 429 an **jeder**
      Operation, 413 an jeder `POST`/`PUT`/`PATCH`-Operation (das Body-Limit gilt jedem Body, auch wo der Vertrag
      keinen `requestBody` kennt), 503 `PersistenceBusy` an jeder Operation unter `/v1`;
    - `info.description`: Absatz „Limits (since <Version>, slice 034a)“ mit Body-Limit, Timeout, den Kontingentarten
      ohne feste Zahl („configurable, defaults in the service“), Sicherheitsheadern und der
      **Doppelklickschutz-Konvention**: ein Client erzeugt je Nutzerabsicht (Tastendruck) genau einen
      `Idempotency-Key`, verwendet ihn bei Wiederholung nach 408, 429, 503, 5xx oder Netzfehler erneut und nie für eine
      zweite Absicht; 429 und 503 verbrauchen keinen Schlüssel, 408 im Dienst mit Postgres ebenfalls nicht;
    - `IdempotencyKey`-Parameter `minLength: 1` (Folgeliste 024; die Domäne lehnt `""` seit 028 mit 422 ab);
    - Längen- und Listengrenzen in Anfrageschemas (Tabelle unten). Die Domäne prüft davon heute nur Kennungen ≤ 128
      und — erst mit takt-028 — `revokeRole.reason` ≤ 500; der Demo-Pfad im Browser validiert nicht gegen den Vertrag
      und nimmt längere Texte weiter an (fachliche Abweichung ohne Sicherheitsfolge, weil die Demo nur lokal läuft;
      Folgeliste: Kernprüfung derselben Grenzen mit 043);
    - `pnpm contract:types`, CHANGELOG-Abschnitt mit „Added“ (Antworten, Konvention, Begründung 408) und „Changed“
      (engere Anfrageschemas ausdrücklich benannt, mit Verweis auf ADR 0015 und die offene Eigentümerfrage E55),
      `package.json`-Version, die festen Versionsaussagen in `contract.test.ts` und `takt-019-contract.test.ts`.

    Ob eine Einschränkung von Anfrageschemas nach ADR 0015 eine Patch-Stufe ist, ist dieselbe offene
    Eigentümerfrage wie bei 0.3.4/0.3.6 (Bautag 27.–29.09.); sie steht jetzt als **E55** im Entscheidungsregister.
    Standard: Patch, weil jede Grenze weit über realen Eingaben liegt und der Dienst bisher unbegrenzt annahm
    (Sicherheitskorrektur, SP-2).

| Feld (Anfrageschema) | Grenze |
|---|---|
| `LegalClearanceRequest.note`, `MeetingContributionCapture.lateEntryReason`, `reason` in `revokeRole`, `returnQuestion`, `withdrawQuestion` | `maxLength: 500` |
| `ContributionCapture.text`, `MeetingContributionCapture.text` | `maxLength: 60000` |
| `QuestionCapture.text` | `maxLength: 4000`; Liste `questions` in `captureQuestions` `maxItems: 200` |
| `AnswerDraft.text` | `maxLength: 20000`; `AnswerDraft.sources` `maxItems: 50`, je Eintrag `maxLength: 2000` |
| `SpeakerRegistration.displayName`, `SpeakerRegistration.organisation`, `MeetingCreate.title`, `MeetingCreate.legalEntity`, `UnitInput.name` | `maxLength: 200` |
| `AgendaItemInput.title` | `maxLength: 500` |
| `StageSeatInput.label` | `maxLength: 100`; `UnitInput.shortName` `maxLength: 32` |
| Kennungen: `ContributionCapture.speakerId`, `MeetingContributionCapture.speakerId`, `Classification.agendaItemId`, `unitId` in `assignQuestion`, `intoQuestionId` in `mergeQuestion`, `MeetingCreate.cloneFromMeetingId`, `AgendaItemInput.id`, `UnitInput.id`, `StageSeatInput.id`, `StageSeatInput.personId`, `StageSeatInput.deviceId`, `RoleAssignmentCreate.personId`, `RoleAssignmentCreate.unitId`, Einträge von `SpeakerOrder.speakerIds` | `maxLength: 128` |
| `SpeakerOrder.speakerIds` | `maxItems: 2000` |
| Listen in `replaceMeetingAgendaItems`, `replaceMeetingUnits`, `replaceMeetingStageSeats` | `maxItems: 200` (Sitze: `maxItems: 50`) |
| Abfrageparameter `FullTextFilter` (`q`) | `maxLength: 200` |

Worst Case: 60 000 Zeichen zu je 4 Byte UTF-8 = 240 000 Byte < 262 144; bei pathologischer JSON-Maskierung greift
das Body-Limit zuerst (413 statt 422, beides ohne Wirkung). Für Operationen, die der Dienst heute nicht bedient
(`createMeeting`, `replaceMeeting*`), werden die Grenzen auf Schemaebene getestet (Ajv-Validator des Anfrageschemas aus
`contractSchema.ts`).

## Nicht-Ziele

Kein Konfigurationsschema, keine `.env.example`, keine Auswertung von `X-Forwarded-For`, keine CORS-Allowlist aus
Konfiguration, keine Prüfung der Verzeichnisrechte (alles 034b). Keine CSP für das Web-Dokument, kein
`netlify.toml`, kein CSP-Report in e2e, keine Grenze an einem vorgeschalteten Proxy, kein Alarm auf die festen
stderr-Zeilen (037). Kein SSE und keine Grenze offener Ströme je Subject (035). Keine Kennzahl und kein Katalogeintrag
für Rate-Limit-Zähler (ADR 0013). Keine neue Regel-ID, keine Rechteänderung, keine Änderung an Ereignissen oder
Übergängen. Keine Längenprüfung im Kern über takt-028 hinaus. Keine neue Abhängigkeit. Keine Oberflächenänderung (die
Weboberfläche zeigt 408/413/429/503 über die bestehende Fehleranzeige; eigene Texte sind eine Folgescheibe der Lane
web-api).

## Bedrohungen, Missbrauchsfall und Test je ID

| ID | Rolle in 034a | Test (Datei) |
|---|---|---|
| T-G1-D-01 | schließen (Rest: Sitzungslesung je gefälschtem Cookie, CSRF-403 bekannter Subjects ungezählt, mehrere Prozesse; Proxy-Grenze 037) | 61. Schreibvorgang desselben Subjects im Fenster → 429 mit `Retry-After` = Rest bis Fensterende (injizierte Uhr, 15 s im Fenster → 45), kein neues Ereignis, kein Idempotenz-Eintrag, nächstes Fenster wieder 201; anderes Subject unberührt; `/auth/logout` nie 429; 1 201. Lesevorgang → 429; 262 145 Byte → 413 mit und ohne `Content-Length`, ohne Fehlerlog-Zeile, 262 144 Byte → kein 413; Text mit 60 001 Zeichen → 422; langsamer Handler → 408; 700 × 413 aus einer Quelle ohne Anmeldung und ebenso mit gefälschtem Cookie → ab Nr. 601 429 und keine weiteren Log-Zeilen (`limits034a.test.ts`); 408 im Postgres-Pfad ohne festgeschriebenes Ereignis, verzögertes COMMIT → 201 statt 408, Abbruch nach Sperrerhalt bei `timedOut` (`postgres-limits034a.test.ts`) |
| T-G1-I-06 | schließen (Anteil Dienst; Web-Dokument 037) | Header-Probe: alle acht Header mit exakten Werten auf 200, 201, 302 (`/auth/login` mit Test-IdP), 401, 404 (`notFound`), 408, 413, 422, 429, 500 (`onError`), 503, `/healthz`, `/readyz`; `Cache-Control` der Anmeldepfade genau einmal `no-store`; 429 einer erlaubten Herkunft trägt `Access-Control-Allow-Origin` und `Retry-After` in `Access-Control-Expose-Headers` (`contract.test.ts`, Block „034a security headers“) |
| **T-G1-D-05 (neu)** | schließen (Rest: Innentäter hinter NAT, MF-10) | 121. `/auth/login` derselben Quelle → 429, auch mit gefälschtem, syntaktisch gültigem `hv_session` und mit `X-Actor`, `createLoginState` nicht aufgerufen (Test-Store zählt); 601. gesamt über viele Quellen → 429 (`limits034a.test.ts`); verbrauchte und abgelaufene Zeilen werden beim nächsten Anmeldestart entfernt, gültige bleiben, höchstens 500 je Aufruf; Laufzeitrolle: `DELETE FROM auth_login_states` → Rechtefehler, `EXECUTE` der Funktion erlaubt; Katalog: `prosecdef`, `proconfig`, `proowner`, keine PUBLIC-ACL auch ohne gesetzte Laufzeitrolle; `assertRuntimePrivileges` schlägt fehl, wenn EXECUTE fehlt oder DELETE vorhanden ist; `/readyz` vor Migration 3 → `migrations_pending`; Aufräumfehler blockiert die Anmeldung nicht (`postgres-limits034a.test.ts`); neue Zeile im Bedrohungsmodell |
| T-G2-D-04 | berührt (Anteil 034a: Quellschicht, Protokollausnahme Punkt 11) | 601. nicht angemeldete Anfrage derselben Quelle → 429; 602.–700. erzeugen **keine** weitere Log-Zeile, genau eine stderr-Zeile je Minute mit der Summe 99; Flut mit gefälschtem Cookie: bis Nr. 600 401, ab Nr. 601 429 mit `Retry-After`, danach keine weiteren Log-Zeilen; Anfrage mit gültiger Sitzung aus derselben Quelle → 200 mit Log-Zeile; 601 × `/healthz` erschöpft nicht das Kontingent für nicht angemeldete Anfragen und umgekehrt; Preflight-Flut erschöpft nur den Preflight-Zähler; keine Log- oder stderr-Zeile enthält die Quelladresse (Marker-Adresse über `sourceOf`) (`limits034a.test.ts`) |
| T-G3-D-02 | berührt | Subject-Grenzen greifen für jeden Akteur unabhängig von der Rolle (zwei Akteure mit verschiedenen Rollen, je eigener Zähler; kein Rollenname im Code, R4) (`limits034a.test.ts`) |
| T-G3-D-01 | berührt | hängende Prüfung (`readiness`-Injektion mit 200 ms, Timeout-Option 50 ms) → 408 statt Warten; langsamer OIDC-Austausch im Callback (Test-IdP verzögert über den Request-Timeout, aber unter dem OIDC-Timeout) → 302 mit Sitzungscookie, **kein** 408, genau eine Sitzung; OIDC-Austausch über dem OIDC-Timeout → 503, **keine** Sitzung angelegt; `/auth/logout` mit langsamem Store → 204, kein 408 (`limits034a.test.ts`) |
| T-G1-T-06 | berührt (CSP am Dienst; Web 037) | CSP-Wert in der Header-Probe (`contract.test.ts`); Zeile im Bedrohungsmodell nennt 037 für den e2e-Report |
| T-G2-I-02 | berührt | Abbruch durch `statement_timeout` (`pg_sleep` über injizierten Testweg) → 503 mit festem Text und `Retry-After: 2`, kein Treibertext in Antwort und Log; `statement_timeout` **während `loadPostgresSnapshot`** → 503 (N2); künstlich hängende Abfrage (`pg_sleep` über dem Abfrage-Timer, Test-Option Abfrage-Timer 200 ms, `statement_timeout` darüber) vor COMMIT → 503 `QueryTimeoutError`, Verbindung verworfen, kein Ereignis; hängendes COMMIT per Test-Hook (Option nur für Tests, die vor `COMMIT` `pg_sleep` einschiebt) → 500 „Persistence outcome is unknown.“ ohne `Retry-After`, Verbindung mit Fehler freigegeben (N3); Migrationen ausstehend → 503 mit `Retry-After: 30` (N4) (`postgres-limits034a.test.ts`) |
| T-G2-D-01 | berührt (Schreibwarteschlange) | Testverbindung hält `pg_advisory_xact_lock(27027, 1)` 4 s, paralleler Schreibvorgang → 503 nach ≤ 3 s + Toleranz, kein Ereignis; nach Freigabe gelingt die Wiederholung mit gleichem `Idempotency-Key` genau einmal (`postgres-limits034a.test.ts`) |
| T-G1-D-03 | berührt (Anteil Rate-Limit; Ströme 035) | durch die Tests zu T-G1-D-01 abgedeckt |

Zähler und Speicher: 10 000 verschiedene Quellen in einem Fenster, die 10 001. teilt den Überlaufschlüssel, feste
stderr-Zeile „key table full“ einmal; nach Fensterwechsel ist die Tabelle leer (`limits034a.test.ts`, reine Funktion
mit injizierter Uhr). Pool-Parameter: `SHOW statement_timeout` = `5s`, `SHOW lock_timeout` = `3s`,
`SHOW idle_in_transaction_session_timeout` = `15s` über den Pool aus der Fabrik, kein `pg`-`query_timeout` in der Client-Konfiguration
(`postgres-limits034a.test.ts`). Grenzen der nicht bedienten Operationen über den Ajv-Validator des Anfrageschemas
(`limits034a.test.ts`).

**Missbrauchsfall (SC-06), neu MF-10 „Flutung ohne Anmeldung“** (Zeile im Bedrohungsmodell Abschnitt 7 legt diese
Scheibe an; verwandt MF-09): Eine Person im internen Netz oder mit Zugang zur Staging-Adresse ruft `GET /auth/login`
und beliebige Pfade in einer Schleife auf, auch mit gefälschten Sitzungscookies. Ohne 034a entsteht je Anmeldestart
eine Datenbankzeile und eine IdP-Weiterleitung, je Anfrage eine Zugriffslog-Zeile; Tabelle und Log-Datenträger laufen
voll, die Anmeldung der Arbeitsplätze am HV-Tag wird langsam. *Verhindert durch:* T-G1-D-05 (Grenzen je Quelle und
gesamt für jeden Anmeldestart, Aufräumen), die Quellschicht vor Auth und Datenbank (429 statt 401 bei erschöpftem
Kontingent), die Protokollausnahme (Punkt 11), 413 und 408. *Verfügbarkeitsfolge, benannt:* dieselbe Person hinter
der Firmen-NAT-Adresse erschöpft das Anmeldekontingent des ganzen Hauses für jeweils ein Fenster; neu hinzukommende
Quellen teilen unter einer Adressflut den Überlaufschlüssel; bestehende Sitzungen arbeiten weiter. *Erkennung:* feste
stderr-Zeilen „anonymous rate limit reached …“ (mit Summe) und „sign-in start limit reached.“ (je Minute höchstens
eine, ohne Quelle und ohne Person) und die erste 429-Zeile je Quelle und Fenster im Zugriffslog (`operationId`,
`status` 429, `subjectHash` null) — Erkennung ohne Kennzahl je Person (ADR 0013). *Reaktion:* Wert über 034b anheben
und neu starten, vertrauenswürdige Proxys setzen (034b), Quelle am Proxy sperren (037). *Signal und Empfänger:* bis
037 liest der technische Betrieb stderr beim Tagesstart und im HV-Fenster; mit 037 alarmiert die Betriebsauswertung
die benannte Beobachterin. *Ausnahme mit Eigentümer und Ablauf:* fehlende Alarmierung, Eigentümer technischer Betrieb,
Ablauf mit Merge von 037, spätestens 30.10.2026. *Messung:* Anmeldespitze in 071 und 078. *Nachweis:* Tests zu
T-G1-D-05 und T-G2-D-04.

Verwandter Fall ohne neue ID: eine gestohlene Sitzung setzt skriptgesteuert Schreibvorgänge ab (MF-02-Nähe). Die
Schreibgrenze bremst auf 60 je Minute; Erkennung über die feste stderr-Zeile „write rate limit reached.“ ohne Subject;
eine Zuordnung zur Person nur über das Verfahren „Auswertung nur zu zweit“ (ADR 0013), nie automatisch.

## Files allowed

- `docs/slices/034a-grenzen-timeouts-sicherheitsheader.md`
- `apps/api/src/app.ts` (Middleware-Reihenfolge, Optionen für Grenzen, Timeout, Quelle; Phasenprüfung und 503-Abbildung in der Postgres-Grenze; Anmeldestart-Grenze; CORS-Header auf Grenzantworten und Retry-After in den exposeHeaders der Demo)
- `apps/api/src/server.ts` (Pool aus der Fabrik, headersTimeout und requestTimeout des Node-Servers, sonst unverändert)
- `apps/api/src/http.ts` (nur Abbildung des BodyLimitError auf 413)
- `apps/api/src/limits/**` (neu: Zähler, Quelle, Middleware für Subject-Grenzen, Quellschicht, Preflight-Zähler, Body-Limit, Timeout, Sicherheitsheader, Pool-Optionen)
- `apps/api/src/observability/context.ts` (nur Phase der Anfrage und Kennzeichen für die Protokollausnahme)
- `apps/api/src/observability/requestLog.ts` (nur die Protokollausnahme aus Punkt 11)
- `apps/api/src/problem.ts` (nur zusätzliche Antwortheader wie Retry-After und 413 ohne Fehlerlog)
- `apps/api/src/contractSchema.ts` (nur Export eines Validators für Anfrageschemas zu Testzwecken)
- `apps/api/src/auth/store.ts` (nur Aufruf der Aufräumfunktion in createLoginState mit stderr-Zeile und Abfragen über den Abfrage-Timer)
- `apps/api/src/auth/oidc.ts` (nur Timeout von 5 000 ms je OIDC-Abruf)
- `apps/api/migrations/0003_auth_login_purge.up.sql`, `apps/api/migrations/0003_auth_login_purge.down.sql` (neu)
- `apps/api/src/persistence/migrations.ts` (Migrationsliste, Down-Zweig und Konsistenz- und Katalogprüfung für Version 3, GRANT EXECUTE in grantRuntimeAccess)
- `apps/api/src/persistence/postgres.ts` (nur die EXECUTE-Prüfung in assertRuntimePrivileges mit requireTables, das Kennzeichen busy an PostgresPersistenceError in loadPostgresSnapshot und insertPostgresEvents ohne Treibertext, und der Abfrage-Wrapper mit QueryTimeoutError)
- `packages/contract/openapi.yaml`, `packages/contract/CHANGELOG.md`, `packages/contract/package.json`, `packages/contract/src/types.ts` (generiert)
- `apps/api/src/__tests__/contract.test.ts` (Versionsaussage, generierte Status um 408/413/429/503 erweitert, Header-Probe)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur die feste Versionsaussage)
- `apps/api/src/__tests__/limits034a.test.ts`, `apps/api/src/__tests__/postgres-limits034a.test.ts` (neu)
- `apps/api/src/__tests__/helpers.ts` (nur falls die Antwortprüfung den Pflichtheader Retry-After als Ganzzahl nicht bereits über den Vertrag prüft)
- `apps/api/src/__tests__/migrations027.test.ts` (nur falls der Auf-/Ab-/Auf-Test mit Version 3 eine feste Annahme ändert; keine Abschwächung)
- `apps/api/src/__tests__/postgres-auth-029b.test.ts` (nur falls die Rechteprüfung der Laufzeitrolle die neue EXECUTE-Ausnahme ausdrücklich erwartet; keine Abschwächung)
- `apps/api/src/__tests__/acceptance.test.ts`, `apps/api/src/__tests__/negative.test.ts`, `apps/api/src/__tests__/idempotency028.test.ts`, `apps/api/src/__tests__/claims028.test.ts`, `apps/api/src/__tests__/person-roles026.test.ts`, `apps/api/src/__tests__/access-log033a.test.ts` (nur eine ausdrückliche Grenzen-Option im createApp-Aufruf, falls ein Test mehr als die Standardgrenze je Akteur in einem Fenster der injizierten Uhr ausführt; Grund im Bericht; jede andere Testdatei ist ein Scope-Befund)
- `.github/workflows/gates.yml` (nur `postgres-limits034a.test.ts` in den Postgres-Schritt aufnehmen)
- `docs/sicherheit/bedrohungsmodell.md` (nur Status, Nachweise und Restrisiken der oben genannten IDs, neue Zeile T-G1-D-05, neuer Missbrauchsfall MF-10, SC-08-Ausnahme EXECUTE, BF-05 und BF-06 (Anteil Dienst), Abschnitt-6-Zeile 034 auf 034a/034b, T-G1-T-06 „e2e-Report 037“)
- `docs/folgeliste.md` (nur: 021c/takt-016 maxLength und 027 Pool-Timeouts als erledigt markieren; nicht blockierende Reviewbefunde ohne Sicherheits- oder Verfügbarkeitsbezug; Punkt „Kernprüfung der Vertragsgrenzen“)
- `docs/entscheidungsregister.md` (nur Status von E55 nach dem Bau)

Weitere Dateien sind Scope-Befunde: erst Spec klären, nicht still ausweichen. Sicherheits- und Verfügbarkeitsbefunde
des Reviews gehen nicht auf die Folgeliste, sondern werden gelöst oder als Restrisiko mit Ziel-Scheibe im
Bedrohungsmodell und unter „Open“ benannt.

## Vor dem Bau prüfen

1. `git log --oneline origin/claude/dax-shareholder-meeting-workflow-0s934z`: Ist 033b gemergt (Pflicht), ist takt-028
   gemergt? takt-029 ist gemergt (`ebf0ae2`, `app.ts` Auth-Middleware für `/auth/me`, 503 im Callback). Auf den dann
   aktuellen Kopf aufsetzen; Zeilenangaben dieser Spec beziehen sich auf `c758fc6`. Ohne takt-028 prüft die Domäne
   `revokeRole.reason` nicht; die Vertragsgrenze gilt am Dienst trotzdem.
2. Vertragsversion: `grep -n "^  version:" packages/contract/openapi.yaml` (heute 0.3.8). Neue Version = aktueller
   Stand + 1 Patch; `packages/contract/scripts/check.mjs` (Version, CHANGELOG) grün.
3. `grep -rn "readiness:\|clockHealth\|requestTimeout" apps/api/src/__tests__`: bestehende Injektionen bleiben gültig.
4. Grenzen gegen die bestehende Suite: `pnpm --filter @hv/api test` einmal mit den Standardgrenzen laufen lassen.
   Fällt ein Test wegen der Subject-Grenzen im Fenster der festen Testuhr, erhält nur dieser `createApp`-Aufruf in einer
   der benannten Dateien eine ausdrückliche höhere Grenze mit Kommentar; keine globale Abschaltung und kein Standard
   „aus“ in `createApp` (der Standard ist „an“, wie der Prozessstart).
5. Tests mit festen Headern oder Zahlen: `auth-029b.test.ts:233` (`Cache-Control` genau `no-store`),
   `platform033a.test.ts:106-108` (`exposeHeaders` mit `toContain`), `access-log033a.test.ts` (exakte Schlüsselmenge,
   „genau eine Zeile je Anfrage“ — die Ausnahme aus Punkt 11 betrifft nur erschöpfte Quellschlüssel),
   `read-rights.test.ts:246-249`, `migrations027.test.ts` (Auf/Ab/Auf), `postgres-auth-029b.test.ts` (Rechte der
   Laufzeitrolle), `postgres027.test.ts` (500 bei Persistenzfehler bleibt für andere Fehler), `contract.test.ts:339-359`
   (generierte Status). Jede nötige Änderung außerhalb der Files allowed ist ein Scope-Befund.
6. `@hono/node-server/conninfo` liefert unter `app.request()` keine Adresse: Tests setzen `sourceOf`; der Standard
   „unbekannt“ darf keinen Test verfälschen, der viele Anfragen ohne Anmeldung sendet (höchstens 600 je Fenster).
7. `pnpm now-check`: Zähler und Timeout rechnen mit der injizierten Uhr; ein Zeitgeber (`setTimeout`) ist erlaubt,
   eine Wanduhr in `apps/api/src/limits/` nicht.
8. Migrationsrolle in CI: ist die Owner-Rolle ein Superuser, läuft die SECURITY-DEFINER-Funktion mit diesen Rechten;
   feste Bedingung, gesetzter `search_path` und die Katalogprüfung begrenzen das. Im Bericht nennen; die Trennung der
   Owner-Rolle vom Superuser ist 037/038.
9. SQLSTATE-Abbildung: `pg` liefert `code` `55P03` (lock_timeout) und `57014` (statement_timeout); der
   eigene Abfrage-Timer wirft `QueryTimeoutError` — alle drei gezielt über `code` bzw. `instanceof` abbilden, keinen
   Meldungstext parsen; `pg`-Version im Lockfile prüfen (heute 8.23.0).
10. `node scripts/slice-scope.mjs` auf dem Baubranch `claude/slice-034a-…` grün.

## Tests zuerst und Abnahme

1. Vor der Implementierung rot: `limits034a.test.ts` (Subject-Grenzen Schreiben und Lesen, Quellschicht mit und ohne
   Anmeldematerial, 429 statt 401 bei erschöpfter Quelle, 700 × 413 mit gefälschtem Cookie → ab Nr. 601 429 ohne
   weitere Log-Zeilen (N1), Anmeldestart je Quelle und gesamt mit gefälschtem Cookie,
   Proben- und Preflight-Zähler getrennt, 413-Zählung, Protokollausnahme mit Summenzeile, keine Quelle in Log und
   stderr, Überlaufschlüssel, 413 mit und ohne `Content-Length` ohne Fehlerlog, 422 für jede Grenze der Tabelle an
   mindestens einem Feld je Zeile, 408, feste stderr-Zeilen höchstens einmal je Minute), Header-Probe in
   `contract.test.ts`, erweiterte generierte Status (408/429 an jeder Operation, 413 an jeder schreibenden, 503 an jeder
   unter `/v1`).
2. Postgres in CI: `postgres-limits034a.test.ts` belegt Pool-Parameter, 408 ohne COMMIT, verzögertes COMMIT → 201,
   `statement_timeout`-Abbruch → 503 ohne Treibertext (auch während `loadPostgresSnapshot`), hängende Abfrage vor und
   hängendes COMMIT während `committing` (503 bzw. 500 „Ergebnis unbekannt“, Verbindung verworfen), Migrationen ausstehend → 503 mit
   `Retry-After: 30`, parallele Schreiber an der gehaltenen Schreibsperre → 503 nach
   ≤ 3 s + Toleranz, Migration 0003 auf/ab/auf, Funktion löscht nur verbrauchte und abgelaufene Zeilen (höchstens 500),
   Katalogprüfung, Laufzeitrolle ohne DELETE, mit EXECUTE, keine PUBLIC-ACL, `assertRuntimePrivileges`-Negativfälle,
   `/readyz` vor Migration 3. Keycloak-Lauf in CI bleibt grün.
3. Operation-Coverage und Vertrags-Tor grün; `pnpm gates` auf sauberem Baucommit grün, wörtlicher Schluss im Bericht;
   vollständige E2E-Suite, soweit ein Browser verfügbar ist (keine Oberflächenänderung, kein Screenshot nötig).
   Manuelle Probe gegen `pnpm --filter @hv/api dev`: `curl -si /healthz` (alle acht Header), 601 × `curl /v1/meeting`
   ohne Anmeldung aus einer Quelle → 429 mit `Retry-After`, `curl -s -X POST --data-binary @<262145 Byte>
   /v1/contributions` → 413; Ausgaben gekürzt im Bericht.
4. Unabhängiges Review in frischem Kontext mit Perspektive Security/Betrieb; Blocker/Major sowie jede Sicherheits-,
   Datenschutz-, Verfügbarkeits- oder Rechtsfrage vor Merge oder als Restrisiko mit Ziel-Scheibe; übrige Befunde in
   `docs/folgeliste.md`. PR-CI auf dem letzten Commit grün. Jeder Commit nennt „Scheibe 034a“ und endet
   `[skip netlify]`. Kein Deploy.

## Nachweise

`pnpm gates`-Schluss, Testnamen je Bedrohungs-ID, `curl`-Ausgaben (Header, 429, 413), Postgres-CI-Schritt mit
`postgres-limits034a.test.ts`, Keycloak-CI-Schritt grün, CHANGELOG-Abschnitt der neuen Vertragsversion.

## Nachweis

**Gates-Commit:** `ce9d50e4aee22a85eb707ce43069a7d044a189b5` (sauberer Baum, `git status` leer). Aufruf:
`CONTRACT_GATE_STRICT=1 pnpm gates` mit `TEST_DATABASE_URL=postgres://hv_owner:…@localhost:5432/hv_s034a`,
`TEST_RUNTIME_DATABASE_URL=postgres://hv_runtime:…@localhost:5432/hv_s034a`, `HV_DB_RUNTIME_ROLE=hv_runtime`
(lokales Postgres 16, Owner-Rolle ist Superuser, Migration 0003 lokal angewendet), Exit 0.
Testsummen: `packages/domain` 14 Dateien / 231 Tests; `apps/web` 13 Dateien / 254 Tests; `apps/api` 32 Dateien /
385 Tests (alle Postgres-Dateien laufen, keine übersprungen; Operation-Coverage: 66 Operationen, 59 geprüft, 7 im
Allowlist); Skripttests 234 / 234; `slice-scope`: 32 geänderte Dateien, alle in „Files allowed“ (37 Muster).

Wörtlicher Schluss der Ausgabe (gekürzt um die Vite-Dateiliste):

```
packages/contract test: contract gate: packages/contract/openapi.yaml (info.version 0.3.10, 66 operations)
packages/contract test:   ok    (a) info.version 0.3.10 = package.json version
packages/contract test:   ok    (b) CHANGELOG.md has a section for 0.3.10
packages/contract test:   ok    (c) openapi.yaml changed against merge base 115c28b; version 0.3.9 -> 0.3.10
packages/contract test:   ok    (d) allowlist.json well-formed, 7 pre-declared operation(s), none expired (today 2026-09-29)
packages/contract test: contract gate: ok
packages/domain test:  Test Files  14 passed (14)
packages/domain test:       Tests  231 passed (231)
apps/web test:  Test Files  13 passed (13)
apps/web test:       Tests  254 passed (254)
apps/api test:  Test Files  32 passed (32)
apps/api test:       Tests  385 passed (385)
apps/api test: operation-coverage: 66 operations in the contract, 59 exercised by tests, 7 pre-declared in allowlist.json
apps/api test: operation-coverage: ok — every operationId is exercised by a test or pre-declared in the allowlist.
slice-scope: 32 changed file(s), all within "docs/slices/034a-grenzen-timeouts-sicherheitsheader.md"'s "Files allowed" list (37 pattern(s)).
metrics-allowlist: 6 metrics, all within the allowlist.
plan-graph: ok.
# tests 234
# pass 234
# fail 0
✓ built in 2.35s
mark-test-run: wrote /home/user/wt/s034a/.claude/state/last-test-run (clean tree) at commit ce9d50e, tree a770d572a6e2…
exit 0
```

**Bedrohungs-ID → Test** (alle Dateien unter `apps/api/src/__tests__/`):

| ID | Test |
|---|---|
| T-G1-D-01 | `limits034a.test.ts › limits per subject` (61. Schreibvorgang → 429, `Retry-After` 45, kein Ereignis, Schlüssel nicht verbraucht, nächstes Fenster 201; 1 201. Lesevorgang), `› body limit 256 KiB` (262 145 Byte mit und ohne `Content-Length`, ohne Fehlerlog; 262 144 kein 413; 60 001 Zeichen → 422), `› request timeout (408)`, `› sources without a session … › counts a request 413 …` (700 × 413 ohne Anmeldung) und `› sign-in start and requests with forged session material › a 413 with a forged cookie`, `› length and list limits …` (eine Zeile der Tabelle je Grenze); `postgres-limits034a.test.ts › 408 in the Postgres path`, `› a COMMIT that is already on its way wins over the timer` |
| T-G1-I-06 | `contract.test.ts › 034a security headers` (acht Header mit Werten auf 200, 201, 302, 400, 401, 404, 408, 413, 422, 429, 500, 503; `no-store` einmal; CORS und `Retry-After` in `exposeHeaders` auf 429) |
| T-G1-D-05 | `limits034a.test.ts › sign-in start and requests with forged session material › answers the 121st /auth/login …`, `› … 601st sign-in start over many sources`; `postgres-limits034a.test.ts › migration 0003 and the purge of login states` (Aufräumfunktion, Katalog, Laufzeitrolle, `assertRuntimePrivileges`, `/readyz` vor Migration 3, Aufräumfehler) |
| T-G2-D-04 | `limits034a.test.ts › sources without a session … › answers request 601 …` (Summenzeile 99), `› a flood with a forged cookie`, `› a request with a valid session stays possible …`, `› keeps a source separate for probes …`, `› … CORS preflight …`, `› never writes the source into a log line …` |
| T-G3-D-02 | `limits034a.test.ts › limits per subject › counts per subject, independent of the role` |
| T-G3-D-01 | `limits034a.test.ts › request timeout (408)` (hängende Prüfung → 408), `› sign-in paths keep their own upper bounds` (302 statt 408, 503 ohne Sitzung, Logout 204) |
| T-G1-T-06 | CSP-Wert in `contract.test.ts › 034a security headers` |
| T-G2-I-02 | `postgres-limits034a.test.ts › statement_timeout answers 503 …`, `› … while the snapshot is loaded …`, `› a query that hangs past the service timer before the COMMIT …`, `› a COMMIT phase that hangs … outcome unknown`, `› migrations pending …`, `› the sign-in store runs under the query timer` |
| T-G2-D-01 | `postgres-limits034a.test.ts › a write that waits longer than lock_timeout … (T-G2-D-01)` |
| T-G1-D-03 | durch die Tests zu T-G1-D-01 abgedeckt |
| Zähler, Pool | `limits034a.test.ts › window counters`, `› source of a request`, `› fixed values and the order of the time limits`; `postgres-limits034a.test.ts › the pool from the factory carries …` |

**Manuelle Probe** gegen `HV_DEMO=1 tsx src/server.ts` (echte TCP-Quelle, gekürzt): `curl -si /healthz` → `200`
mit `cache-control: no-store`, `content-security-policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
`cross-origin-opener-policy`, `cross-origin-resource-policy`, `referrer-policy: no-referrer`,
`strict-transport-security: max-age=31536000`, `x-content-type-options: nosniff`, `x-frame-options: DENY`;
`POST /v1/contributions` mit 262 145 Byte → `HTTP/1.1 413 Payload Too Large` (alle Header), mit 262 144 Byte → 422;
600 × `GET /v1/meeting` ohne Anmeldung, dann der nächste → `HTTP/1.1 429 Too Many Requests` mit `retry-after: 50`.

## Bericht

```
Slice: 034a-grenzen-timeouts-sicherheitsheader
Done: Vertrag 0.3.10 (408/413/429/503 und `Retry-After`, Längengrenzen der Anfrageschemas, E55 Standard Patch); Migration 0003
      (`auth_purge_login_states`, Katalog- und EXECUTE-Prüfung); Grenzschicht in `apps/api/src/limits/` (Zähler mit injizierter
      Uhr, Subject- und Quellgrenzen, Protokollausnahme, Body-Limit, Request-Timeout, Sicherheitsheader, Pool-Optionen,
      Abfrage-Timer, 503/500-Abbildung, OIDC-Frist); Bedrohungsmodell mit T-G1-D-05 und MF-10.
Evidence: Gates-Commit ce9d50e (siehe „Nachweis“); Postgres-Schritt in `gates.yml` um `postgres-limits034a.test.ts` erweitert
Open (Restrisiken mit Ziel): Betriebsvoraussetzung PostgreSQL ≥ 14 (037/038); Node-eigene 408 aus headersTimeout/requestTimeout ohne Sicherheitsheader und ohne Log-Zeile (Slowloris im Log unsichtbar) → Proxy 037; Sitzungslesung je gefälschtem Cookie und ungezählte CSRF-403 bekannter Subjects → Proxy-Grenze 037; Innentäter hinter NAT erschöpft das Anmeldekontingent des Hauses (MF-10) → Messung 071/078, Konfiguration 034b; verteilte Quellen unter der Schwelle füllen das Log → Alarm 037; mehrere Prozesse vervielfachen die Grenzen → 037; 408-Zusage und „408 verbraucht keinen Schlüssel“ nur im Postgres-Pfad; Demo: wechselnde X-Actor-Kennungen erzeugen neue Zähler; Alarm auf die festen stderr-Zeilen 037 (Ausnahme bis 30.10.2026); CSP des Web-Dokuments und e2e-Report 037; Kernprüfung der Vertragsgrenzen (Folgeliste 043); E55 Patch-Stufe (Eigentümer); Owner-Rolle in der lokalen und CI-Umgebung ist Superuser (die SECURITY-DEFINER-Funktion läuft mit deren Rechten, Trennung 037/038); ein durch den Abfrage-Timer zerstörter Anschluss kann die globale Schreibsperre bis zum Ende seiner Anweisung halten (höchstens `statement_timeout`, 5 s) und lässt in dieser Zeit weitere Schreibvorgänge mit 503 antworten; die Vorprüfungen (`getMigrationStatus`, `assertRuntimePrivileges`) laufen unter dem Zeitgeber, ohne dass ihr Anschluss verworfen wird.
Abweichung von der Spec: `hono@4.13.5` kennt keine `BodyLimitError`-Klasse; sein `bodyLimit` liest den Body vorab und ruft `onError` beim ersten Byte über der Grenze auf. Die Abbildung in `http.ts` entfällt deshalb (Datei unverändert); das Verhalten (413 mit und ohne `Content-Length`, ohne Fehlerlog, 262 144 Byte angenommen) ist getestet.
Touched: siehe `git diff --stat 115c28b..HEAD`; keine Datei außerhalb „Files allowed“ (slice-scope grün); `http.ts`, `contractSchema.ts`, `migrations027.test.ts`, `postgres-auth-029b.test.ts` und die Testdateien mit möglicher Grenzen-Option blieben unverändert.
```

## Nachweis nach dem Review

**Gates-Commit:** `ab4098a` (sauberer Baum), `CONTRACT_GATE_STRICT=1 pnpm gates` mit den Postgres-Variablen, Exit 0.
Summen: `packages/domain` 231 Tests, `apps/web` 254 Tests, `apps/api` 32 Dateien / 394 Tests, Skripttests 234 / 234,
`slice-scope` 33 Dateien in „Files allowed“.

```
packages/domain test:       Tests  231 passed (231)
apps/web test:       Tests  254 passed (254)
apps/api test:  Test Files  32 passed (32)
apps/api test:       Tests  394 passed (394)
slice-scope: 33 changed file(s), all within "docs/slices/034a-grenzen-timeouts-sicherheitsheader.md"'s "Files allowed" list (37 pattern(s)).
# pass 234
# fail 0
✓ built in 2.03s
mark-test-run: wrote /home/user/wt/s034a/.claude/state/last-test-run (clean tree) at commit ab4098a
exit 0
```

**e2e** (`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium E2E_PORT=4410 pnpm --filter @hv/web e2e -- --timeout=240000`, Exit 0):

```
  ✓  129 [chromium] › e2e/abnahme.spec.ts:88:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (1.0m)
  4 skipped
  127 passed (8.5m)
exit 0
```

**Review-Befunde:**

| Befund | Stand |
|---|---|
| Blocker: Nachzählen nur bei 401/413 | erledigt: jede Antwort ohne Subject zählt, ab erschöpfter Quelle ersetzt 429 jede Antwort ab Status 400, 2xx/3xx nie; Tests für Logout 422/403, Callback 400, Transparenzhinweis 200, Callback-302 (`limits034a.test.ts`, vorher rot); Bedrohungsmodell T-G2-D-04, MF-10 korrigiert |
| Major: Gesamtzähler zählt abgewiesene Aufrufe | erledigt: nur je Quelle zugelassene Aufrufe zählen gesamt; Test Quelle A 700 Aufrufe, Quelle B 302 (vorher rot); Spec-Wortlaut angepasst |
| Minor: Vorprüfungen/Readiness verwerfen Anschluss nicht | erledigt: `withQueryTimers` (Zeitgeber je Abfrage, `release(error)`), `keepAlive: true`; Test mit hängendem Client |
| Minor: zerstörter Anschluss hält die Schreibsperre | Restrisiko in T-G2-D-01 (Ziel 071/037) und `client_connection_check_interval=1000` gesetzt, im Pool-Test geprüft |
| Minor: abgelaufene Anfrage vor Anschluss und Sperre | erledigt: Frühabbruch vor `pool.connect()` und vor der Sperre; Test (kein `pg_advisory_xact_lock`, kein `BEGIN` im SQL-Mitschnitt; per Mutation geprüft) |
| Minor: Preflight-429 ohne CORS-Header | erledigt: Header der erlaubten Herkunft über `cors`; Test |
| Nachweis e2e | erledigt (oben); PR-CI trägt der Koordinator nach |
| Nit: Entscheidung 6 (`bodyLimit` statt `BodyLimitError`) | erledigt: in Entscheidung 6 festgehalten |
| Nit: `headersTimeout` und Prüfintervall | erledigt: `connectionsCheckingInterval` 5 s über `serverOptions` (wirksam 10 bis 15 s), im Slowloris-Restrisiko (037) benannt |

## Nachweis nach der Nachprüfung

**Gates-Commit:** `cdc3d91` (sauberer Baum), `CONTRACT_GATE_STRICT=1 pnpm gates` mit den Postgres-Variablen, Exit 0.

```
packages/domain test:       Tests  231 passed (231)
apps/web test:       Tests  254 passed (254)
apps/api test:  Test Files  32 passed (32)
apps/api test:       Tests  395 passed (395)
slice-scope: 33 changed file(s), all within "docs/slices/034a-grenzen-timeouts-sicherheitsheader.md"'s "Files allowed" list (37 pattern(s)).
# pass 234
# fail 0
mark-test-run: wrote .claude/state/last-test-run (clean tree) at commit cdc3d91
exit 0
```

| Befund | Stand |
|---|---|
| N1 Blocker: 56 fremde Screenshots in `docs/evidence/` | erledigt: `docs/evidence/` auf 951a905 zurückgesetzt, `slice-scope` grün; künftig nach e2e nur gezielt gestaged |
| N2 Major: `/auth/transparency-notice` mit gefälschtem Cookie blieb bei erschöpfter Quelle 200 | erledigt: `/auth/transparency-notice` und `/metrics` (Pfade ohne Sitzungslesung) zählen cookieunabhängig vorab; nur `/auth/callback` behält „nachzählen, 2xx/3xx nie ersetzen“; Test (rot, dann grün): 429 ab Nr. 6, keine weitere Einzelzeile; Metrics-Tests (033b) grün; Bedrohungsmodell T-G2-D-04 und MF-10 nachgezogen |
| N3 Minor: PostgreSQL ≥ 14 | erledigt: Betriebsvoraussetzung in Entscheidung 8, unter „Open“ und im Bedrohungsmodell (T-G2-D-01), Prüfung 037/038 |
| Optional: `assertRuntimePrivileges` verlor die Ursache | erledigt: `busy`/`queryTimeout` bleiben erhalten (503 statt 500); Test |
| e2e | nicht erneut gelaufen: keine Oberflächenwirkung |

## Lesebefund vor dem Bau

Lesebefund in frischem Kontext (Opus, 29.09.2026): kein Blocker, 8 major, 15 minor, einige nits; alle in dieser Fassung
eingearbeitet. Major: Anmeldestartzähler zählt jeden Aufruf unabhängig von Cookies (M1); gefälschte Cookies bei
erschöpfter Quelle → 429 statt 401 mit Protokollausnahme, Rest-Sitzungslesung als Restrisiko 037 (M2); Quellschicht vor
dem Body-Limit, 413 wird gezählt (M3); `REVOKE … FROM PUBLIC` in der Migration selbst, Katalogprüfung, Readiness mit
`requireTables = false` (M4); Verfügbarkeitsabwägung der Anmelde- und Quellwerte mit Erkennung, Reaktion und Messung,
Werte auf 120/600/600 angehoben (M5); `55P03`/`57014` → 503 mit `Retry-After` im Vertrag und Test mit parallelen
Schreibern (M6); vertrauenswürdige Proxys nach CIDR (M7, 034b); Preflights mit eigenem Zähler, CORS-Header auf
Grenzantworten (M8). Minor: Abhängigkeitsangaben (m1), synchroner Wettlaufschutz beim COMMIT (m2), `BodyLimitError`
→ 413 ohne Fehlerlog, 413 an jeder schreibenden Operation (m3), `Retry-After` als Ganzzahl (m4), Schemaebene für nicht
bediente Operationen (m5), Summenzeile (m6), Checkliste SC-01/SC-08/SC-11 (m7), CHANGELOG und Registerzeile E55 (m8),
Testdateien einzeln (m9), eigener Probenzähler (m10), Lesegrenze 1 200 (m11), `query_timeout` (m12), Timeout-Minimum
7 000 (m13, 034b), Startzeile und `HV_DEMO=0` (m14, 034b), CSRF-403 als Restrisiko (m15). Nits: `FOR UPDATE SKIP
LOCKED`, Begründung 408, Schlüsselzusage nur im Postgres-Pfad, Demo-`X-Actor`-Rotation, Schätzung auf 2 AStd.

Enge Nachprüfung (Opus, 29.09.2026): M1, M2, M4, M5, M7, M8 gelöst; nachgebessert: 413 bei erschöpfter Quelle → 429
auch mit Cookie (N1, Punkt 3); Kennzeichen `busy` an `PostgresPersistenceError`, damit 57014/`query_timeout` aus
Snapshot und Insert 503 werden (N2, Punkt 8); `query_timeout` während `committing` → 500 „Ergebnis unbekannt“,
Verbindung verworfen (N3, Punkte 7, 8, Vertrag); „Migrations are pending.“ mit `Retry-After: 30` (N4).

Codex auf #71: eigener Abfrage-Timer mit `QueryTimeoutError` statt `pg`-`query_timeout`, weil `pg@8.23.0` dort nur
`Error("Query read timeout")` ohne Code wirft (P1, Punkt 8); `/auth/login`, `/auth/callback`, `/auth/logout` von der
408-Stufe ausgenommen, mit OIDC-Timeout 5 000 ms und Postgres-Timeouts als eigenen Obergrenzen (P2, Punkt 7);
Node-eigene 408 aus `headersTimeout`/`requestTimeout` als benannte Ausnahme ohne Header und Log-Zeile, Restrisiko 037
(P2, Punkt 7).

## Review findings

folgt
